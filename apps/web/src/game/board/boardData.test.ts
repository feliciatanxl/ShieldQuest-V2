import { describe, expect, it } from 'vitest';
import { BOARD, COSMETICS, emptyProgress, emptyRewards, type RewardEvent } from '@shieldquest/shared';
import { describeEvent } from '../rewards/RewardToast';
import { liveStreak, rollsReady } from '../rewards/live';
import { TOKEN_COLORS, TOKEN_IDS } from '../rewards/tokens';
import { boardProgress, landingSentence, missionChoices, ringPoint, tileAria, tileName } from './boardData';

const DAY = Date.parse('2026-11-02T04:00:00Z');
const noEvent: RewardEvent = { stars: 0, rolls: 0, claimed: null, secured: null, badges: [], passedHq: false, streakBonus: 0 };

describe('city board helpers', () => {
  it('puts HQ at the top of the ring and every tile inside the box', () => {
    const hq = ringPoint(0, 42);
    expect(hq.x).toBeCloseTo(50);
    expect(hq.y).toBeCloseTo(8);
    for (let i = 0; i < BOARD.length; i++) {
      const p = ringPoint(i, 42);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(100);
    }
  });

  it('announces where the token landed', () => {
    const retailFake = BOARD.find((t) => t.district === 'retail-district' && t.minigame === 'real-or-fake')!;
    expect(landingSentence(4, retailFake, false)).toBe('You rolled 4. Landed on Real or Fake? in Retail District.');
    const bonus = BOARD.find((t) => t.kind === 'bonus')!;
    expect(landingSentence(2, bonus, true)).toContain('+15 Stars');
    expect(tileAria(retailFake, 3, true, false)).toContain('claimed');
    expect(tileName(BOARD.find((t) => t.kind === 'mission')!)).toBe('Mission');
  });

  it('counts claimed tiles per district', () => {
    const school = BOARD.filter((t) => t.district === 'school-street').map((t) => t.id);
    const p = boardProgress(school);
    expect(p[0]).toMatchObject({ district: 'school-street', claimed: 6, secured: true });
    expect(p[1]).toMatchObject({ claimed: 0, secured: false });
  });

  it('offers unplayed missions first, then replays', () => {
    const fresh = missionChoices('school-street', 'teen', emptyProgress());
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.every((c) => c.fresh)).toBe(true);
    const first = fresh[0]!.mission.id;
    const progress = { ...emptyProgress(), runs: { [first]: { bestSafety: 'safe' as const, plays: 1, lastAt: 1, lastChoice: 'x' } } };
    const after = missionChoices('school-street', 'teen', progress);
    expect(after[after.length - 1]!.mission.id).toBe(first);
    expect(after[after.length - 1]!.fresh).toBe(false);
  });
});

describe('reward words', () => {
  it('describes a reward event', () => {
    expect(describeEvent(noEvent, 0)).toBeNull();
    const m = describeEvent({ ...noEvent, stars: 75, claimed: 'x', secured: 'school-street', badges: ['streak-3'], rolls: 1 }, 3)!;
    expect(m.title).toBe('+75 Stars');
    expect(m.lines).toContain('School Street secured! +50');
    expect(m.lines).toContain('Badge: 3-Day Streak');
    expect(m.lines).not.toContain('Tile claimed!');
  });

  it('shows streaks and rolls as they stand today', () => {
    const r = { ...emptyRewards(() => 0), streak: 4, lastPlayDay: '2026-10-30' };
    expect(liveStreak(r, DAY)).toBe(0);
    expect(liveStreak({ ...r, lastPlayDay: '2026-11-01' }, DAY)).toBe(4);
    expect(rollsReady({ ...r, rolls: 0, rollsDay: '2026-11-01' }, DAY)).toBe(3);
    expect(rollsReady({ ...r, rolls: 1, rollsDay: '2026-11-02' }, DAY)).toBe(1);
  });

  it('has art for every token and a colour for every colour cosmetic', () => {
    for (const c of COSMETICS) {
      if (c.slot === 'token') expect(TOKEN_IDS).toContain(c.id);
      if (c.slot === 'color') expect(TOKEN_COLORS[c.id]).toBeTruthy();
    }
  });
});
