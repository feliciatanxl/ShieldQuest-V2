// The NPC "bean" (GAME_DESIGN.md §4.4): an 8-part rigid figure in ONE geometry (≤ 300 triangles).
// Each vertex carries a `part` index; the bean material poses parts with 8 uniform matrices (no skinning).
// The face is painted on the head's front facets through a CanvasTexture atlas of expressions (see faceAtlas.ts).
// Pure three.js (no DOM), so the triangle budget is unit-tested.
import { BufferAttribute, BufferGeometry, Color, type ColorRepresentation } from 'three';
import { hashString, pick, type Vec3 } from './math';
import { mixHex } from './paint';

export type BeanHair =
  | 'short'
  | 'long'
  | 'bun'
  | 'cap'
  | 'hijab'
  | 'none'
  | 'curly'
  | 'ponytail'
  | 'spiky'
  | 'beanie'
  | 'puffs'
  | 'buzz';

export const BEAN_HAIRS: readonly BeanHair[] = [
  'short',
  'long',
  'bun',
  'cap',
  'hijab',
  'none',
  'curly',
  'ponytail',
  'spiky',
  'beanie',
  'puffs',
  'buzz',
];

export type BeanOutfit = 'casual' | 'school' | 'work';

/** Figure styling. `body`/`accent`/`hair` match CastMember.look; the rest are optional extras. */
export interface BeanLook {
  /** Top colour. */
  body: string;
  /** Bottoms, trims, caps and headscarves. */
  accent: string;
  hair?: BeanHair;
  /** Skin tone; picked from a natural range by seed when omitted. */
  skin?: string;
  hairColor?: string;
  glasses?: boolean;
  outfit?: BeanOutfit;
}

export const SKIN_TONES = ['#f3d2b8', '#e9bd98', '#d9a077', '#bf8257', '#9a6342', '#71472f'] as const;
const HAIR_COLORS = ['#1e1a22', '#2b211f', '#3a2a22', '#4b3426', '#22232f', '#5a3b2a'] as const;

/** Part indices (match the bean shader). */
export const BEAN_PART = { torso: 0, legL: 1, head: 2, armL: 3, armR: 4, phone: 5, legR: 6, face: 7 } as const;

/** Joint pivots in bean space (feet at y = 0, facing +z; the bean's left is +x). */
export const BEAN_JOINT: Record<'hip' | 'neck' | 'shoulderL' | 'shoulderR' | 'hipL' | 'hipR' | 'phone', Vec3> = {
  hip: [0, 0.38, 0],
  neck: [0, 1.0, 0],
  shoulderL: [0.24, 0.9, 0],
  shoulderR: [-0.24, 0.9, 0],
  hipL: [0.1, 0.36, 0],
  hipR: [-0.1, 0.36, 0],
  phone: [0, 0.74, 0.27],
};

export const BEAN_HEAD_CENTRE: Vec3 = [0, 1.22, 0];
export const BEAN_HEAD_RADIUS = 0.25;
export const BEAN_HEIGHT = 1.5;

/** Face atlas layout: 4 x 3 cells; the last cell is plain white (used by every non-face vertex). */
export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 3;
export const ATLAS_WHITE_UV: [number, number] = [(3 + 0.5) / ATLAS_COLS, 1 - (2 + 0.5) / ATLAS_ROWS];
/** Margin (fraction of a cell) left white around the projected face. */
export const ATLAS_MARGIN = 0.06;
/** Half-extent of the planar face projection, in head radii. */
export const FACE_SPAN: [number, number] = [0.95, 0.85];

class BeanBuilder {
  positions: number[] = [];
  colors: number[] = [];
  glows: number[] = [];
  parts: number[] = [];
  uvs: number[] = [];
  private c = new Color();

  tri(a: Vec3, b: Vec3, c: Vec3, color: ColorRepresentation, part: number, opts: { glow?: number; uv?: [number, number][] } = {}): void {
    this.c.set(color);
    const verts = [a, b, c];
    verts.forEach((v, i) => {
      this.positions.push(v[0], v[1], v[2]);
      this.colors.push(this.c.r, this.c.g, this.c.b);
      this.glows.push(opts.glow ?? 0);
      this.parts.push(part);
      const uv = opts.uv?.[i] ?? ATLAS_WHITE_UV;
      this.uvs.push(uv[0], uv[1]);
    });
  }

  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: ColorRepresentation, part: number, glow = 0): void {
    this.tri(a, b, c, color, part, { glow });
    this.tri(a, c, d, color, part, { glow });
  }

  box(min: Vec3, max: Vec3, color: ColorRepresentation | ((side: 'top' | 'bottom' | 'side' | 'front') => ColorRepresentation), part: number): void {
    const col = (s: 'top' | 'bottom' | 'side' | 'front') => (typeof color === 'function' ? color(s) : color);
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col('side'), part);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col('side'), part);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col('front'), part);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col('side'), part);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], col('top'), part);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], col('bottom'), part);
  }

  /**
   * Surface of revolution: `point(row, angle)` for rows 0..rows (top to bottom); angle 0 faces +z and grows
   * towards +x. Rings that collapse to a point become fans (no degenerate triangles).
   */
  revolve(
    rows: number,
    segments: number,
    point: (row: number, angle: number) => Vec3,
    color: (row: number, seg: number) => ColorRepresentation,
    part: number | ((row: number, seg: number) => number),
    opts: { phase?: number; skip?: (row: number, seg: number) => boolean; faceUv?: (row: number, seg: number) => boolean } = {},
  ): void {
    const phase = opts.phase ?? 0;
    const ring = (r: number) => Array.from({ length: segments }, (_, s) => point(r, phase + (s / segments) * Math.PI * 2));
    const isPole = (pts: Vec3[]) => pts.every((p) => Math.abs(p[0] - pts[0]![0]) < 1e-6 && Math.abs(p[2] - pts[0]![2]) < 1e-6);
    let top = ring(0);
    for (let r = 0; r < rows; r++) {
      const bottom = ring(r + 1);
      const topPole = isPole(top);
      const bottomPole = isPole(bottom);
      for (let s = 0; s < segments; s++) {
        if (opts.skip?.(r, s)) continue;
        const s1 = (s + 1) % segments;
        const A = top[s]!;
        const B = top[s1]!;
        const C = bottom[s1]!;
        const D = bottom[s]!;
        const col = color(r, s);
        const p = typeof part === 'number' ? part : part(r, s);
        const face = opts.faceUv?.(r, s) ?? false;
        const emit = (a: Vec3, b: Vec3, c: Vec3) =>
          face ? this.tri(a, b, c, col, BEAN_PART.face, { uv: [faceUv(a), faceUv(b), faceUv(c)] }) : this.tri(a, b, c, col, p);
        if (topPole && bottomPole) continue;
        if (topPole) emit(D, C, A);
        else if (bottomPole) emit(D, B, A);
        else {
          emit(D, C, B);
          emit(D, B, A);
        }
      }
      top = bottom;
    }
  }

  build(): BufferGeometry {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(this.colors), 3));
    geo.setAttribute('glow', new BufferAttribute(new Float32Array(this.glows), 1));
    geo.setAttribute('part', new BufferAttribute(new Float32Array(this.parts), 1));
    geo.setAttribute('uv', new BufferAttribute(new Float32Array(this.uvs), 2));
    geo.computeVertexNormals();
    return geo;
  }
}

/** Planar front projection of a head vertex into atlas cell (0, 0). */
function faceUv(p: Vec3): [number, number] {
  const xr = (p[0] - BEAN_HEAD_CENTRE[0]) / BEAN_HEAD_RADIUS;
  const yr = (p[1] - BEAN_HEAD_CENTRE[1]) / BEAN_HEAD_RADIUS;
  const fu = Math.min(1, Math.max(0, 0.5 + xr / (2 * FACE_SPAN[0])));
  const fv = Math.min(1, Math.max(0, 0.5 + yr / (2 * FACE_SPAN[1])));
  const u = (ATLAS_MARGIN + (1 - 2 * ATLAS_MARGIN) * fu) / ATLAS_COLS;
  const v = 1 - 1 / ATLAS_ROWS + (ATLAS_MARGIN + (1 - 2 * ATLAS_MARGIN) * fv) / ATLAS_ROWS;
  return [u, v];
}

/** UV offset that moves face UVs from cell (0, 0) to the given cell (column, row from the top). */
export function atlasCellOffset(col: number, row: number): [number, number] {
  return [col / ATLAS_COLS, -row / ATLAS_ROWS];
}

export interface ResolvedBeanLook {
  top: string;
  bottom: string;
  skin: string;
  hair: BeanHair;
  hairColor: string;
  accent: string;
  glasses: boolean;
}

/** Fills in skin and hair colour deterministically from a seed (e.g. the cast id). */
export function resolveBeanLook(look: BeanLook, seed: string): ResolvedBeanLook {
  const outfit = look.outfit ?? 'casual';
  const skin = look.skin ?? pick(SKIN_TONES, `${seed}:skin`);
  const hairColor = look.hairColor ?? pick(HAIR_COLORS, `${seed}:hair`);
  const top = outfit === 'school' ? '#eef1f6' : look.body;
  const bottom = outfit === 'casual' ? look.accent : outfit === 'school' ? look.accent : mixHex(look.accent, '#1d2440', 0.3);
  return {
    top,
    bottom,
    skin,
    hair: look.hair ?? 'short',
    hairColor,
    accent: look.accent,
    glasses: look.glasses ?? (hashString(`${seed}:glasses`) % 7 === 0),
  };
}

const sph = (c: Vec3, r: number, theta: number, a: number, sx = 1, sy = 1, sz = 1): Vec3 => [
  c[0] + Math.sin(theta) * Math.sin(a) * r * sx,
  c[1] + Math.cos(theta) * r * sy,
  c[2] + Math.sin(theta) * Math.cos(a) * r * sz,
];

/** A small octahedron (8 triangles): buns, puffs, curls, pom-poms. */
function octa(b: BeanBuilder, c: Vec3, r: Vec3, color: string, part: number): void {
  const [x, y, z] = c;
  const px: Vec3 = [x + r[0], y, z];
  const nx: Vec3 = [x - r[0], y, z];
  const py: Vec3 = [x, y + r[1], z];
  const ny: Vec3 = [x, y - r[1], z];
  const pz: Vec3 = [x, y, z + r[2]];
  const nz: Vec3 = [x, y, z - r[2]];
  const light = mixHex(color, '#ffffff', 0.1);
  b.tri(pz, px, py, light, part);
  b.tri(px, nz, py, color, part);
  b.tri(nz, nx, py, color, part);
  b.tri(nx, pz, py, light, part);
  b.tri(px, pz, ny, color, part);
  b.tri(nz, px, ny, color, part);
  b.tri(nx, nz, ny, color, part);
  b.tri(pz, nx, ny, color, part);
}

/** Hair or headwear silhouette (attached to the head part). */
function addHair(b: BeanBuilder, look: ResolvedBeanLook): void {
  const H = BEAN_HEAD_CENTRE;
  const R = BEAN_HEAD_RADIUS;
  const head = BEAN_PART.head;
  const hair = look.hair;
  if (hair === 'none') return;
  const colorFor = hair === 'cap' || hair === 'hijab' || hair === 'beanie' ? look.accent : look.hairColor;
  const shade = mixHex(colorFor, '#000000', 0.18);
  const light = mixHex(colorFor, '#ffffff', 0.12);
  const domeColor = (row: number) => (row === 0 ? light : row === 1 ? colorFor : shade);

  if (hair === 'hijab') {
    // Head-and-neck shell with the face left open (front two segments of the middle rows skipped).
    const r = R * 1.16;
    b.revolve(
      4,
      8,
      (row, a) => (row < 4 ? sph(H, r, (row * Math.PI) / 4.4, a) : [Math.sin(a) * 0.2, 0.94, Math.cos(a) * 0.17 + 0.01]),
      (row) => (row === 0 ? light : colorFor),
      head,
      // Segments 0 and 7 meet at +z: skipping them in the middle rows leaves the face open.
      { skip: (row, seg) => row >= 1 && row <= 2 && (seg === 0 || seg === 7) },
    );
    // Drape over the shoulders.
    b.revolve(1, 8, (row, a) => (row === 0 ? [Math.sin(a) * 0.2, 0.94, Math.cos(a) * 0.18] : [Math.sin(a) * 0.3, 0.8, Math.cos(a) * 0.27]), () => shade, head);
    return;
  }

  // Dome: front edge high (clear of the eyes), back edge low; `back` controls how far down it goes.
  const dome = (r: number, front: number, back: number, flare = 1) => {
    b.revolve(
      3,
      8,
      (row, a) => {
        if (row === 0) return [H[0], H[1] + r, H[2]];
        const edge = front + (back - front) * (0.5 - 0.5 * Math.cos(a));
        const theta = row === 1 ? 0.55 * edge : row === 2 ? 0.85 * edge : edge;
        const f = row === 3 ? flare : 1;
        return sph(H, r, theta, a, f, 1, f);
      },
      domeColor,
      head,
      { phase: Math.PI / 8 },
    );
  };

  switch (hair) {
    case 'short':
      dome(R * 1.07, 1.05, 1.9);
      break;
    case 'buzz':
      dome(R * 1.03, 1.1, 1.75);
      break;
    case 'long':
      dome(R * 1.08, 1.08, 2.25, 1.12);
      b.box([-0.2, 0.82, -0.24], [0.2, 1.18, -0.1], (s) => (s === 'top' ? colorFor : shade), head);
      break;
    case 'bun':
      dome(R * 1.07, 1.08, 1.85);
      octa(b, [H[0], H[1] + R * 1.0, H[2] - R * 0.55], [0.1, 0.09, 0.1], colorFor, head);
      break;
    case 'ponytail':
      dome(R * 1.07, 1.08, 1.85);
      octa(b, [H[0], H[1] - R * 0.05, H[2] - R * 1.25], [0.07, 0.17, 0.08], colorFor, head);
      break;
    case 'puffs':
      dome(R * 1.07, 1.08, 1.85);
      octa(b, [H[0] + R * 0.95, H[1] + R * 0.55, H[2] - R * 0.15], [0.1, 0.1, 0.1], colorFor, head);
      octa(b, [H[0] - R * 0.95, H[1] + R * 0.55, H[2] - R * 0.15], [0.1, 0.1, 0.1], colorFor, head);
      break;
    case 'curly':
      dome(R * 1.1, 1.0, 1.95, 1.05);
      octa(b, [H[0] + R * 0.6, H[1] + R * 0.85, H[2] + R * 0.1], [0.1, 0.09, 0.1], light, head);
      octa(b, [H[0] - R * 0.6, H[1] + R * 0.85, H[2] + R * 0.05], [0.1, 0.09, 0.1], light, head);
      octa(b, [H[0], H[1] + R * 0.95, H[2] - R * 0.6], [0.11, 0.1, 0.11], colorFor, head);
      break;
    case 'spiky': {
      dome(R * 1.07, 1.05, 1.85);
      for (let i = 0; i < 5; i++) {
        const a = -0.9 + i * 0.45;
        const base = sph(H, R * 1.0, 0.45, a);
        const tip: Vec3 = [base[0] * 1.25 - H[0] * 0.25, H[1] + R * 1.38, base[2] * 1.3 - 0.02];
        const l: Vec3 = [base[0] - 0.06, base[1], base[2]];
        const rr: Vec3 = [base[0] + 0.06, base[1], base[2]];
        const back: Vec3 = [base[0], base[1], base[2] - 0.08];
        b.tri(l, rr, tip, light, head);
        b.tri(rr, back, tip, colorFor, head);
        b.tri(back, l, tip, shade, head);
      }
      break;
    }
    case 'cap':
      dome(R * 1.09, 1.0, 1.55);
      // Brim pointing forward.
      b.box([-0.17, H[1] + R * 0.3, R * 0.75], [0.17, H[1] + R * 0.38, R * 1.65], (s) => (s === 'top' ? colorFor : shade), head);
      break;
    case 'beanie':
      dome(R * 1.12, 0.95, 1.6, 1.04);
      b.revolve(1, 8, (row, a) => sph(H, R * 1.17, row === 0 ? 0.88 : 1.15, a), () => shade, head, { phase: Math.PI / 8 });
      octa(b, [H[0], H[1] + R * 1.2, H[2]], [0.07, 0.07, 0.07], light, head);
      break;
  }
}

function addGlasses(b: BeanBuilder): void {
  const H = BEAN_HEAD_CENTRE;
  const R = BEAN_HEAD_RADIUS;
  const z = H[2] + R * 1.0;
  const y = H[1] + R * 0.06;
  const frame = '#2a2f45';
  const t = 0.014;
  for (const sx of [-1, 1]) {
    const cx = H[0] + sx * R * 0.36;
    const w = R * 0.24;
    const h = R * 0.18;
    const zz = z - Math.abs(sx) * 0.02;
    // Four thin bars per lens, facing +z.
    const bar = (x0: number, y0: number, x1: number, y1: number) =>
      b.quad([x0, y0, zz], [x1, y0, zz], [x1, y1, zz], [x0, y1, zz], frame, BEAN_PART.head);
    bar(cx - w, y + h - t, cx + w, y + h + t);
    bar(cx - w, y - h - t, cx + w, y - h + t);
    bar(cx - w - t, y - h, cx - w + t, y + h);
    bar(cx + w - t, y - h, cx + w + t, y + h);
  }
  b.quad([H[0] - R * 0.12, y + 0.02, z - 0.01], [H[0] + R * 0.12, y + 0.02, z - 0.01], [H[0] + R * 0.12, y + 0.035, z - 0.01], [H[0] - R * 0.12, y + 0.035, z - 0.01], frame, BEAN_PART.head);
}

/** Builds the bean geometry (position, color, glow, part, uv). Dispose it when the look changes. */
export function buildBeanGeometry(look: BeanLook, seed = 'bean'): BufferGeometry {
  const L = resolveBeanLook(look, seed);
  const b = new BeanBuilder();
  const topShade = mixHex(L.top, '#1d2440', 0.12);
  const bottomShade = mixHex(L.bottom, '#1d2440', 0.15);
  const skinShade = mixHex(L.skin, '#1d2440', 0.1);
  const shoe = '#2b2f45';

  // Torso: a soft bean (8 segments, 4 rows): shoulders, chest, waist, hips.
  const torso: [number, number][] = [
    [0, 1.04],
    [0.17, 0.98],
    [0.23, 0.76],
    [0.21, 0.5],
    [0, 0.34],
  ];
  b.revolve(
    4,
    8,
    (row, a) => {
      const [r, y] = torso[row]!;
      return [Math.sin(a) * r, y, Math.cos(a) * r * 0.86];
    },
    (row, seg) => {
      if (row >= 3) return seg % 2 === 0 ? L.bottom : bottomShade;
      if (row === 0 && L.top === '#eef1f6') return seg === 0 ? L.accent : L.top; // school tie at the collar
      return seg % 2 === 0 ? L.top : topShade;
    },
    BEAN_PART.torso,
    { phase: -Math.PI / 8 },
  );

  // Head: low-poly sphere; its front facets carry the face (part 7 = head transform + expression atlas).
  const H = BEAN_HEAD_CENTRE;
  b.revolve(
    5,
    8,
    (row, a) => sph(H, BEAN_HEAD_RADIUS, (row * Math.PI) / 5, a),
    (row, seg) => (row === 0 || (row === 4 && seg % 2 === 0) ? skinShade : L.skin),
    BEAN_PART.head,
    // Segment 0 is centred on +z; the face spans segments 7, 0, 1 of the middle rows.
    { phase: -Math.PI / 8, faceUv: (row, seg) => row >= 1 && row <= 3 && (seg === 0 || seg === 1 || seg === 7) },
  );

  // Arms: tapered 6-sided capsules hanging from the shoulders; hands are skin.
  for (const [side, part] of [
    [1, BEAN_PART.armL],
    [-1, BEAN_PART.armR],
  ] as const) {
    const sx = side * 0.28;
    const prof: [number, number][] = [
      [0, 0.93],
      [0.065, 0.88],
      [0.06, 0.62],
      [0, 0.55],
    ];
    b.revolve(
      3,
      5,
      (row, a) => {
        const [r, y] = prof[row]!;
        return [sx + Math.sin(a) * r, y, Math.cos(a) * r];
      },
      (row) => (row === 2 ? L.skin : row === 0 ? L.top : topShade),
      part,
    );
  }

  // Legs: short 5-sided stubs with dark shoes.
  for (const [side, part] of [
    [1, BEAN_PART.legL],
    [-1, BEAN_PART.legR],
  ] as const) {
    const x = side * 0.1;
    const prof: [number, number, number][] = [
      [0, 0.4, 0],
      [0.075, 0.36, 0],
      [0.07, 0.09, 0.02],
      [0, 0, 0.04],
    ];
    b.revolve(
      3,
      5,
      (row, a) => {
        const [r, y, dz] = prof[row]!;
        return [x + Math.sin(a) * r, y, dz + Math.cos(a) * r * (row === 2 ? 1.3 : 1)];
      },
      (row) => (row === 2 ? shoe : row === 0 ? L.bottom : bottomShade),
      part,
    );
  }

  // Phone (hidden by its part matrix unless the pose holds it): screen faces the head and glows.
  {
    const [cx, cy, cz] = BEAN_JOINT.phone;
    const w = 0.055;
    const h = 0.1;
    const t = 0.012;
    const tilt = 0.9; // radians back from vertical, screen towards the face
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    // Local (x, y along screen height, z thickness) -> bean space.
    const P = (x: number, y: number, z: number): Vec3 => [cx + x, cy + y * ct - z * st, cz + y * st + z * ct];
    const back = '#2a2f45';
    const corners = (z: number): Vec3[] => [P(-w, -h, z), P(w, -h, z), P(w, h, z), P(-w, h, z)];
    const [a0, a1, a2, a3] = corners(t) as [Vec3, Vec3, Vec3, Vec3];
    const [b0, b1, b2, b3] = corners(-t) as [Vec3, Vec3, Vec3, Vec3];
    // Screen (faces up/back towards the head): local -z side after tilt.
    b.quad(b1, b0, b3, b2, '#bfe3ff', BEAN_PART.phone, 1);
    b.quad(a0, a1, a2, a3, back, BEAN_PART.phone);
    b.quad(a1, b1, b2, a2, back, BEAN_PART.phone);
    b.quad(b0, a0, a3, b3, back, BEAN_PART.phone);
    b.quad(a3, a2, b2, b3, back, BEAN_PART.phone);
    b.quad(b0, b1, a1, a0, back, BEAN_PART.phone);
  }

  addHair(b, L);
  if (L.glasses) addGlasses(b);

  const geo = b.build();
  // Vertices move in the shader: give culling a generous, pose-independent bound.
  geo.computeBoundingSphere();
  if (geo.boundingSphere) {
    geo.boundingSphere.center.set(0, 0.75, 0);
    geo.boundingSphere.radius = 1.1;
  }
  return geo;
}
