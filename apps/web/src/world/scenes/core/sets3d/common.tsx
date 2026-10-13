// Shared bits for the code-built mission sets (3D chunk only): baked light pools, tiled floors, a low-poly car
// and a smoothed mission clock for the few moving props.
import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ColorRepresentation } from 'three';
import { GeoBuilder, PALETTE, mixHex, useKit } from '../../../kit';
import type { Vec3 } from '../staging';

/** A soft pool of light baked into vertex colours (no runtime lights): lamps, neon, fluorescent tubes. */
export interface LightPool {
  /** Centre on the ground plane: [x, z]. */
  at: readonly [number, number];
  radius: number;
  color: string;
  /** 0..1 at the centre, falling off quadratically. */
  strength: number;
}

export function pooled(base: ColorRepresentation, x: number, z: number, pools: readonly LightPool[]): string {
  let c = mixHex(base, base, 0);
  for (const p of pools) {
    const d = Math.hypot(x - p.at[0], z - p.at[1]) / p.radius;
    if (d < 1) c = mixHex(c, p.color, p.strength * (1 - d) * (1 - d));
  }
  return c;
}

/**
 * A floor of square tiles (top faces only) at height y, each painted by `color(x, z, i, j)` at its centre.
 * Tiles are the unit the light pools are baked at, so keep them around 0.5-1 m.
 */
export function tiledFloor(
  b: GeoBuilder,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y: number,
  tile: number,
  color: (x: number, z: number, i: number, j: number) => ColorRepresentation,
): GeoBuilder {
  const nx = Math.max(1, Math.round((x1 - x0) / tile));
  const nz = Math.max(1, Math.round((z1 - z0) / tile));
  for (let i = 0; i < nx; i++) {
    const xa = x0 + ((x1 - x0) * i) / nx;
    const xb = x0 + ((x1 - x0) * (i + 1)) / nx;
    for (let j = 0; j < nz; j++) {
      const za = z0 + ((z1 - z0) * j) / nz;
      const zb = z0 + ((z1 - z0) * (j + 1)) / nz;
      b.quad([xa, y, zb], [xb, y, zb], [xb, y, za], [xa, y, za], color((xa + xb) / 2, (za + zb) / 2, i, j));
    }
  }
  return b;
}

/**
 * A wall surface facing one way only (the cutaway convention: from behind it is culled, so an orbiting camera
 * looks straight into the room). Corners counter-clockwise as seen from the side it faces.
 */
export function wallQuad(b: GeoBuilder, a: Vec3, c: Vec3, color: ColorRepresentation, glow = 0): GeoBuilder {
  // a = bottom-left, c = top-right as seen from the front; the wall is vertical.
  if (a[2] === c[2]) {
    // Faces +z when a.x < c.x.
    return b.quad([a[0], a[1], a[2]], [c[0], a[1], a[2]], [c[0], c[1], a[2]], [a[0], c[1], a[2]], color, glow);
  }
  // Faces +x when a.z > c.z (left wall seen from inside the room).
  return b.quad([a[0], a[1], a[2]], [a[0], a[1], c[2]], [a[0], c[1], c[2]], [a[0], c[1], a[2]], color, glow);
}

/** A small hatchback (≈ 3.6 m) facing +x, origin at the ground centre. */
export function car(b: GeoBuilder, at: Vec3, color: ColorRepresentation, lit: boolean, rotY = 0): GeoBuilder {
  const g = new GeoBuilder();
  const dark = mixHex(color, PALETTE.ink, 0.35);
  const glass = '#33405f';
  g.box([-1.8, 0.28, -0.8], [1.8, 0.86, 0.8], { side: color, top: mixHex(color, '#ffffff', 0.12), bottom: dark });
  // Cabin with sloped front and back glass.
  g.quad([-1.1, 0.86, 0.72], [0.75, 0.86, 0.72], [0.35, 1.38, 0.66], [-0.85, 1.38, 0.66], glass);
  g.quad([0.75, 0.86, -0.72], [-1.1, 0.86, -0.72], [-0.85, 1.38, -0.66], [0.35, 1.38, -0.66], glass);
  g.quad([0.75, 0.86, 0.72], [0.75, 0.86, -0.72], [0.35, 1.38, -0.66], [0.35, 1.38, 0.66], mixHex(glass, '#9fb3c8', 0.25));
  g.quad([-1.1, 0.86, -0.72], [-1.1, 0.86, 0.72], [-0.85, 1.38, 0.66], [-0.85, 1.38, -0.66], glass);
  g.quad([-0.85, 1.38, 0.66], [0.35, 1.38, 0.66], [0.35, 1.38, -0.66], [-0.85, 1.38, -0.66], mixHex(color, '#ffffff', 0.08));
  for (const x of [-1.15, 1.15]) for (const z of [-0.78, 0.62]) g.box([x - 0.32, 0, z], [x + 0.32, 0.6, z + 0.16], '#1f2336');
  // Head and tail lights resist the Freeze when lit.
  g.box([1.79, 0.58, -0.66], [1.83, 0.74, -0.38], lit ? '#fff4d6' : '#d9d6cc', lit ? 1 : 0);
  g.box([1.79, 0.58, 0.38], [1.83, 0.74, 0.66], lit ? '#fff4d6' : '#d9d6cc', lit ? 1 : 0);
  g.box([-1.83, 0.6, -0.66], [-1.79, 0.72, -0.42], '#e0485c', lit ? 0.8 : 0);
  g.box([-1.83, 0.6, 0.42], [-1.79, 0.72, 0.66], '#e0485c', lit ? 0.8 : 0);
  return b.add(g.build(), { at, rotY });
}

/**
 * Mission time for moving props, smoothed between the ~10 Hz `t` updates: it runs on with the frame clock while
 * `running`, never more than a third of a second ahead of `t`, and snaps back when `t` is rewound.
 */
export function useSmoothTime(t: number, running: boolean): MutableRefObject<number> {
  const time = useRef(t);
  const { requestFrame } = useKit();
  useFrame((_, delta) => {
    const before = time.current;
    let next = running ? before + Math.min(delta, 0.1) : before;
    next = Math.min(Math.max(next, t), t + 0.35);
    time.current = next;
    if (running && next !== before) requestFrame();
  });
  return time;
}
