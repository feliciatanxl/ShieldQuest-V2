// Code-built low-poly props (GAME_DESIGN.md §4.1-4.2): every builder returns ONE kit geometry (non-indexed,
// flat, vertex-coloured, with a `glow` attribute), origin at the ground centre, facing +z, 1 unit = 1 metre.
// Merge the props of a set with mergeKit() so the whole set is one draw call. Pure three.js: testable in Node.
import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  Quaternion,
  Vector3,
  type ColorRepresentation,
} from 'three';
import { clamp, seededRandom, type Vec3 } from './math';
import { bakeAO, geometryFromTriangles, mergeKit, mixHex, paintFaces, place, setGlow, toKitGeometry, type Placement } from './paint';
import { PALETTE } from './uniforms';

export interface BoxColors {
  top?: ColorRepresentation;
  bottom?: ColorRepresentation;
  /** Default for all four sides. */
  side?: ColorRepresentation;
  front?: ColorRepresentation;
  back?: ColorRepresentation;
  left?: ColorRepresentation;
  right?: ColorRepresentation;
}

/**
 * Accumulates coloured triangles and finished kit geometries, then builds one kit geometry.
 * Quads are given counter-clockwise as seen from the side they face.
 */
export class GeoBuilder {
  private positions: number[] = [];
  private colors: ColorRepresentation[] = [];
  private glows: number[] = [];
  private extra: BufferGeometry[] = [];

  tri(a: Vec3, b: Vec3, c: Vec3, color: ColorRepresentation, glow = 0): this {
    this.positions.push(...a, ...b, ...c);
    this.colors.push(color);
    this.glows.push(glow);
    return this;
  }

  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: ColorRepresentation, glow = 0): this {
    return this.tri(a, b, c, color, glow).tri(a, c, d, color, glow);
  }

  /** Axis-aligned box from min to max corner; `colors` is one colour or per-side colours. */
  box(min: Vec3, max: Vec3, colors: ColorRepresentation | BoxColors, glow = 0, skip: { bottom?: boolean; top?: boolean } = {}): this {
    const c: BoxColors = typeof colors === 'object' && colors !== null && !(colors instanceof Color) ? colors : { side: colors, top: colors, bottom: colors };
    const side = c.side ?? '#ffffff';
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], c.right ?? side, glow);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], c.left ?? side, glow);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], c.front ?? side, glow);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], c.back ?? side, glow);
    if (!skip.top) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], c.top ?? side, glow);
    if (!skip.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], c.bottom ?? side, glow);
    return this;
  }

  /** Box by centre and size. */
  boxAt(center: Vec3, size: Vec3, colors: ColorRepresentation | BoxColors, glow = 0): this {
    const [cx, cy, cz] = center;
    const [sx, sy, sz] = size;
    return this.box([cx - sx / 2, cy - sy / 2, cz - sz / 2], [cx + sx / 2, cy + sy / 2, cz + sz / 2], colors, glow);
  }

  /** Vertical cylinder/prism standing on `base` (centre of its bottom face). */
  cylinder(base: Vec3, radius: number, height: number, segments: number, color: ColorRepresentation, options: { radiusTop?: number; top?: ColorRepresentation; open?: boolean; glow?: number } = {}): this {
    const geo = new CylinderGeometry(options.radiusTop ?? radius, radius, height, segments, 1, options.open ?? false);
    const top = options.top;
    const kit = paintFaces(toKitGeometry(geo), (f) => (top !== undefined && f.normal.y > 0.9 ? top : color));
    geo.dispose();
    if (options.glow) setGlow(kit, options.glow);
    return this.add(place(kit, { at: [base[0], base[1] + height / 2, base[2]] }));
  }

  /**
   * Surface of revolution around the y axis. `profile` is [radius, y] from bottom to top; rings with radius 0
   * become fans. `color(row, seg)` paints each facet (row 0 is the lowest band). Faces point outwards.
   */
  lathe(
    profile: readonly (readonly [number, number])[],
    segments: number,
    color: ColorRepresentation | ((row: number, seg: number) => ColorRepresentation),
    options: { center?: Vec3; scale?: [number, number]; phase?: number; glow?: number | ((row: number, seg: number) => number) } = {},
  ): this {
    const [cx, cy, cz] = options.center ?? [0, 0, 0];
    const [sx, sz] = options.scale ?? [1, 1];
    const phase = options.phase ?? 0;
    const point = (row: number, seg: number): Vec3 => {
      const [r, y] = profile[row]!;
      const a = phase + (seg / segments) * Math.PI * 2;
      return [cx + Math.sin(a) * r * sx, cy + y, cz + Math.cos(a) * r * sz];
    };
    for (let row = 0; row + 1 < profile.length; row++) {
      const lowPole = profile[row]![0] === 0;
      const highPole = profile[row + 1]![0] === 0;
      if (lowPole && highPole) continue;
      for (let seg = 0; seg < segments; seg++) {
        const col = typeof color === 'function' ? color(row, seg) : color;
        const g = typeof options.glow === 'function' ? options.glow(row, seg) : options.glow ?? 0;
        const a = point(row, seg);
        const b = point(row, seg + 1);
        const c = point(row + 1, seg + 1);
        const d = point(row + 1, seg);
        if (lowPole) this.tri(a, c, d, col, g);
        else if (highPole) this.tri(a, b, c, col, g);
        else this.quad(a, b, c, d, col, g);
      }
    }
    return this;
  }

  /** A prism strut between two points (railings, limbs, poles at an angle). */
  strut(from: Vec3, to: Vec3, radius: number, segments: number, color: ColorRepresentation, radiusTo = radius): this {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const dz = to[2] - from[2];
    const length = Math.hypot(dx, dy, dz);
    if (length < 1e-6) return this;
    const geo = new CylinderGeometry(radiusTo, radius, length, segments, 1, false);
    const kit = paintFaces(toKitGeometry(geo), color);
    geo.dispose();
    // Align the cylinder's +y with the strut direction, then move its centre to the midpoint.
    const dir = new Vector3(dx, dy, dz).normalize();
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
    kit.applyQuaternion(q);
    kit.translate(from[0] + dx / 2, from[1] + dy / 2, from[2] + dz / 2);
    this.extra.push(kit);
    return this;
  }

  /** Adds a finished geometry (converted to kit layout; consumed). */
  add(geometry: BufferGeometry, placement?: Placement): this {
    const kit = toKitGeometry(geometry);
    geometry.dispose();
    this.extra.push(placement ? place(kit, placement) : kit);
    return this;
  }

  /** Adds a three primitive painted with one colour (or a face function) and placed. */
  addPainted(geometry: BufferGeometry, color: ColorRepresentation | Parameters<typeof paintFaces>[1], placement?: Placement, glow = 0): this {
    const kit = paintFaces(toKitGeometry(geometry), color);
    geometry.dispose();
    if (glow) setGlow(kit, glow);
    this.extra.push(placement ? place(kit, placement) : kit);
    return this;
  }

  get triangleCount(): number {
    return this.colors.length + this.extra.reduce((n, g) => n + g.getAttribute('position').count / 3, 0);
  }

  build(): BufferGeometry {
    const parts: BufferGeometry[] = [];
    if (this.colors.length > 0) parts.push(geometryFromTriangles(this.positions, this.colors, this.glows));
    parts.push(...this.extra);
    this.positions = [];
    this.colors = [];
    this.glows = [];
    this.extra = [];
    return parts.length === 1 ? parts[0]! : mergeKit(parts);
  }
}

// ---------------------------------------------------------------------------------------------------------
// HDB-style slab block
// ---------------------------------------------------------------------------------------------------------

export interface HdbBlockOptions {
  /** Residential floors above the void deck. Default 8. */
  floors?: number;
  /** Slab length along x (m). Default 14. */
  width?: number;
  /** Slab depth along z (m). Default 5. */
  depth?: number;
  floorHeight?: number;
  /** Lit windows: a count (>= 1) or a fraction of all windows (< 1). Default 0.35. */
  litWindows?: number;
  /** Windows per floor per long side. Default ~ one per 1.5 m. */
  columns?: number;
  body?: ColorRepresentation;
  accent?: ColorRepresentation;
  /** Open ground floor with pillars (the void deck). Default true. */
  voidDeck?: boolean;
  /** Seed for which windows are lit. */
  seed?: number | string;
  ao?: boolean;
}

/** HDB-style slab block: void deck, floor ledges, accent end bands, vertex-coloured window grid on both sides. */
export function hdbBlock(options: HdbBlockOptions = {}): BufferGeometry {
  const floors = Math.max(1, Math.round(options.floors ?? 8));
  const width = options.width ?? 14;
  const depth = options.depth ?? 5;
  const fh = options.floorHeight ?? 2.4;
  const body = options.body ?? '#e9e4f2';
  const accent = options.accent ?? PALETTE.school;
  const voidDeck = options.voidDeck ?? true;
  const columns = Math.max(1, Math.round(options.columns ?? width / 1.5));
  const rand = seededRandom(options.seed ?? 'hdb');
  const b = new GeoBuilder();
  const hw = width / 2;
  const hd = depth / 2;
  const deckH = voidDeck ? fh * 1.15 : 0;
  const top = deckH + floors * fh;
  const shade = mixHex(body, PALETTE.duskIndigo, 0.18);

  if (voidDeck) {
    // Floor slab, lift core and pillars.
    b.box([-hw, 0, -hd], [hw, 0.08, hd], { top: '#bdb6cc', side: '#a8a1ba' });
    b.box([-1.4, 0.08, -hd * 0.55], [1.4, deckH, hd * 0.55], { side: shade, front: mixHex(accent, body, 0.35) });
    const pillars = Math.max(2, Math.round(width / 3.5) + 1);
    for (let i = 0; i < pillars; i++) {
      const x = -hw + 0.3 + (i * (width - 0.6)) / (pillars - 1);
      for (const z of [hd - 0.3, -hd + 0.3]) b.box([x - 0.22, 0.08, z - 0.22], [x + 0.22, deckH, z + 0.22], body);
    }
  }
  // Main slab.
  b.box([-hw, deckH, -hd], [hw, top, hd], { side: body, top: '#8f8aa6', bottom: shade, left: mixHex(body, accent, 0.5), right: mixHex(body, accent, 0.5) });
  // End accent bands (full height) and floor ledges.
  for (const x of [-hw, hw - 0.5]) b.box([x - 0.04, deckH, -hd - 0.08], [x + 0.54, top + 0.3, hd + 0.08], accent);
  for (let f = 0; f <= floors; f++) {
    const y = deckH + f * fh;
    b.box([-hw + 0.5, y - 0.06, hd], [hw - 0.5, y + 0.06, hd + 0.18], mixHex(body, '#ffffff', 0.4), 0, { bottom: false });
    b.box([-hw + 0.5, y - 0.06, -hd - 0.18], [hw - 0.5, y + 0.06, -hd], mixHex(body, '#ffffff', 0.4), 0, { bottom: false });
  }
  // Window grid on both long sides.
  const total = floors * columns * 2;
  const litCount = Math.round((options.litWindows ?? 0.35) < 1 ? (options.litWindows ?? 0.35) * total : options.litWindows ?? 0);
  const lit = new Set<number>();
  for (let guard = 0; lit.size < Math.min(litCount, total) && guard < total * 8; guard++) lit.add(Math.floor(rand() * total));
  const span = (width - 1.2) / columns;
  const ww = span * 0.56;
  const wh = fh * 0.48;
  let idx = 0;
  for (let f = 0; f < floors; f++) {
    const y0 = deckH + f * fh + fh * 0.28;
    for (let c = 0; c < columns; c++) {
      const xc = -hw + 0.6 + span * (c + 0.5);
      for (const front of [true, false]) {
        const on = lit.has(idx++);
        const color = on ? (rand() > 0.25 ? PALETTE.windowLit : '#ffe8b8') : PALETTE.windowDark;
        const z = front ? hd + 0.02 : -hd - 0.02;
        const xa = front ? xc - ww / 2 : xc + ww / 2;
        const xb = front ? xc + ww / 2 : xc - ww / 2;
        b.quad([xa, y0, z], [xb, y0, z], [xb, y0 + wh, z], [xa, y0 + wh, z], color, on ? 1 : 0);
      }
    }
  }
  // Roof: parapet, lift motor room, water tank.
  b.box([-hw, top, hd - 0.15], [hw, top + 0.45, hd], body).box([-hw, top, -hd], [hw, top + 0.45, -hd + 0.15], body);
  b.box([-1.6, top, -1.2], [1.6, top + 1.6, 1.2], { side: shade, top: '#8f8aa6' });
  b.box([-1.2, top + 1.6, -0.9], [1.2, top + 2.3, 0.9], { side: '#b7b2c8', top: '#9b96b2' });
  const geo = b.build();
  return options.ao === false ? geo : bakeAO(geo, { height: Math.min(top, 6), ground: 0.72, underside: 0.2 });
}

// ---------------------------------------------------------------------------------------------------------
// Shophouse
// ---------------------------------------------------------------------------------------------------------

export interface ShophouseOptions {
  width?: number;
  depth?: number;
  /** 2 or 3 storeys. */
  storeys?: number;
  /** Pastel facade colour. */
  color?: ColorRepresentation;
  /** Shutters, sign band and trims. */
  accent?: ColorRepresentation;
  /** Ground floor: roller shutter down (closed) or lit shopfront. */
  shutter?: boolean;
  lit?: boolean;
  ao?: boolean;
}

/** Two- or three-storey shophouse with a five-foot way, blank sign band, louvred windows and pitched roof. */
export function shophouse(options: ShophouseOptions = {}): BufferGeometry {
  const w = options.width ?? 5;
  const d = options.depth ?? 8;
  const storeys = clamp(Math.round(options.storeys ?? 2), 2, 3);
  const color = options.color ?? '#f6c9b5';
  const accent = options.accent ?? '#3f8f74';
  const fh = 3.2;
  const h = storeys * fh;
  const hw = w / 2;
  const hd = d / 2;
  const recess = 1.6;
  const b = new GeoBuilder();
  const trim = mixHex(color, '#ffffff', 0.5);
  // Ground floor: recessed shopfront behind the five-foot way.
  b.box([-hw, 0, -hd], [hw, 0.12, hd], { top: '#d8cfc2', side: '#b9ae9f' });
  b.box([-hw, 0.12, -hd], [hw, fh, hd - recess], { side: color, front: options.shutter ? '#b9bfcc' : mixHex(PALETTE.windowLit, color, 0.3) }, options.shutter || options.lit === false ? 0 : 0.6);
  if (options.shutter) {
    for (let i = 1; i < 9; i++) {
      const y = 0.12 + (i * (fh - 0.5)) / 9;
      b.box([-hw + 0.3, y, hd - recess], [hw - 0.3, y + 0.05, hd - recess + 0.04], '#8e95a6');
    }
  }
  // Pillars of the five-foot way and the blank sign band.
  for (const x of [-hw + 0.25, hw - 0.25]) b.box([x - 0.25, 0.12, hd - 0.5], [x + 0.25, fh, hd], trim);
  b.box([-hw, fh - 0.75, hd - 0.12], [hw, fh, hd + 0.05], accent);
  // Upper storeys.
  b.box([-hw, fh, -hd], [hw, h, hd], { side: color, front: color });
  for (let s = 1; s < storeys; s++) {
    const y = s * fh;
    b.box([-hw, y - 0.1, hd], [hw, y + 0.1, hd + 0.2], trim);
    const n = w > 4.5 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const xc = -hw + (w * (i + 0.5)) / n;
      const ww = (w / n) * 0.5;
      // Tall window with louvred shutters either side.
      b.quad([xc - ww / 2, y + 0.5, hd + 0.02], [xc + ww / 2, y + 0.5, hd + 0.02], [xc + ww / 2, y + 2.5, hd + 0.02], [xc - ww / 2, y + 2.5, hd + 0.02], options.lit ? PALETTE.windowLit : PALETTE.windowDark, options.lit ? 0.8 : 0);
      for (const sx of [-1, 1]) {
        const x0 = xc + sx * (ww / 2 + 0.02);
        const x1 = x0 + sx * ww * 0.45;
        b.quad(sx > 0 ? [x0, y + 0.5, hd + 0.05] : [x1, y + 0.5, hd + 0.05], sx > 0 ? [x1, y + 0.5, hd + 0.05] : [x0, y + 0.5, hd + 0.05], sx > 0 ? [x1, y + 2.5, hd + 0.05] : [x0, y + 2.5, hd + 0.05], sx > 0 ? [x0, y + 2.5, hd + 0.05] : [x1, y + 2.5, hd + 0.05], accent);
      }
      b.box([xc - ww / 2 - 0.1, y + 2.5, hd], [xc + ww / 2 + 0.1, y + 2.75, hd + 0.12], trim);
    }
  }
  // Cornice and pitched roof (ridge along x).
  b.box([-hw - 0.1, h - 0.3, -hd - 0.1], [hw + 0.1, h, hd + 0.25], trim);
  const roof = '#c8644b';
  const rh = 1.6;
  b.quad([-hw - 0.1, h, hd + 0.3], [hw + 0.1, h, hd + 0.3], [hw + 0.1, h + rh, 0], [-hw - 0.1, h + rh, 0], roof);
  b.quad([hw + 0.1, h, -hd - 0.3], [-hw - 0.1, h, -hd - 0.3], [-hw - 0.1, h + rh, 0], [hw + 0.1, h + rh, 0], mixHex(roof, PALETTE.ink, 0.15));
  b.tri([hw, h, hd], [hw, h, -hd], [hw, h + rh, 0], color).tri([-hw, h, -hd], [-hw, h, hd], [-hw, h + rh, 0], color);
  const geo = b.build();
  return options.ao === false ? geo : bakeAO(geo, { height: 4, ground: 0.72 });
}

// ---------------------------------------------------------------------------------------------------------
// Street furniture
// ---------------------------------------------------------------------------------------------------------

export interface CoveredWalkwayOptions {
  /** Along x. Default 9. */
  length?: number;
  width?: number;
  height?: number;
  roof?: ColorRepresentation;
  post?: ColorRepresentation;
}

/** Covered walkway: twin rows of posts under a shallow arched roof. */
export function coveredWalkway(options: CoveredWalkwayOptions = {}): BufferGeometry {
  const l = options.length ?? 9;
  const w = options.width ?? 2.4;
  const h = options.height ?? 2.6;
  const roof = options.roof ?? '#4fa58f';
  const post = options.post ?? '#d9dde8';
  const b = new GeoBuilder();
  const hl = l / 2;
  const hw = w / 2;
  const n = Math.max(2, Math.round(l / 3) + 1);
  for (let i = 0; i < n; i++) {
    const x = -hl + 0.15 + (i * (l - 0.3)) / (n - 1);
    for (const z of [hw - 0.1, -hw + 0.1]) b.box([x - 0.07, 0, z - 0.07], [x + 0.07, h, z + 0.07], post);
  }
  // Arched roof: 4 flat panels across the width, plus fascia boards.
  const arch = [-1, -0.45, 0, 0.45, 1].map((u) => [u * (hw + 0.25), h + 0.35 * (1 - u * u)] as const);
  for (let i = 0; i < arch.length - 1; i++) {
    const [z0, y0] = arch[i]!;
    const [z1, y1] = arch[i + 1]!;
    const shade = i < 2 ? roof : mixHex(roof, '#ffffff', 0.12);
    b.quad([-hl, y0, z0], [hl, y0, z0], [hl, y1, z1], [-hl, y1, z1], mixHex(shade, PALETTE.ink, 0.25));
    b.quad([-hl, y0 + 0.06, z0], [-hl, y1 + 0.06, z1], [hl, y1 + 0.06, z1], [hl, y0 + 0.06, z0], shade);
  }
  for (const z of [hw + 0.25, -hw - 0.25]) b.box([-hl, h - 0.05, z - 0.04], [hl, h + 0.12, z + 0.04], post);
  return b.build();
}

export type TreeKind = 'round' | 'cone' | 'rain';

export interface TreeOptions {
  kind?: TreeKind;
  height?: number;
  seed?: number | string;
  leaf?: ColorRepresentation;
  trunk?: ColorRepresentation;
}

/** Low-poly tree: round (angsana), cone (casuarina) or rain tree (wide umbrella canopy). */
export function tree(options: TreeOptions = {}): BufferGeometry {
  const kind = options.kind ?? 'round';
  const h = options.height ?? 4.2;
  const rand = seededRandom(options.seed ?? 'tree');
  const leaf = options.leaf ?? PALETTE.leaf;
  const trunk = options.trunk ?? PALETTE.trunk;
  const light = mixHex(leaf, '#d9f2c4', 0.3);
  const dark = mixHex(leaf, PALETTE.duskIndigo, 0.25);
  const b = new GeoBuilder();
  const trunkH = kind === 'rain' ? h * 0.5 : h * 0.4;
  b.cylinder([0, 0, 0], 0.16 * (h / 4), trunkH + 0.4, 5, trunk, { radiusTop: 0.1 * (h / 4) });
  const shadeLeaf = (f: { normal: { y: number } }) => (f.normal.y > 0.45 ? light : f.normal.y < -0.3 ? dark : leaf);
  const jitter = (geo: BufferGeometry, amount: number) => {
    // Jitter shared corners consistently so the canopy stays watertight.
    const pos = geo.getAttribute('position');
    const seen = new Map<string, [number, number, number]>();
    for (let i = 0; i < pos.count; i++) {
      const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      let o = seen.get(key);
      if (!o) {
        o = [(rand() - 0.5) * amount, (rand() - 0.5) * amount, (rand() - 0.5) * amount];
        seen.set(key, o);
      }
      pos.setXYZ(i, pos.getX(i) + o[0], pos.getY(i) + o[1], pos.getZ(i) + o[2]);
    }
    return geo;
  };
  if (kind === 'cone') {
    for (let i = 0; i < 3; i++) {
      const r = (1.1 - i * 0.25) * (h / 4);
      const ch = h * 0.32;
      b.addPainted(jitter(new ConeGeometry(r, ch, 6).toNonIndexed(), 0.12), shadeLeaf, { at: [0, trunkH + i * ch * 0.55 + ch / 2, 0], rotY: rand() });
    }
  } else if (kind === 'rain') {
    const s = h / 4;
    b.addPainted(jitter(new IcosahedronGeometry(1, 0).toNonIndexed(), 0.18), shadeLeaf, { at: [0, trunkH + 0.9 * s, 0], scale: [2.4 * s, 0.75 * s, 2.2 * s] });
    b.addPainted(jitter(new IcosahedronGeometry(1, 0).toNonIndexed(), 0.18), shadeLeaf, { at: [0.9 * s, trunkH + 1.3 * s, -0.3 * s], scale: [1.3 * s, 0.6 * s, 1.2 * s] });
  } else {
    const s = h / 4;
    const blobs: [Vec3, number][] = [
      [[0, trunkH + 1.0 * s, 0], 1.05],
      [[0.55 * s, trunkH + 0.75 * s, 0.25 * s], 0.7],
      [[-0.5 * s, trunkH + 0.8 * s, -0.2 * s], 0.72],
    ];
    for (const [at, r] of blobs) {
      b.addPainted(jitter(new IcosahedronGeometry(r * s, 0).toNonIndexed(), 0.14 * s), shadeLeaf, { at, rotY: rand() * Math.PI });
    }
  }
  return bakeAO(b.build(), { ground: 0.7, underside: 0.3 });
}

export interface LampPostOptions {
  height?: number;
  lit?: boolean;
  color?: ColorRepresentation;
}

/** Street lamp: pole, arm and a lamp head whose underside glows when lit. */
export function lampPost(options: LampPostOptions = {}): BufferGeometry {
  const h = options.height ?? 4.5;
  const color = options.color ?? '#59607a';
  const lit = options.lit ?? true;
  const b = new GeoBuilder();
  b.cylinder([0, 0, 0], 0.12, 0.3, 6, mixHex(color, PALETTE.ink, 0.2));
  b.cylinder([0, 0.3, 0], 0.07, h - 0.3, 6, color, { radiusTop: 0.05 });
  b.box([-0.04, h - 0.08, -0.04], [0.04, h, 0.9], color);
  b.box([-0.18, h - 0.2, 0.7], [0.18, h - 0.05, 1.2], { side: color, top: color, bottom: lit ? PALETTE.windowLit : '#c9cbd6' }, 0);
  if (lit) b.quad([-0.15, h - 0.21, 0.73], [0.15, h - 0.21, 0.73], [0.15, h - 0.21, 1.17], [-0.15, h - 0.21, 1.17], '#fff1c9', 1);
  return b.build();
}

export interface BenchOptions {
  length?: number;
  back?: boolean;
  color?: ColorRepresentation;
  frame?: ColorRepresentation;
}

/** Bench with seat height 0.42 m (matches Bean "sit"). */
export function bench(options: BenchOptions = {}): BufferGeometry {
  const l = options.length ?? 1.6;
  const color = options.color ?? '#c98b5a';
  const frame = options.frame ?? '#4d5470';
  const b = new GeoBuilder();
  const hl = l / 2;
  for (const x of [-hl + 0.12, hl - 0.12]) {
    b.box([x - 0.04, 0, -0.2], [x + 0.04, 0.38, 0.2], frame);
    if (options.back !== false) b.box([x - 0.04, 0.38, -0.24], [x + 0.04, 0.85, -0.18], frame);
  }
  for (let i = 0; i < 3; i++) {
    const z = -0.18 + i * 0.13;
    b.box([-hl, 0.38, z], [hl, 0.42, z + 0.11], { side: mixHex(color, PALETTE.ink, 0.2), top: color });
  }
  if (options.back !== false) {
    for (let i = 0; i < 2; i++) b.box([-hl, 0.52 + i * 0.18, -0.25], [hl, 0.64 + i * 0.18, -0.21], { side: color, top: color, back: mixHex(color, PALETTE.ink, 0.2) });
  }
  return b.build();
}

export interface TableSetOptions {
  /** Round stone table (void deck, hawker) or rectangular canteen table. */
  round?: boolean;
  stools?: number;
  radius?: number;
  top?: ColorRepresentation;
  stool?: ColorRepresentation;
}

/** Table with stools around it (table top 0.75 m, stool seats 0.42 m). */
export function tableSet(options: TableSetOptions = {}): BufferGeometry {
  const round = options.round ?? true;
  const n = Math.max(0, Math.round(options.stools ?? 4));
  const r = options.radius ?? 0.6;
  const top = options.top ?? (round ? '#d8d2c4' : '#e4dccb');
  const stool = options.stool ?? (round ? '#cfc8b8' : '#e07a5f');
  const b = new GeoBuilder();
  if (round) {
    b.cylinder([0, 0, 0], 0.18, 0.7, 6, mixHex(top, PALETTE.ink, 0.15), { radiusTop: 0.12 });
    b.cylinder([0, 0.7, 0], r, 0.07, 10, mixHex(top, PALETTE.ink, 0.1), { top });
  } else {
    b.box([-r * 1.4, 0.7, -r * 0.7], [r * 1.4, 0.76, r * 0.7], { side: mixHex(top, PALETTE.ink, 0.15), top });
    for (const x of [-r * 1.25, r * 1.25]) b.box([x - 0.04, 0, -r * 0.55], [x + 0.04, 0.7, r * 0.55], '#6d7389');
  }
  const dist = round ? r + 0.38 : r + 0.35;
  const perSide = Math.max(1, Math.ceil(n / 2));
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 + Math.PI / 4;
    const slot = Math.floor(i / 2);
    const x = round ? Math.sin(a) * dist : perSide === 1 ? 0 : -r * 0.9 + (slot * 1.8 * r) / (perSide - 1);
    const z = round ? Math.cos(a) * dist : (i % 2 === 0 ? 1 : -1) * dist;
    b.cylinder([x, 0, z], 0.17, 0.42, 7, mixHex(stool, PALETTE.ink, 0.15), { radiusTop: 0.15, top: stool });
  }
  return b.build();
}

export interface KioskOptions {
  width?: number;
  depth?: number;
  color?: ColorRepresentation;
  /** Awning stripe colours (alternating). */
  awning?: [ColorRepresentation, ColorRepresentation];
  lit?: boolean;
}

/** Booth / kiosk: counter, back wall, striped awning and a blank sign band (text goes in the DOM). */
export function kiosk(options: KioskOptions = {}): BufferGeometry {
  const w = options.width ?? 2.4;
  const d = options.depth ?? 1.6;
  const color = options.color ?? PALETTE.digi;
  const [s1, s2] = options.awning ?? ['#ffffff', color];
  const b = new GeoBuilder();
  const hw = w / 2;
  const hd = d / 2;
  const dark = mixHex(color, PALETTE.ink, 0.3);
  b.box([-hw, 0, hd - 0.5], [hw, 1.0, hd], { side: color, top: '#efe9df', front: mixHex(color, '#ffffff', 0.15) });
  b.box([-hw, 0, -hd], [hw, 2.5, -hd + 0.15], { side: dark, front: options.lit ? mixHex(PALETTE.windowLit, color, 0.4) : mixHex(color, '#ffffff', 0.3) }, options.lit ? 0.5 : 0);
  for (const x of [-hw, hw - 0.12]) b.box([x, 0, -hd], [x + 0.12, 2.5, hd], dark);
  // Striped awning sloping forward.
  const stripes = Math.max(4, Math.round(w / 0.3));
  for (let i = 0; i < stripes; i++) {
    const x0 = -hw - 0.1 + ((w + 0.2) * i) / stripes;
    const x1 = -hw - 0.1 + ((w + 0.2) * (i + 1)) / stripes;
    const c = i % 2 === 0 ? s1 : s2;
    b.quad([x0, 2.2, hd + 0.4], [x1, 2.2, hd + 0.4], [x1, 2.6, -hd], [x0, 2.6, -hd], c);
    b.quad([x1, 2.2, hd + 0.4], [x0, 2.2, hd + 0.4], [x0, 2.6, -hd], [x1, 2.6, -hd], mixHex(c, PALETTE.ink, 0.3));
    b.quad([x0, 2.0, hd + 0.4], [x1, 2.0, hd + 0.4], [x1, 2.2, hd + 0.4], [x0, 2.2, hd + 0.4], c);
  }
  // Blank sign band on top.
  b.box([-hw, 2.6, -hd + 0.1], [hw, 3.1, -hd + 0.3], { side: dark, front: '#f4efe6' }, 0);
  return b.build();
}

export interface FenceOptions {
  length?: number;
  height?: number;
  spacing?: number;
  color?: ColorRepresentation;
}

/** Simple railing: posts every `spacing` m with two rails (along x). */
export function fence(options: FenceOptions = {}): BufferGeometry {
  const l = options.length ?? 4;
  const h = options.height ?? 1.0;
  const color = options.color ?? '#5c6680';
  const n = Math.max(2, Math.round(l / (options.spacing ?? 1.2)) + 1);
  const b = new GeoBuilder();
  for (let i = 0; i < n; i++) {
    const x = -l / 2 + (i * l) / (n - 1);
    b.box([x - 0.04, 0, -0.04], [x + 0.04, h, 0.04], color);
  }
  for (const y of [h * 0.45, h - 0.06]) b.box([-l / 2, y - 0.03, -0.03], [l / 2, y + 0.03, 0.03], mixHex(color, '#ffffff', 0.15));
  return b.build();
}

export interface SignboardOptions {
  width?: number;
  height?: number;
  /** Mounted on two posts (true) or a wall plate (false). */
  posts?: boolean;
  /** Height of the board's bottom edge. */
  elevation?: number;
  panel?: ColorRepresentation;
  frame?: ColorRepresentation;
  /** Lit lightbox (glows). */
  lit?: boolean;
}

/** Blank signboard or notice board (all text is DOM, never baked into 3D). */
export function signboard(options: SignboardOptions = {}): BufferGeometry {
  const w = options.width ?? 1.4;
  const h = options.height ?? 0.9;
  const posts = options.posts ?? true;
  const e = options.elevation ?? (posts ? 0.9 : 1.2);
  const panel = options.panel ?? PALETTE.paper;
  const frame = options.frame ?? '#4d5470';
  const b = new GeoBuilder();
  if (posts) for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) b.box([x - 0.05, 0, -0.05], [x + 0.05, e + h, 0.05], frame);
  b.box([-w / 2 - 0.06, e - 0.06, -0.06], [w / 2 + 0.06, e + h + 0.06, 0.04], frame);
  b.quad([-w / 2, e, 0.045], [w / 2, e, 0.045], [w / 2, e + h, 0.045], [-w / 2, e + h, 0.045], panel, options.lit ? 0.7 : 0);
  return b.build();
}

export interface RoadOptions {
  /** Along x. */
  length?: number;
  width?: number;
  /** Zebra crossing centred at this x (omit for none). */
  crossingAt?: number;
  kerb?: boolean;
}

/** Road strip with kerbs, dashed centre line and optional zebra crossing. */
export function road(options: RoadOptions = {}): BufferGeometry {
  const l = options.length ?? 20;
  const w = options.width ?? 7;
  const b = new GeoBuilder();
  const hl = l / 2;
  const hw = w / 2;
  b.box([-hl, -0.05, -hw], [hl, 0.02, hw], { top: PALETTE.asphalt, side: mixHex(PALETTE.asphalt, PALETTE.ink, 0.3) });
  const y = 0.025;
  const line = '#e8e4da';
  for (let x = -hl + 0.5; x < hl - 1.5; x += 3) {
    if (options.crossingAt !== undefined && Math.abs(x + 0.75 - options.crossingAt) < 2.2) continue;
    b.quad([x, y, 0.07], [x + 1.5, y, 0.07], [x + 1.5, y, -0.07], [x, y, -0.07], line);
  }
  if (options.crossingAt !== undefined) {
    const cx = options.crossingAt;
    for (let z = -hw + 0.4; z < hw - 0.5; z += 0.9) {
      b.quad([cx - 1.4, y, z + 0.5], [cx + 1.4, y, z + 0.5], [cx + 1.4, y, z], [cx - 1.4, y, z], '#f1ede4');
    }
  }
  if (options.kerb !== false) {
    for (const z of [hw, -hw - 0.3]) b.box([-hl, 0, z], [hl, 0.16, z + 0.3], { top: '#c9c3d6', side: '#a39db3' });
  }
  return b.build();
}

export interface GroundOptions {
  width?: number;
  depth?: number;
  color?: ColorRepresentation;
  /** Checker tiles of this size (m); 0 = plain. */
  tile?: number;
  thickness?: number;
}

/** Ground / floor slab, optionally tiled (void deck floors, canteen tiles). */
export function ground(options: GroundOptions = {}): BufferGeometry {
  const w = options.width ?? 12;
  const d = options.depth ?? 12;
  const color = options.color ?? '#bdb6cc';
  const tile = options.tile ?? 0;
  const t = options.thickness ?? 0.2;
  const b = new GeoBuilder();
  b.box([-w / 2, -t, -d / 2], [w / 2, 0, d / 2], { top: color, side: mixHex(color, PALETTE.ink, 0.25) }, 0, { top: tile > 0 });
  if (tile > 0) {
    const alt = mixHex(color, PALETTE.ink, 0.07);
    const nx = Math.max(1, Math.round(w / tile));
    const nz = Math.max(1, Math.round(d / tile));
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const x0 = -w / 2 + (i * w) / nx;
        const x1 = -w / 2 + ((i + 1) * w) / nx;
        const z0 = -d / 2 + (j * d) / nz;
        const z1 = -d / 2 + ((j + 1) * d) / nz;
        b.quad([x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], (i + j) % 2 === 0 ? color : alt);
      }
    }
  }
  return b.build();
}

export interface HexPlateOptions {
  /** Circumradius (m). */
  radius?: number;
  height?: number;
  top?: ColorRepresentation;
  side?: ColorRepresentation;
  /** Rim band colour (district accent). */
  rim?: ColorRepresentation;
}

/** Hexagonal district plate for the City Hub (pointy sides on ±x). */
export function hexPlate(options: HexPlateOptions = {}): BufferGeometry {
  const r = options.radius ?? 10;
  const h = options.height ?? 1.2;
  const top = options.top ?? '#c9c3d6';
  const side = options.side ?? '#6c6890';
  const rim = options.rim ?? PALETTE.school;
  const b = new GeoBuilder();
  const corner = (i: number, rad: number, y: number): Vec3 => [Math.cos((i * Math.PI) / 3) * rad, y, Math.sin((i * Math.PI) / 3) * rad];
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    b.tri([0, 0, 0], corner(j, r, 0), corner(i, r, 0), top);
    // Rim band then the darker plinth side, tapering slightly.
    b.quad(corner(j, r, 0), corner(j, r, -0.25), corner(i, r, -0.25), corner(i, r, 0), rim);
    b.quad(corner(j, r, -0.25), corner(j, r * 0.94, -h), corner(i, r * 0.94, -h), corner(i, r, -0.25), side);
    b.tri([0, -h, 0], corner(i, r * 0.94, -h), corner(j, r * 0.94, -h), mixHex(side, PALETTE.ink, 0.3));
  }
  return b.build();
}

// ---------------------------------------------------------------------------------------------------------
// Faceless manipulator silhouette (GAME_DESIGN.md §4.4) and its lit window
// ---------------------------------------------------------------------------------------------------------

export type FacelessPose = 'stand' | 'phone';

/** Height of the faceless figure (m) and the chest point a "Pull the String" thread attaches to. */
export const FACELESS_HEIGHT = 1.68;
export const FACELESS_CHEST: Vec3 = [0, 1.18, 0.16];

/**
 * A featureless, gender-neutral standing silhouette: soft lathe body, plain head, no face, hair or clothing
 * cues. 'phone' adds bent arms and a dim screen glow at the chest (the manipulator is always "online").
 */
export function facelessFigure(pose: FacelessPose = 'stand', color: ColorRepresentation = PALETTE.faceless): BufferGeometry {
  const base = new Color(color).getHexString();
  const body = `#${base}`;
  const light = mixHex(body, '#ffffff', 0.12);
  const dark = mixHex(body, PALETTE.ink, 0.28);
  const b = new GeoBuilder();
  const profile: [number, number][] = [
    [0, 0],
    [0.2, 0.02],
    [0.22, 0.38],
    [0.24, 0.78],
    [0.29, 1.1],
    [0.27, 1.22],
    [0.16, 1.3],
    [0.075, 1.34],
    [0.07, 1.4],
    [0, 1.42],
  ];
  b.lathe(profile, 10, (row) => (row >= 4 ? light : row <= 1 ? dark : body), { scale: [1.12, 0.7] });
  // Plain head: a slightly tall faceted ball, nudged forward and down when looking at a phone.
  const headAt: Vec3 = pose === 'phone' ? [0, 1.53, 0.05] : [0, 1.55, 0];
  b.addPainted(new IcosahedronGeometry(0.145, 1), (f) => (f.normal.y > 0.3 ? light : body), { at: headAt, scale: [1, 1.12, 1] });
  if (pose === 'phone') {
    for (const sx of [1, -1]) {
      const shoulder: Vec3 = [sx * 0.29, 1.16, 0];
      const elbow: Vec3 = [sx * 0.26, 0.9, 0.08];
      const hand: Vec3 = [sx * 0.07, 1.0, 0.24];
      b.strut(shoulder, elbow, 0.06, 5, body, 0.055).strut(elbow, hand, 0.055, 5, body, 0.045);
    }
    // Screen glow (resists the Freeze like every lit surface).
    b.quad([-0.05, 0.98, 0.29], [0.05, 0.98, 0.29], [0.05, 1.09, 0.24], [-0.05, 1.09, 0.24], '#bfe3ff', 1);
  } else {
    for (const sx of [1, -1]) b.strut([sx * 0.3, 1.14, 0], [sx * 0.27, 0.62, 0.02], 0.06, 5, body, 0.05);
  }
  return b.build();
}

export interface FacelessWindowOptions {
  /** Pane width (m). Default 1.1. */
  width?: number;
  /** Pane height (m). Default 1.05. */
  height?: number;
  /** Sill height above the figure's feet: the wall below hides the figure's lower body. Default 0.86. */
  sill?: number;
  /** Lit pane colour. */
  light?: ColorRepresentation;
  wall?: ColorRepresentation;
  /** Half-drawn curtain colour. */
  curtain?: ColorRepresentation;
}

/** A lit window set into a wall panel, built around a figure standing at the origin (pane behind, wall in front). */
export function facelessWindow(options: FacelessWindowOptions = {}): BufferGeometry {
  const w = options.width ?? 1.1;
  const h = options.height ?? 1.05;
  const sill = options.sill ?? 0.86;
  const light = options.light ?? PALETTE.windowLit;
  const wall = options.wall ?? mixHex(PALETTE.concrete, PALETTE.duskIndigo, 0.45);
  const curtain = options.curtain ?? mixHex('#c98ba0', PALETTE.duskIndigo, 0.25);
  const frame = mixHex(wall, PALETTE.ink, 0.35);
  const reveal = mixHex(wall, PALETTE.ink, 0.2);
  const b = new GeoBuilder();
  const hw = w / 2;
  const top = sill + h;
  const border = 0.32;
  const zPane = -0.32;
  const zFront = 0.3;
  const zBack = 0.22;
  // Glowing pane (the room light behind the silhouette).
  b.quad([-hw, sill, zPane], [hw, sill, zPane], [hw, top, zPane], [-hw, top, zPane], light, 1);
  // Wall around the opening: below the sill, the two sides and the lintel.
  b.box([-hw - border, 0, zBack], [hw + border, sill, zFront], { side: wall, top: mixHex(wall, '#ffffff', 0.2), back: reveal }, 0, { bottom: true });
  b.box([-hw - border, sill, zBack], [-hw, top, zFront], { side: wall, right: reveal }, 0, { bottom: true, top: true });
  b.box([hw, sill, zBack], [hw + border, top, zFront], { side: wall, left: reveal }, 0, { bottom: true, top: true });
  b.box([-hw - border, top, zBack], [hw + border, top + border, zFront], { side: wall, bottom: reveal });
  // Window reveals (the recess between wall and pane), lit from the room so they glow faintly.
  b.quad([-hw, sill, zBack], [-hw, sill, zPane], [-hw, top, zPane], [-hw, top, zBack], mixHex(reveal, light, 0.25), 0.15);
  b.quad([hw, sill, zPane], [hw, sill, zBack], [hw, top, zBack], [hw, top, zPane], mixHex(reveal, light, 0.25), 0.15);
  b.quad([-hw, top, zPane], [hw, top, zPane], [hw, top, zBack], [-hw, top, zBack], mixHex(reveal, light, 0.15), 0.1);
  b.quad([-hw, sill, zBack], [hw, sill, zBack], [hw, sill, zPane], [-hw, sill, zPane], frame);
  // Slim frame and sill lip.
  b.box([-hw - 0.04, sill - 0.06, zFront], [hw + 0.04, sill, zFront + 0.08], frame);
  // Half-drawn curtains hanging at both sides of the pane.
  const zc = zPane + 0.03;
  b.quad([-hw, sill + 0.1, zc], [-hw + 0.1, sill + 0.15, zc], [-hw + 0.24, top - 0.02, zc], [-hw, top - 0.02, zc], curtain, 0.25);
  b.quad([hw - 0.1, sill + 0.15, zc], [hw, sill + 0.1, zc], [hw, top - 0.02, zc], [hw - 0.24, top - 0.02, zc], curtain, 0.25);
  return b.build();
}

// ---------------------------------------------------------------------------------------------------------
// Paper lantern
// ---------------------------------------------------------------------------------------------------------

/** Lantern height (m) at scale 1; its origin is the bottom of the tassel. */
export const LANTERN_HEIGHT = 0.62;

/**
 * Paper lantern in neutral paper tones (multiply with a material/instance colour, default trust gold).
 * The paper body glows (resists the Freeze); caps and tassel stay dark.
 */
export function lantern(): BufferGeometry {
  const b = new GeoBuilder();
  const paper = '#ffffff';
  const fold = '#f1e3c6';
  const cap = '#6b3a2e';
  // Tassel, bottom cap, ribbed glowing body, top cap and loop.
  b.lathe([[0, 0], [0.035, 0.1], [0, 0.12]], 5, mixHex(cap, '#ffffff', 0.15));
  b.lathe([[0, 0.12], [0.1, 0.13], [0.11, 0.17]], 8, cap);
  b.lathe(
    [[0.11, 0.17], [0.19, 0.22], [0.23, 0.32], [0.22, 0.42], [0.17, 0.5], [0.1, 0.53]],
    8,
    (_row, seg) => (seg % 2 === 0 ? paper : fold),
    { glow: (row) => (row === 0 || row === 4 ? 0.75 : 1) },
  );
  b.lathe([[0.1, 0.53], [0.11, 0.57], [0, 0.58]], 8, cap);
  b.strut([0, 0.58, 0], [0, LANTERN_HEIGHT, 0], 0.012, 4, cap);
  return b.build();
}
