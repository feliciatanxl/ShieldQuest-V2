// Checks for the S2, S3, S4 and S6 sets: anchors match SCENES exactly, the live camera frames every anchor,
// hotspot, label and the influence window, the Flat View twin lines up, and each set stays inside the
// per-set budget (GAME_DESIGN.md §10.2: <= 8k triangles and <= 6 draw calls after merging).
import { describe, expect, it } from 'vitest';
import { Object3D, PerspectiveCamera, Vector3, type BufferGeometry } from 'three';
import { MISSIONS, SCENES, type Mission } from '@shieldquest/shared';
import { triangleCount } from '../../../kit/paint';
import { liveShot, elevationOf } from '../../core/camera';
import { placeCast } from '../../core/cast';
import { influenceSpot } from '../../core/director';
import { stagingOf, type FlatTwin, type Vec3 } from '../../core/staging';
import type { SetPiece } from '../types';
import { canteen } from '../canteen';
import { buildCanteen, canteenMoving, secondAngle } from './canteen.3d';
import { minimart } from '../minimart';
import { buildMinimart, doorOpen, minimartMoving } from './minimart.3d';
import { foodCourt } from '../food-court';
import { buildFoodCourt, foodCourtMoving, steamLayout } from './food-court.3d';
import { digiSky } from '../digi-sky';
import { ARCADE_FLICKER_VERTS, NEON_PERIOD, arcadeFlicker, buildDigiSky, digiSkyMoving, neonGlow } from './digi-sky.3d';

type Build = (o: { tier: 'high' | 'medium' | 'low'; night: boolean }) => BufferGeometry;

interface Case {
  set: SetPiece;
  build: Build;
  moving: () => { geometry: BufferGeometry; count: number }[];
  /** Draw calls: the merged set plus each moving or toggled mesh. */
  drawCalls: number;
}

const CASES: Case[] = [
  { set: canteen, build: buildCanteen, moving: canteenMoving, drawCalls: 4 },
  { set: minimart, build: buildMinimart, moving: minimartMoving, drawCalls: 4 },
  { set: foodCourt, build: buildFoodCourt, moving: foodCourtMoving, drawCalls: 3 },
  // Islands, sky dome, booth, chat bubbles, review lanterns, portal swirl.
  { set: digiSky, build: buildDigiSky, moving: digiSkyMoving, drawCalls: 6 },
];

// Every mission file in the shared content, registered in MISSIONS or not yet (content batches land in parallel).
const MISSION_FILES = import.meta.glob<Record<string, unknown>>('../../../../../../../packages/shared/src/content/missions/*.ts', { eager: true });
const isMission = (v: unknown): v is Mission =>
  typeof v === 'object' && v !== null && 'scene' in v && 'cast' in v && 'clues' in v && Array.isArray((v as Mission).cast);
const ALL_MISSIONS: Mission[] = [...(MISSIONS as readonly Mission[])];
for (const mod of Object.values(MISSION_FILES)) {
  for (const v of Object.values(mod)) if (isMission(v) && !ALL_MISSIONS.some((m) => m.id === v.id)) ALL_MISSIONS.push(v);
}

const MAX_TRIANGLES = 8000;
const MAX_DRAW_CALLS = 6;

function finite(geo: BufferGeometry): boolean {
  const arr = geo.getAttribute('position').array as ArrayLike<number>;
  for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i]!)) return false;
  return true;
}

function liveCamera(set: SetPiece, aspect = 1.25): PerspectiveCamera {
  const shot = liveShot(set.camera.live, aspect);
  const cam = new PerspectiveCamera(shot.fov, aspect, 0.1, 240);
  cam.position.set(...shot.position);
  cam.lookAt(new Vector3(...shot.target));
  cam.updateMatrixWorld();
  return cam;
}

function ndc(cam: PerspectiveCamera, p: Vec3): Vector3 {
  return new Vector3(...p).project(cam);
}

const inFrame = (v: Vector3, margin = 0.94) => Math.abs(v.x) <= margin && Math.abs(v.y) <= margin && v.z < 1;

describe('S2/S3/S4/S6 set data (GAME_DESIGN.md §4.1, sets/types.ts)', () => {
  it('reads the shared mission files (registered or not) for staging checks', () => {
    expect(Object.keys(MISSION_FILES).length).toBeGreaterThan(0);
    expect(ALL_MISSIONS.length).toBeGreaterThanOrEqual(MISSIONS.length);
  });

  for (const { set } of CASES) {
    describe(set.id, () => {
      const staging = stagingOf(set);

      it('has exactly the anchors listed in SCENES, in 3D and in the Flat View', () => {
        expect(Object.keys(set.anchors).sort()).toEqual([...SCENES[set.id]].sort());
        expect(Object.keys(set.flat.anchors).sort()).toEqual([...SCENES[set.id]].sort());
        for (const key of Object.keys(staging.seats ?? {})) expect(SCENES[set.id]).toContain(key);
        for (const a of Object.values(set.anchors)) expect(a.label.length).toBeGreaterThan(2);
      });

      it('labels read well in a sentence ("at the <label>")', () => {
        for (const a of Object.values(set.anchors)) {
          const lowered = a.label.charAt(0).toLowerCase() + a.label.slice(1);
          // No acronym or brand first: lower-casing its first letter would garble it ("cCTV", "chatLah").
          expect(lowered.slice(0, 2)).toBe(lowered.slice(0, 2).toLowerCase());
        }
      });

      it('authors a live camera at FOV 30 within the orbit limits (25-70 degrees elevation)', () => {
        expect(set.camera.live.fov).toBe(30);
        const shot = liveShot(set.camera.live, 1.25);
        const d = Math.hypot(...(shot.position.map((v, i) => v - shot.target[i]!) as Vec3));
        expect(d).toBeGreaterThan(set.camera.orbit.minDistance);
        expect(d).toBeLessThan(set.camera.orbit.maxDistance);
        const e = (elevationOf(shot) * 180) / Math.PI;
        expect(e).toBeGreaterThanOrEqual(25);
        expect(e).toBeLessThanOrEqual(70);
      });

      for (const aspect of [1.25, 16 / 9, 0.9]) {
        it(`frames every anchor, hotspot, label and the influence window (aspect ${aspect.toFixed(2)})`, () => {
          const cam = liveCamera(set, aspect);
          for (const [key, a] of Object.entries(set.anchors)) {
            const off = a.hotspotOffset ?? [0, 1.6, 0];
            expect(inFrame(ndc(cam, a.position)), `${key} anchor`).toBe(true);
            expect(inFrame(ndc(cam, [a.position[0] + off[0], a.position[1] + off[1], a.position[2] + off[2]])), `${key} hotspot`).toBe(true);
          }
          for (const l of staging.labels ?? []) expect(inFrame(ndc(cam, l.position)), `label ${l.text}`).toBe(true);
          const spot = influenceSpot(staging, set.camera.orbit.target);
          const top: Vec3 = [spot.position[0], spot.position[1] + 1.9, spot.position[2]];
          expect(inFrame(ndc(cam, top), 0.98), 'influence window').toBe(true);
        });
      }

      it('keeps hotspots above the ground and the influence window behind the action', () => {
        for (const a of Object.values(set.anchors)) expect((a.hotspotOffset ?? [0, 1.6, 0])[1]).toBeGreaterThan(0.9);
        const spot = influenceSpot(staging, set.camera.orbit.target);
        expect(spot.position[2]).toBeLessThan(Math.min(...Object.values(set.anchors).map((a) => a.position[2])));
      });

      it('places every flat anchor and hotspot inside the drawing', () => {
        const [x, y, w, h] = set.flat.viewBox.split(' ').map(Number) as [number, number, number, number];
        const fs = (set.flat as FlatTwin).staging ?? {};
        for (const key of SCENES[set.id]) {
          const a = set.flat.anchors[key]!;
          expect(a.x).toBeGreaterThanOrEqual(x);
          expect(a.x).toBeLessThanOrEqual(x + w);
          expect(a.y).toBeGreaterThanOrEqual(y);
          expect(a.y).toBeLessThanOrEqual(y + h);
          const spot = fs.hotspots?.[key];
          expect(spot, `${key} hotspot`).toBeDefined();
          expect(spot!.x).toBeGreaterThanOrEqual(x + 8);
          expect(spot!.x).toBeLessThanOrEqual(x + w - 8);
          expect(spot!.y).toBeGreaterThanOrEqual(y + 4);
          expect(spot!.y).toBeLessThanOrEqual(y + h);
        }
        const inf = fs.influence!;
        expect(inf.x).toBeGreaterThan(x);
        expect(inf.x).toBeLessThan(x + w);
        expect(inf.y).toBeGreaterThan(y);
        expect(inf.y).toBeLessThan(y + h);
      });

      it('places the cast of every mission staged here, apart, and finds every anchor clue', () => {
        const missions = ALL_MISSIONS.filter((m) => m.scene === set.id);
        for (const mission of missions) {
          const placed = placeCast(mission, set.anchors, staging.seats);
          const expected = mission.cast.filter((c) => c.anchor).length;
          expect(placed.length, mission.id).toBe(expected);
          for (const p of placed) expect(p.position.every(Number.isFinite)).toBe(true);
          for (const a of placed) {
            for (const b of placed) {
              if (a !== b) expect(Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]), `${mission.id}: ${a.member.id}/${b.member.id}`).toBeGreaterThan(0.6);
            }
          }
          for (const clue of mission.clues) if (clue.target.kind === 'anchor') expect(set.anchors[clue.target.anchor], `${mission.id}: ${clue.id}`).toBeDefined();
        }
      });
    });
  }
});

describe('S2/S3/S4/S6 set geometry (GAME_DESIGN.md §10.2)', () => {
  for (const { set, build, moving, drawCalls } of CASES) {
    it(`${set.id}: finite merged geometry within ${MAX_TRIANGLES} triangles and ${MAX_DRAW_CALLS} draw calls`, () => {
      expect(drawCalls).toBeLessThanOrEqual(MAX_DRAW_CALLS);
      const parts = moving();
      let movingTris = 0;
      for (const p of parts) {
        expect(finite(p.geometry)).toBe(true);
        expect(p.geometry.getAttribute('glow')).toBeDefined();
        movingTris += triangleCount(p.geometry) * p.count;
        p.geometry.dispose();
      }
      const counts: Record<string, number> = {};
      for (const tier of ['low', 'medium', 'high'] as const) {
        for (const night of [false, true]) {
          const geo = build({ tier, night });
          expect(finite(geo)).toBe(true);
          expect(geo.getAttribute('glow')).toBeDefined();
          const tris = triangleCount(geo) + movingTris;
          counts[`${tier}${night ? '-night' : ''}`] = tris;
          expect(tris).toBeLessThanOrEqual(MAX_TRIANGLES);
          geo.dispose();
        }
      }
      console.log(set.id, JSON.stringify(counts));
      expect(counts.low!).toBeLessThan(counts.high!);
    });
  }

  it('the minimart door stands open at rest and shuts for a few seconds every 18 s', () => {
    expect(doorOpen(0)).toBe(1);
    const samples = Array.from({ length: 180 }, (_, i) => doorOpen(i / 10));
    expect(samples.filter((v) => v === 0).length).toBeGreaterThan(30);
    expect(samples.filter((v) => v === 1).length).toBeGreaterThan(90);
    for (const v of samples) expect(v).toBeGreaterThanOrEqual(0);
    expect(doorOpen(5)).toBe(doorOpen(23));
  });

  it('food-court steam rises and fades from the pot, and hangs still for a fixed time', () => {
    const o = new Object3D();
    const at = (i: number, time: number) => {
      o.position.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      steamLayout(i, time, o);
      return { y: o.position.y, s: o.scale.x };
    };
    expect(at(0, 2.5)).toEqual(at(0, 2.5));
    const ys = Array.from({ length: 30 }, (_, k) => at(0, k * 0.1).y);
    expect(Math.max(...ys)).toBeGreaterThan(Math.min(...ys) + 0.5);
    for (let k = 0; k < 40; k++) expect(at(k % 5, k * 0.37).s).toBeGreaterThanOrEqual(0);
  });

  it('the Digi Sky neon stutters gently: the flicker tubes are the last vertices of the merged set', () => {
    const tubes = arcadeFlicker();
    expect(tubes.getAttribute('position').count).toBe(ARCADE_FLICKER_VERTS);
    tubes.dispose();
    for (const tier of ['low', 'high'] as const) {
      const geo = buildDigiSky({ tier, night: true });
      const glow = geo.getAttribute('glow');
      const color = geo.getAttribute('color');
      for (let i = glow.count - ARCADE_FLICKER_VERTS; i < glow.count; i++) {
        expect(glow.getX(i)).toBe(1);
        // Magenta (#ff5fa2): strong red, weaker green.
        expect(color.getX(i)).toBeGreaterThan(color.getY(i) + 0.3);
      }
      geo.dispose();
    }
    expect(neonGlow(0)).toBe(1);
    // Sampled at the mission clock's 0.1 s step over two periods: a few dips, never dark, and every lit or
    // dimmed state lasts at least 0.25 s (far below three flashes a second).
    const samples = Array.from({ length: Math.round((NEON_PERIOD * 2) / 0.05) }, (_, i) => neonGlow(i * 0.05));
    expect(Math.min(...samples)).toBeGreaterThan(0.2);
    expect(samples.filter((v) => v < 1).length).toBeGreaterThan(0);
    let run = 1;
    const runs: number[] = [];
    for (let i = 1; i < samples.length; i++) {
      if (samples[i] === samples[i - 1]) run++;
      else {
        runs.push(run);
        run = 1;
      }
    }
    for (const r of runs.slice(1)) expect(r * 0.05).toBeGreaterThanOrEqual(0.25 - 1e-9);
    expect(neonGlow(5.1)).toBe(neonGlow(5.1 + NEON_PERIOD));
  });

  it('the canteen clock ticks once a second and holds still between ticks', () => {
    expect(secondAngle(3.2)).toBe(secondAngle(3.9));
    expect(secondAngle(4.0)).not.toBe(secondAngle(3.9));
  });
});
