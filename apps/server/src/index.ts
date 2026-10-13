// ShieldQuest server: one Node process serving the API, live squad sessions (Socket.IO)
// and, in production, the built PWA. Sized for a single small instance (see docs/DEPLOY.md).

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { GAME, MISSIONS } from '@shieldquest/shared';
import { purgeAssessmentResponses, registerAssessmentRoutes } from './assess/routes';
import { registerErrorHandling } from './errors';
import { registerPortalRoutes } from './portal/routes';
import { purgeStaleSaveCards, registerSaveRoutes } from './save/routes';
import { registerSquad } from './squad/server';

// Railway does not set NODE_ENV. Without this a deployed server would accept the portal's development passcode
// and expose development-only routes.
if (!process.env.NODE_ENV && (process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_ENVIRONMENT)) {
  process.env.NODE_ENV = 'production';
}

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const WEB_DIST = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'dist');

const app = Fastify({
  // Privacy: never log IP addresses, user agents or request bodies.
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    serializers: {
      req: (req) => ({ method: req.method, url: req.url.split('?')[0] }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  },
  bodyLimit: 64 * 1024,
  trustProxy: true,
});

await app.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') ?? true });

// Before any route: Fastify routes keep the error handler that was set when they were added.
// API errors always answer { error, statusCode, message }; failed page requests get a fallback HTML page.
const SPA = existsSync(WEB_DIST);
registerErrorHandling(app, { spa: SPA });

app.get('/api/health', async () => ({ ok: true, game: GAME.name, missions: MISSIONS.length }));

await registerPortalRoutes(app);
await registerAssessmentRoutes(app);
await registerSaveRoutes(app);
// REST routes for sessions + Socket.IO attached to app.server (must happen before listen).
await registerSquad(app);

// Production: serve the built PWA with SPA fallback (dev uses Vite on :5173 instead).
if (SPA) await app.register(fastifyStatic, { root: WEB_DIST, wildcard: false });

// Retention (GDD §11.15): assessment responses are deleted 90 days after the final report. That date is set by
// the team as ASSESSMENT_PURGE_DATE (YYYY-MM-DD); from then on every stored response is removed.
const purgeDate = Date.parse(process.env.ASSESSMENT_PURGE_DATE ?? '');
if (Number.isFinite(purgeDate)) {
  const sweep = async () => {
    if (Date.now() < purgeDate) return;
    const removed = await purgeAssessmentResponses(new Date());
    if (removed) app.log.info({ removed }, 'assessment retention purge');
  };
  const timer = setInterval(() => void sweep().catch((err) => app.log.error(err, 'assessment purge failed')), 6 * 3_600_000);
  timer.unref();
  app.addHook('onClose', async () => clearInterval(timer));
  void sweep().catch((err) => app.log.error(err, 'assessment purge failed'));
}

// Retention: Save Cards (encrypted progress blobs) not updated for 180 days are deleted.
{
  const sweep = async () => {
    const removed = await purgeStaleSaveCards(new Date());
    if (removed) app.log.info({ removed }, 'save card retention purge');
  };
  const timer = setInterval(() => void sweep().catch((err) => app.log.error(err, 'save card purge failed')), 6 * 3_600_000);
  timer.unref();
  app.addHook('onClose', async () => clearInterval(timer));
  void sweep().catch((err) => app.log.error(err, 'save card purge failed'));
}

await app.listen({ port: PORT, host: HOST });

// Graceful stop (Railway sends SIGTERM on redeploy): app.close() runs the squad server's shutdown, which writes a
// crash snapshot for every live session so a restart mid-class resumes paused instead of losing the room.
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    app.log.info({ signal }, 'shutting down');
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    app
      .close()
      .then(() => process.exit(0))
      .catch((err) => {
        app.log.error(err, 'shutdown failed');
        process.exit(1);
      });
  });
}
