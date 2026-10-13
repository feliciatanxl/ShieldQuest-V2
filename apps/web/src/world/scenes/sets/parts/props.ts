// Small code-built props shared by the S2, S3, S4 and S6 sets (GAME_DESIGN.md §4.1-4.2): canteen tables, shop
// gondolas, fans, a wall clock, speech bubbles, stars, floating islands and glowing wire outlines. Each returns
// ONE kit geometry (origin at the ground centre, facing +z, metres) or paints into a GeoBuilder. Pure three.js:
// no React, testable in Node. Words never live in geometry: every sign is blank and its text is a DOM label.
import type { BufferGeometry, ColorRepresentation } from 'three';
import { GeoBuilder, PALETTE, mixHex, type Vec3 } from '../../../kit';

const TAU = Math.PI * 2;

/** Five-point star in the XY plane facing +z (10 triangles), centred at `c`. */
export function star(b: GeoBuilder, c: Vec3, r: number, color: ColorRepresentation, glow = 0, inner = 0.45): GeoBuilder {
  const pt = (k: number): Vec3 => {
    const a = Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? r : r * inner;
    return [c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, c[2]];
  };
  for (let k = 0; k < 10; k++) b.tri(c, pt(k), pt(k + 1), color, glow);
  return b;
}

/** A flat disc / polygon in the XY plane facing +z (a fan of `segments` triangles). */
export function disc(b: GeoBuilder, c: Vec3, r: number, segments: number, color: ColorRepresentation | ((i: number) => ColorRepresentation), glow = 0): GeoBuilder {
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * TAU;
    const a1 = ((i + 1) / segments) * TAU;
    b.tri(c, [c[0] + Math.cos(a0) * r, c[1] + Math.sin(a0) * r, c[2]], [c[0] + Math.cos(a1) * r, c[1] + Math.sin(a1) * r, c[2]], typeof color === 'function' ? color(i) : color, glow);
  }
  return b;
}

/** A flat ring in the XY plane facing +z. */
export function ring(b: GeoBuilder, c: Vec3, r0: number, r1: number, segments: number, color: ColorRepresentation, glow = 0, arc = TAU, start = 0): GeoBuilder {
  for (let i = 0; i < segments; i++) {
    const a0 = start + (i / segments) * arc;
    const a1 = start + ((i + 1) / segments) * arc;
    const p = (a: number, r: number): Vec3 => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2]];
    b.quad(p(a0, r0), p(a0, r1), p(a1, r1), p(a1, r0), color, glow);
  }
  return b;
}

/**
 * A quad whose visible side faces `toward` (the winding is chosen for you). For slanted and odd-angled faces
 * where working out counter-clockwise order by hand is error-prone.
 */
export function facingQuad(b: GeoBuilder, a: Vec3, c: Vec3, d: Vec3, e: Vec3, toward: Vec3, color: ColorRepresentation, glow = 0): GeoBuilder {
  const u: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const v: Vec3 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  const n: Vec3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const dot = n[0] * toward[0] + n[1] * toward[1] + n[2] * toward[2];
  return dot >= 0 ? b.quad(a, c, d, e, color, glow) : b.quad(a, e, d, c, color, glow);
}

/** A flat ring lying on the ground plane at height y (top face only), centred at (cx, cz). */
export function floorRing(b: GeoBuilder, cx: number, cz: number, r0: number, r1: number, y: number, segments: number, color: ColorRepresentation | ((i: number) => ColorRepresentation), glow = 0): GeoBuilder {
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * TAU;
    const a1 = ((i + 1) / segments) * TAU;
    const p = (a: number, r: number): Vec3 => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
    facingQuad(b, p(a0, r0), p(a0, r1), p(a1, r1), p(a1, r0), [0, 1, 0], typeof color === 'function' ? color(i) : color, glow);
  }
  return b;
}

/** A floor decal quad (top face only) lying at height y. */
export function decal(b: GeoBuilder, x0: number, z0: number, x1: number, z1: number, y: number, color: ColorRepresentation, glow = 0): GeoBuilder {
  return b.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], color, glow);
}

/** A vertical quad facing +z at depth z (posters, screens, product fronts). */
export function panel(b: GeoBuilder, x0: number, y0: number, x1: number, y1: number, z: number, color: ColorRepresentation, glow = 0): GeoBuilder {
  return b.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], color, glow);
}

export interface CanteenTableOptions {
  length?: number;
  top?: ColorRepresentation;
  seat?: ColorRepresentation;
  frame?: ColorRepresentation;
}

/**
 * School canteen table with its two attached benches (along x). Table top 0.75 m; bench seats 0.42 m, centred
 * at z = ±0.62 (matches Bean "sit").
 */
export function canteenTable(options: CanteenTableOptions = {}): BufferGeometry {
  const l = options.length ?? 2.2;
  const top = options.top ?? '#e8e0cc';
  const seat = options.seat ?? '#2b9c8f';
  const frame = options.frame ?? '#59607a';
  const hl = l / 2;
  const b = new GeoBuilder();
  b.box([-hl, 0.71, -0.4], [hl, 0.76, 0.4], { side: mixHex(top, PALETTE.ink, 0.18), top }, 0, { bottom: false });
  for (const z of [-0.62, 0.62]) {
    b.box([-hl + 0.05, 0.38, z - 0.15], [hl - 0.05, 0.42, z + 0.15], { side: mixHex(seat, PALETTE.ink, 0.22), top: seat });
  }
  // Two trestle frames: a leg under the table and a cross bar carrying both benches.
  for (const x of [-hl + 0.3, hl - 0.3]) {
    b.box([x - 0.04, 0, -0.05], [x + 0.04, 0.71, 0.05], frame, 0, { top: true, bottom: true });
    b.box([x - 0.03, 0.3, -0.75], [x + 0.03, 0.38, 0.75], frame, 0, { bottom: true });
    b.box([x - 0.03, 0, -0.66], [x + 0.03, 0.3, -0.58], frame, 0, { top: true, bottom: true });
    b.box([x - 0.03, 0, 0.58], [x + 0.03, 0.3, 0.66], frame, 0, { top: true, bottom: true });
  }
  return b.build();
}

export interface GondolaOptions {
  /** Along z. */
  length?: number;
  height?: number;
  width?: number;
  body?: ColorRepresentation;
  /** Product colours for the -x face and the +x face. */
  left?: readonly ColorRepresentation[];
  right?: readonly ColorRepresentation[];
  /** End cap (facing +z) promo colour. */
  cap?: ColorRepresentation;
  shelves?: number;
  /** Product fronts per shelf (detail). */
  perShelf?: number;
}

/**
 * Double-sided shop shelf (gondola) running along z, with rows of product fronts on both faces and a promo end
 * cap facing the camera. Low and open so nothing in the aisles is hidden.
 */
export function gondola(options: GondolaOptions = {}): BufferGeometry {
  const l = options.length ?? 3;
  const h = options.height ?? 1.45;
  const w = options.width ?? 0.7;
  const body = options.body ?? '#e9e4ef';
  const left = options.left ?? ['#f26b5b', '#f2c14e', '#2bb3a3', '#7cc4ff'];
  const right = options.right ?? left;
  const cap = options.cap ?? PALETTE.retail;
  const shelves = options.shelves ?? 3;
  const per = options.perShelf ?? 7;
  const hw = w / 2;
  const hl = l / 2;
  const edge = mixHex(body, PALETTE.ink, 0.25);
  const b = new GeoBuilder();
  b.box([-hw, 0, -hl], [hw, 0.14, hl], { side: edge, top: edge }, 0, { bottom: true });
  b.box([-0.04, 0.14, -hl], [0.04, h, hl], { side: body, top: edge, front: edge, back: edge }, 0, { bottom: true });
  for (let s = 0; s < shelves; s++) {
    const y = 0.14 + (s * (h - 0.25)) / shelves;
    const yTop = y + (h - 0.25) / shelves - 0.07;
    for (const side of [-1, 1] as const) {
      const xFace = side * (hw - 0.02);
      b.box(side < 0 ? [-hw, y, -hl] : [0.04, y, -hl], side < 0 ? [-0.04, y + 0.03, hl] : [hw, y + 0.03, hl], { side: edge, top: body }, 0, { bottom: true });
      const colours = side < 0 ? left : right;
      for (let i = 0; i < per; i++) {
        const z0 = -hl + 0.06 + (i * (l - 0.12)) / per;
        const z1 = z0 + (l - 0.12) / per - 0.05;
        const top = y + 0.04 + (yTop - y - 0.04) * (0.7 + 0.3 * (((i * 7 + s * 3) % 5) / 4));
        const color = colours[(i + s * 2) % colours.length]!;
        if (side < 0) b.quad([xFace, y + 0.03, z0], [xFace, y + 0.03, z1], [xFace, top, z1], [xFace, top, z0], color);
        else b.quad([xFace, y + 0.03, z1], [xFace, y + 0.03, z0], [xFace, top, z0], [xFace, top, z1], color);
      }
    }
  }
  // Promo end cap with a header card.
  b.box([-hw, 0.14, hl], [hw, h - 0.1, hl + 0.06], { side: edge, front: cap, top: edge }, 0, { bottom: true });
  b.box([-hw - 0.04, h - 0.05, hl - 0.02], [hw + 0.04, h + 0.28, hl + 0.08], { side: edge, front: PALETTE.paper }, 0, { bottom: true });
  return b.build();
}

/** Wall fan head (motor + round cage), facing +z, centred on its pivot. Spin the blades separately. */
export function fanHead(color: ColorRepresentation = '#e7e2d6'): BufferGeometry {
  const b = new GeoBuilder();
  const cage = mixHex(color, PALETTE.ink, 0.12);
  b.box([-0.09, -0.09, -0.24], [0.09, 0.09, -0.02], { side: color, back: mixHex(color, PALETTE.ink, 0.2) });
  ring(b, [0, 0, 0.06], 0.26, 0.3, 10, cage);
  ring(b, [0, 0, -0.02], 0.26, 0.3, 10, cage);
  b.strut([0, 0, -0.3], [0, 0, -0.18], 0.035, 5, mixHex(color, PALETTE.ink, 0.3));
  return b.build();
}

/** Three fan blades in the XY plane facing +z (spin about z). */
export function fanBlades(color: ColorRepresentation = '#9fc7d8'): BufferGeometry {
  const b = new GeoBuilder();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const dir: Vec3 = [Math.cos(a), Math.sin(a), 0];
    const side: Vec3 = [-Math.sin(a), Math.cos(a), 0];
    const p = (r: number, s: number, z: number): Vec3 => [dir[0] * r + side[0] * s, dir[1] * r + side[1] * s, z];
    b.quad(p(0.04, -0.05, 0.02), p(0.24, -0.09, 0.03), p(0.25, 0.07, 0.03), p(0.04, 0.04, 0.02), color);
    b.quad(p(0.04, 0.04, 0.0), p(0.25, 0.07, 0.01), p(0.24, -0.09, 0.01), p(0.04, -0.05, 0.0), mixHex(color, PALETTE.ink, 0.2));
  }
  disc(b, [0, 0, 0.035], 0.06, 6, mixHex(color, PALETTE.ink, 0.35));
  return b.build();
}

/** Ceiling fan blades (spin about y): four paddles and a hub, origin at the hub. */
export function ceilingFanBlades(color: ColorRepresentation = '#c9a27a', radius = 0.62): BufferGeometry {
  const b = new GeoBuilder();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const p = (r: number, w: number, y: number): Vec3 => [c * r - s * w, y, s * r + c * w];
    // Underside, then the top the camera usually sees.
    b.quad(p(0.1, 0.06, -0.015), p(0.1, -0.06, -0.015), p(radius, -0.08, -0.035), p(radius, 0.08, -0.035), mixHex(color, PALETTE.ink, 0.3));
    b.quad(p(0.1, -0.06, 0), p(0.1, 0.06, 0), p(radius, 0.08, -0.02), p(radius, -0.08, -0.02), color);
  }
  b.cylinder([0, -0.08, 0], 0.11, 0.12, 7, '#d9d4c7', { top: '#efe9df' });
  return b.build();
}

/** Clock second hand (in the XY plane facing +z, pointing up at angle 0; rotate about z). */
export function clockHand(color: ColorRepresentation = PALETTE.risk): BufferGeometry {
  const b = new GeoBuilder();
  b.quad([-0.008, -0.05, 0.03], [0.008, -0.05, 0.03], [0.008, 0.22, 0.03], [-0.008, 0.22, 0.03], color);
  disc(b, [0, 0, 0.032], 0.025, 6, color);
  return b.build();
}

/** Wall clock face centred at `c` facing +z (radius r), hour and minute hands fixed at 3:40 (the second hand moves). */
export function wallClock(b: GeoBuilder, c: Vec3, r: number): GeoBuilder {
  const rim = '#3d4766';
  disc(b, [c[0], c[1], c[2] + 0.02], r, 12, '#fbf8f1');
  ring(b, [c[0], c[1], c[2] + 0.025], r, r + 0.04, 12, rim);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const x = c[0] + Math.sin(a) * r * 0.82;
    const y = c[1] + Math.cos(a) * r * 0.82;
    const s = i % 3 === 0 ? 0.022 : 0.012;
    b.quad([x - s, y - s, c[2] + 0.025], [x + s, y - s, c[2] + 0.025], [x + s, y + s, c[2] + 0.025], [x - s, y + s, c[2] + 0.025], PALETTE.ink);
  }
  const hand = (angle: number, len: number, w: number) => {
    const dx = Math.sin(angle);
    const dy = Math.cos(angle);
    const px = -dy * w;
    const py = dx * w;
    const z = c[2] + 0.028;
    b.quad([c[0] + px, c[1] + py, z], [c[0] - px, c[1] - py, z], [c[0] - px + dx * len, c[1] - py + dy * len, z], [c[0] + px + dx * len, c[1] + py + dy * len, z], PALETTE.ink);
  };
  hand(((3 + 40 / 60) / 12) * TAU, r * 0.5, 0.014);
  hand((40 / 60) * TAU, r * 0.75, 0.01);
  return b;
}

/**
 * A rounded speech bubble (facing +z, centred on its body) with a tail at the bottom left and three "typing"
 * dots. Vertex colours are near-white so an instance colour tints it (ChatLah teal, violet, gold...).
 */
export interface BubbleTint {
  front: ColorRepresentation;
  back: ColorRepresentation;
  edge: ColorRepresentation;
  dots: ColorRepresentation;
  /** Glow of the front face (default 0.55). */
  glow?: number;
}

export function speechBubble(width = 0.9, height = 0.55, depth = 0.1, tint?: BubbleTint): BufferGeometry {
  const b = new GeoBuilder();
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(hh, hw) * 0.55;
  const outline: [number, number][] = [];
  const corners: [number, number, number][] = [
    [hw - r, hh - r, 0],
    [-hw + r, hh - r, Math.PI / 2],
    [-hw + r, -hh + r, Math.PI],
    [hw - r, -hh + r, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let k = 0; k <= 3; k++) {
      const a = a0 + (k / 3) * (Math.PI / 2);
      outline.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  const front = tint?.front ?? '#ffffff';
  const back = tint?.back ?? '#e6e2f0';
  const edge = tint?.edge ?? '#d4cfe6';
  const fg = tint?.glow ?? 0.55;
  const zf = depth / 2;
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = outline[i]!;
    const [x1, y1] = outline[(i + 1) % n]!;
    b.tri([0, 0, zf], [x0, y0, zf], [x1, y1, zf], front, fg);
    b.tri([0, 0, -zf], [x1, y1, -zf], [x0, y0, -zf], back, 0.4);
    b.quad([x0, y0, -zf], [x1, y1, -zf], [x1, y1, zf], [x0, y0, zf], edge, 0.4);
  }
  // Tail.
  const tx = -hw * 0.35;
  const t0: Vec3 = [tx - 0.08, -hh + 0.02, zf];
  const t1: Vec3 = [tx + 0.1, -hh + 0.02, zf];
  const tip: Vec3 = [tx - 0.16, -hh - 0.2, zf * 0.4];
  b.tri(t0, tip, t1, front, fg);
  b.tri([t0[0], t0[1], -zf], [t1[0], t1[1], -zf], [tip[0], tip[1], -zf * 0.4], back, 0.4);
  // Typing dots.
  for (const x of [-0.18, 0, 0.18]) disc(b, [x * width, 0, zf + 0.005], Math.min(0.055, height * 0.1), 6, tint?.dots ?? '#5b5f86', 0.2);
  return b.build();
}

export interface IslandOptions {
  /** Circumradius of the hexagonal top (pointy corners on ±x). */
  radius: number;
  top?: ColorRepresentation;
  rim?: ColorRepresentation;
  under?: ColorRepresentation;
  /** Depth of the crystal underside below the rim. */
  depth?: number;
  /** Glowing grid rings on the top surface. */
  rings?: number;
}

/**
 * A floating hexagonal island for the Digi Sky: a flat top with glowing inset rings, a glowing rim band and an
 * inverted crystal underside tapering to a point (it hangs in the night sky; nothing holds it up).
 */
export function floatingIsland(b: GeoBuilder, at: Vec3, options: IslandOptions): GeoBuilder {
  const r = options.radius;
  const top = options.top ?? '#232a5e';
  const rim = options.rim ?? '#8a6cf0';
  const under = options.under ?? '#1a1f45';
  const depth = options.depth ?? 1.2 + r * 0.45;
  const corner = (i: number, rad: number, y: number): Vec3 => [at[0] + Math.cos((i * Math.PI) / 3) * rad, at[1] + y, at[2] + Math.sin((i * Math.PI) / 3) * rad];
  const centre: Vec3 = [at[0], at[1], at[2]];
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    b.tri(centre, corner(j, r, 0), corner(i, r, 0), (i % 2 === 0 ? top : mixHex(top, '#ffffff', 0.04)));
    b.quad(corner(j, r, 0), corner(j, r, -0.22), corner(i, r, -0.22), corner(i, r, 0), rim, 0.9);
    b.quad(corner(j, r, -0.22), corner(j, r * 0.82, -0.5), corner(i, r * 0.82, -0.5), corner(i, r, -0.22), mixHex(under, rim, 0.35), 0.25);
    b.tri(corner(j, r * 0.82, -0.5), [at[0], at[1] - depth, at[2]], corner(i, r * 0.82, -0.5), i % 2 === 0 ? under : mixHex(under, rim, 0.15), 0.12);
  }
  const rings = options.rings ?? 2;
  for (let k = 1; k <= rings; k++) {
    const rr = (r * k) / (rings + 1);
    const w = 0.05;
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      const a0 = corner(i, rr - w, 0.012);
      const a1 = corner(j, rr - w, 0.012);
      const b1 = corner(j, rr + w, 0.012);
      const b0 = corner(i, rr + w, 0.012);
      b.quad(a0, a1, b1, b0, mixHex(top, rim, 0.55), 0.7);
    }
  }
  return b;
}

/** A glowing wireframe box outline: 12 edge struts (the Digi Sky draws the city "redrawn as light"). */
export function wireBox(b: GeoBuilder, min: Vec3, max: Vec3, color: ColorRepresentation, glow = 0.85, t = 0.05): GeoBuilder {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const skip = { bottom: true, top: true };
  for (const x of [x0, x1]) {
    for (const z of [z0, z1]) b.box([x - t, y0, z - t], [x + t, y1, z + t], color, glow, skip);
  }
  for (const y of [y0, y1]) {
    for (const z of [z0, z1]) b.box([x0, y - t, z - t], [x1, y + t, z + t], color, glow);
    for (const x of [x0, x1]) b.box([x - t, y - t, z0], [x + t, y + t, z1], color, glow);
  }
  return b;
}

/** Points along a sagging wire from a to b (inclusive), for strings of lanterns or bunting. */
export function catenary(a: Vec3, c: Vec3, sag: number, count: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const s = count === 1 ? 0.5 : i / (count - 1);
    out.push([a[0] + (c[0] - a[0]) * s, a[1] + (c[1] - a[1]) * s - sag * 4 * s * (1 - s), a[2] + (c[2] - a[2]) * s]);
  }
  return out;
}

/** A thin wire through `points` (struts between consecutive points). */
export function wire(b: GeoBuilder, points: readonly Vec3[], color: ColorRepresentation, radius = 0.015): GeoBuilder {
  for (let i = 0; i + 1 < points.length; i++) b.strut(points[i]!, points[i + 1]!, radius, 4, color);
  return b;
}
