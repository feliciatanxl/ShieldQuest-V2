// City Hub camera maths (GAME_DESIGN.md §4.5): an orthographic, isometric-style turntable whose zoom is
// computed from the canvas size, so Lumen always fits a 360x800 phone and a 1920x1080 projector alike.
// Pure functions (no three.js) so they are unit-tested in Node.
import type { DistrictId } from '@shieldquest/shared';
import { CITY, DISTRICT_SPOTS, spotById, type V3 } from './layout';

/** Default turntable angle: a little off-axis so the Stillpoint shows two faces (isometric feel). */
export const HOME_AZIMUTH = 0.32;
export const HOME_ELEVATION = 0.6;
/** Drag clamps the tilt to keep the diorama readable (about 24-58 degrees). */
export const MIN_ELEVATION = 0.42;
export const MAX_ELEVATION = 1.02;
/** Tapping a district plays a 900 ms ease-out zoom (§4.5). */
export const FOCUS_MS = 900;
/** Showcase orbit: one slow lap in 90 s (the projector's idle orbit, §4.5). */
export const SHOWCASE_PERIOD = 90;
/**
 * Camera distance from its target. Orthographic, so it only has to clear the scene: far enough that the near
 * plane never cuts the bay at the bottom of a tall phone screen.
 */
export const CAMERA_DISTANCE = 900;

export interface Basis {
  /** Unit vector from the target towards the camera. */
  dir: V3;
  right: V3;
  up: V3;
}

export function basis(azimuth: number, elevation: number): Basis {
  const ca = Math.cos(azimuth);
  const sa = Math.sin(azimuth);
  const ce = Math.cos(elevation);
  const se = Math.sin(elevation);
  return { dir: [sa * ce, se, ca * ce], right: [ca, 0, -sa], up: [-se * sa, ce, -se * ca] };
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Normalised screen region (0..1, y down) the framed content must fit inside. */
export interface Region {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export type FrameMode = 'overview' | 'focus' | 'decorative';

/**
 * Where the city should sit on screen. The hub's HUD covers the top bar and a bottom dock on phones, and a
 * side panel (bottom sheet on phones) once a district is open; decorative views (home page hero) use it all.
 */
export function viewRegion(aspect: number, mode: FrameMode): Region {
  if (mode === 'decorative') return { x0: 0.04, x1: 0.96, y0: 0.05, y1: 0.95 };
  if (mode === 'focus') {
    return aspect < 1 ? { x0: 0.05, x1: 0.95, y0: 0.1, y1: 0.42 } : { x0: 0.03, x1: 0.6, y0: 0.13, y1: 0.88 };
  }
  return aspect < 0.8 ? { x0: 0.03, x1: 0.97, y0: 0.13, y1: 0.66 } : { x0: 0.04, x1: 0.96, y0: 0.12, y1: 0.86 };
}

export interface Framing {
  /** Pixels per metre (orthographic camera zoom). */
  zoom: number;
  /** Camera offset inside its view plane (metres along `right` and `up`). */
  shiftU: number;
  shiftV: number;
}

/** Fits `points` (world) into `region` of a `width` x `height` canvas, seen along `b` around `target`. */
export function fitView(points: readonly V3[], target: V3, b: Basis, width: number, height: number, region: Region): Framing {
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (const p of points) {
    const d: V3 = [p[0] - target[0], p[1] - target[1], p[2] - target[2]];
    const u = dot(d, b.right);
    const v = dot(d, b.up);
    if (u < u0) u0 = u;
    if (u > u1) u1 = u;
    if (v < v0) v0 = v;
    if (v > v1) v1 = v;
  }
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const rw = Math.max(0.05, region.x1 - region.x0) * w;
  const rh = Math.max(0.05, region.y1 - region.y0) * h;
  const zoom = Math.max(0.05, Math.min(rw / Math.max(1e-3, u1 - u0), rh / Math.max(1e-3, v1 - v0)));
  // Region centre in pixels from the canvas centre (y up), then the camera shift that puts the bounds there.
  const rx = ((region.x0 + region.x1) / 2 - 0.5) * w;
  const ry = (0.5 - (region.y0 + region.y1) / 2) * h;
  return { zoom, shiftU: (u0 + u1) / 2 - rx / zoom, shiftV: (v0 + v1) / 2 - ry / zoom };
}

function ring(radius: number, y: number, n: number, cx = 0, cz = 0): V3[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius] as V3;
  });
}

/**
 * Rotation-invariant envelope of the whole city (rim, tower, and the Digi Sky swept round every angle), so the
 * overview zoom never "breathes" while the turntable spins.
 */
export const OVERVIEW_POINTS: readonly V3[] = [
  ...ring(CITY.rim + 4, CITY.sea + 6, 32),
  ...ring(CITY.rim + 4, 5, 32),
  ...ring(CITY.ring + 14, CITY.skyTop - 2, 32),
  // The Stillpoint finial and the highest squad lanterns above it (projector).
  [0, CITY.tower + 6, 0],
];
export const OVERVIEW_TARGET: V3 = [0, 4, 0];

/** Envelope of one district plate (and the sky layer above the Digi-District). */
export function districtPoints(id: DistrictId): V3[] {
  const s = spotById(id);
  const pts = [...ring(CITY.plate + 1, -CITY.plateDepth, 12, s.x, s.z), ...ring(CITY.plate * 0.9, 17, 12, s.x, s.z)];
  if (id === 'digi-district') pts.push(...ring(17, CITY.skyTop, 12, s.x, s.z));
  return pts;
}

export function districtTarget(id: DistrictId): V3 {
  const s = spotById(id);
  return [s.x, id === 'digi-district' ? 14 : 6, s.z];
}

/** Turntable angle that looks at a district from outside the city (nothing stands between). */
export function facingAzimuth(id: DistrictId): number {
  return Math.PI / 2 - spotById(id).angle;
}

/** `to` shifted by whole turns so it is within half a turn of `from` (shortest spin). */
export function nearestAngle(from: number, to: number): number {
  const turn = Math.PI * 2;
  return to + Math.round((from - to) / turn) * turn;
}

/** Every district id the camera can frame. */
export const FRAMABLE = DISTRICT_SPOTS.map((s) => s.id);

/** Ray (origin, unit direction) against a vertical capped cylinder; returns the entry distance or null. */
export function rayCylinder(origin: V3, dir: V3, cx: number, cz: number, radius: number, y0: number, y1: number): number | null {
  let tMin = 0;
  let tMax = Infinity;
  // Slab in y.
  if (Math.abs(dir[1]) < 1e-9) {
    if (origin[1] < y0 || origin[1] > y1) return null;
  } else {
    let a = (y0 - origin[1]) / dir[1];
    let b = (y1 - origin[1]) / dir[1];
    if (a > b) [a, b] = [b, a];
    tMin = Math.max(tMin, a);
    tMax = Math.min(tMax, b);
  }
  // Infinite vertical cylinder in xz.
  const ox = origin[0] - cx;
  const oz = origin[2] - cz;
  const A = dir[0] * dir[0] + dir[2] * dir[2];
  const B = 2 * (ox * dir[0] + oz * dir[2]);
  const C = ox * ox + oz * oz - radius * radius;
  if (A < 1e-12) {
    if (C > 0) return null;
  } else {
    const disc = B * B - 4 * A * C;
    if (disc < 0) return null;
    const sq = Math.sqrt(disc);
    tMin = Math.max(tMin, (-B - sq) / (2 * A));
    tMax = Math.min(tMax, (-B + sq) / (2 * A));
  }
  return tMin <= tMax ? tMin : null;
}

/** View-plane coordinates (metres along `right` and `up`) of a world point. */
export const viewUV = (p: V3, b: Basis): [number, number] => [dot(p, b.right), dot(p, b.up)];

/**
 * Leaves room above the framed content for `rows` of mission pins (their anchor floats near the top of a
 * district's framing points), so a focused district's pins never slide under the top bar.
 */
export function regionWithPins(region: Region, rows: number, height: number, pinSpacing: number): Region {
  const extra = (Math.max(0, rows - 1) * pinSpacing + pinSpacing * 0.55) / Math.max(1, height);
  return { ...region, y0: Math.min(region.y1 - 0.1, region.y0 + extra) };
}

/** Envelope of the city seen from the fixed 2D map angle (tighter than the turntable's rotation-proof one). */
export function mapPoints(): V3[] {
  const sky = districtPoints('digi-district').filter((p) => p[1] > CITY.skyBase);
  return [...ring(CITY.rim + 4, 2, 48), ...ring(CITY.rim + 2, CITY.sea + 5, 24), ...sky, [0, CITY.tower + 6, 0]];
}
