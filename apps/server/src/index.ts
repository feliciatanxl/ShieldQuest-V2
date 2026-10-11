// ShieldQuest server: one Node process serving the API, live squad sessions (Socket.IO)
// and, in production, the built PWA. Sized for a single small instance (see docs/DEPLOY.md).

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { GAME, MISSIONS } from '@shieldquest/shared';
import { registerAssessmentRoutes } from './assess/routes';
import { registerPortalRoutes } from './portal/routes';
import { registerSquad } from './squad/server';

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

app.get('/api/health', async () => ({ ok: true, game: GAME.name, missions: MISSIONS.length }));

await registerPortalRoutes(app);
await registerAssessmentRoutes(app);
// REST routes for sessions + Socket.IO attached to app.server (must happen before listen).
await registerSquad(app);

// Production: serve the built PWA with SPA fallback (dev uses Vite on :5173 instead).
if (existsSync(WEB_DIST)) {
  await app.register(fastifyStatic, { root: WEB_DIST, wildcard: false });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/socket.io')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });
}

await app.listen({ port: PORT, host: HOST });
