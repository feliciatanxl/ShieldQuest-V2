// Scenario Portal API: educator sign-in, youth Moment Cards (personal-data guard, moderation),
// the two-person sign-off before publishing, and n >= 5 suppression in analytics.
// Uses Fastify's inject against a temporary data folder.

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MISSIONS,
  assessmentFormFor,
  assessmentItems,
  buildAssessmentResponse,
  emptyMissionAggregate,
  type AssessmentAnswers,
  type Mission,
  type SessionAggregate,
} from '@shieldquest/shared';
import type { AnalyticsReport, CustomMissionDetail, PitchInput, SubmissionRecord } from '../src/portal/model';

// The store reads SHIELDQUEST_DATA_DIR when it loads, so the routes are imported only after this is set.
const dataDir = mkdtempSync(join(tmpdir(), 'shieldquest-portal-'));
process.env.SHIELDQUEST_DATA_DIR = dataDir;
delete process.env.PORTAL_PASSCODE;
delete process.env.SUBMISSIONS_REQUIRE_MAKER_CODE;

type Routes = typeof import('../src/portal/routes');
type Store = typeof import('../src/store');

const clock = Date.UTC(2026, 9, 12, 9, 47, 31);
const readJson = <T>(name: string): T[] => {
  const file = join(dataDir, `${name}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T[]) : [];
};

const pitch = (patch: Partial<PitchInput> = {}): PitchInput => ({
  band: 'teen',
  district: 'digi-district',
  setting: 'job-app',
  pusher: 'online-seller',
  pressureTactics: ['too-good', 'urgency'],
  whatTheySay: 'Earn $300 a day just by letting us use your bank account for a few transfers. Reply fast, only 3 spots left!',
  redFlags: { chips: ['too-much-money', 'asks-account', 'rush'] },
  saferMove: { chip: 'tell-adult' },
  recoveryMove: 'call-bank',
  totem: 'hornbill',
  consent: true,
  ...patch,
});

function customMission(id: string, patch: Partial<Mission> = {}): Mission {
  const base = MISSIONS.find((m) => m.id === 'easy-money');
  if (!base) throw new Error('easy-money missing');
  return { ...(JSON.parse(JSON.stringify(base)) as Mission), id, title: 'Easy Money (custom copy)', ...patch };
}

describe('portal API', () => {
  let app: FastifyInstance;
  let routes: Routes;
  let store: Store;
  let token = '';

  beforeAll(async () => {
    routes = await import('../src/portal/routes');
    store = await import('../src/store');
    app = Fastify();
    await routes.registerPortalRoutes(app, { now: () => clock, loginPerMinute: 100, submitPerMinute: 100 });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  const auth = () => ({ authorization: `Bearer ${token}` });
  const post = (url: string, payload: unknown, headers: Record<string, string> = auth()) =>
    app.inject({ method: 'POST', url, payload: payload as Record<string, unknown>, headers });
  const get = (url: string, headers: Record<string, string> = auth()) => app.inject({ method: 'GET', url, headers });

  describe('educator sign-in', () => {
    it('accepts the development passcode when PORTAL_PASSCODE is unset outside production', async () => {
      const res = await post('/api/portal/login', { passcode: 'shieldquest-dev', initials: 'f.t.' }, {});
      expect(res.statusCode).toBe(200);
      const body = res.json() as { token: string; initials: string; devPasscode: boolean; expiresAt: string };
      expect(body.devPasscode).toBe(true);
      expect(body.initials).toBe('FT');
      expect(Date.parse(body.expiresAt) - clock).toBe(8 * 3_600_000);
      expect(res.headers['cache-control']).toBe('no-store');
      token = body.token;
      expect((await get('/api/portal/me')).statusCode).toBe(200);
    });

    it('rejects a wrong passcode, a full name as initials, and missing or unknown tokens', async () => {
      expect((await post('/api/portal/login', { passcode: 'shieldquest-DEV' }, {})).statusCode).toBe(401);
      expect((await post('/api/portal/login', { passcode: 'shieldquest-dev', initials: 'Felicia Tan' }, {})).statusCode).toBe(400);
      expect((await get('/api/missions/custom', {})).statusCode).toBe(401);
      expect((await get('/api/missions/custom', { authorization: 'Bearer not-a-real-token-aaaaaaaaaaaa' })).statusCode).toBe(401);
      expect((await get('/api/analytics', {})).statusCode).toBe(401);
      expect((await get('/api/submissions', {})).statusCode).toBe(401);
    });

    it('logs out by revoking the token', async () => {
      const res = await post('/api/portal/login', { passcode: 'shieldquest-dev' }, {});
      const other = (res.json() as { token: string }).token;
      expect((await post('/api/portal/logout', {}, { authorization: `Bearer ${other}` })).statusCode).toBe(204);
      expect((await get('/api/portal/me', { authorization: `Bearer ${other}` })).statusCode).toBe(401);
    });

    it('uses only the configured passcode, and is disabled in production without one', async () => {
      const configured = Fastify();
      await routes.registerPortalRoutes(configured, { passcode: 'correct-horse-battery' });
      expect((await configured.inject({ method: 'POST', url: '/api/portal/login', payload: { passcode: 'shieldquest-dev' } })).statusCode).toBe(401);
      expect((await configured.inject({ method: 'POST', url: '/api/portal/login', payload: { passcode: 'correct-horse-battery' } })).statusCode).toBe(200);
      await configured.close();

      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const prod = Fastify();
        await routes.registerPortalRoutes(prod);
        const res = await prod.inject({ method: 'POST', url: '/api/portal/login', payload: { passcode: 'shieldquest-dev' } });
        expect(res.statusCode).toBe(503);
        expect(res.json()).toMatchObject({ error: 'portal-disabled' });
        await prod.close();
      } finally {
        process.env.NODE_ENV = prev;
      }
    });
  });

  describe('youth Moment Cards', () => {
    let ticket = '';

    it('stores a pitch as pending with a ticket, an hour-rounded time and no client details', async () => {
      const res = await post('/api/submissions', pitch(), { 'user-agent': 'KidPhone/2.0', 'x-forwarded-for': '203.0.113.7' });
      expect(res.statusCode).toBe(201);
      const body = res.json() as { ticket: string; status: string };
      expect(body.status).toBe('pending');
      expect(body.ticket).toMatch(/^MC-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      ticket = body.ticket;
      const [doc] = readJson<SubmissionRecord>('submissions');
      expect(doc?.createdAtHour).toBe('2026-10-12T09:00:00.000Z');
      expect(JSON.stringify(doc)).not.toMatch(/203\.0\.113|KidPhone|consent/);
      const status = await get(`/api/submissions/${ticket.toLowerCase().replace(/-/g, ' ')}`, {});
      expect(status.statusCode).toBe(200);
      expect(status.json()).toMatchObject({ ticket, status: 'pending', reason: null });
    });

    it.each([
      ['an NRIC number', pitch({ whatTheySay: 'Send me a photo of your card, my NRIC is S1234567D so you can trust me' })],
      ['a phone number', pitch({ whatTheySay: 'Call me on 9123 4567 for the job details, quick before it goes' })],
      ['an email address', pitch({ redFlags: { chips: ['rush'], text: 'asks you to email boss@quickjobs.sg' } })],
      ['a phone number in the safer move', pitch({ saferMove: { text: 'Call my mum at 8765 4321' } })],
      ['a real school', pitch({ whatTheySay: 'A senior from Rivervale Secondary says everyone in class does this job' })],
      ['personal data in an extra field', { ...pitch(), name: 'S7654321A' }],
    ])('rejects %s with a friendly message and stores nothing', async (_label, body) => {
      const before = readJson<SubmissionRecord>('submissions').length;
      const res = await post('/api/submissions', body, {});
      expect(res.statusCode).toBe(422);
      const json = res.json() as { error: string; message: string };
      expect(json.error).toBe('personal-data');
      expect(json.message).toMatch(/fictional only/i);
      expect(readJson<SubmissionRecord>('submissions').length).toBe(before);
    });

    it('rejects a pitch without consent, without warning signs or with excluded themes', async () => {
      expect((await post('/api/submissions', { ...pitch(), consent: false }, {})).statusCode).toBe(400);
      expect((await post('/api/submissions', pitch({ redFlags: { chips: [] } }), {})).statusCode).toBe(400);
      const theme = await post('/api/submissions', pitch({ whatTheySay: 'They threaten sextortion unless you pay them by tonight' }), {});
      expect(theme.statusCode).toBe(422);
      expect(theme.json()).toMatchObject({ error: 'not-allowed' });
    });

    it('lists the queue for educators without the youth ticket', async () => {
      const res = await get('/api/submissions?status=pending');
      expect(res.statusCode).toBe(200);
      const list = (res.json() as { submissions: Record<string, unknown>[] }).submissions;
      expect(list).toHaveLength(1);
      expect(list[0]).not.toHaveProperty('ticket');
    });

    it('returns a card with a reason code, which the youth sees by ticket', async () => {
      const other = await post('/api/submissions', pitch({ setting: 'marketplace', whatTheySay: 'Pay a deposit first and I will hold the phone for you' }), {});
      const otherTicket = (other.json() as { ticket: string }).ticket;
      const queue = (await get('/api/submissions')).json() as { submissions: { id: string; pitch: { setting: string } }[] };
      const id = queue.submissions.find((s) => s.pitch.setting === 'marketplace')!.id;
      expect((await post(`/api/submissions/${id}/decision`, { decision: 'reject' })).statusCode).toBe(400);
      const res = await post(`/api/submissions/${id}/decision`, { decision: 'reject', reason: 'too-similar' });
      expect(res.statusCode).toBe(200);
      const status = (await get(`/api/submissions/${otherTicket}`, {})).json() as { status: string; reason: string };
      expect(status.status).toBe('rejected');
      expect(status.reason).toMatch(/very close to a mission/);
      expect((await post(`/api/submissions/${id}/decision`, { decision: 'approve' })).statusCode).toBe(409);
    });

    it('approving creates a clearly marked draft mission with the squad credit, never a name', async () => {
      const queue = (await get('/api/submissions?status=pending')).json() as { submissions: { id: string }[] };
      const id = queue.submissions[0]!.id;
      const res = await post(`/api/submissions/${id}/decision`, { decision: 'approve', initials: 'ab' });
      expect(res.statusCode).toBe(200);
      const { missionId } = res.json() as { missionId: string };
      expect(missionId).toMatch(/^youth-digi-/);
      const detail = (await get(`/api/missions/custom/${missionId}`)).json() as CustomMissionDetail;
      expect(detail.status).toBe('draft');
      expect(detail.origin?.credit).toBe('Squad Hornbill');
      expect(detail.mission.title).toMatch(/^Youth pitch/);
      expect(detail.mission.premise).toContain('Earn $300 a day');
      expect(detail.lint.errors).toBeGreaterThan(0); // the skeleton cannot be published until the team builds it out
      expect((await get(`/api/submissions/${ticket}`, {})).json()).toMatchObject({ status: 'approved' });
      const audit = (await get('/api/portal/audit')).json() as { entries: { action: string; initials: string }[] };
      expect(audit.entries.map((e) => e.action)).toEqual(expect.arrayContaining(['submission.approve', 'submission.return']));
      expect(audit.entries.find((e) => e.action === 'submission.approve')?.initials).toBe('AB');
    });

    it('checks maker codes and credits the cohort', async () => {
      const created = await post('/api/portal/maker-codes', { label: 'NYP Pilot 1' });
      expect(created.statusCode).toBe(201);
      const code = (created.json() as { id: string }).id;
      expect(code).toMatch(/^MK-[A-Z2-9]{6}$/);
      const strict = Fastify();
      await routes.registerPortalRoutes(strict, { now: () => clock, requireMakerCode: true });
      expect((await strict.inject({ method: 'POST', url: '/api/submissions', payload: pitch() as unknown as Record<string, unknown> })).statusCode).toBe(403);
      const wrong = await strict.inject({ method: 'POST', url: '/api/submissions', payload: { ...pitch(), makerCode: 'MK-AAAAAA' } });
      expect(wrong.json()).toMatchObject({ error: 'bad-maker-code' });
      const ok = await strict.inject({ method: 'POST', url: '/api/submissions', payload: { ...pitch(), makerCode: code.toLowerCase() } });
      expect(ok.statusCode).toBe(201);
      await strict.close();
      const stored = readJson<SubmissionRecord>('submissions').find((s) => s.cohort === 'NYP Pilot 1');
      expect(stored).toBeDefined();
      expect(JSON.stringify(stored)).not.toContain(code);
    });

    it('deletes returned cards 30 days after the decision', async () => {
      const { purgeReturnedSubmissions } = await import('../src/portal/submissions');
      const before = readJson<SubmissionRecord>('submissions');
      expect(before.some((s) => s.status === 'rejected')).toBe(true);
      expect(await purgeReturnedSubmissions(clock + 29 * 24 * 3_600_000)).toBe(0);
      expect(await purgeReturnedSubmissions(clock + 31 * 24 * 3_600_000)).toBe(1);
      expect(readJson<SubmissionRecord>('submissions').some((s) => s.status === 'rejected')).toBe(false);
    });
  });

  describe('custom missions', () => {
    const id = 'custom-easy-money';

    it('saves a draft with lint results and refuses broken JSON, built-in ids and duplicates', async () => {
      const res = await post('/api/missions/custom', { mission: customMission(id) });
      expect(res.statusCode).toBe(201);
      const doc = res.json() as CustomMissionDetail;
      expect(doc.status).toBe('draft');
      expect(doc.version).toBe(1);
      expect(doc.lint.errors).toBe(0);

      const broken = await post('/api/missions/custom', { mission: { id: 'broken-one', title: 'Broken' } });
      expect(broken.statusCode).toBe(422);
      expect((broken.json() as { issues: unknown[] }).issues.length).toBeGreaterThan(3);
      expect((await post('/api/missions/custom', [1, 2, 3])).statusCode).toBe(422);
      expect((await post('/api/missions/custom', { mission: customMission('easy-money') })).statusCode).toBe(422);
      expect((await post('/api/missions/custom', { mission: customMission(id) })).statusCode).toBe(409);

      const list = (await get('/api/missions/custom')).json() as { missions: { id: string }[] };
      expect(list.missions.map((m) => m.id)).toContain(id);
    });

    it('requires two sign-offs by two different people before publishing', async () => {
      const publish = () => post(`/api/missions/custom/${id}/publish`, {});
      expect((await publish()).json()).toMatchObject({ error: 'not-reviewed' });

      const content = await post(`/api/missions/custom/${id}/signoff`, { initials: 'FT', role: 'content' });
      expect(content.statusCode).toBe(200);
      expect((content.json() as CustomMissionDetail).status).toBe('draft');
      expect((await publish()).statusCode).toBe(409);

      const same = await post(`/api/missions/custom/${id}/signoff`, { initials: 'ft', role: 'safeguarding' });
      expect(same.json()).toMatchObject({ error: 'same-reviewer' });
      expect((await post(`/api/missions/custom/${id}/signoff`, { initials: 'Felicia Tan', role: 'safeguarding' })).statusCode).toBe(400);

      const safe = await post(`/api/missions/custom/${id}/signoff`, { initials: 'JL', role: 'safeguarding' });
      const reviewed = safe.json() as CustomMissionDetail;
      expect(reviewed.status).toBe('reviewed');
      expect(reviewed.mission.review).toMatchObject({ status: 'reviewed', reviewers: ['FT', 'JL'] });

      const published = await publish();
      expect(published.statusCode).toBe(200);
      expect((published.json() as CustomMissionDetail).status).toBe('published');
      const pub = (await get('/api/missions/published', {})).json() as { missions: { mission: Mission; version: number }[] };
      expect(pub.missions.map((m) => m.mission.id)).toEqual([id]);
    });

    it('an edit bumps the version, clears sign-offs and keeps the published copy live', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/missions/custom/${id}`,
        headers: auth(),
        payload: { mission: customMission(id, { title: 'Easy Money (custom, edited)' }) },
      });
      expect(res.statusCode).toBe(200);
      const doc = res.json() as CustomMissionDetail;
      expect(doc.version).toBe(2);
      expect(doc.status).toBe('draft');
      expect(doc.signoffs).toEqual([]);
      expect(doc.publishedVersion).toBe(1);
      expect(doc.history.map((h) => h.version)).toEqual([1]);
      const pub = (await get('/api/missions/published', {})).json() as { missions: { mission: Mission; version: number }[] };
      expect(pub.missions[0]?.version).toBe(1);
      expect(pub.missions[0]?.mission.title).toBe('Easy Money (custom copy)');
      const unpub = await post(`/api/missions/custom/${id}/unpublish`, {});
      expect((unpub.json() as CustomMissionDetail).publishedVersion).toBeNull();
      expect(((await get('/api/missions/published', {})).json() as { missions: unknown[] }).missions).toHaveLength(0);
    });

    it('saves a draft with content errors but blocks sign-off until they are fixed', async () => {
      const m = customMission('custom-brand-test', { intro: 'Kai sees a job ad on Carousell. Call 9876 5432 now.' });
      const res = await post('/api/missions/custom', { mission: m });
      expect(res.statusCode).toBe(201);
      expect((res.json() as CustomMissionDetail).lint.errors).toBeGreaterThanOrEqual(2);
      const sign = await post('/api/missions/custom/custom-brand-test/signoff', { initials: 'FT', role: 'safeguarding' });
      expect(sign.statusCode).toBe(409);
      expect(sign.json()).toMatchObject({ error: 'lint-errors' });
    });
  });

  describe('analytics', () => {
    const aggregate = (id: string, seats: number, players: number, band: SessionAggregate['band'] = 'teen'): SessionAggregate => {
      const m = emptyMissionAggregate('easy-money');
      m.squads = Math.max(1, Math.round(players / 4));
      m.squadsCompleted = m.squads;
      m.firstTotal = players;
      m.firstSafe = Math.floor(players / 2);
      m.finalTotal = players;
      m.finalSafe = players - 1;
      m.shiftedSafer = 1;
      m.unchanged = players - 1;
      m.forecastTotal = players;
      m.forecastLikely = players - 1;
      m.holdBuckets['0-5'] = players - 1;
      m.holdBuckets.late = 1;
      return {
        id,
        createdAt: '2026-10-12T09:00:00.000Z',
        band,
        missionIds: ['easy-money'],
        seatsTotal: seats,
        squadsTotal: 1,
        missionsCompleted: 1,
        perMission: [m],
        lateHold: { good: 0, total: 0 },
        aftershocksDelivered: 0,
        roomFreezePeak: 0.5,
        lanterns: 1,
        complete: true,
      };
    };

    const respond = async (code: string) => {
      const items = assessmentItems('pre', 'teen', assessmentFormFor(code, 'pre'));
      const answers: AssessmentAnswers = {};
      for (const item of items) if (item.type === 'likert') answers[item.id] = { type: 'likert', value: 4 };
      const { response } = buildAssessmentResponse({ code, kind: 'pre', band: 'teen', answers }, clock);
      await store.collection<typeof response>('assessment-responses').put(response);
    };

    it('suppresses every cell built from fewer than 5 people, in the report and in the CSV', async () => {
      await store.collection<SessionAggregate>('session-aggregates').put(aggregate('agg-1', 3, 3));
      for (const code of ['KAYA-7K2', 'ROTI-3MX', 'ORCA-9QP']) await respond(code);
      const res = await get('/api/analytics');
      expect(res.statusCode).toBe(200);
      const r = res.json() as AnalyticsReport;
      expect(r.totals.seats).toBeNull();
      expect(r.totals.responses.pre).toBeNull();
      const decision = r.kpis.find((k) => k.id === 'decision')!;
      expect(decision.signals.find((s) => s.id === 'first-safe')?.stat).toEqual({ n: null, value: null, suppressed: true });
      const peer = r.kpis.find((k) => k.id === 'peer')!;
      expect(peer.calibration.every((c) => c.pre.suppressed && c.pre.mean === null)).toBe(true);
      expect(r.holdLatency.find((h) => h.bucket === '0-5')?.n).toBeNull();
      expect(r.missions[0]?.decisions.every((d) => d.squads === null || d.squads === 0)).toBe(true);
      expect(r.sessions[0]?.seats).toBeNull();
      expect(r.sessions[0]?.lanterns).toBeNull();

      const csv = await get('/api/analytics.csv');
      expect(csv.statusCode).toBe(200);
      expect(csv.headers['content-type']).toMatch(/text\/csv/);
      expect(csv.headers['content-disposition']).toMatch(/attachment/);
      expect(csv.body).toContain('<5');
      expect(csv.body).toContain('fewer than 5');
      expect(csv.body).not.toMatch(/KAYA|ROTI|ORCA/);
    });

    it('shows values once 5 or more contribute, and filters by band and hour', async () => {
      await store.collection<SessionAggregate>('session-aggregates').put(aggregate('agg-2', 24, 24));
      await store.collection<SessionAggregate>('session-aggregates').put(aggregate('agg-3', 30, 30, 'junior'));
      for (const code of ['TAPIR-4HH', 'MANGO-2B7']) await respond(code);
      const r = (await get('/api/analytics?band=teen')).json() as AnalyticsReport;
      expect(r.filter.band).toBe('teen');
      expect(r.totals.seats).toBe(27);
      expect(r.totals.responses.pre).toBe(5);
      const first = r.kpis.find((k) => k.id === 'decision')!.signals.find((s) => s.id === 'first-safe')!.stat;
      expect(first).toEqual({ n: 27, value: Math.round((13 / 27) * 1000) / 1000, suppressed: false });
      const peer = r.kpis.find((k) => k.id === 'peer')!;
      expect(peer.calibration.find((c) => c.metricId === 'peerConfidence')?.pre.mean).toBe(4);
      const later = (await get('/api/analytics?from=2026-10-12T10:00:00Z')).json() as AnalyticsReport;
      expect(later.totals.seats).toBe(0);
      expect(later.totals.sessions).toBe(0);
    });
  });
});
