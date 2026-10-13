import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { MISSIONS, SCENES, missionById, type Mission } from '@shieldquest/shared';
// Not registered in MISSIONS yet (school content is still being written); staged on the school gate set.
import { busStopPickup } from '../../../../../packages/shared/src/content/missions/bus-stop-pickup';
import { triangleCount } from '../kit/paint';
import { voidDeck } from './sets/void-deck';
import { schoolGate } from './sets/school-gate';
import { bedroom } from './sets/bedroom';
import type { SetPiece } from './sets/types';
import { buildVoidDeck } from './core/sets3d/void-deck';
import { buildSchoolGate, carX } from './core/sets3d/school-gate';
import { buildBedroom } from './core/sets3d/bedroom';
import {
  ELEVATION_MAX,
  ELEVATION_MIN,
  FREEZE_FOV,
  aspectFit,
  clampShot,
  elevationOf,
  liveShot,
  orbitLimits,
  orbitStep,
  punchShot,
  railStops,
  swayPixels,
} from './core/camera';
import { castExpression, placeCast } from './core/cast';
import { directorFocus, gazeTargets, pendingCards, placeHotspots, threadEnds, influenceSpot } from './core/director';
import { stagingOf, type FlatTwin } from './core/staging';

const MINE: SetPiece[] = [voidDeck, schoolGate, bedroom];

function finite(geo: BufferGeometry): boolean {
  const arr = geo.getAttribute('position').array as ArrayLike<number>;
  for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i]!)) return false;
  return true;
}

describe('set data (GAME_DESIGN.md §4.1, sets/types.ts)', () => {
  for (const set of MINE) {
    describe(set.id, () => {
      it('has exactly the anchors listed in SCENES', () => {
        expect(Object.keys(set.anchors).sort()).toEqual([...SCENES[set.id]].sort());
        expect(Object.keys(set.flat.anchors).sort()).toEqual([...SCENES[set.id]].sort());
      });

      it('places every flat anchor and hotspot inside the drawing', () => {
        const [x, y, w, h] = set.flat.viewBox.split(' ').map(Number) as [number, number, number, number];
        const staging = (set.flat as FlatTwin).staging ?? {};
        for (const key of SCENES[set.id]) {
          const a = set.flat.anchors[key]!;
          expect(a.x).toBeGreaterThanOrEqual(x);
          expect(a.x).toBeLessThanOrEqual(x + w);
          expect(a.y).toBeGreaterThanOrEqual(y);
          expect(a.y).toBeLessThanOrEqual(y + h);
          const spot = staging.hotspots?.[key];
          expect(spot, `${key} hotspot`).toBeDefined();
          expect(spot!.x).toBeGreaterThanOrEqual(x + 8);
          expect(spot!.x).toBeLessThanOrEqual(x + w - 8);
          expect(spot!.y).toBeGreaterThanOrEqual(y + 4);
          expect(spot!.y).toBeLessThanOrEqual(y + h);
        }
        const inf = staging.influence!;
        expect(inf.x).toBeGreaterThan(x);
        expect(inf.x).toBeLessThan(x + w);
        expect(inf.y).toBeGreaterThan(y);
        expect(inf.y).toBeLessThan(y + h);
      });

      it('authors a live camera at FOV 30 and an orbit that contains the live distance', () => {
        expect(set.camera.live.fov).toBe(30);
        const live = liveShot(set.camera.live, 1.25);
        const d = Math.hypot(...live.position.map((v, i) => v - live.target[i]!) as [number, number, number]);
        expect(d).toBeGreaterThan(set.camera.orbit.minDistance);
        expect(d).toBeLessThan(set.camera.orbit.maxDistance);
      });

      it('keeps hotspots above the ground and the influence window behind the action', () => {
        for (const a of Object.values(set.anchors)) expect((a.hotspotOffset ?? [0, 1.6, 0])[1]).toBeGreaterThan(0.9);
        const spot = influenceSpot(stagingOf(set), set.camera.orbit.target);
        expect(spot.position[2]).toBeLessThan(Math.min(...Object.values(set.anchors).map((a) => a.position[2])));
      });
    });
  }
});

describe('set geometry (GAME_DESIGN.md §10.2)', () => {
  const builders: [string, (o: { tier: 'high' | 'medium' | 'low'; night: boolean }) => BufferGeometry][] = [
    ['void-deck', buildVoidDeck],
    ['school-gate', buildSchoolGate],
    ['bedroom', buildBedroom],
  ];
  for (const [id, build] of builders) {
    it(`${id}: one finite merged geometry within the per-scene triangle budget on every tier`, () => {
      for (const tier of ['low', 'medium', 'high'] as const) {
        for (const night of [false, true]) {
          const geo = build({ tier, night });
          expect(finite(geo)).toBe(true);
          const tris = triangleCount(geo);
          // Leaves room under the low tier's 40k for beans (<= 300 each), hotspots, rain and the string.
          expect(tris).toBeLessThan(tier === 'low' ? 26000 : 34000);
          expect(geo.getAttribute('glow')).toBeDefined();
          geo.dispose();
        }
      }
    });
  }

  it('the low tier is lighter than high', () => {
    const low = buildSchoolGate({ tier: 'low', night: true });
    const high = buildSchoolGate({ tier: 'high', night: true });
    expect(triangleCount(low)).toBeLessThan(triangleCount(high));
  });

  it('the passing car crosses the stage and then leaves it', () => {
    const xs = Array.from({ length: 130 }, (_, i) => carX(i / 10));
    expect(xs.some((x) => x !== null && Math.abs(x) < 2)).toBe(true);
    expect(xs.some((x) => x === null)).toBe(true);
  });
});

describe('camera rig maths (GAME_DESIGN.md §4.5)', () => {
  const set = voidDeck;
  const live = liveShot(set.camera.live, 1.25);
  const base0 = punchShot(live, set.camera.orbit.target);
  const limits = orbitLimits(base0, set.camera.orbit);
  const base = clampShot(base0, limits);

  it('punches in to FOV 26 inside the 25-70° elevation band', () => {
    expect(base.fov).toBe(FREEZE_FOV);
    const e = elevationOf(base);
    expect(e).toBeGreaterThanOrEqual(ELEVATION_MIN - 1e-6);
    expect(e).toBeLessThanOrEqual(ELEVATION_MAX + 1e-6);
  });

  it('never orbits past ±75° from the authored front', () => {
    let shot = base;
    for (let i = 0; i < 40; i++) shot = orbitStep(shot, limits, 0.2, 0);
    const front = Math.atan2(base.position[0] - base.target[0], base.position[2] - base.target[2]);
    const now = Math.atan2(shot.position[0] - shot.target[0], shot.position[2] - shot.target[2]);
    expect(Math.abs(now - front)).toBeLessThanOrEqual((75 * Math.PI) / 180 + 1e-6);
  });

  it('pulls back on narrow stages, within limits', () => {
    expect(aspectFit(2)).toBe(1);
    expect(aspectFit(0.78)).toBeGreaterThan(1.4);
    expect(aspectFit(0.3)).toBeLessThanOrEqual(1.9);
  });

  it('derives four junior rail stops', () => {
    expect(railStops(base, undefined)).toHaveLength(4);
  });

  it('sways 2 px calm and 3 px at full pressure', () => {
    expect(swayPixels(0)).toBe(2);
    expect(swayPixels(1)).toBe(3);
  });
});

describe('every shipped mission stages on its set', () => {
  const staged = [...MISSIONS, busStopPickup].filter((m, i, all) => all.findIndex((x) => x.id === m.id) === i && MINE.some((s) => s.id === m.scene));
  it('covers the school gate as well as the void deck', () => {
    expect(new Set(staged.map((m) => m.scene))).toEqual(new Set(['void-deck', 'school-gate']));
  });
  for (const mission of staged) {
    it(`${mission.id}: cast anchors exist and nobody shares a spot`, () => {
      const set = MINE.find((s) => s.id === mission.scene)!;
      const placed = placeCast(mission, set.anchors, stagingOf(set).seats);
      for (const c of mission.cast) if (c.anchor) expect(set.anchors[c.anchor], `${c.id} at ${c.anchor}`).toBeDefined();
      for (const a of placed) for (const b of placed) if (a !== b) expect(Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2])).toBeGreaterThan(0.5);
      for (const clue of mission.clues) if (clue.target.kind === 'anchor') expect(set.anchors[clue.target.anchor]).toBeDefined();
    });
  }
});

describe('staging the reference mission on the void deck', () => {
  const mission = missionById('easy-money') as Mission;
  const placements = placeCast(mission, voidDeck.anchors, stagingOf(voidDeck).seats);

  it('omits the remote manipulator and seats Dev at the stone table', () => {
    expect(placements.map((p) => p.member.id).sort()).toEqual(['auntie', 'dev', 'ren']);
    expect(placements.find((p) => p.member.id === 'dev')!.seated).toBe(true);
    expect(placements.every((p) => p.kind === 'bean')).toBe(true);
  });

  it('dollies to the phone when Mel messages, and cuts to Dev when he speaks', () => {
    const toPhone = directorFocus(mission, placements, 'ren');
    expect(toPhone?.cut).toBe(false);
    const toDev = directorFocus(mission, placements, 'dev');
    expect(toDev?.cut).toBe(true);
    expect(toDev?.who).toBe('dev');
  });

  it('turns everyone towards the speaker', () => {
    const gaze = gazeTargets(placements, 'dev', 'live');
    expect(gaze.get('ren')).not.toBeNull();
    expect(gaze.get('auntie')).not.toBeNull();
  });

  it('is worried while tense and relieved when warm', () => {
    expect(castExpression('resident', 'tense', 'live', true)).toBe('worried');
    expect(castExpression('resident', 'warm', 'released', true)).toBe('relieved');
  });

  it('spreads clues that share an anchor and skips hidden ones', () => {
    const spots = placeHotspots(
      [
        { clueId: 'a', anchor: 'bench', state: 'available' },
        { clueId: 'b', anchor: 'bench', state: 'found-flag' },
        { clueId: 'c', anchor: 'pillar', state: 'hidden' },
      ],
      voidDeck.anchors,
    );
    expect(spots).toHaveLength(2);
    expect(spots[0]!.position[0]).not.toBeCloseTo(spots[1]!.position[0], 2);
    expect(spots[0]!.label).toBe('Bench (1 of 2)');
  });

  it('runs the string from Dev to the window, and hangs unarrived messages only while held', () => {
    const spot = influenceSpot(stagingOf(voidDeck), voidDeck.camera.orbit.target);
    const ends = threadEnds({ from: 'dev', revealed: false }, placements, spot);
    expect(ends?.fromId).toBe('dev');
    expect(ends!.to[1]).toBeGreaterThan(3);
    expect(pendingCards(mission, 30, 'frozen')).toBeGreaterThan(0);
    expect(pendingCards(mission, 30, 'live')).toBe(0);
  });
});
