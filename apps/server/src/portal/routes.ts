// Scenario Management Portal API (GDD §7.4, §7.5, §9.6, §11):
// - educator sign-in by shared passcode (no personal accounts), 8-hour bearer sessions in memory;
// - custom missions: drafts, two-person sign-off, publish per band (missions.ts);
// - youth-made Moment Cards: public submission + status, moderation queue, maker codes (submissions.ts);
// - aggregated analytics with n >= 5 suppression and CSV export (analytics.ts);
// - a moderation log of every educator action (audit.ts).

import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { z } from 'zod';
import { getAssessmentSummary } from '../assess/routes';
import { recentAudit } from './audit';
import { SessionStore, bearerToken, passcodeMatches, requireEducator, resolvePasscode } from './auth';
import { buildAnalytics, normalizeFilter, reportToCsv } from './analytics';
import { registerMissionRoutes } from './missions';
import { isInitials, normalizeInitials, type LoginResponse } from './model';
import { purgeReturnedSubmissions, registerSubmissionRoutes } from './submissions';

export interface PortalRouteOptions {
  now?: () => number;
  /** Overrides env PORTAL_PASSCODE (tests). */
  passcode?: string;
  /** Overrides env SUBMISSIONS_REQUIRE_MAKER_CODE=1. */
  requireMakerCode?: boolean;
  loginPerMinute?: number;
  submitPerMinute?: number;
}

const LoginBody = z.object({ passcode: z.string().min(1).max(200), initials: z.string().max(12).optional() });
const AnalyticsQuery = z.object({
  band: z.string().max(20).optional(),
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
});

export async function registerPortalRoutes(app: FastifyInstance, opts: PortalRouteOptions = {}): Promise<void> {
  const now = opts.now ?? Date.now;
  const config = resolvePasscode(app.log, opts.passcode);
  const sessions = new SessionStore(now);
  const auth = requireEducator(sessions) as preHandlerAsyncHookHandler;

  await app.register(async (scope) => {
    if (!scope.hasDecorator('rateLimit')) await scope.register(rateLimit, { global: false });

    scope.post(
      '/api/portal/login',
      { logLevel: 'warn', bodyLimit: 2048, config: { rateLimit: { max: opts.loginPerMinute ?? 10, timeWindow: '1 minute' } } },
      async (req, reply) => {
        void reply.header('cache-control', 'no-store');
        if (!config.passcode) {
          return reply.code(503).send({ error: 'portal-disabled', message: 'Portal sign-in is switched off on this server (no passcode is set).' });
        }
        const b = LoginBody.safeParse(req.body);
        if (!b.success) return reply.code(400).send({ error: 'bad-request', message: 'Enter the portal passcode.' });
        let initials: string | null = null;
        if (b.data.initials?.trim()) {
          initials = normalizeInitials(b.data.initials);
          if (!isInitials(initials)) {
            return reply.code(400).send({ error: 'bad-initials', message: 'Initials only (1-4 letters, e.g. FT). Never a full name.' });
          }
        }
        if (!passcodeMatches(b.data.passcode, config.passcode)) {
          return reply.code(401).send({ error: 'wrong-passcode', message: 'That passcode did not work.' });
        }
        const { token, session } = sessions.create(initials);
        const out: LoginResponse = { token, expiresAt: new Date(session.expiresAt).toISOString(), initials, devPasscode: config.dev };
        return out;
      },
    );

    scope.post('/api/portal/logout', { preHandler: auth }, async (req, reply) => {
      const token = bearerToken(req);
      if (token) sessions.revoke(token);
      return reply.code(204).send();
    });

    scope.get('/api/portal/me', { preHandler: auth }, async (req, reply) => {
      void reply.header('cache-control', 'no-store');
      return { ok: true, initials: req.educator?.initials ?? null, expiresAt: new Date(req.educator?.expiresAt ?? now()).toISOString() };
    });

    scope.get('/api/portal/audit', { preHandler: auth }, async (_req, reply) => {
      void reply.header('cache-control', 'no-store');
      return { entries: await recentAudit(100) };
    });

    registerMissionRoutes(scope, { now, auth });
    registerSubmissionRoutes(scope, {
      now,
      auth,
      requireMakerCode: opts.requireMakerCode ?? process.env.SUBMISSIONS_REQUIRE_MAKER_CODE === '1',
      submitPerMinute: opts.submitPerMinute ?? 60,
    });

    scope.get('/api/analytics', { preHandler: auth }, async (req, reply) => {
      void reply.header('cache-control', 'no-store');
      const q = AnalyticsQuery.safeParse(req.query ?? {});
      if (!q.success) return reply.code(400).send({ error: 'bad-request', message: 'Unknown filter.' });
      return buildAnalytics(normalizeFilter(q.data), now());
    });

    scope.get('/api/analytics.csv', { preHandler: auth }, async (req, reply) => {
      const q = AnalyticsQuery.safeParse(req.query ?? {});
      if (!q.success) return reply.code(400).send({ error: 'bad-request', message: 'Unknown filter.' });
      const report = await buildAnalytics(normalizeFilter(q.data), now());
      return reply
        .header('cache-control', 'no-store')
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="shieldquest-analytics-${report.generatedAt.slice(0, 10)}.csv"`)
        .send(reportToCsv(report));
    });

    // Educator-only alias of the Calibration summary (the public route is slated to move behind sign-in).
    scope.get('/api/portal/assessment-summary', { preHandler: auth }, async (req, reply) => {
      void reply.header('cache-control', 'no-store');
      const q = req.query as { sessionCode?: string; band?: string } | undefined;
      const band = q?.band === 'junior' || q?.band === 'teen' || q?.band === 'young-adult' ? q.band : undefined;
      return getAssessmentSummary({ ...(q?.sessionCode ? { sessionCode: q.sessionCode } : {}), ...(band ? { band } : {}) });
    });
  });

  // Retention sweep (GDD §11.15): returned Moment Cards go 30 days after the decision.
  const sweep = setInterval(() => void purgeReturnedSubmissions(now()).catch(() => undefined), 6 * 3_600_000);
  sweep.unref();
  app.addHook('onClose', async () => clearInterval(sweep));
}
