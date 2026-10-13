// Calibration API: pre/post/return responses keyed by a random pseudonymous code (GDD §7.6, §11).
//
// Privacy rules enforced here:
// - Responses live only in their own collection ('assessment-responses'), never next to gameplay data.
// - Any string (or long number) that looks like personal data rejects the whole request: nothing is stored.
// - Time is stored rounded down to the hour; IP addresses and user agents are never read or stored.
// - The summary is aggregate only, with every cell under 5 people suppressed (shared summarise()).
//
// The summary route will sit behind the portal's educator sign-in; the portal can also call
// getAssessmentSummary() directly.

import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import {
  ASSESSMENT_KINDS,
  assessmentResponseId,
  buildAssessmentResponse,
  findPersonalData,
  isAssessmentCode,
  isRoomCode,
  makeAssessmentCode,
  normalizeAssessmentCode,
  normalizeRoomCode,
  summarise,
  type AssessmentResponse,
  type AssessmentSubmission,
  type AssessmentSummary,
  type BandId,
} from '@shieldquest/shared';
import { collection } from '../store';
import { SubmissionBody, SummaryQuery } from './schemas';

export const ASSESSMENT_COLLECTION = 'assessment-responses';

/** Hard cap for a submission body (GDD §11.29: 16 KB per message). */
const BODY_LIMIT = 16 * 1024;

const responses = () => collection<AssessmentResponse>(ASSESSMENT_COLLECTION);

export interface AssessmentSummaryFilter {
  /** Squad room code of a workshop session (e.g. "H7KQ2M"). */
  sessionCode?: string;
  band?: BandId;
}

/**
 * Aggregated KPI summary for the portal and analytics dashboard (n >= 5 suppression applied).
 * With a sessionCode, Return visits that arrived without the session link are followed by their code.
 */
export async function getAssessmentSummary(filter: AssessmentSummaryFilter = {}): Promise<AssessmentSummary> {
  const all = await responses().list();
  let picked = all;
  if (filter.sessionCode !== undefined) {
    const session = normalizeRoomCode(filter.sessionCode);
    if (!isRoomCode(session)) return summarise([]);
    const people = new Set(all.filter((r) => r.sessionCode === session).map((r) => r.code));
    picked = all.filter((r) => r.sessionCode === session || (!r.sessionCode && people.has(r.code)));
  }
  if (filter.band) picked = picked.filter((r) => r.band === filter.band);
  return summarise(picked);
}

/** Retention (GDD §11.15): deletes responses created before `before`. Returns how many were removed. */
export async function purgeAssessmentResponses(before: Date): Promise<number> {
  const store = responses();
  const old = await store.list((r) => Date.parse(r.createdAtHour) < before.getTime());
  for (const r of old) await store.remove(r.id);
  return old.length;
}

/** Names of personal-data patterns found anywhere in an untrusted payload (keys and long numbers included). */
export function personalDataIn(payload: unknown): string[] {
  const found = new Set<string>();
  const walk = (v: unknown, depth: number) => {
    if (depth > 8) return;
    if (typeof v === 'string') for (const name of findPersonalData(v)) found.add(name);
    else if (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) >= 1e6) {
      for (const name of findPersonalData(String(Math.trunc(Math.abs(v))))) found.add(name);
    } else if (Array.isArray(v)) for (const x of v) walk(x, depth + 1);
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        walk(k, depth + 1);
        walk(x, depth + 1);
      }
    }
  };
  walk(payload, 0);
  return [...found];
}

export interface AssessmentRouteOptions {
  now?: () => number;
  /** Per client address; a whole class usually shares one school NAT address. */
  submitPerMinute?: number;
  /**
   * Serve the unauthenticated GET /api/assessments/summary. Off in production: educators use the signed-in
   * GET /api/portal/assessment-summary instead. Default: on outside production (development and tests).
   */
  publicSummary?: boolean;
}

export async function registerAssessmentRoutes(app: FastifyInstance, opts: AssessmentRouteOptions = {}): Promise<void> {
  const now = opts.now ?? Date.now;
  // Codes handed out but not yet used, so two phones can never be given the same one.
  const issued = new Set<string>();
  const remember = (code: string) => {
    issued.add(code);
    if (issued.size > 20_000) for (const old of [...issued].slice(0, 2_000)) issued.delete(old);
  };

  async function freshCode(): Promise<string> {
    const store = responses();
    for (let attempt = 0; attempt < 40; attempt++) {
      const code = makeAssessmentCode();
      if (issued.has(code)) continue;
      const taken = await Promise.all(ASSESSMENT_KINDS.map((k) => store.get(assessmentResponseId(code, k))));
      if (taken.some(Boolean)) continue;
      remember(code);
      return code;
    }
    return makeAssessmentCode();
  }

  await app.register(async (scope) => {
    if (!scope.hasDecorator('rateLimit')) await scope.register(rateLimit, { global: false });

    // A fresh, unused code from the server's cryptographic RNG. The device falls back to its own when offline.
    scope.post(
      '/api/assessments/codes',
      { logLevel: 'warn', bodyLimit: 1024, config: { rateLimit: { max: 240, timeWindow: '1 minute' } } },
      async (_req, reply) => {
        void reply.header('cache-control', 'no-store');
        return reply.code(201).send({ code: await freshCode() });
      },
    );

    scope.post(
      '/api/assessments',
      {
        logLevel: 'warn',
        bodyLimit: BODY_LIMIT,
        config: { rateLimit: { max: opts.submitPerMinute ?? 240, timeWindow: '1 minute' } },
      },
      async (req, reply) => {
        void reply.header('cache-control', 'no-store');
        // Personal data first, on the raw body, so it is refused even inside fields zod would strip.
        const pii = personalDataIn(req.body);
        if (pii.length) {
          return reply.code(422).send({
            error: 'personal-data',
            message: `Please remove personal details (${pii.join(', ')}). ShieldQuest never needs them.`,
          });
        }
        const parsed = SubmissionBody.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'bad-request', message: 'That response could not be read.' });
        const body = parsed.data;
        const code = normalizeAssessmentCode(body.code);
        if (!isAssessmentCode(code)) {
          return reply.code(400).send({ error: 'bad-code', message: 'That code does not look right. Codes look like KAYA-7K2.' });
        }
        const session = body.sessionCode === undefined ? '' : normalizeRoomCode(body.sessionCode);
        const submission: AssessmentSubmission = {
          code,
          kind: body.kind,
          band: body.band,
          // zod has checked the shape; cleanAnswers() inside buildAssessmentResponse narrows each answer to the form.
          answers: body.answers as AssessmentSubmission['answers'],
        };
        // A malformed session tag is dropped rather than losing the person's answers.
        if (isRoomCode(session)) submission.sessionCode = session;
        const { response, dropped } = buildAssessmentResponse(submission, now());
        await responses().put(response);
        issued.delete(code);
        return reply.code(201).send({ ok: true, id: response.id, dropped });
      },
    );

    if (!(opts.publicSummary ?? process.env.NODE_ENV !== 'production')) return;
    scope.get(
      '/api/assessments/summary',
      { logLevel: 'warn', config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
      async (req, reply) => {
        void reply.header('cache-control', 'no-store');
        const q = SummaryQuery.safeParse(req.query);
        if (!q.success) return reply.code(400).send({ error: 'bad-request', message: 'Unknown filter.' });
        const filter: AssessmentSummaryFilter = {};
        if (q.data.sessionCode) filter.sessionCode = q.data.sessionCode;
        if (q.data.band) filter.band = q.data.band;
        return getAssessmentSummary(filter);
      },
    );
  });
}
