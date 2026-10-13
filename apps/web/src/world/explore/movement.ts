// Explore mode movement (pure, no three.js): walkable test, collision with slide, input mapping, tap-to-walk
// paths over a small nav graph, proximity, and the third-person camera's clear distance. Unit-tested in Node.
import { hexEdgeDistance } from '../city/layout';
import {
  PLAYER_RADIUS,
  toLocal,
  fromLocal,
  type AreaId,
  type ExploreWorld,
  type Obstacle,
  type Place,
  type WalkArea,
} from './exploreMap';

export interface P2 {
  x: number;
  z: number;
}

// ---------------------------------------------------------------------------------------------------------
// Walkable areas and obstacles
// ---------------------------------------------------------------------------------------------------------

function inArea(a: WalkArea, x: number, z: number, r: number): boolean {
  if (a.kind === 'hex') {
    const dx = x - a.x;
    const dz = z - a.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) return true;
    return d <= hexEdgeDistance(a.radius, Math.atan2(dz, dx), a.corner) - r;
  }
  const vx = a.bx - a.ax;
  const vz = a.bz - a.az;
  const len2 = vx * vx + vz * vz || 1;
  const t = ((x - a.ax) * vx + (z - a.az) * vz) / len2;
  if (t < 0 || t > 1) return false;
  const px = a.ax + vx * t - x;
  const pz = a.az + vz * t - z;
  return Math.hypot(px, pz) <= a.half - r;
}

/** True when a body of radius `r` centred at (x, z) stands fully on a plate or bridge. */
export function isWalkable(world: ExploreWorld, x: number, z: number, r = PLAYER_RADIUS): boolean {
  for (const a of world.areas) if (inArea(a, x, z, r)) return true;
  return false;
}

/** The area containing a point (plates before bridges), or null over the bay. */
export function areaAt(world: ExploreWorld, x: number, z: number): AreaId | null {
  let bridge = false;
  for (const a of world.areas) {
    if (!inArea(a, x, z, 0)) continue;
    if (a.kind === 'hex') return a.id;
    bridge = true;
  }
  return bridge ? 'bridge' : null;
}

/** Signed-ish distance from an obstacle's outline (negative inside). Also returns the outward normal. */
function obstacleContact(o: Obstacle, x: number, z: number): { d: number; nx: number; nz: number } {
  if (o.kind === 'circle') {
    const dx = x - o.x;
    const dz = z - o.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-9) return { d: -o.r, nx: 1, nz: 0 };
    return { d: len - o.r, nx: dx / len, nz: dz / len };
  }
  const [lx, lz] = toLocal(o.frame, x, z);
  const qx = Math.max(o.x0, Math.min(o.x1, lx));
  const qz = Math.max(o.z0, Math.min(o.z1, lz));
  let nlx: number;
  let nlz: number;
  let d: number;
  if (qx === lx && qz === lz) {
    // Inside: push out through the nearest face.
    const faces = [lx - o.x0, o.x1 - lx, lz - o.z0, o.z1 - lz];
    const m = Math.min(...faces);
    const i = faces.indexOf(m);
    nlx = i === 0 ? -1 : i === 1 ? 1 : 0;
    nlz = i === 2 ? -1 : i === 3 ? 1 : 0;
    d = -m;
  } else {
    const dx = lx - qx;
    const dz = lz - qz;
    d = Math.hypot(dx, dz);
    nlx = dx / d;
    nlz = dz / d;
  }
  // Local direction -> world direction (rotation only).
  const c = Math.cos(o.frame.rotY);
  const s = Math.sin(o.frame.rotY);
  return { d, nx: nlx * c + nlz * s, nz: -nlx * s + nlz * c };
}

/** Roofs (pavilions, covered walkways) only block the camera. */
const walkUnder = (o: Obstacle) => o.kind === 'box' && o.roof !== undefined;

/** True when a body of radius `r` overlaps any obstacle. */
export function hitsObstacle(world: ExploreWorld, x: number, z: number, r = PLAYER_RADIUS): boolean {
  for (const o of world.obstacles) if (!walkUnder(o) && obstacleContact(o, x, z).d < r - 1e-6) return true;
  return false;
}

/** A point you can stand on: walkable and clear of obstacles. */
export const isClear = (world: ExploreWorld, x: number, z: number, r = PLAYER_RADIUS) =>
  isWalkable(world, x, z, r) && !hitsObstacle(world, x, z, r);

/** Pushes a body out of every obstacle it overlaps (a few relaxation passes). */
export function pushOut(world: ExploreWorld, x: number, z: number, r = PLAYER_RADIUS): P2 {
  let px = x;
  let pz = z;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const o of world.obstacles) {
      if (walkUnder(o)) continue;
      const c = obstacleContact(o, px, pz);
      if (c.d < r) {
        const by = r - c.d + 1e-4;
        px += c.nx * by;
        pz += c.nz * by;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x: px, z: pz };
}

/**
 * Moves a body by (dx, dz) in small sub-steps, sliding along buildings and the edges of plates and bridges.
 * Never ends inside an obstacle or off the walkable city.
 */
export function step(world: ExploreWorld, from: P2, dx: number, dz: number, r = PLAYER_RADIUS): P2 {
  const len = Math.hypot(dx, dz);
  if (len < 1e-9) return { ...from };
  const n = Math.max(1, Math.ceil(len / 0.2));
  const sx = dx / n;
  const sz = dz / n;
  let p = { ...from };
  const ok = (q: P2) => isWalkable(world, q.x, q.z, r) && !hitsObstacle(world, q.x, q.z, r);
  for (let i = 0; i < n; i++) {
    const tries: P2[] = [
      pushOut(world, p.x + sx, p.z + sz, r),
      pushOut(world, p.x + sx, p.z, r),
      pushOut(world, p.x, p.z + sz, r),
    ];
    const next = tries.find(ok);
    if (!next) break;
    p = next;
  }
  return p;
}

/** Nearest clear point to (x, z) (searching outwards), e.g. for a tap on a building. Null if none nearby. */
export function nearestClear(world: ExploreWorld, x: number, z: number, maxR = 3, r = PLAYER_RADIUS): P2 | null {
  const pushed = pushOut(world, x, z, r);
  if (isClear(world, pushed.x, pushed.z, r)) return pushed;
  for (let rad = 0.5; rad <= maxR; rad += 0.5) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const qx = x + Math.cos(a) * rad;
      const qz = z + Math.sin(a) * rad;
      if (isClear(world, qx, qz, r)) return { x: qx, z: qz };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------------------------------------

/** Clamps a stick/keys vector to the unit disc. */
export function clampStick(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  return len > 1 ? { x: x / len, y: y / len } : { x, y };
}

/**
 * Camera-relative input (x right, y forward) -> world direction. The camera sits at (sin yaw, cos yaw) from the
 * player, so "forward" points away from it.
 */
export function inputToWorld(ix: number, iy: number, yaw: number): { dx: number; dz: number } {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  return { dx: fx * iy + rx * ix, dz: fz * iy + rz * ix };
}

/** Yaw a figure faces when moving along (dx, dz) (0 faces +z). */
export const headingOf = (dx: number, dz: number) => Math.atan2(dx, dz);

/** Wraps an angle to -π..π. */
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Turns `from` towards `to` by at most `maxStep` radians (shortest way round). */
export function turnTowards(from: number, to: number, maxStep: number): number {
  const d = wrapAngle(to - from);
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}

// ---------------------------------------------------------------------------------------------------------
// Tap-to-walk: straight line when clear, otherwise a route over a small nav graph (plates, bridge heads)
// ---------------------------------------------------------------------------------------------------------

/** Bounding circle of an obstacle (world), for cheap broad-phase tests. */
function bounds(o: Obstacle): { x: number; z: number; r: number } {
  if (o.kind === 'circle') return { x: o.x, z: o.z, r: o.r };
  const [x, z] = fromLocal(o.frame, (o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2);
  return { x, z, r: Math.hypot(o.x1 - o.x0, o.z1 - o.z0) / 2 };
}

const boundsCache = new WeakMap<readonly Obstacle[], { x: number; z: number; r: number }[]>();

function obstacleBounds(world: ExploreWorld) {
  let b = boundsCache.get(world.obstacles);
  if (!b) {
    b = world.obstacles.map(bounds);
    boundsCache.set(world.obstacles, b);
  }
  return b;
}

/** Distance from point p to segment a-b. */
function segDistance(px: number, pz: number, a: P2, b: P2): number {
  const vx = b.x - a.x;
  const vz = b.z - a.z;
  const len2 = vx * vx + vz * vz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - a.x) * vx + (pz - a.z) * vz) / len2)) : 0;
  return Math.hypot(a.x + vx * t - px, a.z + vz * t - pz);
}

/** True when a body can walk the straight segment a -> b (sampled every 0.35 m). */
export function segmentClear(world: ExploreWorld, a: P2, b: P2, r = PLAYER_RADIUS): boolean {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(len / 0.35));
  // Broad phase: only obstacles whose bounding circle comes near the segment.
  const bs = obstacleBounds(world);
  const near: Obstacle[] = [];
  world.obstacles.forEach((o, i) => {
    const bb = bs[i]!;
    if (segDistance(bb.x, bb.z, a, b) < bb.r + r) near.push(o);
  });
  const local: ExploreWorld = { areas: world.areas, obstacles: near };
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (!isClear(local, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, r)) return false;
  }
  return true;
}

interface NavGraph {
  nodes: P2[];
  edges: number[][];
}

const graphs = new WeakMap<ExploreWorld, NavGraph>();

function candidateNodes(world: ExploreWorld): P2[] {
  const out: P2[] = [];
  for (const a of world.areas) {
    if (a.kind === 'hex') {
      const f = { x: a.x, z: a.z, rotY: -a.corner };
      out.push({ x: a.x, z: a.z });
      const hub = a.id === 'hub';
      const rings = hub ? [11] : [6, 11, 16.2];
      for (const rr of rings) {
        const n = 12;
        for (let k = 0; k < n; k++) {
          const ang = (k / n) * Math.PI * 2 + (hub || rr === 11 ? Math.PI / n : 0);
          const [x, z] = fromLocal(f, Math.cos(ang) * rr, Math.sin(ang) * rr);
          out.push({ x, z });
        }
      }
    } else {
      // Both bridge heads and the middle of the deck.
      const vx = a.bx - a.ax;
      const vz = a.bz - a.az;
      for (const t of [0.12, 0.5, 0.88]) out.push({ x: a.ax + vx * t, z: a.az + vz * t });
    }
  }
  // Visibility-graph style: just outside every building corner, so routes can turn round them.
  const m = PLAYER_RADIUS + 0.35;
  for (const o of world.obstacles) {
    if (o.kind !== 'box' || o.roof) continue;
    for (const [lx, lz] of [
      [o.x0 - m, o.z0 - m],
      [o.x1 + m, o.z0 - m],
      [o.x1 + m, o.z1 + m],
      [o.x0 - m, o.z1 + m],
    ] as const) {
      const [x, z] = fromLocal(o.frame, lx, lz);
      out.push({ x, z });
    }
  }
  return out.filter((p) => isClear(world, p.x, p.z));
}

export function navGraph(world: ExploreWorld): NavGraph {
  const cached = graphs.get(world);
  if (cached) return cached;
  const nodes = candidateNodes(world);
  const edges: number[][] = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      if (Math.hypot(a.x - b.x, a.z - b.z) > 24) continue;
      if (!segmentClear(world, a, b)) continue;
      edges[i]!.push(j);
      edges[j]!.push(i);
    }
  }
  const g = { nodes, edges };
  graphs.set(world, g);
  return g;
}

/**
 * Waypoints from `from` to `to` (excluding `from`, ending at `to`), or null when `to` is not reachable.
 * Straight when the line is clear; otherwise the shortest route through the nav graph.
 */
export function findPath(world: ExploreWorld, from: P2, to: P2): P2[] | null {
  if (!isClear(world, to.x, to.z)) return null;
  if (segmentClear(world, from, to)) return [{ ...to }];
  const g = navGraph(world);
  const n = g.nodes.length;
  const START = n;
  const GOAL = n + 1;
  const pts = [...g.nodes, from, to];
  const near = (p: P2) => g.nodes.map((q, i) => ({ i, d: Math.hypot(p.x - q.x, p.z - q.z) })).filter((e) => e.d <= 30);
  const startLinks = near(from).filter((e) => segmentClear(world, from, g.nodes[e.i]!));
  const goalLinks = near(to).filter((e) => segmentClear(world, g.nodes[e.i]!, to));
  if (startLinks.length === 0 || goalLinks.length === 0) return null;
  const goalSet = new Map(goalLinks.map((e) => [e.i, e.d]));

  // Dijkstra (tiny graph: a linear scan is fine).
  const dist = new Array<number>(n + 2).fill(Infinity);
  const prev = new Array<number>(n + 2).fill(-1);
  const done = new Array<boolean>(n + 2).fill(false);
  dist[START] = 0;
  const neighbours = (u: number): [number, number][] => {
    if (u === START) return startLinks.map((e) => [e.i, e.d]);
    if (u === GOAL) return [];
    const out: [number, number][] = g.edges[u]!.map((v) => [v, Math.hypot(pts[u]!.x - pts[v]!.x, pts[u]!.z - pts[v]!.z)]);
    const toGoal = goalSet.get(u);
    if (toGoal !== undefined) out.push([GOAL, toGoal]);
    return out;
  };
  for (;;) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n + 2; i++) {
      if (!done[i] && dist[i]! < best) {
        best = dist[i]!;
        u = i;
      }
    }
    if (u === -1 || u === GOAL) break;
    done[u] = true;
    for (const [v, w] of neighbours(u)) {
      if (dist[u]! + w < dist[v]!) {
        dist[v] = dist[u]! + w;
        prev[v] = u;
      }
    }
  }
  if (!Number.isFinite(dist[GOAL]!)) return null;
  const route: P2[] = [];
  for (let v = GOAL; v !== START && v !== -1; v = prev[v]!) route.push({ ...pts[v]! });
  route.reverse();
  return smoothPath(world, from, route);
}

/** Drops waypoints that can be skipped with a clear straight line (fewer zig-zags). */
function smoothPath(world: ExploreWorld, from: P2, route: P2[]): P2[] {
  const out: P2[] = [];
  let anchor = from;
  let i = 0;
  while (i < route.length) {
    let j = route.length - 1;
    while (j > i && !segmentClear(world, anchor, route[j]!)) j--;
    out.push(route[j]!);
    anchor = route[j]!;
    i = j + 1;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// The walker: one tick of player movement from input or a tap-to-walk path
// ---------------------------------------------------------------------------------------------------------

export interface Walker {
  x: number;
  z: number;
  /** Facing yaw (0 faces +z). */
  heading: number;
  /** Camera yaw (camera sits at (sin yaw, cos yaw) from the player). */
  yaw: number;
  /** Remaining tap-to-walk waypoints. */
  path: P2[];
  /** Seconds without progress while following a path (gives up when stuck). */
  stuck: number;
}

export const WALK_SPEED = 6.5;
export const TURN_RATE = 12;

/**
 * Advances the walker by `dt` seconds. `input` is camera-relative (x right, y forward, length <= 1); any input
 * cancels a tap-to-walk path. Returns how far the walker moved.
 */
export function tickWalker(world: ExploreWorld, w: Walker, input: { x: number; y: number }, dt: number, snapTurn = false): number {
  const t = Math.min(Math.max(dt, 0), 0.1);
  let dx = 0;
  let dz = 0;
  const stick = clampStick(input.x, input.y);
  const mag = Math.hypot(stick.x, stick.y);
  if (mag > 0.08) {
    w.path = [];
    const d = inputToWorld(stick.x, stick.y, w.yaw);
    dx = d.dx * WALK_SPEED * t;
    dz = d.dz * WALK_SPEED * t;
  } else if (w.path.length > 0) {
    const target = w.path[0]!;
    const tx = target.x - w.x;
    const tz = target.z - w.z;
    const dist = Math.hypot(tx, tz);
    if (dist < 0.25) {
      w.path.shift();
      w.stuck = 0;
      return 0;
    }
    const s = Math.min(dist, WALK_SPEED * t);
    dx = (tx / dist) * s;
    dz = (tz / dist) * s;
  } else {
    return 0;
  }
  const next = step(world, { x: w.x, z: w.z }, dx, dz);
  const moved = Math.hypot(next.x - w.x, next.z - w.z);
  if (w.path.length > 0) {
    w.stuck = moved < WALK_SPEED * t * 0.2 ? w.stuck + t : 0;
    if (w.stuck > 0.6) {
      w.path = [];
      w.stuck = 0;
    }
  }
  if (moved > 1e-4) {
    const want = headingOf(dx, dz);
    w.heading = snapTurn ? want : turnTowards(w.heading, want, TURN_RATE * t);
  }
  w.x = next.x;
  w.z = next.z;
  return moved;
}

// ---------------------------------------------------------------------------------------------------------
// Proximity and the camera
// ---------------------------------------------------------------------------------------------------------

/** Within this distance (m) of a kiosk, beacon or townie its prompt shows. */
export const PROMPT_RADIUS = 3.3;
/** Within this distance (m) of a Shield Shard you pick it up. */
export const PICKUP_RADIUS = 1.3;

/** The nearest place within `radius` of (x, z) among `places`, or null. */
export function nearestPlace<T extends Place>(places: readonly T[], x: number, z: number, radius: number): T | null {
  let best: T | null = null;
  let bestD = radius;
  for (const p of places) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d <= bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

/** Places sorted by distance from (x, z). */
export function byDistance<T extends Place>(places: readonly T[], x: number, z: number): { place: T; distance: number }[] {
  return places
    .map((place) => ({ place, distance: Math.hypot(place.x - x, place.z - z) }))
    .sort((a, b) => a.distance - b.distance);
}

/** Height (m) of the tallest obstacle covering (x, z), or 0. */
export function heightAt(world: ExploreWorld, x: number, z: number): number {
  let h = 0;
  for (const o of world.obstacles) if (o.h > h && !walkUnder(o) && obstacleContact(o, x, z).d <= 0) h = o.h;
  return h;
}

/** True when an obstacle hides a sight line passing (x, z) at height `line` (buildings, or a tree's canopy). */
export function blocksSight(world: ExploreWorld, x: number, z: number, line: number): boolean {
  for (const o of world.obstacles) {
    // Low things (tables, planters) never hide a whole player.
    if (o.h < 1.2) continue;
    if (o.h <= line && !(o.kind === 'circle' && o.canopy)) continue;
    if (o.kind === 'circle' && o.canopy) {
      if (line >= o.canopy.y0 && line <= o.h && Math.hypot(x - o.x, z - o.z) <= o.canopy.r) return true;
      if (o.h > line && Math.hypot(x - o.x, z - o.z) <= o.r) return true;
      continue;
    }
    if (o.kind === 'box' && o.roof && line < o.roof.y0) continue;
    if (obstacleContact(o, x, z).d <= 0) return true;
  }
  return false;
}

export const CAMERA = {
  distance: 11,
  minDistance: 3,
  /** Look-at height above the player's feet. */
  eye: 1.4,
  /** Downward tilt (radians). */
  pitch: 0.46,
} as const;

/**
 * How far back the camera can sit (along its yaw) before a building or a tree would block the view of the
 * player: walks out from the player and stops just before the first thing taller than the sight line.
 */
export function cameraDistance(world: ExploreWorld, x: number, z: number, yaw: number, max: number = CAMERA.distance, eye: number = CAMERA.eye): number {
  const dirX = Math.sin(yaw);
  const dirZ = Math.cos(yaw);
  const cosP = Math.cos(CAMERA.pitch);
  const tanP = Math.tan(CAMERA.pitch);
  const horizontal = max * cosP;
  for (let h = 0.6; h <= horizontal; h += 0.4) {
    const line = eye + h * tanP;
    if (blocksSight(world, x + dirX * h, z + dirZ * h, line)) return Math.max(CAMERA.minDistance, (h - 0.5) / cosP);
  }
  return max;
}

/**
 * A camera yaw near `yaw` with a clear view (used after a jump): the closest angle, within a half turn either
 * way, whose camera can sit at full distance; `yaw` itself when none is clear.
 */
export function clearYaw(world: ExploreWorld, x: number, z: number, yaw: number, eye: number = CAMERA.eye): number {
  const full = CAMERA.distance;
  let best = yaw;
  let bestD = cameraDistance(world, x, z, yaw, full, eye);
  if (bestD >= full) return yaw;
  for (let k = 1; k <= 12; k++) {
    for (const sign of [1, -1]) {
      const a = yaw + sign * k * (Math.PI / 12);
      const d = cameraDistance(world, x, z, a, full, eye);
      if (d >= full) return a;
      if (d > bestD + 0.5) {
        best = a;
        bestD = d;
      }
    }
  }
  return best;
}
