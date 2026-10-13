import { describe, expect, it } from 'vitest';
import { DISTRICT_SPOTS } from '../city/layout';
import {
  BEACONS,
  EXPLORE_WORLD,
  KIOSKS,
  PLACES,
  SHARDS,
  SHARD_IDS,
  SPAWN,
  TOWNIE_PLACES,
  fromLocal,
  toLocal,
  withObstacles,
} from './exploreMap';
import {
  PICKUP_RADIUS,
  PROMPT_RADIUS,
  areaAt,
  byDistance,
  cameraDistance,
  CAMERA,
  clampStick,
  clearYaw,
  findPath,
  hitsObstacle,
  inputToWorld,
  isClear,
  isWalkable,
  nearestClear,
  nearestPlace,
  step,
  tickWalker,
  turnTowards,
  type Walker,
} from './movement';

const W = EXPLORE_WORLD;

describe('explore map data', () => {
  it('has ten shards with stable, unique ids', () => {
    expect(SHARDS).toHaveLength(10);
    expect(new Set(SHARD_IDS).size).toBe(10);
    for (const id of SHARD_IDS) expect(id).toMatch(/^shard-[a-z]+-\d$/);
  });

  it('has one arcade kiosk and one mission beacon per launch district', () => {
    expect(KIOSKS.map((k) => k.district).sort()).toEqual(['digi-district', 'retail-district', 'school-street']);
    expect(BEACONS.map((b) => b.district).sort()).toEqual(['digi-district', 'retail-district', 'school-street']);
    expect(new Set(KIOSKS.map((k) => k.game)).size).toBe(3);
  });

  it('uses unique place ids', () => {
    expect(new Set(PLACES.map((p) => p.id)).size).toBe(PLACES.length);
  });

  it('round-trips local and world coordinates', () => {
    for (const s of DISTRICT_SPOTS) {
      const [x, z] = fromLocal(s, 3, -7);
      const [lx, lz] = toLocal(s, x, z);
      expect(lx).toBeCloseTo(3, 6);
      expect(lz).toBeCloseTo(-7, 6);
    }
  });

  it('spawns on a clear spot on the bridge to School Street', () => {
    expect(isClear(W, SPAWN.x, SPAWN.z)).toBe(true);
    expect(areaAt(W, SPAWN.x, SPAWN.z)).toBe('bridge');
  });

  it('puts every shard and stand point on a clear, walkable spot', () => {
    for (const p of PLACES) {
      expect(isClear(W, p.standX, p.standZ), `${p.id} stand point`).toBe(true);
    }
  });

  it('keeps fogged districts closed', () => {
    for (const s of DISTRICT_SPOTS.filter((d) => d.fogged)) {
      expect(isWalkable(W, s.x, s.z)).toBe(false);
    }
  });

  it('can reach every place from the spawn point', () => {
    const from = { x: SPAWN.x, z: SPAWN.z };
    for (const p of PLACES) {
      const path = findPath(W, from, { x: p.standX, z: p.standZ });
      expect(path, `path to ${p.id}`).not.toBeNull();
      expect(path!.at(-1)).toEqual({ x: p.standX, z: p.standZ });
    }
  });

  it('shows each prompt from its stand point and picks shards up there', () => {
    for (const p of PLACES) {
      const radius = p.kind === 'shard' ? PICKUP_RADIUS : PROMPT_RADIUS;
      const pool = PLACES.filter((q) => (p.kind === 'shard' ? q.kind === 'shard' : q.kind !== 'shard'));
      expect(nearestPlace(pool, p.standX, p.standZ, radius)?.id, p.id).toBe(p.id);
    }
  });

  it('gives each townie a name and a tip', () => {
    for (const t of TOWNIE_PLACES) {
      expect(t.name.length).toBeGreaterThan(2);
      expect(t.tip.length).toBeGreaterThan(20);
    }
  });
});

describe('explore movement', () => {
  it('clamps the stick to the unit disc', () => {
    expect(clampStick(3, 4)).toEqual({ x: 0.6, y: 0.8 });
    expect(clampStick(0.2, 0.1)).toEqual({ x: 0.2, y: 0.1 });
  });

  it('maps forward input away from the camera', () => {
    // Camera at +z (yaw 0): forward is -z, right is +x.
    const f = inputToWorld(0, 1, 0);
    expect(f.dx).toBeCloseTo(0);
    expect(f.dz).toBeCloseTo(-1);
    const r = inputToWorld(1, 0, 0);
    expect(r.dx).toBeCloseTo(1);
    expect(r.dz).toBeCloseTo(0);
  });

  it('does not walk through the clock tower', () => {
    const p = step(W, { x: 0, z: 8 }, 0, -10);
    expect(hitsObstacle(W, p.x, p.z)).toBe(false);
    expect(p.z).toBeGreaterThan(4.6);
  });

  it('slides along a wall instead of stopping dead', () => {
    // Walk diagonally into the tower's +z face: the x part keeps going.
    const p = step(W, { x: 0, z: 6 }, 2, -3);
    expect(p.x).toBeGreaterThan(1.5);
    expect(hitsObstacle(W, p.x, p.z)).toBe(false);
  });

  it('never steps off the plaza into the bay', () => {
    let p = { x: 0, z: 9 };
    for (let i = 0; i < 40; i++) p = step(W, p, 0.5, 0.5);
    expect(isWalkable(W, p.x, p.z)).toBe(true);
  });

  it('crosses a bridge to a district', () => {
    const school = KIOSKS.find((k) => k.district === 'school-street')!;
    const w: Walker = { x: SPAWN.x, z: SPAWN.z, heading: 0, yaw: SPAWN.yaw, path: findPath(W, SPAWN, { x: school.standX, z: school.standZ })!, stuck: 0 };
    for (let i = 0; i < 600 && w.path.length > 0; i++) tickWalker(W, w, { x: 0, y: 0 }, 1 / 30);
    expect(Math.hypot(w.x - school.standX, w.z - school.standZ)).toBeLessThan(0.5);
    expect(areaAt(W, w.x, w.z)).toBe('school-street');
  });

  it('walks forward with the stick and cancels a path', () => {
    const w: Walker = { x: SPAWN.x, z: SPAWN.z, heading: 0, yaw: SPAWN.yaw, path: [{ x: 0, z: 0 }], stuck: 0 };
    const moved = tickWalker(W, w, { x: 0, y: 1 }, 0.1, true);
    expect(moved).toBeGreaterThan(0.3);
    expect(w.path).toHaveLength(0);
  });

  it('turns the short way round', () => {
    expect(turnTowards(3, -3, 0.1)).toBeCloseTo(3.1);
    expect(turnTowards(0, 0.05, 0.1)).toBe(0.05);
  });

  it('finds no path into the sea', () => {
    expect(findPath(W, SPAWN, { x: 0, z: 30 })).toBeNull();
  });

  it('nudges a tap on a building to a clear spot next to it', () => {
    const p = nearestClear(W, 0, 0, 6);
    expect(p).not.toBeNull();
    expect(isClear(W, p!.x, p!.z)).toBe(true);
  });

  it('sorts places by distance', () => {
    const list = byDistance(PLACES, SPAWN.x, SPAWN.z);
    for (let i = 1; i < list.length; i++) expect(list[i]!.distance).toBeGreaterThanOrEqual(list[i - 1]!.distance);
  });

  it('pulls the camera in when a building would block the view', () => {
    // Stand just in front of the school block with the camera behind it: the block hides the player.
    const school = DISTRICT_SPOTS.find((s) => s.id === 'school-street')!;
    const [x, z] = fromLocal(school, 0, -7.6);
    const yawTowardsBlock = Math.atan2(...(() => {
      const [bx, bz] = fromLocal(school, 0, -11.5);
      return [bx - x, bz - z] as [number, number];
    })());
    expect(cameraDistance(W, x, z, yawTowardsBlock)).toBeLessThan(CAMERA.distance);
    // In the open plaza looking away from the tower, nothing blocks it.
    expect(cameraDistance(W, SPAWN.x, SPAWN.z, SPAWN.yaw)).toBe(CAMERA.distance);
  });

  it('turns the camera round a tree canopy after a jump', () => {
    const yaw = SPAWN.yaw;
    const tree = { kind: 'circle' as const, x: SPAWN.x + Math.sin(yaw) * 4, z: SPAWN.z + Math.cos(yaw) * 4, r: 0.4, h: 7, canopy: { r: 2.6, y0: 2 } };
    const w2 = withObstacles(W, [tree]);
    expect(cameraDistance(w2, SPAWN.x, SPAWN.z, yaw)).toBeLessThan(CAMERA.distance);
    const better = clearYaw(w2, SPAWN.x, SPAWN.z, yaw);
    expect(better).not.toBe(yaw);
    expect(cameraDistance(w2, SPAWN.x, SPAWN.z, better)).toBe(CAMERA.distance);
  });

  it('accepts extra obstacles (trees) without changing the base world', () => {
    const w2 = withObstacles(W, [{ kind: 'circle', x: SPAWN.x, z: SPAWN.z - 2, r: 0.5, h: 5 }]);
    expect(w2.obstacles.length).toBe(W.obstacles.length + 1);
    expect(hitsObstacle(w2, SPAWN.x, SPAWN.z - 2)).toBe(true);
    expect(hitsObstacle(W, SPAWN.x, SPAWN.z - 2)).toBe(false);
  });
});
