// Youth-made Moment Cards ("Pitch a Frame", GDD §7.4): public, rate-limited submission with the
// personal-data guard on the server (the same rules the form runs on the device), a status lookup by
// ticket, and the educator moderation queue. Approving a card creates a clearly marked draft mission.
//
// Privacy: no IP addresses, names or exact times are stored (hour only). Contributors are never asked
// about their own experiences. Returned cards are deleted 30 days after the decision (GDD §11.15).

import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, preHandlerAsyncHookHandler } from 'fastify';
import { z } from 'zod';
import { BANDS, DISTRICTS, SQUAD_TOTEMS, TACTICS, findPersonalData, lintFreeText, toHourIso } from '@shieldquest/shared';
import { personalDataIn } from '../assess/routes';
import { collection } from '../store';
import { audit } from './audit';
import { createDraft, customMissions } from './missions';
import {
  PITCH_LIMITS,
  PITCH_PUSHERS,
  PITCH_RECOVERY_MOVES,
  PITCH_RED_FLAGS,
  PITCH_SAFER_MOVES,
  PITCH_SETTINGS,
  RETURN_REASONS,
  SUBMISSION_STATUS_TEXT,
  checkPitch,
  isInitials,
  missionFromPitch,
  normalizeInitials,
  youthCredit,
  type MakerCode,
  type PitchInput,
  type SubmissionCreated,
  type SubmissionRecord,
  type SubmissionStatusView,
  type SubmissionView,
} from './model';

export const SUBMISSION_COLLECTION = 'submissions';
export const MAKER_CODE_COLLECTION = 'maker-codes';
const RETURNED_TTL_MS = 30 * 24 * 3_600_000;
const MAKER_CODE_TTL_MS = 60 * 24 * 3_600_000;
const MAX_PENDING = 2_000;
/** No 0/O/1/I/L, so codes survive being read aloud and copied by hand. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const submissions = () => collection<SubmissionRecord>(SUBMISSION_COLLECTION);
const makerCodes = () => collection<MakerCode>(MAKER_CODE_COLLECTION);

function randomCode(length: number): string {
  const bytes = randomBytes(length * 2);
  let out = '';
  // Rejection sampling keeps every character equally likely.
  for (let i = 0; i < bytes.length && out.length < length; i++) {
    const b = bytes[i] ?? 0;
    if (b < 248) out += ALPHABET[b % ALPHABET.length];
  }
  return out.length === length ? out : randomCode(length);
}

/** "MC-7K2Q-9HXD". */
export function normalizeTicket(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = s.startsWith('MC') ? s.slice(2) : s;
  if (body.length !== 8 || [...body].some((c) => !ALPHABET.includes(c))) return null;
  return `MC-${body.slice(0, 4)}-${body.slice(4)}`;
}

/** "MK-7K2Q9H". */
export function normalizeMakerCode(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = s.startsWith('MK') ? s.slice(2) : s;
  if (body.length !== 6 || [...body].some((c) => !ALPHABET.includes(c))) return null;
  return `MK-${body}`;
}

const ids = <T extends { id: string }>(list: readonly T[]) => list.map((x) => x.id) as [T['id'], ...T['id'][]];

const PitchBody = z.object({
  band: z.enum(ids(BANDS)),
  district: z.enum(ids(DISTRICTS)),
  setting: z.enum(ids(PITCH_SETTINGS)),
  pusher: z.enum(ids(PITCH_PUSHERS)).optional(),
  pressureTactics: z.array(z.enum(ids(TACTICS))).min(1).max(PITCH_LIMITS.tactics),
  whatTheySay: z.string().max(PITCH_LIMITS.whatTheySay + 40),
  redFlags: z.object({
    chips: z.array(z.enum(ids(PITCH_RED_FLAGS))).min(1).max(PITCH_LIMITS.redFlags),
    text: z.string().max(PITCH_LIMITS.short + 40).optional(),
  }),
  saferMove: z.object({
    chip: z.enum(ids(PITCH_SAFER_MOVES)).optional(),
    text: z.string().max(PITCH_LIMITS.short + 40).optional(),
  }),
  recoveryMove: z.enum(ids(PITCH_RECOVERY_MOVES)).optional(),
  totem: z.enum(ids(SQUAD_TOTEMS)).optional(),
  makerCode: z.string().max(20).optional(),
  consent: z.literal(true),
});

const DecisionBody = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().max(40).optional(),
  note: z.string().max(PITCH_LIMITS.note + 40).optional(),
  initials: z.string().max(12).optional(),
});

const MakerCodeBody = z.object({ label: z.string().min(1).max(PITCH_LIMITS.cohort), days: z.number().int().min(1).max(180).optional() });

const bad = (reply: FastifyReply, code: number, error: string, message: string, extra: Record<string, unknown> = {}) =>
  reply.code(code).send({ error, message, ...extra });

const view = ({ ticket: _ticket, ...rest }: SubmissionRecord): SubmissionView => rest;

export interface SubmissionRouteOptions {
  now: () => number;
  auth: preHandlerAsyncHookHandler;
  requireMakerCode: boolean;
  submitPerMinute: number;
}

/** Deletes returned cards 30 days after the decision. Returns how many were removed. */
export async function purgeReturnedSubmissions(nowMs: number): Promise<number> {
  const store = submissions();
  const old = await store.list((s) => s.status === 'rejected' && !!s.decision && Date.parse(s.decision.at) < nowMs - RETURNED_TTL_MS);
  for (const s of old) await store.remove(s.id);
  return old.length;
}

export function registerSubmissionRoutes(app: FastifyInstance, opts: SubmissionRouteOptions): void {
  const { now, auth } = opts;

  async function validMakerCode(raw: string): Promise<MakerCode | null> {
    const code = normalizeMakerCode(raw);
    if (!code) return null;
    const found = await makerCodes().get(code);
    if (!found || found.revoked || Date.parse(found.expiresAt) <= now()) return null;
    return found;
  }

  app.get('/api/submissions/config', async (_req, reply) => {
    void reply.header('cache-control', 'no-store');
    return { makerCodeRequired: opts.requireMakerCode };
  });

  app.post(
    '/api/submissions',
    { logLevel: 'warn', bodyLimit: 8 * 1024, config: { rateLimit: { max: opts.submitPerMinute, timeWindow: '1 minute' } } },
    async (req, reply) => {
      void reply.header('cache-control', 'no-store');
      // Personal data first, on the raw body, so it is refused even in fields the schema would drop.
      const pii = personalDataIn(req.body);
      if (pii.length) {
        return bad(reply, 422, 'personal-data', `Please take out the ${pii.join(', ')}. Fictional only, no real people or places.`, {
          problems: pii.map((name) => ({ field: 'form', level: 'error', message: `Please remove the ${name}.` })),
        });
      }
      const parsed = PitchBody.safeParse(req.body);
      if (!parsed.success) return bad(reply, 400, 'bad-request', 'Some answers are missing. Check each step and try again.');
      const { makerCode, consent: _consent, ...pitch } = parsed.data;
      const input: PitchInput = parsed.data;
      const problems = checkPitch(input);
      const errors = problems.filter((p) => p.level === 'error');
      if (errors.length) {
        const personal = errors.some((p) => /remove the|made-up school/i.test(p.message));
        return bad(
          reply,
          422,
          personal ? 'personal-data' : 'not-allowed',
          personal
            ? 'Please take out anything real, like names, numbers or schools. Fictional only, no real people or places.'
            : errors[0]?.message ?? 'Please check your answers.',
          { problems },
        );
      }
      let cohort: string | undefined;
      if (makerCode?.trim()) {
        const found = await validMakerCode(makerCode);
        if (!found) return bad(reply, 403, 'bad-maker-code', 'That maker code did not work. Check the code on your take-home card.');
        cohort = found.label;
      } else if (opts.requireMakerCode) {
        return bad(reply, 403, 'maker-code-required', 'Add the maker code from your take-home card to send your idea.');
      }
      const store = submissions();
      const pending = await store.list((s) => s.status === 'pending');
      if (pending.length >= MAX_PENDING) return bad(reply, 503, 'busy', 'Lots of ideas are waiting to be read. Please try again another day.');
      const record: SubmissionRecord = {
        id: randomUUID(),
        ticket: normalizeTicket(randomCode(8)) ?? `MC-${randomCode(4)}-${randomCode(4)}`,
        createdAtHour: toHourIso(now()),
        pitch: {
          ...pitch,
          whatTheySay: pitch.whatTheySay.trim(),
          redFlags: { chips: [...new Set(pitch.redFlags.chips)], ...(pitch.redFlags.text?.trim() ? { text: pitch.redFlags.text.trim() } : {}) },
          saferMove: {
            ...(pitch.saferMove.chip ? { chip: pitch.saferMove.chip } : {}),
            ...(pitch.saferMove.text?.trim() ? { text: pitch.saferMove.text.trim() } : {}),
          },
          pressureTactics: [...new Set(pitch.pressureTactics)],
        },
        warnings: problems.filter((p) => p.level === 'warning').map((p) => p.message),
        status: 'pending',
      };
      if (cohort) record.cohort = cohort;
      await store.put(record);
      const out: SubmissionCreated = { ok: true, ticket: record.ticket, status: record.status, warnings: record.warnings };
      return reply.code(201).send(out);
    },
  );

  app.get(
    '/api/submissions/:ticket',
    { logLevel: 'warn', config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (req, reply) => {
      void reply.header('cache-control', 'no-store');
      const raw = (req.params as { ticket?: string }).ticket ?? '';
      const ticket = normalizeTicket(raw);
      if (!ticket) return bad(reply, 400, 'bad-ticket', 'Ticket codes look like MC-7K2Q-9HXD.');
      const [found] = await submissions().list((s) => s.ticket === ticket);
      if (!found) return bad(reply, 404, 'not-found', 'We could not find that ticket. Returned ideas are cleared after 30 days.');
      const reason = found.status === 'rejected' ? (RETURN_REASONS.find((r) => r.id === found.decision?.reason)?.label ?? null) : null;
      const out: SubmissionStatusView = { ticket, status: found.status, statusText: SUBMISSION_STATUS_TEXT[found.status], reason };
      return out;
    },
  );

  app.get('/api/submissions', { preHandler: auth }, async (req, reply) => {
    void reply.header('cache-control', 'no-store');
    await purgeReturnedSubmissions(now());
    const status = (req.query as { status?: string } | undefined)?.status;
    const list = await submissions().list((s) => !status || status === 'all' || s.status === status);
    list.sort((a, b) => (a.status === b.status ? b.createdAtHour.localeCompare(a.createdAtHour) : a.status === 'pending' ? -1 : 1));
    return { submissions: list.map(view) };
  });

  app.post('/api/submissions/:id/decision', { preHandler: auth, bodyLimit: 4096 }, async (req, reply) => {
    void reply.header('cache-control', 'no-store');
    const id = (req.params as { id?: string }).id ?? '';
    const sub = await submissions().get(id);
    if (!sub) return bad(reply, 404, 'not-found', 'That Moment Card is no longer in the queue.');
    if (sub.status !== 'pending') return bad(reply, 409, 'already-decided', 'Someone has already decided on this card.');
    const b = DecisionBody.safeParse(req.body);
    if (!b.success) return bad(reply, 400, 'bad-request', 'Choose approve or return.');
    const initials = normalizeInitials(b.data.initials ?? req.educator?.initials ?? '');
    if (!isInitials(initials)) return bad(reply, 400, 'bad-initials', 'Add your initials (1-4 letters, e.g. FT). Never a full name.');
    const note = b.data.note?.trim() ?? '';
    if (note && (findPersonalData(note).length || lintFreeText(note).some((i) => i.level === 'error'))) {
      return bad(reply, 422, 'personal-data', 'Please keep personal details out of the note.');
    }
    if (note.length > PITCH_LIMITS.note) return bad(reply, 400, 'bad-request', `Keep the note under ${PITCH_LIMITS.note} characters.`);
    const reason = b.data.reason ? RETURN_REASONS.find((r) => r.id === b.data.reason)?.id : undefined;
    if (b.data.decision === 'reject' && !reason) return bad(reply, 400, 'needs-reason', 'Pick a reason so the young person knows why.');
    const t = now();
    sub.decision = { at: new Date(t).toISOString(), initials, ...(reason ? { reason } : {}), ...(note ? { note } : {}) };
    if (b.data.decision === 'reject') {
      sub.status = 'rejected';
      await submissions().put(sub);
      await audit('submission.return', sub.id, initials, reason ?? null, t);
      return { submission: view(sub), missionId: null };
    }
    // Approve: a clearly marked draft on the nearest set, to be built out and signed off by the team.
    const base = `youth-${sub.pitch.district.split('-')[0]}-${sub.id.slice(0, 6)}`;
    let missionId = base;
    for (let i = 2; await customMissions().get(missionId); i++) missionId = `${base}-${i}`;
    const credit = youthCredit(sub.pitch.totem, sub.cohort);
    await createDraft(missionFromPitch(sub, missionId), { now: t, by: initials, origin: { kind: 'youth', submissionId: sub.id, credit } });
    sub.status = 'approved';
    sub.decision.missionId = missionId;
    await submissions().put(sub);
    await audit('submission.approve', sub.id, initials, `draft ${missionId}`, t);
    return { submission: view(sub), missionId };
  });

  // Maker codes: one per cohort, printed on the take-home card. The label becomes the credit line.
  app.get('/api/portal/maker-codes', { preHandler: auth }, async (_req, reply) => {
    void reply.header('cache-control', 'no-store');
    const list = await makerCodes().list();
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { codes: list, required: opts.requireMakerCode };
  });

  app.post('/api/portal/maker-codes', { preHandler: auth, bodyLimit: 1024 }, async (req, reply) => {
    void reply.header('cache-control', 'no-store');
    const b = MakerCodeBody.safeParse(req.body);
    if (!b.success) return bad(reply, 400, 'bad-request', `Give the cohort a short label (up to ${PITCH_LIMITS.cohort} characters).`);
    const label = b.data.label.trim().replace(/\s+/g, ' ');
    if (!label || findPersonalData(label).length || lintFreeText(label).some((i) => i.level === 'error')) {
      return bad(reply, 422, 'personal-data', 'Use a cohort label like "NYP Pilot 1", without personal details.');
    }
    const t = now();
    let id = `MK-${randomCode(6)}`;
    while (await makerCodes().get(id)) id = `MK-${randomCode(6)}`;
    const code: MakerCode = {
      id,
      label,
      createdAt: new Date(t).toISOString(),
      expiresAt: new Date(t + (b.data.days ? b.data.days * 24 * 3_600_000 : MAKER_CODE_TTL_MS)).toISOString(),
      revoked: false,
    };
    await makerCodes().put(code);
    await audit('makercode.create', id, req.educator?.initials ?? null, label, t);
    return reply.code(201).send(code);
  });

  app.post('/api/portal/maker-codes/:code/revoke', { preHandler: auth, bodyLimit: 1024 }, async (req, reply) => {
    void reply.header('cache-control', 'no-store');
    const code = normalizeMakerCode((req.params as { code?: string }).code ?? '');
    const found = code ? await makerCodes().get(code) : undefined;
    if (!found) return bad(reply, 404, 'not-found', 'No such maker code.');
    found.revoked = true;
    await makerCodes().put(found);
    await audit('makercode.revoke', found.id, req.educator?.initials ?? null, found.label, now());
    return found;
  });
}
