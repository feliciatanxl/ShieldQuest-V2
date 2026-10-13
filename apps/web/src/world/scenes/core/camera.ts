// Camera maths for mission scenes (GAME_DESIGN.md §4.5). Pure functions (no three.js) so the rig stays small and
// every framing rule is unit-tested: aspect fitting, the live director's lean, the Freeze punch, the constrained
// Hold orbit (±75° azimuth, 25-70° elevation, zoom 0.6-2.0×), junior rail stops and spherical shot blending.
import type { CameraShot, Vec3 } from './staging';

export interface Shot {
  position: Vec3;
  target: Vec3;
  fov: number;
}

export const LIVE_FOV = 30;
export const FREEZE_FOV = 26;
const DEG = Math.PI / 180;
export const ORBIT_AZIMUTH = 75 * DEG;
export const ELEVATION_MIN = 25 * DEG;
export const ELEVATION_MAX = 70 * DEG;
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 2.0;
/** Sets are authored for this stage aspect (width / height); narrower stages pull the camera back. */
export const REF_ASPECT = 1.25;
/** Never pull back more than this on very narrow stages (phone portrait is ~0.78). */
export const MAX_FIT = 1.75;

export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const lerpVec = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const distance = (a: Vec3, b: Vec3) => length(sub(a, b));

/** Spherical coordinates of an offset: radius, azimuth theta = atan2(x, z) (three's OrbitControls), polar phi from +y. */
export interface Spherical {
  radius: number;
  theta: number;
  phi: number;
}

export function toSpherical(offset: Vec3): Spherical {
  const radius = Math.max(1e-6, length(offset));
  return { radius, theta: Math.atan2(offset[0], offset[2]), phi: Math.acos(clamp(offset[1] / radius, -1, 1)) };
}

export function fromSpherical({ radius, theta, phi }: Spherical): Vec3 {
  const s = Math.sin(phi) * radius;
  return [s * Math.sin(theta), Math.cos(phi) * radius, s * Math.cos(theta)];
}

/** Elevation above the horizon (radians) of a shot. */
export const elevationOf = (shot: Shot) => Math.PI / 2 - toSpherical(sub(shot.position, shot.target)).phi;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * How far to pull the camera back so a narrow stage still shows (nearly) the set's authored width. Slightly
 * under-fitted (power 0.9): a sliver of the edges is traded for bigger characters on phones; Hold reveals it.
 */
export function aspectFit(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return 1;
  return clamp((REF_ASPECT / aspect) ** 0.9, 1, MAX_FIT);
}

/** A shot pushed along its view axis by `factor` (1 = unchanged, > 1 further away). */
export function dolly(shot: Shot, factor: number): Shot {
  return { ...shot, position: add(shot.target, scale(sub(shot.position, shot.target), factor)) };
}

export function toShot(shot: CameraShot, fov = LIVE_FOV): Shot {
  return { position: [...shot.position], target: [...shot.target], fov: shot.fov ?? fov };
}

/** Extra elevation per unit of aspect fit: narrow stages look down a little more, so the floor fills them. */
const FIT_TILT = 0.36;

/** The authored live framing, fitted to the stage aspect (pulled back and tilted down on narrow stages). */
export function liveShot(live: CameraShot, aspect: number): Shot {
  const fit = aspectFit(aspect);
  const shot = toShot(live);
  if (fit === 1) return shot;
  const s = toSpherical(sub(shot.position, shot.target));
  const phi = Math.max(20 * DEG, s.phi - (fit - 1) * FIT_TILT);
  return { ...shot, position: add(shot.target, fromSpherical({ radius: s.radius * fit, theta: s.theta, phi })) };
}

/** Where the intro glide starts: further back and higher than the live framing (a slow crane down). */
export function introShot(live: Shot): Shot {
  const s = toSpherical(sub(live.position, live.target));
  const pos = fromSpherical({ radius: s.radius * 1.45, theta: s.theta + 12 * DEG, phi: Math.max(18 * DEG, s.phi - 14 * DEG) });
  return { position: add(live.target, pos), target: [live.target[0], live.target[1] + 0.8, live.target[2]], fov: live.fov };
}

/**
 * The live director's lean towards whoever matters now: the target slides `amount` of the way to the focus point
 * and the camera dollies in a little (a message landing on the resident's phone, or a friend speaking).
 */
export function focusShot(base: Shot, focus: Vec3 | null, amount = 0.38, dollyIn = 0.86): Shot {
  if (!focus) return base;
  const target = lerpVec(base.target, focus, amount);
  return { position: add(target, scale(sub(base.position, base.target), dollyIn)), target, fov: base.fov };
}

/** The Freeze "punch": FOV 30 -> 26 with a small dolly in, around the set's orbit target. */
export function punchShot(live: Shot, orbitTarget: Vec3): Shot {
  const dir = sub(live.position, live.target);
  return { position: add(orbitTarget, scale(dir, 0.94)), target: [...orbitTarget], fov: FREEZE_FOV };
}

export interface OrbitLimits {
  minAzimuth: number;
  maxAzimuth: number;
  /** Polar angles (from straight up) for OrbitControls. */
  minPolar: number;
  maxPolar: number;
  minDistance: number;
  maxDistance: number;
}

/**
 * Constrained Hold orbit around a base (punched) shot: ±75° from the authored front, 25-70° elevation and
 * 0.6-2.0× zoom, intersected with the set's own distance range (scaled by the same aspect fit).
 */
export function orbitLimits(base: Shot, set: { minDistance: number; maxDistance: number }, fit = 1): OrbitLimits {
  const s = toSpherical(sub(base.position, base.target));
  let minDistance = Math.max(s.radius / ZOOM_MAX, set.minDistance * fit);
  let maxDistance = Math.min(s.radius / ZOOM_MIN, set.maxDistance * fit);
  if (!(minDistance <= s.radius)) minDistance = s.radius / ZOOM_MAX;
  if (!(maxDistance >= s.radius)) maxDistance = s.radius / ZOOM_MIN;
  return {
    minAzimuth: s.theta - ORBIT_AZIMUTH,
    maxAzimuth: s.theta + ORBIT_AZIMUTH,
    minPolar: Math.PI / 2 - ELEVATION_MAX,
    maxPolar: Math.PI / 2 - ELEVATION_MIN,
    minDistance,
    maxDistance,
  };
}

/** Keeps a shot inside orbit limits (around its own target). */
export function clampShot(shot: Shot, limits: OrbitLimits): Shot {
  const s = toSpherical(sub(shot.position, shot.target));
  const mid = (limits.minAzimuth + limits.maxAzimuth) / 2;
  const half = (limits.maxAzimuth - limits.minAzimuth) / 2;
  const theta = mid + clamp(wrap(s.theta - mid), -half, half);
  const phi = clamp(s.phi, limits.minPolar, limits.maxPolar);
  const radius = clamp(s.radius, limits.minDistance, limits.maxDistance);
  return { ...shot, position: add(shot.target, fromSpherical({ radius, theta, phi })) };
}

/** One small orbit step (keyboard arrows / rail swipes): azimuth and elevation in radians, zoom as a factor. */
export function orbitStep(shot: Shot, limits: OrbitLimits, dTheta: number, dElevation: number, zoom = 1): Shot {
  const s = toSpherical(sub(shot.position, shot.target));
  const next = fromSpherical({ radius: s.radius * zoom, theta: s.theta + dTheta, phi: s.phi - dElevation });
  return clampShot({ ...shot, position: add(shot.target, next) }, limits);
}

/** Double-tap close-up: look at the object from the current side, as close as the zoom limit allows. */
export function closeUpShot(current: Shot, focus: Vec3, limits: OrbitLimits): Shot {
  const s = toSpherical(sub(current.position, current.target));
  const radius = clamp(limits.minDistance * 1.08, limits.minDistance, limits.maxDistance);
  return clampShot({ position: add(focus, fromSpherical({ ...s, radius })), target: [...focus], fov: current.fov }, limits);
}

/** Frames two points (the thread's ends) from the current side. */
export function frameShot(current: Shot, a: Vec3, b: Vec3, limits: OrbitLimits, bias = 0.5): Shot {
  const target = lerpVec(a, b, bias);
  const s = toSpherical(sub(current.position, current.target));
  const span = distance(a, b);
  const need = (span * 0.62) / Math.tan((current.fov * DEG) / 2);
  const radius = clamp(Math.max(s.radius, need), limits.minDistance, limits.maxDistance);
  return clampShot({ position: add(target, fromSpherical({ ...s, radius })), target, fov: current.fov }, limits);
}

/**
 * The four junior rail stops (GAME_DESIGN.md §4.5: "4 authored stops you swipe between"): the authored ones when
 * the set provides them, otherwise front, left, right and a high overview derived from the base shot.
 */
export function railStops(base: Shot, authored: readonly CameraShot[] | undefined, fit = 1): Shot[] {
  if (authored && authored.length >= 2) return authored.map((s) => dolly(toShot(s, FREEZE_FOV), fit));
  const s = toSpherical(sub(base.position, base.target));
  const at = (dTheta: number, elevation: number, r: number): Shot => ({
    position: add(base.target, fromSpherical({ radius: s.radius * r, theta: s.theta + dTheta, phi: Math.PI / 2 - elevation })),
    target: [...base.target],
    fov: base.fov,
  });
  const baseElevation = clamp(Math.PI / 2 - s.phi, ELEVATION_MIN, ELEVATION_MAX);
  return [at(0, baseElevation, 1), at(-40 * DEG, 30 * DEG, 0.82), at(40 * DEG, 30 * DEG, 0.82), at(0, 58 * DEG, 1.08)];
}

/**
 * Blends two shots: targets and FOV linearly, the camera around the moving target in spherical coordinates
 * (shortest way round), so recentring after an orbit swings around the set instead of cutting through it.
 */
export function blendShots(a: Shot, b: Shot, t: number): Shot {
  const target = lerpVec(a.target, b.target, t);
  const sa = toSpherical(sub(a.position, a.target));
  const sb = toSpherical(sub(b.position, b.target));
  const theta = sa.theta + wrap(sb.theta - sa.theta) * t;
  const s: Spherical = { radius: lerp(sa.radius, sb.radius, t), theta, phi: lerp(sa.phi, sb.phi, t) };
  return { position: add(target, fromSpherical(s)), target, fov: lerp(a.fov, b.fov, t) };
}

/** World units per CSS pixel at the target distance (for the 2-3 px director sway). */
export function worldPerPixel(shot: Shot, viewportHeight: number): number {
  const d = distance(shot.position, shot.target);
  return (2 * d * Math.tan((shot.fov * DEG) / 2)) / Math.max(1, viewportHeight);
}

/** Director sway in CSS pixels: 2 px when calm, 3 px at full pressure (GAME_DESIGN.md §4.5). */
export const swayPixels = (pressure: number) => 2 + clamp(pressure, 0, 1);

/** Live pressure 0..1: how far into the live phase we are, weighted towards landed tactic beats. */
export function pressureAt(t: number, durationSec: number, landedTactics: number, totalTactics: number): number {
  const time = durationSec > 0 ? clamp(t / durationSec, 0, 1) : 0;
  const tactics = totalTactics > 0 ? clamp(landedTactics / totalTactics, 0, 1) : time;
  return clamp(0.4 * time + 0.6 * tactics, 0, 1);
}
