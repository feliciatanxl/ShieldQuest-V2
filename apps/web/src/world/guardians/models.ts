// The six origami Guardians (GAME_DESIGN.md §4.4, §6.2), built from computed vertex positions (no model files),
// and the "Unfold": every facet also has a place on a flat, folded paper square. The guardian kit material
// (kit/materials.ts, variant 'guardian') flies each facet from the sheet to the animal as uUnfold goes 0 -> 1.
// Pure three.js (no React, no DOM), so triangle budgets are unit-tested (≤ 1.5k triangles each).
//
// Model space: 1 unit ≈ 1 m, feet on y = 0, facing +z (towards the camera), ~1 unit tall.
import { BufferAttribute, BufferGeometry, Color } from 'three';
import { guardianById, type GuardianId } from '@shieldquest/shared';
import { clamp, seededRandom, type Vec3 } from '../kit/math';
import { Origami, lerp3, ringY, tonesFor, v3, type Facet, type Tones } from './origami';
import { GUARDIAN_ACCENT, GUARDIAN_INK as INK, GUARDIAN_PAPER as PAPER } from './palette';

export type { Facet } from './origami';

/** Hard budget per Guardian (GAME_DESIGN.md §4.4). */
export const GUARDIAN_TRIANGLE_BUDGET = 1500;

interface BuildContext {
  o: Origami;
  /** Paper tones of the Guardian colour. */
  t: Tones;
  /** Second-colour tones from bond mark II (null at level 1). */
  a: Tones | null;
  /** 1..3 */
  level: number;
}

const mixc = (a: string, b: string, k: number) => `#${new Color(a).lerp(new Color(b), k).getHexString()}`;
const shade = (c: string, k = 0.08) => mixc(c, INK, k);
const centroid = (v: readonly [Vec3, Vec3, Vec3]): Vec3 => [
  (v[0][0] + v[1][0] + v[2][0]) / 3,
  (v[0][1] + v[1][1] + v[2][1]) / 3,
  (v[0][2] + v[1][2] + v[2][2]) / 3,
];

// ---------------------------------------------------------------------------------------------------------
// Modelling helpers
// ---------------------------------------------------------------------------------------------------------

/** Ring of `n` points perpendicular to `axis` around `c` (angle 0 = the axis-orthogonal "up"). */
function ringAround(c: Vec3, axis: Vec3, ra: number, rb: number, n: number, phase = 0): Vec3[] {
  const t = v3.norm(axis);
  const ref: Vec3 = Math.abs(t[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
  const u = v3.norm(v3.sub(ref, v3.scale(t, v3.dot(ref, t))));
  const w = v3.norm(v3.cross(t, u));
  return Array.from({ length: n }, (_, i) => {
    const ang = phase + (i / n) * Math.PI * 2;
    return v3.add(c, v3.add(v3.scale(u, Math.cos(ang) * ra), v3.scale(w, Math.sin(ang) * rb)));
  });
}

/** Folded band between two rings: automatic paper tones with a crease, or a painted colour per segment. */
function band(
  o: Origami,
  a: Vec3[],
  b: Vec3[],
  paint?: (seg: number) => string | undefined,
  glow?: (seg: number) => number,
  accent = false,
): void {
  a.forEach((p, i) => {
    const j = (i + 1) % a.length;
    const q = a[j]!;
    const r = b[j]!;
    const s = b[i]!;
    const c = paint?.(i);
    const opts = { glow: glow?.(i) ?? 0, accent };
    if (c) o.tri(p, q, r, c, opts).tri(p, r, s, shade(c, 0.07), opts);
    else o.face(p, q, r, undefined, opts).tri(p, r, s, o.auto(p, r, s, -0.08), opts);
  });
}

/** Builds with another set of paper tones (e.g. a darker head or a second-colour fold). */
function withTones(o: Origami, tones: Tones, build: () => void): void {
  const saved = o.tones;
  o.tones = tones;
  build();
  o.tones = saved;
}

/** Friendly eye: ink bead plus a catch-light. */
function eye(o: Origami, p: Vec3, r: number): void {
  o.bead(p, r, INK, { ry: r * 1.2 });
  o.bead([p[0] + r * 0.3, p[1] + r * 0.45, p[2] + r * 0.72], r * 0.34, '#ffffff', { glow: 0.5 });
}

/** A thin flat strip (whiskers, trims). */
function strip(o: Origami, from: Vec3, to: Vec3, width: number, color: string, glow = 0): void {
  const up: Vec3 = [0, width / 2, 0];
  o.quad(v3.sub(from, up), v3.sub(to, up), v3.add(to, up), v3.add(from, up), color, { glow });
}

/** A five-point folded paper star (raised centre), facing `normal`. */
function star(o: Origami, c: Vec3, normal: Vec3, r: number, tones: Tones, glow = 0.3): void {
  const n = v3.norm(normal);
  const ref: Vec3 = Math.abs(n[1]) > 0.9 ? [0, 0, -1] : [0, 1, 0];
  const up = v3.norm(v3.sub(ref, v3.scale(n, v3.dot(ref, n))));
  const right = v3.norm(v3.cross(up, n));
  const top = v3.add(c, v3.scale(n, r * 0.35));
  const pts = Array.from({ length: 10 }, (_, i) => {
    const ang = (i / 10) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    return v3.add(c, v3.add(v3.scale(up, Math.cos(ang) * rr), v3.scale(right, Math.sin(ang) * rr)));
  });
  pts.forEach((p, i) => o.tri(p, pts[(i + 1) % 10]!, top, i % 2 === 0 ? tones.light : tones.base, { glow, accent: true }));
}

/** Folded collar / scarf around a neck. */
function collar(o: Origami, c: Vec3, r: number, h: number, tones: Tones, n = 8): void {
  const top = ringY([c[0], c[1] + h / 2, c[2]], r, r, n, Math.PI / n);
  const bottom = ringY([c[0], c[1] - h / 2, c[2]], r * 1.1, r * 1.1, n, Math.PI / n);
  top.forEach((p, i) => {
    const j = (i + 1) % n;
    o.tri(p, top[j]!, bottom[j]!, i % 2 === 0 ? tones.light : tones.base, { accent: true });
    o.tri(p, bottom[j]!, bottom[i]!, tones.dark, { accent: true });
  });
}

/** Square pyramid-ish ear: front face + inner fold. */
function ear(o: Origami, b1: Vec3, b2: Vec3, b3: Vec3, apex: Vec3, front: string, inner: string): void {
  o.centre = centroid([b1, b2, b3]);
  o.face(b1, b2, apex, front).face(b2, b3, apex).face(b3, b1, apex);
  const c = centroid([b1, b2, apex]);
  const n = o.normal(b1, b2, apex);
  const shrink = (p: Vec3) => v3.add(lerp3(c, p, 0.58), v3.scale(n, 0.006));
  o.tri(shrink(b1), shrink(b2), shrink(apex), inner);
}

/** Paper "waterbomb" box: each face puffed into four creased triangles. */
function paperBox(o: Origami, min: Vec3, max: Vec3, puff: number): void {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  o.centre = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const faces: [Vec3, Vec3[]][] = [
    [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]],
    [[0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]],
    [[1, 0, 0], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]]],
    [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]],
    [[0, 1, 0], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]]],
    [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]],
  ];
  for (const [n, pts] of faces) {
    const mid = pts.reduce<Vec3>((acc, p) => v3.add(acc, v3.scale(p, 0.25)), [0, 0, 0]);
    const c = v3.add(mid, v3.scale(n, puff));
    pts.forEach((p, i) => o.face(p, pts[(i + 1) % 4]!, c));
  }
}

/** An ink paw print on the ground (pad + four toes) pointing along `dir` (radians, 0 = +z). */
function pawPrint(o: Origami, c: Vec3, dir: number, size: number, color: string, glow: number): void {
  const pad = (p: Vec3, r: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      o.tri(p, [p[0] + Math.sin(a0) * r, p[1], p[2] + Math.cos(a0) * r * 0.85], [p[0] + Math.sin(a1) * r, p[1], p[2] + Math.cos(a1) * r * 0.85], color, { glow });
    }
  };
  pad(c, size, 6);
  for (const k of [-1.5, -0.5, 0.5, 1.5]) {
    const a = dir + k * 0.42;
    const d = size * (Math.abs(k) > 1 ? 1.45 : 1.75);
    pad([c[0] + Math.sin(a) * d, c[1], c[2] + Math.cos(a) * d], size * 0.42, 5);
  }
}

// ---------------------------------------------------------------------------------------------------------
// The six Guardians
// ---------------------------------------------------------------------------------------------------------

const PH6 = Math.PI / 6;
const PH8 = Math.PI / 8;

/** VeriFox: a sitting fox whose white-tipped tail curls into a magnifier fold. */
function verifox({ o, t, a }: BuildContext): void {
  // Body: hips to neck, leaning forward; segment 5 of a PH6 ring faces +z (the white chest).
  o.centre = [0, 0.28, 0];
  const body = [
    ringY([0, 0.03, -0.05], 0.19, 0.23, 6, PH6),
    ringY([0, 0.2, -0.03], 0.22, 0.24, 6, PH6),
    ringY([0, 0.4, 0.03], 0.17, 0.17, 6, PH6),
    ringY([0, 0.56, 0.07], 0.115, 0.11, 6, PH6),
  ];
  for (let i = 0; i < body.length - 1; i++) band(o, body[i]!, body[i + 1]!, (seg) => (seg === 5 && i === 2 ? t.paper : undefined));
  o.cone(body[0]!, [0, 0, -0.05]);
  o.cone(body[3]!, [0, 0.6, 0.06]);

  // Head: skull ring -> cheek ring -> pointed snout; lower facets are the white muzzle.
  o.centre = [0, 0.7, 0.1];
  const skull = ringAround([0, 0.71, 0.09], [0, 0, 1], 0.115, 0.15, 6);
  const cheek = ringAround([0, 0.67, 0.21], [0, 0.1, 1], 0.07, 0.085, 6);
  const tip: Vec3 = [0, 0.63, 0.37];
  o.cone(skull, [0, 0.75, -0.07]);
  band(o, skull, cheek, (seg) => (seg === 2 || seg === 3 ? t.paper : undefined));
  o.centre = [0, 0.66, 0.25];
  cheek.forEach((p, i) => o.face(p, cheek[(i + 1) % 6]!, tip, i === 2 || i === 3 ? t.paper : undefined));
  o.bead(tip, 0.026, INK, { ry: 0.02 });
  o.symmetric((m) => {
    eye(o, m([0.072, 0.735, 0.178]), 0.024);
    ear(o, m([0.035, 0.8, 0.12]), m([0.15, 0.77, 0.1]), m([0.1, 0.79, -0.02]), m([0.165, 1.0, 0.05]), t.dark, t.paper);
    // Front legs with dark socks, paws and haunches.
    o.tube([m([0.085, 0.42, 0.11]), m([0.09, 0.16, 0.15]), m([0.095, 0.03, 0.17])], [0.045, 0.04, 0.036], 4, (seg, side) =>
      seg === 1 ? t.deep : side % 2 ? t.base : t.dark,
    );
    o.bead(m([0.095, 0.03, 0.2]), 0.045, t.deep, { ry: 0.028 });
    o.centre = m([0.17, 0.13, -0.03]);
    o.bead(m([0.17, 0.13, -0.03]), 0.11, t.base, { ry: 0.12 });
  });

  // Tail sweeping round and up, white tip.
  o.tube(
    [[0, 0.1, -0.22], [0.2, 0.1, -0.38], [0.38, 0.2, -0.35], [0.47, 0.38, -0.22], [0.45, 0.52, -0.12]],
    [0.06, 0.1, 0.1, 0.07, 0.045],
    5,
    (seg, side) => (seg >= 3 ? (side % 2 ? PAPER : t.paper) : side % 2 ? t.base : t.dark),
  );
  // The magnifier fold: a paper loop with a glassy lens (gold from bond mark II).
  const M: Vec3 = [0.43, 0.66, -0.08];
  const n = v3.norm([0.35, 0.05, 1]);
  const outer = ringAround(M, n, 0.14, 0.14, 10);
  const inner = ringAround(M, n, 0.1, 0.1, 10);
  const off = (pts: Vec3[], d: number) => pts.map((p) => v3.add(p, v3.scale(n, d)));
  const of = off(outer, 0.018);
  const ob = off(outer, -0.018);
  const inf = off(inner, 0.018);
  const ib = off(inner, -0.018);
  const fc = a ?? tonesFor(PAPER);
  const accent = a !== null;
  o.centre = M;
  for (let i = 0; i < 10; i++) {
    const j = (i + 1) % 10;
    o.quad(of[i]!, of[j]!, inf[j]!, inf[i]!, i % 2 ? fc.light : fc.base, { accent });
    o.quad(ob[j]!, ob[i]!, ib[i]!, ib[j]!, fc.dark, { accent });
    o.quad(of[j]!, of[i]!, ob[i]!, ob[j]!, fc.dark, { accent });
    o.quad(inf[i]!, inf[j]!, ib[j]!, ib[i]!, fc.deep, { accent });
    o.tri(inner[i]!, inner[j]!, M, i % 2 ? '#d8eeff' : '#c4e2ff', { glow: 0.35 });
  }

  if (a) {
    collar(o, [0, 0.53, 0.07], 0.13, 0.06, a);
    o.tri([0.03, 0.52, 0.2], [0.11, 0.5, 0.17], [0.07, 0.36, 0.21], a.base, { accent: true });
    o.tri([0.03, 0.52, 0.2], [0.07, 0.36, 0.21], [0.0, 0.4, 0.21], a.dark, { accent: true });
  }
}

/** Echo: an otter standing up, holding a pebble, long flat tail behind. */
function echo({ o, t, a, level }: BuildContext): void {
  const belly = mixc(t.paper, t.light, 0.45);
  const rings = [
    ringY([0, 0.03, 0], 0.15, 0.14, 6, PH6),
    ringY([0, 0.2, 0], 0.21, 0.19, 6, PH6),
    ringY([0, 0.42, 0.01], 0.2, 0.18, 6, PH6),
    ringY([0, 0.6, 0.02], 0.15, 0.14, 6, PH6),
    ringY([0, 0.71, 0.03], 0.125, 0.115, 6, PH6),
    ringY([0, 0.8, 0.04], 0.15, 0.14, 6, PH6),
    ringY([0, 0.92, 0.03], 0.125, 0.115, 6, PH6),
  ];
  for (let i = 0; i < rings.length - 1; i++) {
    o.centre = i < 4 ? [0, 0.4, 0] : [0, 0.82, 0.03];
    band(o, rings[i]!, rings[i + 1]!, (seg) => (seg === 5 && i >= 1 && i <= 2 ? belly : undefined));
  }
  o.centre = [0, 0.4, 0];
  o.cone(rings[0]!, [0, 0, 0]);
  o.centre = [0, 0.82, 0.03];
  o.cone(rings[6]!, [0, 0.98, 0.02]);

  // Muzzle, nose, eyes, ears, whiskers.
  o.centre = [0, 0.79, 0.1];
  const muzzle = ringAround([0, 0.79, 0.12], [0, 0, 1], 0.05, 0.07, 6);
  o.cone(muzzle, [0, 0.78, 0.215], (i) => (i === 2 || i === 3 ? shade(t.paper, 0.05) : t.paper));
  o.bead([0, 0.8, 0.205], 0.028, INK, { ry: 0.02 });
  o.symmetric((m) => {
    eye(o, m([0.06, 0.85, 0.15]), 0.022);
    o.bead(m([0.11, 0.93, 0.0]), 0.04, t.dark, { ry: 0.03 });
    strip(o, m([0.05, 0.785, 0.2]), m([0.17, 0.8, 0.17]), 0.006, INK);
    strip(o, m([0.05, 0.775, 0.2]), m([0.16, 0.755, 0.17]), 0.006, INK);
    // Arms meeting at the chest around the pebble.
    o.tube([m([0.14, 0.6, 0.08]), m([0.1, 0.5, 0.17]), m([0.035, 0.52, 0.2])], [0.04, 0.035, 0.03], 4, (_seg, side) =>
      side % 2 ? t.dark : t.deep,
    );
    o.bead(m([0.09, 0.025, 0.11]), 0.065, t.dark, { ry: 0.025 });
  });
  o.bead([0, 0.52, 0.24], 0.055, '#c9d3e6', { ry: 0.045 });

  o.tube(
    [[0, 0.09, -0.12], [0.1, 0.04, -0.32], [0.3, 0.03, -0.4], [0.47, 0.03, -0.3]],
    [0.08, 0.065, 0.045, 0],
    5,
    (_seg, side) => (side % 2 ? t.base : t.dark),
    { flatten: 0.45 },
  );

  if (a) {
    collar(o, [0, 0.68, 0.03], 0.135, 0.05, a);
    if (level >= 3) {
      // Sound ripples either side of the head: "a second opinion" echoing out.
      o.symmetric((_m, s) => {
        for (const rr of [0.17, 0.23]) {
          const pts = (r: number) =>
            Array.from({ length: 5 }, (_, i) => {
              const phi = (-50 + i * 25) * (Math.PI / 180);
              return [s * (0.08 + Math.cos(phi) * r), 0.86 + Math.sin(phi) * r, 0.06] as Vec3;
            });
          const inner = pts(rr);
          const outerPts = pts(rr + 0.022);
          for (let i = 0; i < 4; i++) o.quad(inner[i]!, inner[i + 1]!, outerPts[i + 1]!, outerPts[i]!, i % 2 ? a.light : a.base, { glow: 0.35, accent: true });
        }
      });
    }
  }
}

/** Beacon: a lantern firefly with a pleated, glowing paper-lantern abdomen. */
function beacon({ o, t, a, level }: BuildContext): void {
  const dark = tonesFor(mixc(t.base, INK, 0.62));
  // Head.
  withTones(o, dark, () => {
    o.centre = [0, 0.72, 0.2];
    const hr = [ringY([0, 0.64, 0.2], 0.065, 0.06, 6), ringY([0, 0.72, 0.2], 0.1, 0.095, 6), ringY([0, 0.8, 0.19], 0.07, 0.065, 6)];
    band(o, hr[0]!, hr[1]!);
    band(o, hr[1]!, hr[2]!);
    o.cone(hr[0]!, [0, 0.61, 0.2]);
    o.cone(hr[2]!, [0, 0.83, 0.19]);
    o.centre = [0, 0.6, 0.09];
    o.bead([0, 0.6, 0.09], 0.1, dark.base, { ry: 0.09 });
  });
  o.symmetric((m) => {
    eye(o, m([0.052, 0.74, 0.272]), 0.03);
    // Antennae with glowing tips.
    o.tube([m([0.03, 0.8, 0.23]), m([0.07, 0.9, 0.29]), m([0.12, 0.97, 0.27])], [0.012, 0.01, 0.008], 3, () => dark.dark, { cap: false });
    o.bead(m([0.125, 0.975, 0.27]), 0.028, a ? a.light : t.light, { glow: 1, accent: a !== null });
    // Legs.
    for (const dz of [0, -0.08]) {
      o.tube([m([0.05, 0.53, 0.13 + dz]), m([0.09, 0.45, 0.17 + dz]), m([0.1, 0.4, 0.14 + dz])], [0.012, 0.011, 0.01], 3, () => dark.deep, { cap: false });
    }
    // Wings: two creased paper pairs.
    o.centre = m([0.15, 0.72, -0.05]);
    const wing = '#eef6ff';
    const wing2 = '#d6e8fb';
    const root = m([0.05, 0.68, 0.05]);
    const front = m([0.34, 0.95, 0.02]);
    const back = m([0.44, 0.8, -0.2]);
    const trail = m([0.07, 0.64, -0.05]);
    const mid = m([0.25, 0.82, -0.05]);
    const tipColor = level >= 3 && a ? mixc(a.light, '#ffffff', 0.35) : wing2;
    o.tri(root, front, mid, wing).tri(mid, front, back, tipColor, { accent: level >= 3 }).tri(root, mid, trail, wing2).tri(trail, mid, back, wing);
    const r2 = m([0.06, 0.6, 0.03]);
    const f2 = m([0.3, 0.62, -0.06]);
    const b2 = m([0.26, 0.5, -0.2]);
    const mid2 = m([0.2, 0.57, -0.1]);
    o.tri(r2, f2, mid2, wing2).tri(r2, mid2, b2, wing).tri(mid2, f2, b2, wing2);
  });

  // Abdomen: a pleated paper lantern along a tilted axis; the paper glows (and resists the Freeze).
  const A0: Vec3 = [0, 0.56, 0];
  const A1: Vec3 = [0, 0.3, -0.34];
  const axis = v3.sub(A1, A0);
  const prof: [number, number][] = [
    [0, 0.06],
    [0.15, 0.12],
    [0.4, 0.155],
    [0.68, 0.14],
    [0.9, 0.085],
  ];
  const rings = prof.map(([s, r]) => ringAround(lerp3(A0, A1, s), axis, r, r, 8));
  o.centre = lerp3(A0, A1, 0.45);
  for (let i = 0; i < rings.length - 1; i++) {
    band(o, rings[i]!, rings[i + 1]!, (seg) => (seg % 2 ? t.light : t.base), () => (i === 0 || i === 3 ? 0.55 : 0.8));
  }
  const cap = a ?? dark;
  const capRing = ringAround(lerp3(A0, A1, 0.98), axis, 0.05, 0.05, 8);
  band(o, rings[4]!, capRing, () => cap.base, undefined, a !== null);
  o.cone(capRing, A1, cap.dark, { accent: a !== null });
  o.cone(rings[0]!, lerp3(A0, A1, -0.04), cap.base, { accent: a !== null });
  o.bead(lerp3(A0, A1, 1.1), 0.03, cap.light, { glow: a ? 0.7 : 0.2, ry: 0.05, accent: a !== null });

  if (a && level >= 3) {
    // Three little firefly friends.
    for (const p of [[-0.42, 0.95, 0.1], [0.46, 0.36, 0.12], [-0.36, 0.28, -0.12]] as Vec3[]) o.bead(p, 0.026, a.light, { glow: 1, accent: true });
  }
}

/** Shieldfin: a manta ray rising towards you, its wings spread into a heater-shield outline. */
function shieldfin({ o, t, a, level }: BuildContext): void {
  // Built in the XY plane (back faces +z), then tilted so the back catches the light.
  const stations: { R: Vec3; M: Vec3; E: Vec3 }[] = [
    { R: [0, 0.92, 0.05], M: [0.08, 0.93, 0.04], E: [0.14, 0.94, 0.02] },
    { R: [0, 0.82, 0.12], M: [0.22, 0.85, 0.07], E: [0.4, 0.86, 0.06] },
    { R: [0, 0.68, 0.15], M: [0.3, 0.74, 0.08], E: [0.62, 0.76, 0.14] },
    { R: [0, 0.52, 0.14], M: [0.24, 0.54, 0.07], E: [0.42, 0.52, 0.06] },
    { R: [0, 0.36, 0.1], M: [0.14, 0.37, 0.05], E: [0.24, 0.36, 0.03] },
    { R: [0, 0.22, 0.05], M: [0.04, 0.22, 0.03], E: [0.07, 0.21, 0.02] },
  ];
  const under = (p: Vec3, z: number): Vec3 => [p[0], p[1], z];
  const pivot: Vec3 = [0, 0.55, 0];
  const tilt = -0.35;
  const rotX = (p: Vec3): Vec3 => {
    const y = p[1] - pivot[1];
    const z = p[2] - pivot[2];
    // Tilt, and scale to 86% so the wingspan fits the same frame as the other Guardians.
    const k = 0.86;
    return [p[0] * k, pivot[1] + k * (y * Math.cos(tilt) - z * Math.sin(tilt)), pivot[2] + k * (y * Math.sin(tilt) + z * Math.cos(tilt))];
  };
  o.transformed(rotX, () => {
    o.symmetric((m) => {
      o.centre = [0, 0.6, -0.15];
      for (let k = 0; k < stations.length - 1; k++) {
        const s0 = stations[k]!;
        const s1 = stations[k + 1]!;
        // Back: ridge -> mid crease -> wing edge.
        o.face(m(s0.R), m(s0.M), m(s1.M)).tri(m(s0.R), m(s1.M), m(s1.R), o.auto(m(s0.R), m(s1.M), m(s1.R), -0.1));
        o.face(m(s0.M), m(s0.E), m(s1.E)).tri(m(s0.M), m(s1.E), m(s1.M), o.auto(m(s0.M), m(s1.E), m(s1.M), 0.08));
        // Pale belly underneath.
        const belly = k % 2 ? t.paper : shade(t.paper, 0.05);
        o.quad(m(under(s0.R, -0.05)), m(under(s1.R, -0.05)), m(under(s1.M, -0.03)), m(under(s0.M, -0.03)), belly);
        o.quad(m(under(s0.M, -0.03)), m(under(s1.M, -0.03)), m(s1.E), m(s0.E), belly);
      }
      // Close the head and tail ends.
      const top = stations[0]!;
      const bottom = stations[stations.length - 1]!;
      for (const s of [top, bottom]) {
        o.quad(m(s.R), m(s.M), m(under(s.M, -0.03)), m(under(s.R, -0.05)), t.dark);
        o.tri(m(s.M), m(s.E), m(under(s.M, -0.03)), t.dark);
      }
      // Curled cephalic fins and eyes.
      o.tube([m([0.07, 0.92, 0.04]), m([0.11, 1.0, 0.08]), m([0.09, 1.05, 0.14])], [0.03, 0.022, 0], 4, (_seg, side) => (side % 2 ? t.dark : t.deep), { flatten: 0.5 });
      eye(o, m([0.12, 0.865, 0.105]), 0.026);
      if (a && level >= 3) {
        // Gold trims along the leading edges.
        for (let k = 0; k < 2; k++) {
          const s0 = stations[k]!;
          const s1 = stations[k + 1]!;
          const lift = (p: Vec3): Vec3 => [p[0], p[1], p[2] + 0.008];
          o.quad(m(lift(s0.E)), m(lift(s1.E)), m(lift(lerp3(s1.E, s1.M, 0.22))), m(lift(lerp3(s0.E, s0.M, 0.22))), a.light, { glow: 0.35, accent: true });
        }
      }
    });
    // Tail.
    o.tube([[0, 0.22, 0.0], [0.02, 0.1, 0.02], [0.08, 0.02, 0.06]], [0.03, 0.02, 0], 4, (_seg, side) => (side % 2 ? t.dark : t.deep));
    if (a) {
      // Shield crest on the back.
      const crest: Vec3[] = [[-0.075, 0.69, 0.17], [0.075, 0.69, 0.17], [0.075, 0.61, 0.175], [0, 0.5, 0.17], [-0.075, 0.61, 0.175]];
      const c: Vec3 = [0, 0.615, 0.2];
      crest.forEach((p, i) => o.tri(p, crest[(i + 1) % crest.length]!, c, i % 2 ? a.base : a.light, { glow: 0.25, accent: true }));
    }
  });
}

/** Cluepaw: a round-faced sitting cat with ink-dipped paws, leaving ink paw prints. */
function cluepaw({ o, t, a, level }: BuildContext): void {
  o.centre = [0, 0.26, 0];
  const body = [
    ringY([0, 0.03, -0.03], 0.2, 0.22, 6, PH6),
    ringY([0, 0.2, -0.01], 0.24, 0.24, 6, PH6),
    ringY([0, 0.4, 0.02], 0.19, 0.18, 6, PH6),
    ringY([0, 0.53, 0.04], 0.13, 0.12, 6, PH6),
  ];
  for (let i = 0; i < body.length - 1; i++) band(o, body[i]!, body[i + 1]!, (seg) => (seg === 5 && i === 2 ? t.paper : undefined));
  o.cone(body[0]!, [0, 0, -0.03]);
  o.cone(body[3]!, [0, 0.57, 0.04]);

  // Round head (8 segments; segment 7 faces +z).
  o.centre = [0, 0.7, 0.06];
  const head = [
    ringY([0, 0.585, 0.06], 0.1, 0.09, 8, PH8),
    ringY([0, 0.66, 0.06], 0.19, 0.15, 8, PH8),
    ringY([0, 0.78, 0.05], 0.165, 0.135, 8, PH8),
  ];
  band(o, head[0]!, head[1]!, (seg) => (seg === 7 ? t.paper : undefined));
  band(o, head[1]!, head[2]!);
  o.cone(head[0]!, [0, 0.56, 0.06]);
  o.cone(head[2]!, [0, 0.86, 0.04]);
  o.bead([0, 0.672, 0.214], 0.02, '#f58ea0', { ry: 0.015 });
  const innerEar = a ? a.light : '#f7b2a6';
  o.symmetric((m) => {
    o.bead(m([0.032, 0.645, 0.198]), 0.04, t.paper, { ry: 0.03 });
    eye(o, m([0.07, 0.715, 0.186]), 0.028);
    strip(o, m([0.07, 0.655, 0.2]), m([0.25, 0.675, 0.17]), 0.006, INK);
    strip(o, m([0.07, 0.64, 0.2]), m([0.24, 0.6, 0.16]), 0.006, INK);
    ear(o, m([0.05, 0.8, 0.1]), m([0.17, 0.74, 0.08]), m([0.12, 0.78, -0.03]), m([0.17, 0.94, 0.04]), t.base, innerEar);
    // Front legs: paws dipped in ink.
    o.tube([m([0.08, 0.4, 0.1]), m([0.085, 0.15, 0.14]), m([0.09, 0.03, 0.16])], [0.045, 0.04, 0.037], 4, (seg, side) =>
      seg === 1 ? INK : side % 2 ? t.base : t.dark,
    );
    o.bead(m([0.09, 0.03, 0.19]), 0.046, INK, { ry: 0.028 });
    o.centre = m([0.17, 0.12, -0.02]);
    o.bead(m([0.17, 0.12, -0.02]), 0.11, t.base, { ry: 0.11 });
  });
  // Tail curling round the front, ink tip.
  o.tube(
    [[0, 0.08, -0.22], [0.22, 0.06, -0.22], [0.3, 0.05, 0.0], [0.2, 0.045, 0.2], [0.04, 0.045, 0.26]],
    [0.05, 0.05, 0.045, 0.04, 0.03],
    5,
    (seg, side) => (seg === 3 ? t.deep : side % 2 ? t.base : t.dark),
  );
  // Ink paw prints leading off towards a clue (they glow in the second colour from bond mark III).
  const printColor = level >= 3 && a ? a.base : t.deep;
  const printGlow = level >= 3 && a ? 0.6 : 0;
  pawPrint(o, [0.4, 0.004, 0.3], -2.4, 0.035, printColor, printGlow);
  pawPrint(o, [0.52, 0.004, 0.08], -2.6, 0.035, printColor, printGlow);

  if (a) {
    collar(o, [0, 0.545, 0.04], 0.135, 0.045, a);
    o.bead([0, 0.5, 0.19], 0.034, '#f2c14e', { glow: 0.35, accent: true });
    if (level >= 3) star(o, [0, 0.79, 0.175], [0, 0.25, 1], 0.035, a);
  }
}

/** ByteBuddy: a folded paper cube robot whose screen face folds out on a hinge. */
function bytebuddy({ o, t, a, level }: BuildContext): void {
  const dark = tonesFor(mixc(t.base, INK, 0.45));
  paperBox(o, [-0.2, 0.15, -0.16], [0.2, 0.48, 0.16], 0.03);
  withTones(o, dark, () => {
    paperBox(o, [-0.07, 0.48, -0.06], [0.07, 0.54, 0.06], 0);
    o.symmetric((m) => {
      const p = m([0.06, 0, 0]);
      const q = m([0.16, 0, 0]);
      paperBox(o, [Math.min(p[0], q[0]), 0, -0.07], [Math.max(p[0], q[0]), 0.15, 0.08], 0.01);
    });
  });
  paperBox(o, [-0.21, 0.54, -0.17], [0.21, 0.88, 0.17], 0.025);

  // Fold-out screen face, hinged at the top front edge of the head.
  const TL: Vec3 = [-0.17, 0.855, 0.19];
  const TR: Vec3 = [0.17, 0.855, 0.19];
  const BL: Vec3 = [-0.17, 0.58, 0.245];
  const n = v3.norm(v3.cross(v3.sub(BL, TL), v3.sub(TR, TL)));
  const P = (u: number, v: number, lift: number): Vec3 =>
    v3.add(v3.add(TL, v3.add(v3.scale(v3.sub(TR, TL), u), v3.scale(v3.sub(BL, TL), v))), v3.scale(n, lift));
  const rect = (u0: number, v0: number, u1: number, v1: number, lift: number, color: string, glow = 0) =>
    o.quad(P(u0, v0, lift), P(u1, v0, lift), P(u1, v1, lift), P(u0, v1, lift), color, { glow });
  rect(0, 0, 1, 1, 0, '#273152');
  rect(0, 0, 1, 1, -0.006, '#273152');
  rect(0.07, 0.08, 0.93, 0.92, 0.004, '#bfe9ff', 0.85);
  rect(0.25, 0.3, 0.37, 0.52, 0.008, INK);
  rect(0.63, 0.3, 0.75, 0.52, 0.008, INK);
  rect(0.36, 0.62, 0.44, 0.68, 0.008, INK);
  rect(0.44, 0.67, 0.56, 0.73, 0.008, INK);
  rect(0.56, 0.62, 0.64, 0.68, 0.008, INK);
  rect(0.13, 0.6, 0.22, 0.66, 0.008, '#ff9db0', 0.5);
  rect(0.78, 0.6, 0.87, 0.66, 0.008, '#ff9db0', 0.5);
  o.tube([[-0.17, 0.858, 0.185], [0.17, 0.858, 0.185]], [0.014, 0.014], 4, () => dark.deep);

  // Antenna with a glowing tip, ear bolts, arms.
  o.tube([[0.08, 0.88, 0], [0.1, 0.97, 0], [0.14, 1.04, 0.02]], [0.014, 0.013, 0.012], 4, () => dark.base);
  o.bead([0.145, 1.05, 0.02], 0.035, a ? a.light : '#fff3c4', { glow: 1, accent: a !== null });
  o.symmetric((m) => {
    const boltTones = level >= 3 && a ? a : dark;
    o.bead(m([0.225, 0.7, 0]), 0.04, boltTones.light, { glow: level >= 3 ? 0.4 : 0, accent: level >= 3 });
    o.tube([m([0.2, 0.42, 0]), m([0.29, 0.32, 0.05]), m([0.31, 0.22, 0.08])], [0.04, 0.038, 0.036], 4, (_seg, side) =>
      side % 2 ? t.base : t.dark,
    );
    o.bead(m([0.31, 0.2, 0.09]), 0.045, t.light);
    if (level >= 3 && a) {
      o.tri(m([0.08, 0.45, -0.165]), m([0.16, 0.28, -0.165]), m([0.27, 0.52, -0.27]), a.base, { accent: true });
      o.tri(m([0.08, 0.45, -0.165]), m([0.27, 0.52, -0.27]), m([0.12, 0.5, -0.2]), a.dark, { accent: true });
    }
  });

  if (a) {
    // A folded paper heart on the chest.
    const bottom: Vec3 = [0, 0.24, 0.2];
    const left: Vec3 = [-0.075, 0.36, 0.195];
    const topLeft: Vec3 = [-0.037, 0.405, 0.2];
    const notch: Vec3 = [0, 0.37, 0.21];
    const topRight: Vec3 = [0.037, 0.405, 0.2];
    const right: Vec3 = [0.075, 0.36, 0.195];
    const g = { glow: 0.4, accent: true };
    o.tri(bottom, left, notch, a.base, g).tri(left, topLeft, notch, a.light, g).tri(bottom, notch, right, a.dark, g).tri(notch, topRight, right, a.base, g);
  }
}

const BUILDERS: Record<GuardianId, (ctx: BuildContext) => void> = { verifox, echo, beacon, shieldfin, cluepaw, bytebuddy };

/** Bond level used for geometry: 0 and 1 share the level-1 animal (the sheet unfolds into it). */
export const geometryLevel = (level: number): 1 | 2 | 3 => (level >= 3 ? 3 : level >= 2 ? 2 : 1);

/** The animal's facets for a bond level (1..3), centred on x/z so idle sway turns about its middle. */
export function guardianFacets(id: GuardianId, level: number): Facet[] {
  const g = guardianById(id);
  const t = tonesFor(g.color);
  const lv = geometryLevel(level);
  const a = lv >= 2 ? tonesFor(GUARDIAN_ACCENT[id]) : null;
  const o = new Origami(t);
  BUILDERS[id]({ o, t, a, level: lv });
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const f of o.facets) {
    for (const p of f.v) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minZ = Math.min(minZ, p[2]);
      maxZ = Math.max(maxZ, p[2]);
    }
  }
  const dx = -(minX + maxX) / 2;
  const dz = -(minZ + maxZ) / 2;
  for (const f of o.facets) f.v = f.v.map((p) => [p[0] + dx, p[1], p[2] + dz] as Vec3) as Facet['v'];
  return o.facets;
}

// ---------------------------------------------------------------------------------------------------------
// The Unfold: a folded paper square that becomes the animal
// ---------------------------------------------------------------------------------------------------------

/** The sheet shown at level 0: a creased square, one corner folded to the centre (showing the coloured side). */
export const SHEET = {
  /** Side length (m). */
  size: 0.94,
  /** Lean back from vertical (radians), so the sheet faces a camera slightly above. */
  lean: 0.32,
  /** Height of the sheet's centre. */
  centreY: 0.52,
  /** Depth of the soft valley folds (m at the corners). */
  relief: 0.09,
} as const;

/** Uniform values the guardian material expects (uLift: arc height of flying facets). */
export const UNFOLD_LIFT = 0.2;

interface SheetTri {
  uv: [[number, number], [number, number], [number, number]];
}

/** Maps a sheet coordinate (u, v in -0.5..0.5, z relief) into model space. */
function sheetPoint(u: number, v: number, z: number): Vec3 {
  const { size, lean, centreY } = SHEET;
  const cl = Math.cos(lean);
  const sl = Math.sin(lean);
  return [u * size, centreY + v * size * cl + z * sl, -v * size * sl + z * cl];
}

/**
 * Builds the Guardian geometry for the guardian kit material: `position` = the animal; `aSheet` = the same
 * facet on the folded sheet; plus per-facet centres, fold axis and stagger (`aFold`) and the sheet colour.
 * Facets are matched to sheet cells by screen position (rows top to bottom, then left to right), so the
 * paper flows into the animal without criss-crossing. Dispose the geometry when done.
 */
export function buildGuardianGeometry(id: GuardianId, level: number): BufferGeometry {
  const g = guardianById(id);
  const t = tonesFor(g.color);
  const facets = guardianFacets(id, level);
  const rand = seededRandom(`unfold:${id}`);

  // Pad to a full square grid with zero-area facets hidden at the core of the animal.
  const k = Math.max(2, Math.ceil(Math.sqrt(facets.length / 2)));
  const total = 2 * k * k;
  const core = facets.reduce<Vec3>((acc, f) => v3.add(acc, v3.scale(centroid(f.v), 1 / facets.length)), [0, 0, 0]);
  const padded: Facet[] = [...facets];
  while (padded.length < total) padded.push({ v: [core, core, core], color: t.base, glow: 0, accent: false });

  const items = padded.map((f) => ({ f, c: centroid(f.v) }));
  items.sort((p, q) => q.c[1] - p.c[1]);
  const ordered: typeof items = [];
  for (let r = 0; r < k; r++) ordered.push(...items.slice(r * 2 * k, (r + 1) * 2 * k).sort((p, q) => p.c[0] - q.c[0]));

  const h = 1 / k;
  const cells: SheetTri[] = [];
  for (let i = 0; i < k; i++) {
    const v1 = 0.5 - i * h;
    const v0 = v1 - h;
    for (let j = 0; j < k; j++) {
      const u0 = -0.5 + j * h;
      const u1 = u0 + h;
      // Split so every crease runs along triangle edges: "/" in the bottom-left quadrant (the u = v crease),
      // "\" elsewhere (the u = -v crease, and the corner fold u + v = c in the top-right).
      const slash = u1 <= 1e-9 && v1 <= 1e-9;
      if (slash) cells.push({ uv: [[u0, v1], [u0, v0], [u1, v1]] }, { uv: [[u0, v0], [u1, v0], [u1, v1]] });
      else cells.push({ uv: [[u0, v1], [u0, v0], [u1, v0]] }, { uv: [[u0, v1], [u1, v0], [u1, v1]] });
    }
  }
  // The top-right corner is folded to the centre along u + v = c (c on a grid diagonal).
  const c = Math.round(0.5 / h) * h;
  const relief = (u: number, v: number) => SHEET.relief * (Math.abs(u) + Math.abs(v));
  const paperA = t.paper;
  const paperB = mixc(t.paper, INK, 0.07);
  // The coloured back of the paper shows on the folded flap (a hint of who is waiting inside).
  const flap = t.base;

  const n = total * 3;
  const position = new Float32Array(n * 3);
  const color = new Float32Array(n * 3);
  const glow = new Float32Array(n);
  const aSheet = new Float32Array(n * 3);
  const aSheetCentre = new Float32Array(n * 3);
  const aCentre = new Float32Array(n * 3);
  const aFold = new Float32Array(n * 4);
  const aSheetColor = new Float32Array(n * 3);
  const col = new Color();
  const sheetCol = new Color();

  ordered.forEach(({ f, c: fc }, idx) => {
    const cell = cells[idx]!;
    const cu = (cell.uv[0][0] + cell.uv[1][0] + cell.uv[2][0]) / 3;
    const cv = (cell.uv[0][1] + cell.uv[1][1] + cell.uv[2][1]) / 3;
    const folded = cu + cv > c;
    const sheet = cell.uv.map(([u, v]) => {
      if (!folded) return sheetPoint(u, v, relief(u, v));
      const ru = c - v;
      const rv = c - u;
      return sheetPoint(ru, rv, relief(ru, rv) + 0.012 + 0.05 * (u + v - c));
    }) as [Vec3, Vec3, Vec3];
    const sc = centroid(sheet);
    const sector = Math.floor((Math.atan2(cv, cu) + Math.PI) / (Math.PI / 4)) % 8;
    sheetCol.set(folded ? flap : sector % 2 ? paperA : paperB);
    col.set(f.color);
    // Fold axis: across the direction of travel (a page turning over), with a little per-facet variety.
    const travel = v3.sub(fc, sc);
    let axis = v3.cross(travel, [0, 1, 0]);
    if (Math.hypot(...axis) < 1e-3) axis = [1, 0, 0];
    axis = v3.norm(v3.add(v3.norm(axis), [(rand() - 0.5) * 0.6, (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.6]));
    // Ripple from the folded corner across to the opposite corner.
    const delay = 0.42 * clamp(Math.hypot(0.5 - cu, 0.5 - cv) / Math.SQRT2);
    for (let k3 = 0; k3 < 3; k3++) {
      const vi = idx * 3 + k3;
      position.set(f.v[k3]!, vi * 3);
      color.set([col.r, col.g, col.b], vi * 3);
      glow[vi] = f.glow;
      aSheet.set(sheet[k3]!, vi * 3);
      aSheetCentre.set(sc, vi * 3);
      aCentre.set(fc, vi * 3);
      aFold.set([axis[0], axis[1], axis[2], delay], vi * 4);
      aSheetColor.set([sheetCol.r, sheetCol.g, sheetCol.b], vi * 3);
    }
  });

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(position, 3));
  geo.setAttribute('color', new BufferAttribute(color, 3));
  geo.setAttribute('glow', new BufferAttribute(glow, 1));
  geo.setAttribute('aSheet', new BufferAttribute(aSheet, 3));
  geo.setAttribute('aSheetCentre', new BufferAttribute(aSheetCentre, 3));
  geo.setAttribute('aCentre', new BufferAttribute(aCentre, 3));
  geo.setAttribute('aFold', new BufferAttribute(aFold, 4));
  geo.setAttribute('aSheetColor', new BufferAttribute(aSheetColor, 3));
  geo.computeVertexNormals();
  // Vertices move in the shader: one generous bound that covers sheet, flight arc and animal.
  geo.computeBoundingSphere();
  if (geo.boundingSphere) {
    geo.boundingSphere.center.set(0, 0.55, 0);
    geo.boundingSphere.radius = 1.35;
  }
  geo.userData.triangles = facets.length;
  return geo;
}
