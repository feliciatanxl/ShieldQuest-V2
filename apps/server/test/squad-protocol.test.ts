// Pure protocol helpers shared by the squad server and the phone / Conductor / Big Screen clients.

import { describe, expect, it } from 'vitest';
import {
  REASON_CHIPS,
  ROLE_ORDER,
  ROOM_CODE_ALPHABET,
  SEAT_TOKEN_RE,
  SQUAD_ROLES,
  chipBoard,
  clockOffset,
  encodeSeatToken,
  holdBucket,
  isRoomCode,
  majorityOf,
  moodFor,
  normalizeRoomCode,
  phaseTiming,
  pickSteelmanSeat,
  roleForSeat,
  shieldSlotsFor,
  steelmanTarget,
  tallyVotes,
  type BandId,
  type SquadRoleId,
} from '@shieldquest/shared';

const seatsOf = (size: number, missionIndex: number, band: BandId) =>
  Array.from({ length: size }, (_, i) => roleForSeat(i, missionIndex, size, band));

describe('room codes and seat tokens', () => {
  it('uses an unambiguous 32-character alphabet', () => {
    expect(ROOM_CODE_ALPHABET).toHaveLength(32);
    for (const ch of ['I', 'O', '0', '1']) expect(ROOM_CODE_ALPHABET).not.toContain(ch);
  });

  it('normalises typed codes and validates them', () => {
    expect(normalizeRoomCode(' h7k-q2m ')).toBe('H7KQ2M');
    expect(isRoomCode('H7KQ2M')).toBe(true);
    expect(isRoomCode('H7KQ0M')).toBe(false);
    expect(isRoomCode('H7KQ2')).toBe(false);
  });

  it('encodes seat tokens as base64url that the handshake accepts', () => {
    const bytes = new Uint8Array(Array.from({ length: 16 }, (_, i) => (i * 37 + 11) & 255));
    const token = encodeSeatToken(bytes);
    expect(token).toBe(Buffer.from(bytes).toString('base64url'));
    expect(SEAT_TOKEN_RE.test(token)).toBe(true);
  });

  it('computes the clock offset from one ping round trip', () => {
    expect(clockOffset(1000, 1600, 1200)).toBe(500);
  });
});

describe('roleForSeat (GDD §6.6)', () => {
  it('deals all five roles to a squad of five and rotates them each mission', () => {
    const m0 = seatsOf(5, 0, 'teen').map((r) => r.role);
    expect(m0).toEqual([...ROLE_ORDER]);
    expect(new Set(m0).size).toBe(5);
    const m1 = seatsOf(5, 1, 'teen').map((r) => r.role);
    expect(m1[0]).toBe(m0[1]);
    expect(m1[4]).toBe(m0[0]);
  });

  it('merges Ripple into Path for four, and Thread into Clue for three', () => {
    const four = seatsOf(4, 0, 'young-adult');
    expect(four.map((r) => r.role)).not.toContain('future-reader');
    const lead = four.find((r) => r.role === 'safety-lead');
    expect(lead?.covers).toEqual(['safety-lead', 'future-reader']);
    expect(lead?.lenses).toEqual(['path', 'ripple']);

    const three = seatsOf(3, 0, 'teen');
    expect(three.map((r) => r.role).sort()).toEqual(['evidence-checker', 'peer-supporter', 'safety-lead']);
    expect(three.find((r) => r.role === 'evidence-checker')?.covers).toEqual(['evidence-checker', 'influence-tracer']);
  });

  it('gives the junior band three lenses (Clue, Heart, Path) and Shadow Clue lenses beyond them', () => {
    const junior = seatsOf(5, 0, 'junior');
    const active = junior.filter((r) => !r.shadow);
    expect(active.map((r) => r.lenses[0]).sort()).toEqual(['clue', 'heart', 'path']);
    expect(junior.filter((r) => r.shadow)).toHaveLength(2);
  });

  it('adds one Shadow Clue lens for a squad of six', () => {
    const six = seatsOf(6, 0, 'teen');
    const shadows = six.filter((r) => r.shadow);
    expect(shadows).toHaveLength(1);
    expect(shadows[0]?.lenses).toEqual(['clue']);
  });

  it('always carries every job, whatever the squad size or band', () => {
    for (const band of ['junior', 'teen', 'young-adult'] as const) {
      for (let size = 1; size <= 7; size++) {
        for (let mission = 0; mission < 3; mission++) {
          const covered = new Set<SquadRoleId>(seatsOf(size, mission, band).flatMap((r) => r.covers));
          expect([...covered].sort()).toEqual(SQUAD_ROLES.map((r) => r.id).sort());
        }
      }
    }
  });

  it('deals each seat one or two Peer Shield slots, and every slot of the band is owned', () => {
    for (const [band, slots] of [
      ['teen', ['channel', 'offer', 'opener', 'reason']],
      ['junior', ['channel', 'offer', 'opener']],
    ] as const) {
      for (const size of [3, 4, 5]) {
        const seats = seatsOf(size, 0, band).filter((r) => !r.shadow);
        const owned = new Set(seats.flatMap((r) => shieldSlotsFor(r, band)));
        expect([...owned].sort()).toEqual([...slots]);
        for (const r of seats) {
          const n = shieldSlotsFor(r, band).length;
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(2);
        }
      }
    }
  });
});

describe('votes: tallies, mood, majority and ties', () => {
  const ids = ['a', 'b', 'c'];

  it('counts per choice in authored order and ignores unknown ids', () => {
    expect(tallyVotes(ids, ['b', 'a', 'b', 'zzz'])).toEqual([
      { choiceId: 'a', n: 1 },
      { choiceId: 'b', n: 2 },
      { choiceId: 'c', n: 0 },
    ]);
  });

  it('reads the mood as United / Mostly agree / Split', () => {
    expect(moodFor(tallyVotes(ids, ['a', 'a', 'a', 'a', 'a']))).toBe('united');
    expect(moodFor(tallyVotes(ids, ['a', 'a', 'a', 'a', 'b']))).toBe('mostly');
    expect(moodFor(tallyVotes(ids, ['a', 'a', 'b']))).toBe('mostly');
    expect(moodFor(tallyVotes(ids, ['a', 'a', 'a', 'b', 'b']))).toBe('split');
    expect(moodFor(tallyVotes(ids, []))).toBeNull();
  });

  it('finds the majority, or the tied choices for the Safety Lead', () => {
    expect(majorityOf(tallyVotes(ids, ['a', 'a', 'b']))).toEqual({ winner: 'a', tied: [] });
    expect(majorityOf(tallyVotes(ids, ['b', 'a', 'a', 'b', 'c']))).toEqual({ winner: null, tied: ['a', 'b'] });
    expect(majorityOf(tallyVotes(ids, []))).toEqual({ winner: null, tied: [] });
  });

  it('aims the Steelman card at the least-picked minority Exit', () => {
    expect(steelmanTarget(tallyVotes(ids, ['a', 'a', 'a', 'b', 'c']))).toBe('b');
    expect(steelmanTarget(tallyVotes(ids, ['a', 'a', 'b', 'b']))).toBe('b');
    expect(steelmanTarget(tallyVotes(ids, ['a', 'a']))).toBeNull();
  });
});

describe('reason chips', () => {
  it('shows a chip only when at least two players picked it and pools the rest', () => {
    const board = chipBoard([['too-urgent'], ['too-urgent', 'cant-verify'], ['too-good'], []]);
    expect(board).toEqual({ chips: [{ chipId: 'too-urgent', n: 2 }], other: 2, players: 3 });
  });

  it('counts a chip once per player and at most two chips each', () => {
    const board = chipBoard([
      ['easy-money', 'easy-money'],
      ['easy-money', 'who-gains', 'need-money'],
    ]);
    expect(board.chips).toEqual([{ chipId: 'easy-money', n: 2 }]);
    expect(board.other).toBe(1);
  });

  it('offers the seven GDD chips', () => {
    expect(REASON_CHIPS.map((c) => c.id)).toHaveLength(7);
  });
});

describe('Steelman seat pick', () => {
  const seats = ['s1', 's2', 's3', 's4', 's5'];

  it('is deterministic for a seed and independent of anything but seed, mission, squad and deal', () => {
    const a = pickSteelmanSeat('seed', 0, 'hornbill', 0, seats);
    expect(pickSteelmanSeat('seed', 0, 'hornbill', 0, seats)).toBe(a);
    expect(seats).toContain(a);
  });

  it('spreads cards across every seat', () => {
    const picked = new Set<string | null>();
    for (let deal = 0; deal < 200; deal++) picked.add(pickSteelmanSeat('seed', 1, 'heron', deal, seats));
    expect(picked).toEqual(new Set(seats));
    expect(pickSteelmanSeat('seed', 0, 'heron', 0, [])).toBeNull();
  });
});

describe('hold latency buckets', () => {
  it('buckets seconds into Live and treats no hold as late', () => {
    expect(holdBucket(0, 60)).toBe('0-5');
    expect(holdBucket(4.9, 60)).toBe('0-5');
    expect(holdBucket(5, 60)).toBe('5-15');
    expect(holdBucket(29.9, 60)).toBe('15-30');
    expect(holdBucket(30, 60)).toBe('30+');
    expect(holdBucket(60, 60)).toBe('late');
    expect(holdBucket(null, 60)).toBe('late');
    expect(holdBucket(Number.NaN, 60)).toBe('late');
  });
});

describe('phase timing (GDD §5.3, §5.4)', () => {
  it('uses the reference timings, the Wildcard Sprint and band dials', () => {
    const guided = phaseTiming({ band: 'teen', scaffold: 'guided' });
    expect([guided.roleFlip, guided.freezeEnd, guided.think, guided.sealLock, guided.reveal, guided.explain, guided.reseal]).toEqual([
      15, 210, 30, 10, 15, 120, 20,
    ]);
    const sprint = phaseTiming({ band: 'young-adult', scaffold: 'wildcard' });
    expect(sprint.freezeEnd).toBe(150);
    expect(sprint.explain).toBe(60);
    expect(phaseTiming({ band: 'junior', scaffold: 'guided' }).think).toBeGreaterThan(guided.think);
    expect(phaseTiming({ band: 'teen', scaffold: 'guided', relaxed: true }).explain).toBeGreaterThan(guided.explain);
  });
});
