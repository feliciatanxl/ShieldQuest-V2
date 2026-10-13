import { describe, expect, it } from 'vitest';
import {
  BOARD,
  BOARD_DISTRICTS,
  COSMETICS,
  DAILY_ROLLS,
  MAX_ROLLS,
  STARS,
  buyCosmetic,
  dailyMiniGame,
  dayKey,
  districtTiles,
  emptyRewards,
  equipCosmetic,
  generateHandle,
  recordChance,
  recordMiniGame,
  recordMission,
  recordShard,
  roll,
  skipLanded,
  topUpDaily,
  type RewardsState,
} from '../src';

const DAY = Date.parse('2026-11-02T04:00:00Z'); // 12:00 in Singapore
const fixed = (n: number) => () => n;
/** rng value that makes roll() produce `die`. */
const die = (n: number) => fixed((n - 1) / 6 + 0.01);

const fresh = (): RewardsState => emptyRewards(fixed(0));

describe('days', () => {
  it('uses Singapore midnight', () => {
    expect(dayKey(Date.parse('2026-11-01T15:59:00Z'))).toBe('2026-11-01');
    expect(dayKey(Date.parse('2026-11-01T16:00:00Z'))).toBe('2026-11-02');
  });

  it('rotates the mini-game of the day', () => {
    const games = new Set(['2026-11-01', '2026-11-02', '2026-11-03'].map(dailyMiniGame));
    expect(games.size).toBe(3);
  });
});

describe('board', () => {
  it('has HQ first and six tiles per launch district', () => {
    expect(BOARD).toHaveLength(21);
    expect(BOARD[0]!.kind).toBe('hq');
    for (const d of BOARD_DISTRICTS) expect(districtTiles(d)).toHaveLength(6);
    expect(new Set(BOARD.map((t) => t.id)).size).toBe(BOARD.length);
  });

  it('tops rolls up once a day without removing banked rolls', () => {
    const a = topUpDaily(fresh(), DAY);
    expect(a.added).toBe(DAILY_ROLLS);
    expect(topUpDaily(a.state, DAY).added).toBe(0);
    const banked = { ...a.state, rolls: 7 };
    expect(topUpDaily(banked, DAY + 86_400_000).state.rolls).toBe(7);
  });

  it('moves, lands, and blocks rolling until the tile is finished or skipped', () => {
    const s = topUpDaily(fresh(), DAY).state;
    const r = roll(s, die(2))!;
    expect(r.die).toBe(2);
    expect(r.path).toEqual([1, 2]);
    expect(r.state.landed).toBe(BOARD[2]!.id);
    expect(r.state.badges).toContain('first-roll');
    expect(roll(r.state, die(1))).toBeNull();
    expect(roll(skipLanded(r.state), die(1))).not.toBeNull();
  });

  it('pays for passing HQ and for the bonus corner', () => {
    const near = { ...fresh(), rolls: 2, position: 19 };
    const r = roll(near, die(3))!;
    expect(r.event.passedHq).toBe(true);
    expect(r.state.position).toBe(1);
    expect(r.state.stars).toBe(STARS.passHq);

    const bonus = roll({ ...fresh(), rolls: 1, position: 5 }, die(2))!;
    expect(BOARD[bonus.state.position]!.kind).toBe('bonus');
    expect(bonus.state.landed).toBeNull();
    expect(bonus.state.stars).toBe(STARS.bonusTile);
  });
});

describe('claiming', () => {
  const landedOn = (id: string): RewardsState => ({ ...fresh(), landed: id });

  it('claims a matching mini-game tile only at the pass score, and always returns a roll', () => {
    const tile = BOARD.find((t) => t.kind === 'minigame' && t.minigame === 'wordsearch')!;
    const low = recordMiniGame(landedOn(tile.id), { game: 'wordsearch', score: 0.5 }, DAY);
    expect(low.state.claimed).toEqual([]);
    expect(low.state.landed).toBeNull();
    expect(low.event.rolls).toBe(1);

    const ok = recordMiniGame(landedOn(tile.id), { game: 'wordsearch', score: 0.8 }, DAY);
    expect(ok.state.claimed).toEqual([tile.id]);
    expect(ok.state.badges).toContain('first-claim');
  });

  it('ignores a different game than the landed tile', () => {
    const tile = BOARD.find((t) => t.kind === 'minigame' && t.minigame === 'wordsearch')!;
    const r = recordMiniGame(landedOn(tile.id), { game: 'money-trail', score: 1 }, DAY);
    expect(r.state.landed).toBe(tile.id);
    expect(r.state.claimed).toEqual([]);
  });

  it('claims mission tiles in the same district on any path', () => {
    const tile = BOARD.find((t) => t.kind === 'mission' && t.district === 'retail-district')!;
    const r = recordMission(landedOn(tile.id), { district: 'retail-district', firstTime: true, safety: 'risky' }, DAY);
    expect(r.state.claimed).toEqual([tile.id]);
  });

  it('secures a district and then the city', () => {
    let s = fresh();
    s.claimed = BOARD.filter((t) => t.district && t.id !== 'digi-district-5').map((t) => t.id);
    s.badges = ['secured-school-street', 'secured-retail-district'];
    s.landed = 'digi-district-5';
    const r = recordMiniGame(s, { game: 'money-trail', score: 1 }, DAY);
    expect(r.event.secured).toBe('digi-district');
    expect(r.state.badges).toEqual(expect.arrayContaining(['secured-digi-district', 'city-secured']));
    expect(r.state.owned).toEqual(expect.arrayContaining(['token-lantern', 'title-guardian']));
  });

  it('caps banked rolls', () => {
    const r = recordChance({ ...landedOn('pop-quiz'), rolls: MAX_ROLLS }, true, DAY);
    expect(r.state.rolls).toBe(MAX_ROLLS);
    expect(r.state.claimed).toEqual([]); // the corner Pop Quiz is never claimable
  });
});

describe('stars and streaks', () => {
  it('doubles the mini-game of the day', () => {
    const today = dailyMiniGame(dayKey(DAY));
    const other = (['wordsearch', 'real-or-fake', 'money-trail'] as const).find((g) => g !== today)!;
    const streak = STARS.streakPerDay;
    expect(recordMiniGame(fresh(), { game: today, score: 1 }, DAY).state.stars).toBe(STARS.miniGameMax * 2 + streak);
    expect(recordMiniGame(fresh(), { game: other, score: 1 }, DAY).state.stars).toBe(STARS.miniGameMax + streak);
  });

  it('counts consecutive days and resets after a gap', () => {
    let s = fresh();
    for (let d = 0; d < 3; d++) s = recordChance(s, false, DAY + d * 86_400_000).state;
    expect(s.streak).toBe(3);
    expect(s.badges).toContain('streak-3');
    s = recordChance(s, false, DAY + 5 * 86_400_000).state;
    expect(s.streak).toBe(1);
    expect(s.bestStreak).toBe(3);
  });

  it('only awards the streak bonus once per day', () => {
    const a = recordChance(fresh(), false, DAY);
    const b = recordChance(a.state, false, DAY + 1000);
    expect(a.event.streakBonus).toBe(STARS.streakPerDay);
    expect(b.event.streakBonus).toBe(0);
  });

  it('collects each shard once per day', () => {
    const a = recordShard(fresh(), 'shard-1', DAY)!;
    expect(a.state.stars).toBe(STARS.shard);
    expect(recordShard(a.state, 'shard-1', DAY + 1000)).toBeNull();
    expect(recordShard(a.state, 'shard-1', DAY + 86_400_000)).not.toBeNull();
  });
});

describe('locker', () => {
  it('sells fixed-price items and never badge items', () => {
    const rich = { ...fresh(), stars: 100 };
    const bought = buyCosmetic(rich, 'token-crane')!;
    expect(bought.stars).toBe(60);
    expect(buyCosmetic(bought, 'token-crane')).toBeNull();
    expect(buyCosmetic(rich, 'token-lantern')).toBeNull();
    expect(buyCosmetic(fresh(), 'token-durian')).toBeNull();
    expect(equipCosmetic(bought, 'token-crane')!.equipped.token).toBe('token-crane');
    expect(equipCosmetic(rich, 'token-crane')).toBeNull();
  });

  it('starts with the free items equipped', () => {
    const s = fresh();
    for (const id of Object.values(s.equipped)) expect(s.owned).toContain(id);
    expect(COSMETICS.filter((c) => c.badge).every((c) => !s.owned.includes(c.id))).toBe(true);
  });

  it('generates handles from word lists only', () => {
    expect(generateHandle(fixed(0))).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+-\d{4}$/);
  });
});
