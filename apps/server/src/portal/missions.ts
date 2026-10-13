// Custom missions (collection 'custom-missions'): save drafts, two-person sign-off, publish per band.
// The game can load published custom missions from GET /api/missions/published.

import type { FastifyInstance, FastifyReply, preHandlerAsyncHookHandler } from 'fastify';
import { z } from 'zod';
import { BANDS, type BandId, type Mission } from '@shieldquest/shared';
import { collection } from '../store';
import { audit } from './audit';
import {
  SIGNOFF_ROLES,
  checkMission,
  contentKey,
  missionTactics,
  isInitials,
  isIsoDate,
  normalizeInitials,
  type CustomMissionDetail,
  type CustomMissionDoc,
  type CustomMissionSummary,
  type CustomStatus,
  type PublishedMission,
  type Signoff,
} from './model';

export const CUSTOM_COLLECTION = 'custom-missions';
const HISTORY_KEEP = 30;
/** A mission JSON is a few tens of KB; this leaves room without letting one request fill the disk. */
export const MISSION_BODY_LIMIT = 256 * 1024;

export const customMissions = () => collection<CustomMissionDoc>(CUSTOM_COLLECTION);

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Sign-offs that still count: made on the current version. */
const currentSignoffs = (doc: CustomMissionDoc): Signoff[] => doc.signoffs.filter((s) => s.version === doc.mission.version);

export function fullySigned(doc: CustomMissionDoc): boolean {
  const cur = currentSignoffs(doc);
  const content = cur.find((s) => s.role === 'content');
  const safe = cur.find((s) => s.role === 'safeguarding');
  return Boolean(content && safe && content.initials !== safe.initials);
}

export function statusOf(doc: CustomMissionDoc): CustomStatus {
  if (doc.published && doc.published.version === doc.mission.version && fullySigned(doc)) return 'published';
  return fullySigned(doc) ? 'reviewed' : 'draft';
}

/** Keeps mission.review in step with the sign-offs the server holds (clients cannot set it). */
function syncReview(doc: CustomMissionDoc): void {
  const signed = fullySigned(doc);
  doc.mission.review = {
    ...doc.mission.review,
    status: signed ? 'reviewed' : 'draft',
    reviewers: currentSignoffs(doc).map((s) => s.initials),
  };
  doc.status = statusOf(doc);
}

export function summarize(doc: CustomMissionDoc): CustomMissionSummary {
  const check = checkMission(doc.mission, { custom: true });
  return {
    id: doc.id,
    title: doc.mission.title,
    district: doc.mission.district,
    bands: doc.mission.bands,
    scene: doc.mission.scene,
    scaffold: doc.mission.scaffold,
    tactics: missionTactics(doc.mission),
    version: doc.mission.version,
    status: statusOf(doc),
    signoffs: currentSignoffs(doc),
    publishedBands: doc.published?.bands ?? [],
    publishedVersion: doc.published?.version ?? null,
    origin: doc.origin ?? null,
    archived: doc.archived,
    updatedAt: doc.updatedAt,
    lint: { errors: check.errors, warnings: check.warnings, issues: check.issues },
  };
}

function detail(doc: CustomMissionDoc): CustomMissionDetail {
  return {
    ...summarize(doc),
    mission: doc.mission,
    history: doc.history.map((h) => ({ version: h.version, savedAt: h.savedAt, by: h.by })),
  };
}

/** Creates a draft doc (used by POST and by approving a Moment Card). */
export async function createDraft(
  mission: Mission,
  opts: { now: number; by: string | null; origin?: CustomMissionDoc['origin'] },
): Promise<CustomMissionDoc> {
  const at = new Date(opts.now).toISOString();
  const doc: CustomMissionDoc = {
    id: mission.id,
    mission: { ...clone(mission), version: 1 },
    status: 'draft',
    signoffs: [],
    archived: false,
    createdAt: at,
    updatedAt: at,
    savedBy: opts.by,
    history: [],
  };
  if (opts.origin) doc.origin = opts.origin;
  syncReview(doc);
  await customMissions().put(doc);
  return doc;
}

const BandList = z.array(z.enum(BANDS.map((b) => b.id) as [BandId, ...BandId[]])).min(1).max(3);
const SignoffBody = z.object({ initials: z.string().max(12), role: z.enum(SIGNOFF_ROLES) });
const PublishBody = z.object({ bands: BandList.optional() }).optional();
const ArchiveBody = z.object({ archived: z.boolean() });
const IdParams = z.object({ id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,63}$/) });

/** Accepts `{ mission: {...} }` or the bare mission object. */
const missionIn = (body: unknown): unknown =>
  body && typeof body === 'object' && 'mission' in body ? (body as { mission: unknown }).mission : body;

const bad = (reply: FastifyReply, code: number, error: string, message: string, extra: Record<string, unknown> = {}) =>
  reply.code(code).send({ error, message, ...extra });

export function registerMissionRoutes(
  app: FastifyInstance,
  opts: { now: () => number; auth: preHandlerAsyncHookHandler },
): void {
  const { now, auth } = opts;
  const store = customMissions;

  app.get('/api/missions/published', { config: { rateLimit: { max: 600, timeWindow: '1 minute' } } }, async (req, reply) => {
    void reply.header('cache-control', 'no-cache');
    const band = (req.query as { band?: string } | undefined)?.band;
    const docs = await store().list((d) => Boolean(d.published) && !d.archived);
    const out: PublishedMission[] = docs.flatMap((d) => {
      const pub = d.published;
      if (!pub || (band && !pub.bands.includes(band as BandId))) return [];
      return [
        {
          mission: { ...pub.mission, bands: pub.bands },
          version: pub.version,
          bands: pub.bands,
          publishedAt: pub.at,
          credit: d.origin?.credit ?? null,
        },
      ];
    });
    return { missions: out };
  });

  app.get('/api/missions/custom', { preHandler: auth }, async (_req, reply) => {
    void reply.header('cache-control', 'no-store');
    const docs = await store().list();
    docs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { missions: docs.map(summarize) };
  });

  app.get('/api/missions/custom/:id', { preHandler: auth }, async (req, reply) => {
    void reply.header('cache-control', 'no-store');
    const p = IdParams.safeParse(req.params);
    const doc = p.success ? await store().get(p.data.id) : undefined;
    if (!doc) return bad(reply, 404, 'not-found', 'No custom mission with that id.');
    return detail(doc);
  });

  // Lint-only endpoint, so the editor can show exactly what the server will decide.
  app.post('/api/missions/check', { preHandler: auth, bodyLimit: MISSION_BODY_LIMIT }, async (req, reply) => {
    void reply.header('cache-control', 'no-store');
    const check = checkMission(missionIn(req.body), { custom: true });
    return { errors: check.errors, warnings: check.warnings, issues: check.issues };
  });

  const save = async (body: unknown, pathId: string | null, reply: FastifyReply, by: string | null) => {
    const check = checkMission(missionIn(body), { custom: true });
    if (!check.mission) {
      return bad(reply, 422, 'invalid-mission', 'This mission JSON is missing fields or has the wrong types. Fix the errors and save again.', {
        issues: check.issues,
      });
    }
    const incoming = check.mission;
    if (pathId && incoming.id !== pathId) {
      return bad(reply, 400, 'id-mismatch', 'The id inside the JSON must match the mission you are editing. Use "Save as new" to copy it.');
    }
    if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(incoming.id) || check.issues.some((i) => i.path === 'id' && i.level === 'error')) {
      return bad(reply, 422, 'bad-id', check.issues.find((i) => i.path === 'id')?.message ?? 'Choose a different id.', {
        issues: check.issues,
      });
    }
    const existing = await store().get(incoming.id);
    const t = now();
    if (!pathId) {
      if (existing) return bad(reply, 409, 'exists', `A custom mission called "${incoming.id}" already exists. Open it from the Library instead.`);
      const doc = await createDraft(incoming, { now: t, by });
      await audit('mission.create', doc.id, by, null, t);
      return reply.code(201).send(detail(doc));
    }
    if (!existing) return bad(reply, 404, 'not-found', 'No custom mission with that id.');
    const changed = contentKey(existing.mission) !== contentKey(incoming);
    if (!changed) return detail(existing);
    existing.history.push({ version: existing.mission.version, savedAt: existing.updatedAt, by: existing.savedBy, mission: existing.mission });
    existing.savedBy = by;
    if (existing.history.length > HISTORY_KEEP) existing.history.splice(0, existing.history.length - HISTORY_KEEP);
    existing.mission = { ...clone(incoming), version: existing.mission.version + 1 };
    // Any edit needs fresh sign-offs; the published copy stays live until the next publish.
    existing.signoffs = [];
    existing.updatedAt = new Date(t).toISOString();
    syncReview(existing);
    await store().put(existing);
    await audit('mission.update', existing.id, by, `version ${existing.mission.version}`, t);
    return detail(existing);
  };

  app.post('/api/missions/custom', { preHandler: auth, bodyLimit: MISSION_BODY_LIMIT }, async (req, reply) => {
    void reply.header('cache-control', 'no-store');
    return save(req.body, null, reply, req.educator?.initials ?? null);
  });

  app.put('/api/missions/custom/:id', { preHandler: auth, bodyLimit: MISSION_BODY_LIMIT }, async (req, reply) => {
    void reply.header('cache-control', 'no-store');
    const p = IdParams.safeParse(req.params);
    if (!p.success) return bad(reply, 404, 'not-found', 'No custom mission with that id.');
    return save(req.body, p.data.id, reply, req.educator?.initials ?? null);
  });

  app.post('/api/missions/custom/:id/signoff', { preHandler: auth, bodyLimit: 2048 }, async (req, reply) => {
    void reply.header('cache-control', 'no-store');
    const p = IdParams.safeParse(req.params);
    const doc = p.success ? await store().get(p.data.id) : undefined;
    if (!doc) return bad(reply, 404, 'not-found', 'No custom mission with that id.');
    const b = SignoffBody.safeParse(req.body);
    if (!b.success) return bad(reply, 400, 'bad-request', 'Sign-off needs your initials and the check you are signing.');
    const initials = normalizeInitials(b.data.initials);
    if (!isInitials(initials)) return bad(reply, 400, 'bad-initials', 'Use your initials only (1-4 letters, e.g. FT). Never a full name.');
    const check = checkMission(doc.mission, { custom: true });
    if (check.errors > 0) {
      return bad(reply, 409, 'lint-errors', `Fix the ${check.errors} content error${check.errors === 1 ? '' : 's'} before signing off.`);
    }
    if (b.data.role === 'content' && (!isIsoDate(doc.mission.review.reviewBy) || doc.mission.sources.length === 0)) {
      return bad(reply, 409, 'needs-sources', 'The content sign-off needs at least one cited source and a review-by date (YYYY-MM-DD).');
    }
    const other = currentSignoffs(doc).find((s) => s.role !== b.data.role);
    if (other && other.initials === initials) {
      return bad(reply, 409, 'same-reviewer', 'Two different people must sign: the other check was signed with the same initials.');
    }
    const t = now();
    doc.signoffs = [
      ...currentSignoffs(doc).filter((s) => s.role !== b.data.role),
      { role: b.data.role, initials, at: new Date(t).toISOString(), version: doc.mission.version },
    ];
    doc.updatedAt = new Date(t).toISOString();
    syncReview(doc);
    await store().put(doc);
    await audit('mission.signoff', doc.id, initials, `${b.data.role}, version ${doc.mission.version}`, t);
    return detail(doc);
  });

  app.post('/api/missions/custom/:id/publish', { preHandler: auth, bodyLimit: 2048 }, async (req, reply) => {
    void reply.header('cache-control', 'no-store');
    const p = IdParams.safeParse(req.params);
    const doc = p.success ? await store().get(p.data.id) : undefined;
    if (!doc) return bad(reply, 404, 'not-found', 'No custom mission with that id.');
    const b = PublishBody.safeParse(req.body ?? undefined);
    if (!b.success) return bad(reply, 400, 'bad-request', 'Unknown band.');
    if (doc.archived) return bad(reply, 409, 'archived', 'Restore this mission from the archive first.');
    if (!fullySigned(doc)) {
      return bad(reply, 409, 'not-reviewed', 'Publishing needs two sign-offs from two different people: content accuracy and safeguarding.');
    }
    const check = checkMission(doc.mission, { custom: true });
    if (check.errors > 0) return bad(reply, 409, 'lint-errors', 'This mission still has content errors.');
    const bands = b.data?.bands ?? doc.mission.bands;
    const unknown = bands.filter((x) => !doc.mission.bands.includes(x));
    if (unknown.length) return bad(reply, 400, 'bad-band', `This mission is not written for: ${unknown.join(', ')}.`);
    const t = now();
    const keep = doc.published?.version === doc.mission.version ? doc.published.bands : [];
    doc.published = {
      mission: clone(doc.mission),
      version: doc.mission.version,
      bands: [...new Set([...keep, ...bands])],
      at: new Date(t).toISOString(),
    };
    doc.updatedAt = doc.published.at;
    syncReview(doc);
    await store().put(doc);
    await audit('mission.publish', doc.id, req.educator?.initials ?? null, `version ${doc.mission.version}: ${doc.published.bands.join(', ')}`, t);
    return detail(doc);
  });

  app.post('/api/missions/custom/:id/unpublish', { preHandler: auth, bodyLimit: 2048 }, async (req, reply) => {
    void reply.header('cache-control', 'no-store');
    const p = IdParams.safeParse(req.params);
    const doc = p.success ? await store().get(p.data.id) : undefined;
    if (!doc) return bad(reply, 404, 'not-found', 'No custom mission with that id.');
    const b = PublishBody.safeParse(req.body ?? undefined);
    if (!b.success) return bad(reply, 400, 'bad-request', 'Unknown band.');
    if (!doc.published) return detail(doc);
    const drop = b.data?.bands ?? doc.published.bands;
    const left = doc.published.bands.filter((x) => !drop.includes(x));
    const t = now();
    if (left.length) doc.published.bands = left;
    else delete doc.published;
    doc.updatedAt = new Date(t).toISOString();
    syncReview(doc);
    await store().put(doc);
    await audit('mission.unpublish', doc.id, req.educator?.initials ?? null, drop.join(', '), t);
    return detail(doc);
  });

  app.post('/api/missions/custom/:id/archive', { preHandler: auth, bodyLimit: 1024 }, async (req, reply) => {
    void reply.header('cache-control', 'no-store');
    const p = IdParams.safeParse(req.params);
    const doc = p.success ? await store().get(p.data.id) : undefined;
    if (!doc) return bad(reply, 404, 'not-found', 'No custom mission with that id.');
    const b = ArchiveBody.safeParse(req.body);
    if (!b.success) return bad(reply, 400, 'bad-request', 'Say whether to archive or restore.');
    if (b.data.archived && doc.published) return bad(reply, 409, 'published', 'Unpublish this mission before archiving it.');
    const t = now();
    doc.archived = b.data.archived;
    doc.updatedAt = new Date(t).toISOString();
    await store().put(doc);
    await audit(b.data.archived ? 'mission.archive' : 'mission.restore', doc.id, req.educator?.initials ?? null, null, t);
    return detail(doc);
  });
}
