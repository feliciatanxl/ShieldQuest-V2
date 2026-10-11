import { describe, expect, it } from 'vitest';
import { MISSION_PHASES, MISSIONS, SCENES, missionById, type Mission, type SceneAnchor } from '@shieldquest/shared';
import {
  PHASE_PROMPT,
  beatViews,
  counterView,
  exitOrder,
  foundIds,
  hypercorrectionClue,
  inspectables,
  liveHeldCounts,
  litTactics,
  nextMissionId,
  pinnedDecoys,
  railLetters,
  ringTactics,
  seededShuffle,
  shieldSlotsFor,
  sniffTarget,
  stageHotspots,
  surgeLine,
} from './runLogic';

const mission = missionById('easy-money') as Mission;

describe('seededShuffle', () => {
  it('is a deterministic permutation for a given seed and salt', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const one = seededShuffle(items, 42, 'x');
    expect(seededShuffle(items, 42, 'x')).toEqual(one);
    expect([...one].sort()).toEqual(items);
    expect(items).toEqual(['a', 'b', 'c', 'd', 'e']); // input untouched
  });

  it('gives different lists independent orders from one run seed', () => {
    const items = Array.from({ length: 8 }, (_, i) => i);
    const differs = Array.from({ length: 20 }, (_, seed) =>
      seededShuffle(items, seed, 'exits').join() !== seededShuffle(items, seed, 'tiles').join(),
    );
    expect(differs.some(Boolean)).toBe(true);
  });
});

describe('exitOrder', () => {
  it('labels exits A-D with neutral patterns and moves the safe exit around across runs', () => {
    const exits = exitOrder(mission, 7);
    expect(exits.map((e) => e.letter)).toEqual(['A', 'B', 'C', 'D'].slice(0, mission.choices.length));
    expect(new Set(exits.map((e) => e.pattern)).size).toBe(exits.length);
    const safeSlots = new Set(
      Array.from({ length: 40 }, (_, seed) => exitOrder(mission, seed).findIndex((e) => e.choice.safety === 'safe')),
    );
    expect(safeSlots.size).toBeGreaterThan(1);
  });
});

describe('the live timeline', () => {
  it('shows typing dots only for the next chat or speech beat, and freezes later beats in mid-air', () => {
    const first = [...mission.live.beats].sort((a, b) => a.at - b.at).find((b) => b.channel === 'chat')!;
    const live = beatViews(mission, first.at - 0.5, false);
    expect(live.filter((v) => v.state === 'typing')).toHaveLength(1);
    const frozen = beatViews(mission, first.at - 0.5, true);
    expect(frozen.some((v) => v.state === 'typing' || v.state === 'pending')).toBe(false);
    expect(frozen.filter((v) => v.state === 'frozen').length).toBeGreaterThan(0);
  });

  it('lights Pressure Ring segments in landing order', () => {
    const ring = ringTactics(mission);
    expect(new Set(ring).size).toBe(ring.length);
    expect(litTactics(mission, 0)).toEqual([]);
    expect(litTactics(mission, mission.live.durationSec)).toEqual(ring);
  });
});

describe('pins and counters', () => {
  const red = mission.clues.filter((c) => c.redFlag);
  const decoy = mission.clues.find((c) => !c.redFlag)!;

  it('counts an unchallenged first look on a red flag as live, and a confirmed pin while holding as held', () => {
    const looks = [red[0]!.id, decoy.id];
    const calls = { [red[1]!.id]: 'flag' as const, [decoy.id]: 'fine' as const };
    const { liveFound, frozenFound } = foundIds(mission, looks, calls);
    expect(liveFound).toEqual([red[0]!.id]);
    expect(frozenFound).toEqual([red[1]!.id]);
    expect(liveHeldCounts(mission, looks, calls)).toEqual({ live: 1, held: 1, total: red.length });
  });

  it('lists pinned decoys for the gentle Release note', () => {
    expect(pinnedDecoys(mission, [], { [decoy.id]: 'flag' }).map((c) => c.id)).toEqual([decoy.id]);
    expect(pinnedDecoys(mission, [], { [decoy.id]: 'fine' })).toEqual([]);
  });

  it('Cluepaw sniffs a quiet place clue first, and nothing once every red flag is pinned', () => {
    expect(sniffTarget(mission, [], {})?.target.kind).toBe('anchor');
    const all = Object.fromEntries(red.map((c) => [c.id, 'flag' as const]));
    expect(sniffTarget(mission, [], all)).toBeNull();
  });
});

describe('scene list and stage', () => {
  const anchors = SCENES[mission.scene] as readonly SceneAnchor[];

  it('puts every clue in the DOM scene list, quiet clues under "Look around"', () => {
    const items = inspectables(mission, anchors);
    const clueIds = new Set(items.flatMap((i) => (i.clue ? [i.clue.id] : [])));
    expect(clueIds.size).toBe(mission.clues.length);
    for (const item of items.filter((i) => i.clue?.target.kind === 'anchor')) expect(item.section).toBe('around');
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  });

  it('only marks landed clues while live, and one hotspot per anchor', () => {
    const atStart = stageHotspots(mission, 'live', 0, [], {});
    const later = stageHotspots(mission, 'live', mission.live.durationSec, [], {});
    expect(later.length).toBeGreaterThanOrEqual(atStart.length);
    expect(new Set(later.map((h) => h.anchor)).size).toBe(later.length);
  });
});

describe('rail and prompts', () => {
  it('marks the current letter and the letters already passed', () => {
    expect(railLetters(mission, 'freeze')).toEqual({ current: 'H', done: ['S'] });
    expect(railLetters(mission, 'saved').done).toEqual(['S', 'H', 'I', 'E', 'L', 'D']);
  });

  it('has a guided prompt for every playable phase', () => {
    for (const phase of MISSION_PHASES) {
      if (phase === 'intro' || phase === 'saved') continue;
      expect(PHASE_PROMPT[phase]).toBeTruthy();
    }
  });
});

describe('explain and release helpers', () => {
  it("Echo's counter-view argues for the safe exit after a risky seal, and for another exit after a safe one", () => {
    const risky = mission.choices.find((c) => c.safety === 'risky')!;
    const safe = mission.choices.find((c) => c.safety === 'safe')!;
    expect(counterView(mission, risky.id)?.choice.safety).toBe('safe');
    expect(counterView(mission, safe.id)?.choice.id).not.toBe(safe.id);
  });

  it('picks a red-flag clue for the private correction note', () => {
    const risky = mission.choices.find((c) => c.safety === 'risky')!;
    expect(hypercorrectionClue(mission, risky.id)?.redFlag).toBe(true);
  });

  it("uses the pusher's own words for the Pressure Surge", () => {
    const line = surgeLine(mission);
    expect(line).not.toBeNull();
    expect(mission.live.beats.some((b) => b.text === line!.text)).toBe(true);
  });
});

describe('band dials', () => {
  it('gives juniors three Peer Shield slots only when success stays reachable', () => {
    for (const m of MISSIONS) {
      if (!m.peerShield) continue;
      expect(shieldSlotsFor(m.peerShield, 'teen')).toEqual(['opener', 'reason', 'offer', 'channel']);
      expect([3, 4]).toContain(shieldSlotsFor(m.peerShield, 'junior').length);
    }
  });

  it('finds the next moment in the same district, or none at the end', () => {
    for (const m of MISSIONS) {
      const next = nextMissionId(m, m.bands[0] ?? null);
      if (next) expect(missionById(next)?.district).toBe(m.district);
    }
  });
});
