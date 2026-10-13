// Calibration API: validation, the personal-data guard, upserts, aggregation and n >= 5 suppression.
// Uses Fastify's inject (same routes, hooks and rate limits) against a temporary data folder.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assessmentFormFor,
  assessmentItems,
  isAssessmentCode,
  type AssessmentAnswers,
  type AssessmentItem,
  type AssessmentKind,
  type AssessmentResponse,
  type AssessmentSummary,
  type BandId,
} from '@shieldquest/shared';

// The store reads SHIELDQUEST_DATA_DIR when it loads, so the routes are imported only after this is set.
const dataDir = mkdtempSync(join(tmpdir(), 'shieldquest-assess-'));
process.env.SHIELDQUEST_DATA_DIR = dataDir;

type Routes = typeof import('../src/assess/routes');

function answersFor(items: readonly AssessmentItem[], quality: 'best' | 'worst'): AssessmentAnswers {
  const out: AssessmentAnswers = {};
  for (const item of items) {
    if (item.type === 'twin') out[item.id] = { type: 'twin', pick: quality === 'best' ? item.scam : item.scam === 'a' ? 'b' : 'a', confidence: 2 };
    if (item.type === 'choice') {
      const opt = item.options.find((o) => (quality === 'best' ? o.best : !o.best))!;
      out[item.id] = { type: 'choice', option: opt.id };
    }
    if (item.type === 'likert') out[item.id] = { type: 'likert', value: quality === 'best' ? 5 : 2 };
    if (item.type === 'flags')
      out[item.id] = { type: 'flags', picked: item.segments.filter((s) => (quality === 'best' ? s.flag : !s.flag)).map((s) => s.id) };
  }
  return out;
}

const CODES = ['KAYA-7K2', 'ROTI-3MX', 'ORCA-9QP', 'TAPIR-4HH', 'MANGO-2B7', 'PANDA-8ZT'];

describe('assessment API', () => {
  let app: FastifyInstance;
  let routes: Routes;
  const clock = Date.UTC(2026, 9, 12, 9, 47, 31, 456);

  beforeAll(async () => {
    routes = await import('../src/assess/routes');
    app = Fastify();
    await routes.registerAssessmentRoutes(app, { now: () => clock });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  async function submit(body: unknown) {
    const res = await app.inject({ method: 'POST', url: '/api/assessments', payload: body as Record<string, unknown> });
    return { status: res.statusCode, json: res.json() as Record<string, unknown> };
  }

  function body(code: string, kind: AssessmentKind, band: BandId, quality: 'best' | 'worst', sessionCode?: string) {
    const items = assessmentItems(kind, band, assessmentFormFor(code, kind));
    return { code, kind, band, answers: answersFor(items, quality), ...(sessionCode ? { sessionCode } : {}) };
  }

  async function summary(query = ''): Promise<AssessmentSummary> {
    const res = await app.inject({ method: 'GET', url: `/api/assessments/summary${query}` });
    expect(res.statusCode).toBe(200);
    return res.json() as AssessmentSummary;
  }

  const stored = (): AssessmentResponse[] =>
    JSON.parse(readFileSync(join(dataDir, `${routes.ASSESSMENT_COLLECTION}.json`), 'utf8')) as AssessmentResponse[];

  it('hands out fresh, valid codes', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const res = await app.inject({ method: 'POST', url: '/api/assessments/codes' });
      expect(res.statusCode).toBe(201);
      expect(res.headers['cache-control']).toBe('no-store');
      const { code } = res.json() as { code: string };
      expect(isAssessmentCode(code)).toBe(true);
      expect(seen.has(code)).toBe(false);
      seen.add(code);
    }
  });

  it('stores a valid response with server-side scores, an hour-rounded time and no client details', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/assessments',
      payload: body('kaya 7k2', 'pre', 'teen', 'best', 'h7k-q2m'),
      headers: { 'user-agent': 'TestPhone/1.0', 'x-forwarded-for': '203.0.113.9' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ ok: true, id: 'KAYA-7K2:pre', dropped: 0 });
    const doc = stored().find((r) => r.id === 'KAYA-7K2:pre')!;
    expect(doc.code).toBe('KAYA-7K2');
    expect(doc.sessionCode).toBe('H7KQ2M');
    expect(doc.createdAtHour).toBe('2026-10-12T09:00:00.000Z');
    expect(doc.form).toBe(assessmentFormFor('KAYA-7K2', 'pre'));
    expect(doc.scores.twinAccuracy).toBe(1);
    expect(doc.scores.decisionAccuracy).toBe(1);
    const raw = readFileSync(join(dataDir, `${routes.ASSESSMENT_COLLECTION}.json`), 'utf8');
    expect(raw).not.toMatch(/203\.0\.113|TestPhone|user-agent|\bip\b/i);
  });

  it('upserts by code and kind, so a retry or a re-take replaces the earlier answers', async () => {
    expect((await submit(body('KAYA-7K2', 'pre', 'teen', 'worst', 'H7KQ2M'))).status).toBe(201);
    const docs = stored().filter((r) => r.code === 'KAYA-7K2' && r.kind === 'pre');
    expect(docs).toHaveLength(1);
    expect(docs[0]!.scores.twinAccuracy).toBe(0);
  });

  it('ignores client-sent scores and answers to items outside the form', async () => {
    const b = body('ROTI-3MX', 'pre', 'junior', 'worst');
    const res = await submit({ ...b, scores: { twinAccuracy: 1 }, answers: { ...b.answers, 'Z.fake': { type: 'likert', value: 5 } } });
    expect(res.status).toBe(201);
    expect(res.json.dropped).toBe(1);
    const doc = stored().find((r) => r.id === 'ROTI-3MX:pre')!;
    expect(doc.scores.twinAccuracy).toBe(0);
    expect(Object.keys(doc.answers)).not.toContain('Z.fake');
  });

  it.each([
    ['an NRIC number in an extra field', { note: 'S1234567D' }],
    ['a phone number in an answer', { answers: { 'P.cf.1': { type: 'chips', chips: ['9123 4567'] } } }],
    ['an email address as the session code', { sessionCode: 'kid@school.example' }],
    ['a phone number sent as a number', { extra: 91234567 }],
    ['personal data hidden in a key', { answers: { 'call 8123 4567': { type: 'likert', value: 3 } } }],
  ])('rejects %s and stores nothing', async (_label, patch) => {
    const before = stored().length;
    const base = body('ORCA-9QP', 'post', 'teen', 'best');
    const res = await submit({ ...base, ...patch, answers: { ...base.answers, ...((patch as { answers?: object }).answers ?? {}) } });
    expect(res.status).toBe(422);
    expect(res.json.error).toBe('personal-data');
    expect(JSON.stringify(res.json)).not.toMatch(/S1234567D|9123|kid@/);
    expect(stored().length).toBe(before);
    expect(stored().some((r) => r.code === 'ORCA-9QP')).toBe(false);
  });

  it.each([
    ['an unknown kind', { kind: 'mid' }],
    ['an age-style band', { band: '13' }],
    ['a malformed code', { code: 'KAYA-0O1' }],
    ['a broken answer shape', { answers: { 'P.cf.1': { type: 'likert', value: 9 } } }],
    ['a missing body', null],
  ])('rejects %s with 400', async (_label, patch) => {
    const payload = patch === null ? undefined : { ...body('TAPIR-4HH', 'pre', 'teen', 'best'), ...patch };
    const res = await app.inject({
      method: 'POST',
      url: '/api/assessments',
      ...(payload ? { payload } : {}),
    });
    expect(res.statusCode).toBe(400);
  });

  it('drops a malformed session tag instead of losing the answers', async () => {
    expect((await submit(body('TAPIR-4HH', 'pre', 'teen', 'best', 'not a room'))).status).toBe(201);
    expect(stored().find((r) => r.id === 'TAPIR-4HH:pre')!.sessionCode).toBeUndefined();
  });

  it('enforces the 16 KB body cap', async () => {
    const res = await submit({ ...body('MANGO-2B7', 'pre', 'teen', 'best'), pad: 'x'.repeat(17 * 1024) });
    expect(res.status).toBe(413);
  });

  it('summarises only groups of 5 or more, per session, following Return visits by code', async () => {
    // Session ABCDEF: 4 people so far -> everything suppressed.
    const people = ['LIME-2C3', 'PLUM-3D4', 'KIWI-4E5', 'PEAR-5F6', 'FIG-6G7'];
    for (const code of people.slice(0, 4)) {
      expect((await submit(body(code, 'pre', 'teen', 'worst', 'ABCDEF'))).status).toBe(201);
      expect((await submit(body(code, 'post', 'teen', 'best', 'ABCDEF'))).status).toBe(201);
    }
    let s = await summary('?sessionCode=ABCDEF');
    expect(s.responses.pre).toBeNull();
    expect(s.kpis[0]!.metrics.every((m) => m.pre.suppressed && m.postVsPre.suppressed)).toBe(true);

    // The fifth person makes the session reportable.
    expect((await submit(body(people[4]!, 'pre', 'teen', 'worst', 'ABCDEF'))).status).toBe(201);
    expect((await submit(body(people[4]!, 'post', 'teen', 'best', 'ABCDEF'))).status).toBe(201);
    s = await summary('?sessionCode=abc-def');
    expect(s.responses).toEqual({ pre: 5, post: 5, return: null });
    expect(s.matched.prePost).toBe(5);
    const acc = s.kpis.find((k) => k.id === 'risk')!.metrics.find((m) => m.id === 'twinAccuracy')!;
    expect(acc.pre.mean).toBe(0);
    expect(acc.post.mean).toBe(1);
    expect(acc.postVsPre.mean).toBe(1);
    expect(acc.postVsPre.ci95).toEqual([1, 1]);

    // Return visits arrive weeks later without the session link; they still count for the session.
    for (const code of people) expect((await submit(body(code, 'return', 'teen', 'best'))).status).toBe(201);
    s = await summary('?sessionCode=ABCDEF');
    expect(s.responses.return).toBe(5);
    expect(s.matched.postReturn).toBe(5);
    const knowledge = s.kpis.find((k) => k.id === 'retention')!.metrics.find((m) => m.id === 'knowledge')!;
    expect(knowledge.returnVsPost.suppressed).toBe(false);

    // Other sessions and bands stay separate; an invalid filter yields an empty, suppressed summary.
    expect((await summary('?sessionCode=ZZZZZZ')).responses.pre).toBeNull();
    expect((await summary('?sessionCode=ABCDEF&band=junior')).responses.pre).toBeNull();
    const res = await app.inject({ method: 'GET', url: '/api/assessments/summary?band=13' });
    expect(res.statusCode).toBe(400);
  });

  it('exposes the same summary as a pure function for the portal', async () => {
    const direct = await routes.getAssessmentSummary({ sessionCode: 'ABCDEF' });
    expect(direct).toEqual(await summary('?sessionCode=ABCDEF'));
    const all = await routes.getAssessmentSummary();
    expect(all.responses.pre).toBeGreaterThanOrEqual(5);
  });

  it('never returns per-person data from the summary', async () => {
    const text = JSON.stringify(await summary());
    for (const code of [...CODES, 'LIME-2C3']) expect(text).not.toContain(code);
    expect(text).not.toContain('answers');
  });

  it('serves the public summary route only when allowed (off in production)', async () => {
    const closed = Fastify();
    await routes.registerAssessmentRoutes(closed, { publicSummary: false });
    await closed.ready();
    const res = await closed.inject({ method: 'GET', url: '/api/assessments/summary' });
    expect(res.statusCode).toBe(404);
    const codes = await closed.inject({ method: 'POST', url: '/api/assessments/codes' });
    expect(codes.statusCode).toBe(201);
    await closed.close();
  });

  it('purges responses older than the retention date', async () => {
    const removed = await routes.purgeAssessmentResponses(new Date(Date.UTC(2026, 9, 12, 10)));
    expect(removed).toBeGreaterThan(0);
    expect(stored()).toHaveLength(0);
  });
});
