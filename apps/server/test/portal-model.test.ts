// Scenario Portal model: the mission structure check never throws on untrusted JSON, the extra
// portal lint rules, the pitch guard shared by the form and the server, and the CSV export.

import { describe, expect, it } from 'vitest';
import { MISSIONS, emptyMissionAggregate, type Mission, type SessionAggregate } from '@shieldquest/shared';
import { computeAnalytics, reportToCsv, safeCount, stat } from '../src/portal/analytics';
import { checkMission, checkPitch, missionFromPitch, pitchTextProblems, skeletonMission, type PitchInput } from '../src/portal/model';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('checkMission', () => {
  it('accepts the structure of every built-in mission', () => {
    for (const m of MISSIONS) {
      const r = checkMission(m, { custom: false, today: '2026-10-01' });
      expect(r.mission, m.id).not.toBeNull();
      expect(r.issues.filter((i) => i.message.includes('unknown field')), m.id).toEqual([]);
    }
  });

  it('never throws on malformed input and reports paths', () => {
    const base = clone(MISSIONS[0]!) as unknown as Record<string, unknown>;
    const inputs: unknown[] = [
      null,
      42,
      'mission',
      [],
      {},
      { ...base, cast: 'nobody' },
      { ...base, live: { beats: [{ id: 'x' }] } },
      { ...base, clues: [{ id: 'c', target: { kind: 'elsewhere' } }] },
      { ...base, choices: [{ id: 'a', feedback: null }] },
      { ...base, peerShield: { slots: {} } },
      { ...base, review: undefined },
    ];
    for (const input of inputs) {
      const r = checkMission(input);
      expect(r.mission).toBeNull();
      expect(r.errors).toBeGreaterThan(0);
    }
    const r = checkMission({ ...base, cast: 'nobody' });
    expect(r.issues.some((i) => i.path === 'cast')).toBe(true);
  });

  it('flags legal penalties in the 10-13 band and built-in ids for custom copies', () => {
    const junior = clone(MISSIONS.find((m) => m.bands.includes('junior'))!);
    junior.id = 'junior-copy';
    junior.intro = `${junior.intro} If caught, you could go to jail.`;
    const r = checkMission(junior, { custom: true, today: '2026-10-01' });
    expect(r.issues.some((i) => i.level === 'error' && i.path === 'intro' && /penalties/.test(i.message))).toBe(true);
    const copy = checkMission(MISSIONS[0], { custom: true, today: '2026-10-01' });
    expect(copy.issues.some((i) => i.path === 'id' && i.level === 'error')).toBe(true);
  });

  it('builds draft skeletons that are well-formed but cannot pass review untouched', () => {
    const blank = skeletonMission({ id: 'blank-draft', band: 'teen', district: 'school-street' });
    const r = checkMission(blank);
    expect(r.mission).not.toBeNull();
    expect(r.errors).toBeGreaterThan(0);
    const fromPitch: Mission = missionFromPitch(
      {
        id: 'abc',
        ticket: 'MC-AAAA-BBBB',
        createdAtHour: '2026-10-12T09:00:00.000Z',
        pitch: {
          band: 'junior',
          district: 'retail-district',
          setting: 'convenience-shop',
          pusher: 'friend',
          pressureTactics: ['loyalty'],
          whatTheySay: 'If you are really my friend you will take it for me',
          redFlags: { chips: ['guilt'] },
          saferMove: { chip: 'say-no' },
        },
        warnings: [],
        status: 'approved',
      },
      'youth-retail-abc',
    );
    const f = checkMission(fromPitch);
    expect(f.issues.some((i) => i.level === 'error' && /placeholder/.test(i.message))).toBe(true);
    // Adding the missing source alone must not clear the draft: every TODO is still an error.
    const sourced = clone(blank);
    sourced.sources = [{ label: 'Scam trends', publisher: 'Example Agency', asOf: '2026-09-01' }];
    sourced.review.reviewBy = '2027-09-01';
    const s = checkMission(sourced, { today: '2026-10-13' });
    expect(s.errors).toBeGreaterThan(0);
    expect(s.issues.filter((i) => i.level === 'error' && /placeholder/.test(i.message)).length).toBeGreaterThan(5);
    expect(s.issues.some((i) => i.path === 'sources')).toBe(false);
    expect(f.mission?.scene).toBe('minimart');
    expect(f.mission?.cast[1]?.role).toBe('friend');
    expect(f.mission?.review.notes).toMatch(/Made by youths/);
  });
});

describe('pitch guard', () => {
  const pitch: PitchInput = {
    band: 'teen',
    district: 'school-street',
    setting: 'class-chat',
    pressureTactics: ['everyone-does-it'],
    whatTheySay: 'Everyone in the group already shared their login, just send yours',
    redFlags: { chips: ['everyone', 'asks-account'] },
    saferMove: { chip: 'say-no' },
    consent: true,
  };

  it('passes a clean pitch and blocks personal data, schools and swearing', () => {
    expect(checkPitch(pitch).filter((p) => p.level === 'error')).toEqual([]);
    expect(pitchTextProblems('text me at 9123 4567', 'whatTheySay')[0]?.level).toBe('error');
    expect(pitchTextProblems('a kid from NYP said so', 'whatTheySay')[0]?.level).toBe('error');
    expect(pitchTextProblems('what the fuck', 'whatTheySay')[0]?.level).toBe('error');
    expect(pitchTextProblems('she was so stupid to believe it', 'whatTheySay')[0]?.level).toBe('warning');
  });

  it('suggests made-up names for real apps without blocking, and ignores everyday words', () => {
    const brand = pitchTextProblems('DM me on WhatsApp for the job', 'whatTheySay');
    expect(brand).toHaveLength(1);
    expect(brand[0]).toMatchObject({ level: 'warning' });
    expect(brand[0]?.message).toMatch(/ChatLah/);
    expect(pitchTextProblems('Grab it now before the deal is gone, let off steam later', 'whatTheySay')).toEqual([]);
  });

  it('needs a safer move, a warning sign and consent', () => {
    expect(checkPitch({ ...pitch, saferMove: {} }).some((p) => p.level === 'error')).toBe(true);
    expect(checkPitch({ ...pitch, redFlags: { chips: [] } }).some((p) => p.level === 'error')).toBe(true);
    expect(checkPitch({ ...pitch, consent: false as unknown as true }).some((p) => p.level === 'error')).toBe(true);
    expect(checkPitch({ ...pitch, whatTheySay: 'x'.repeat(281) }).some((p) => p.field === 'whatTheySay')).toBe(true);
  });
});

describe('analytics suppression', () => {
  it('suppresses counts and rates from fewer than 5, keeps zero as zero', () => {
    expect(safeCount(0)).toBe(0);
    expect(safeCount(4)).toBeNull();
    expect(safeCount(5)).toBe(5);
    expect(stat(1, 4)).toEqual({ n: null, value: null, suppressed: true });
    expect(stat(1, 5)).toEqual({ n: 5, value: 0.2, suppressed: false });
    expect(stat(0, 0)).toEqual({ n: 0, value: null, suppressed: false });
  });

  it('decides suppression on distinct players, not player-missions (3 players x 3 missions is still 3 people)', () => {
    const perMission = ['easy-money', 'free-skins', 'the-screenshot'].map((id) => {
      const m = emptyMissionAggregate(id);
      m.squads = 1;
      m.squadsCompleted = 1;
      m.firstTotal = 3;
      m.firstSafe = 2;
      m.finalTotal = 3;
      m.finalSafe = 3;
      m.shiftedSafer = 1;
      m.unchanged = 2;
      m.holdBuckets['0-5'] = 2;
      m.holdBuckets.late = 1;
      return m;
    });
    const small: SessionAggregate = {
      id: 'small',
      createdAt: '2026-10-12T09:00:00.000Z',
      band: 'teen',
      missionIds: perMission.map((m) => m.missionId),
      seatsTotal: 3,
      squadsTotal: 1,
      missionsCompleted: 3,
      perMission,
      lateHold: { good: 0, total: 0 },
      aftershocksDelivered: 0,
      roomFreezePeak: 0,
      lanterns: 2,
      complete: true,
    };
    const r = computeAnalytics([small], [], { band: null, from: null, to: null }, { now: Date.UTC(2026, 9, 12, 10) });
    const row = r.sessions[0];
    expect(row?.holdRate.suppressed).toBe(true);
    expect(row?.shiftedSafer.suppressed).toBe(true);
    expect(row?.lanterns).toBeNull();
    const signals = r.kpis.flatMap((k) => k.signals).filter((x) => x.unit === 'players' || x.unit === 'squads');
    expect(signals.length).toBeGreaterThan(5);
    for (const x of signals) expect(x.stat.value).toBeNull();
    expect(r.holdLatency.every((h) => h.n === null)).toBe(true);
    const csv = reportToCsv(r);
    expect(csv).not.toMatch(/,0\.667,|,0\.333,/);
  });

  it('defuses spreadsheet formulas in exported text', () => {
    const m = emptyMissionAggregate('=HYPERLINK("x")');
    m.squads = 6;
    const agg: SessionAggregate = {
      id: 'a',
      createdAt: '2026-10-12T09:00:00.000Z',
      band: 'teen',
      missionIds: [m.missionId],
      seatsTotal: 30,
      squadsTotal: 6,
      missionsCompleted: 1,
      perMission: [m],
      lateHold: { good: 0, total: 0 },
      aftershocksDelivered: 0,
      roomFreezePeak: 0,
      lanterns: 0,
      complete: true,
    };
    const csv = reportToCsv(computeAnalytics([agg], [], { band: null, from: null, to: null }, { now: Date.UTC(2026, 9, 12) }));
    expect(csv.split('\r\n')[0]).toBe('section,group,measure,unit,n,value,ci95_low,ci95_high,note');
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
    expect(csv).toContain(`"'=HYPERLINK(""x"") (=HYPERLINK(""x""))"`);
  });
});
