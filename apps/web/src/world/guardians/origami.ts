// Origami modelling helpers for the Guardians (pure maths, no React/DOM): facets with explicit paper tones,
// mirrored halves, lofts, tubes and tiny decals (eyes, noses, paw prints). Winding is irrelevant: Guardian
// materials are double-sided and flat-shaded from screen-space derivatives.
import { Color } from 'three';
import type { Vec3 } from '../kit/math';

export interface Facet {
  v: [Vec3, Vec3, Vec3];
  color: string;
  glow: number;
  /** Cosmetic fold recoloured with the Guardian's second colour from bond level 2. */
  accent: boolean;
}

export interface Tones {
  base: string;
  light: string;
  dark: string;
  deep: string;
  paper: string;
  ink: string;
}

const INK = '#1d2440';
const PAPER = '#f4efe6';

const mix = (a: string, b: string, t: number) => `#${new Color(a).lerp(new Color(b), t).getHexString()}`;

export function tonesFor(color: string): Tones {
  return {
    base: mix(color, color, 0),
    light: mix(color, '#ffffff', 0.32),
    dark: mix(color, INK, 0.2),
    deep: mix(color, INK, 0.42),
    paper: mix(PAPER, color, 0.08),
    ink: INK,
  };
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const v3 = { sub, add, scale, dot, cross, norm };

export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mirrorX = (v: Vec3): Vec3 => [-v[0], v[1], v[2]];
export const mirrorZ = (v: Vec3): Vec3 => [v[0], v[1], -v[2]];

/** Ring of `n` points around the y axis at height c.y (angle 0 = +z, growing towards +x). */
export function ringY(c: Vec3, rx: number, rz: number, n: number, phase = 0): Vec3[] {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return [c[0] + Math.sin(a) * rx, c[1], c[2] + Math.cos(a) * rz] as Vec3;
  });
}

type ColorFn = string | ((i: number, j: number) => string);
const pickColor = (c: ColorFn, i: number, j: number) => (typeof c === 'function' ? c(i, j) : c);

export class Origami {
  facets: Facet[] = [];
  /** Outward reference for automatic tones and decals (set per part). */
  centre: Vec3 = [0, 0.5, 0];

  constructor(public tones: Tones) {}

  tri(a: Vec3, b: Vec3, c: Vec3, color: string, opts: { glow?: number; accent?: boolean } = {}): this {
    this.facets.push({ v: [a, b, c], color, glow: opts.glow ?? 0, accent: opts.accent ?? false });
    return this;
  }

  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: string, opts: { glow?: number; accent?: boolean } = {}): this {
    return this.tri(a, b, c, color, opts).tri(a, c, d, color, opts);
  }

  /** Outward unit normal of a triangle (relative to the current part centre). */
  normal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
    let n = norm(cross(sub(b, a), sub(c, a)));
    const centroid = scale(add(add(a, b), c), 1 / 3);
    if (dot(n, sub(centroid, this.centre)) < 0) n = scale(n, -1);
    return n;
  }

  /** Paper tone for a facet from its orientation: top and front-right read lighter, undersides deeper. */
  auto(a: Vec3, b: Vec3, c: Vec3, crease = 0): string {
    const n = this.normal(a, b, c);
    const s = 0.55 * n[1] + 0.35 * n[2] + 0.22 * n[0] + crease;
    const t = this.tones;
    return s > 0.42 ? t.light : s > 0.0 ? t.base : s > -0.35 ? t.dark : t.deep;
  }

  /** Triangle painted automatically (or with `color`). */
  face(a: Vec3, b: Vec3, c: Vec3, color?: string, opts: { glow?: number; accent?: boolean } = {}): this {
    return this.tri(a, b, c, color ?? this.auto(a, b, c), opts);
  }

  /** Fan from an apex to a closed ring. */
  cone(ring: Vec3[], apex: Vec3, color?: ColorFn, opts: { glow?: number; accent?: boolean } = {}): this {
    ring.forEach((p, i) => {
      const q = ring[(i + 1) % ring.length]!;
      this.face(p, q, apex, color === undefined ? undefined : pickColor(color, i, 0), opts);
    });
    return this;
  }

  /** Quads between two closed rings of equal length. */
  loft(a: Vec3[], b: Vec3[], color?: ColorFn, opts: { glow?: number | ((i: number) => number); accent?: boolean } = {}): this {
    a.forEach((p, i) => {
      const j = (i + 1) % a.length;
      const q = a[j]!;
      const r = b[j]!;
      const s = b[i]!;
      const glow = typeof opts.glow === 'function' ? opts.glow(i) : opts.glow;
      const o = { glow, accent: opts.accent };
      if (color === undefined) {
        // Split each quad along a crease: two tones read as folded paper.
        this.face(p, q, r, undefined, o).tri(p, r, s, this.auto(p, r, s, -0.08), o);
      } else {
        const c = pickColor(color, i, 0);
        this.tri(p, q, r, c, o).tri(p, r, s, c, o);
      }
    });
    return this;
  }

  /** A stack of rings: loft between each pair; optional caps. */
  stack(rings: Vec3[][], color?: ColorFn, caps: { bottom?: Vec3; top?: Vec3 } = {}): this {
    for (let i = 0; i + 1 < rings.length; i++) {
      const c = color === undefined ? undefined : typeof color === 'function' ? (j: number) => color(i, j) : color;
      this.loft(rings[i]!, rings[i + 1]!, c);
    }
    if (caps.bottom) this.cone(rings[0]!, caps.bottom);
    if (caps.top) this.cone(rings[rings.length - 1]!, caps.top);
    return this;
  }

  /**
   * A tapered tube along a path (tails, legs, antennae). `radii` per path point (0 = pointed end).
   * `flatten` squashes the cross-section vertically (1 = round).
   */
  tube(path: Vec3[], radii: number[], sides: number, color?: (seg: number, side: number) => string, opts: { flatten?: number; glow?: number; accent?: boolean; cap?: boolean } = {}): this {
    const flatten = opts.flatten ?? 1;
    const rings = path.map((p, i) => {
      const prev = path[Math.max(0, i - 1)]!;
      const next = path[Math.min(path.length - 1, i + 1)]!;
      const t = norm(sub(next, prev));
      const ref: Vec3 = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const n = norm(sub(ref, scale(t, dot(ref, t))));
      const b = norm(cross(t, n));
      const r = radii[i] ?? radii[radii.length - 1] ?? 0.05;
      return Array.from({ length: sides }, (_, k) => {
        const a = (k / sides) * Math.PI * 2 + Math.PI / sides;
        return add(p, add(scale(n, Math.cos(a) * r * flatten), scale(b, Math.sin(a) * r)));
      });
    });
    const saved = this.centre;
    for (let i = 0; i + 1 < rings.length; i++) {
      this.centre = lerp3(path[i]!, path[i + 1]!, 0.5);
      const A = rings[i]!;
      const B = rings[i + 1]!;
      const pointed = (radii[i + 1] ?? 1) === 0;
      for (let k = 0; k < sides; k++) {
        const k1 = (k + 1) % sides;
        const col = color?.(i, k);
        const o = { glow: opts.glow, accent: opts.accent };
        if (pointed) this.face(A[k]!, A[k1]!, B[0]!, col, o);
        else this.face(A[k]!, A[k1]!, B[k1]!, col, o).face(A[k]!, B[k1]!, B[k]!, col, o);
      }
    }
    if (opts.cap !== false) {
      this.centre = path[0]!;
      const first = rings[0]!;
      if ((radii[0] ?? 0) > 0) this.cone(first, add(path[0]!, scale(norm(sub(path[0]!, path[1] ?? path[0]!)), 0.001)), color ? color(0, 0) : undefined);
      const last = rings[rings.length - 1]!;
      const lr = radii[path.length - 1] ?? 0;
      if (lr > 0) {
        this.centre = path[path.length - 1]!;
        this.cone(last, path[path.length - 1]!, color ? color(path.length - 2, 0) : undefined);
      }
    }
    this.centre = saved;
    return this;
  }

  /** Small octahedron (bells, bulbs, antenna tips). */
  bead(c: Vec3, r: number, color: string, opts: { glow?: number; accent?: boolean; ry?: number } = {}): this {
    const ry = opts.ry ?? r;
    const pts: Vec3[] = [
      [c[0] + r, c[1], c[2]],
      [c[0], c[1], c[2] + r],
      [c[0] - r, c[1], c[2]],
      [c[0], c[1], c[2] - r],
    ];
    const top: Vec3 = [c[0], c[1] + ry, c[2]];
    const bottom: Vec3 = [c[0], c[1] - ry, c[2]];
    const light = mix(color, '#ffffff', 0.25);
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % 4]!;
      this.tri(p, q, top, i % 2 === 0 ? light : color, opts).tri(p, q, bottom, color, opts);
    });
    return this;
  }

  /**
   * A tiny flat diamond lying on triangle (a, b, c) at barycentric weights `w`, lifted off the surface.
   * `size` = [half width, half height]; height runs along the facet's "up".
   */
  decal(a: Vec3, b: Vec3, c: Vec3, w: Vec3, size: [number, number], color: string, opts: { glow?: number; tilt?: number; lift?: number } = {}): this {
    const p = add(add(scale(a, w[0]), scale(b, w[1])), scale(c, w[2]));
    const n = this.normal(a, b, c);
    let up = sub([0, 1, 0], scale(n, n[1]));
    if (Math.hypot(...up) < 1e-3) up = sub([0, 0, -1], scale(n, -n[2]));
    up = norm(up);
    let right = norm(cross(up, n));
    if (opts.tilt) {
      const c0 = Math.cos(opts.tilt);
      const s0 = Math.sin(opts.tilt);
      const u2 = add(scale(up, c0), scale(right, s0));
      right = add(scale(right, c0), scale(up, -s0));
      up = u2;
    }
    const q = add(p, scale(n, opts.lift ?? 0.006));
    const [hw, hh] = size;
    const top = add(q, scale(up, hh));
    const bottom = add(q, scale(up, -hh));
    const l = add(q, scale(right, -hw));
    const r = add(q, scale(right, hw));
    return this.tri(top, l, bottom, color, { glow: opts.glow }).tri(top, bottom, r, color, { glow: opts.glow });
  }

  /** A flat polygon fan on the ground plane (y = h): paw prints, shadows. */
  disc(c: Vec3, r: number, n: number, color: string, squash = 1): this {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      this.tri(c, [c[0] + Math.sin(a0) * r, c[1], c[2] + Math.cos(a0) * r * squash], [c[0] + Math.sin(a1) * r, c[1], c[2] + Math.cos(a1) * r * squash], color);
    }
    return this;
  }

  /** Runs `build` once as is and once mirrored across x = 0. */
  symmetric(build: (m: (v: Vec3) => Vec3, side: 1 | -1) => void): this {
    build((v) => v, 1);
    build(mirrorX, -1);
    return this;
  }

  /** Applies a transform to every facet built by `build`. */
  transformed(fn: (v: Vec3) => Vec3, build: () => void): this {
    const start = this.facets.length;
    build();
    for (let i = start; i < this.facets.length; i++) {
      const f = this.facets[i]!;
      f.v = [fn(f.v[0]), fn(f.v[1]), fn(f.v[2])];
    }
    return this;
  }
}
