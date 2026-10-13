// S4 Food Court and Pop-up Booth (GAME_DESIGN.md §4.1): a hawker-style food court under a pitched zinc roof,
// cut away at the ridge so the camera sees in. Four stalls with blank lightbox signs, round tables with
// stools, steel pillars, a tray-return station, a Boba Boleh pop-up booth with its ring light, a QR payment
// sticker on one table, and the shophouse row behind. All static props are ONE merged geometry; the ceiling fans
// and the steam over the laksa pot are two small instanced meshes moved by pure functions of mission time.
// Lazy-loaded (3D chunk): the set data and Flat View twin live in sets/food-court.tsx and parts/food-court.layout.ts.
import { IcosahedronGeometry, type BufferGeometry, type Object3D } from 'three';
import { GeoBuilder, KitMesh, PALETTE, mixHex, tableSet, useKitGeometry } from '../../../kit';
import type { QualityTier } from '../../../quality';
import { pooled, tiledFloor, type LightPool } from '../../core/sets3d/common';
import type { SetPieceProps } from '../types';
import { AnimatedInstances, useAmbient, type InstanceLayout } from './anim';
import { FC } from './food-court.layout';
import { ceilingFanBlades, disc, facingQuad, panel, ring } from './props';

const TILE = '#c98c6a';
const TILE_B = '#d9a27f';
const WALL = '#efe7d6';
const STEEL = '#4f8f84';
const ZINC = PALETTE.zinc;
const BOBA = '#e8c9a0';
const BOBA_PINK = '#f4a6c0';
const PEARL = '#5a3b2e';

export interface FoodCourtOptions {
  tier: QualityTier;
  night: boolean;
}

function pools(night: boolean): LightPool[] {
  const s = night ? 1 : 0.6;
  return [
    ...FC.stalls.map((st): LightPool => ({ at: [(st.x0 + st.x1) / 2, FC.counterZ + 0.8], radius: 2.2, color: '#ffe3a8', strength: 0.32 * s })),
    { at: [6.35, -2.2], radius: 2.2, color: '#ffd0e0', strength: 0.3 * s },
    { at: [-3.8, -0.8], radius: 3.4, color: '#f2f7ff', strength: 0.18 * s },
    { at: [1.0, -0.8], radius: 3.4, color: '#f2f7ff', strength: 0.18 * s },
    // Open front: daylight on the near tables (none at night).
    { at: [0, 2.6], radius: 5, color: '#fff4dc', strength: night ? 0 : 0.18 },
  ];
}

/** Height of the back roof slope's underside at depth z. */
const roofY = (z: number) => {
  const r = FC.roof;
  return r.backY + ((z - r.backZ) / (r.ridgeZ - r.backZ)) * (r.ridgeY - r.backY);
};

/** Every static prop of the food court as one kit geometry. Pure (testable in Node). */
export function buildFoodCourt({ tier, night }: FoodCourtOptions): BufferGeometry {
  const { floor: f, wallZ: wz, wallH, roof: r, counterZ: cz } = FC;
  const light = pools(night);
  const detail = tier !== 'low';
  const b = new GeoBuilder();

  // --- Slab, quarry-tile floor, the drain along the open front --------------------------------------------
  b.box([f.x0, -0.5, f.z0], [f.x1, 0, f.z1], { side: mixHex(TILE, PALETTE.ink, 0.45), top: TILE }, 0, { top: true });
  tiledFloor(b, f.x0, f.x1, f.z0, f.z1 - 0.3, 0, detail ? 0.8 : 1.3, (x, z, i, j) => pooled((i + j) % 2 === 0 ? TILE : TILE_B, x, z, light));
  b.quad([f.x0, 0, f.z1], [f.x1, 0, f.z1], [f.x1, 0, f.z1 - 0.3], [f.x0, 0, f.z1 - 0.3], '#6d6f86');
  if (detail) for (let x = f.x0 + 0.25; x < f.x1; x += 0.5) b.quad([x, 0.004, f.z1 - 0.05], [x + 0.25, 0.004, f.z1 - 0.05], [x + 0.25, 0.004, f.z1 - 0.25], [x, 0.004, f.z1 - 0.25], '#4d5470');

  // --- Back wall: tiled stall backs, painted wall above, then the gap under the eave -----------------------
  b.box([f.x0, 0, wz - 0.25], [f.x1, wallH, wz], { side: '#3d4a7a', front: WALL, top: '#9c97b0' }, 0, { bottom: true });
  panel(b, f.x0, 2.95, f.x1, 3.15, wz + 0.004, STEEL);

  // --- The shophouse row behind (upper storeys only show above the roof) ----------------------------------
  const sh = FC.shophouses;
  const lit = (i: number) => (night ? i % 3 !== 1 : false);
  let wi = 0;
  for (let u = 0; u * sh.width < f.x1 - f.x0 - 0.01; u++) {
    const x0 = f.x0 + u * sh.width;
    const x1 = x0 + sh.width;
    const c = sh.colors[u % sh.colors.length]!;
    b.box([x0, sh.y0, sh.z - 0.4], [x1, sh.y1, sh.z], { side: mixHex(c, PALETTE.ink, 0.2), front: c, top: mixHex(c, PALETTE.ink, 0.3) }, 0, { bottom: true });
    // Pilasters, a cornice and a pitched tile roof sloping back.
    b.box([x0, sh.y0, sh.z], [x0 + 0.18, sh.y1, sh.z + 0.12], { side: mixHex(c, '#ffffff', 0.3), top: mixHex(c, '#ffffff', 0.3) }, 0, { bottom: true });
    b.box([x0 - 0.02, sh.y1 - 0.3, sh.z], [x1 + 0.02, sh.y1 - 0.12, sh.z + 0.2], mixHex(c, '#ffffff', 0.35));
    facingQuad(b, [x0, sh.y1 - 0.12, sh.z + 0.3], [x1, sh.y1 - 0.12, sh.z + 0.3], [x1, sh.y1 + 0.5, sh.z - 1.2], [x0, sh.y1 + 0.5, sh.z - 1.2], [0, 1, 0.6], u % 2 === 0 ? '#c7735a' : '#b8664f');
    for (const dx of [-0.95, 0.95]) {
      wi++;
      const cx = (x0 + x1) / 2 + dx;
      if (Math.abs(cx - FC.influenceX) < 0.2) continue;
      const on = lit(wi);
      panel(b, cx - 0.55, 4.3, cx + 0.55, 5.5, sh.z + 0.005, on ? PALETTE.windowLit : night ? PALETTE.windowDark : '#bcd3ea', on ? 1 : night ? 0 : 0.2);
      panel(b, cx - 0.66, 4.22, cx + 0.66, 4.3, sh.z + 0.02, mixHex(c, '#ffffff', 0.4));
      if (detail) {
        // Open louvred shutters on both sides of the window.
        const shut = mixHex(c, PALETTE.ink, 0.35);
        panel(b, cx - 0.86, 4.3, cx - 0.58, 5.5, sh.z + 0.01, shut);
        panel(b, cx + 0.58, 4.3, cx + 0.86, 5.5, sh.z + 0.01, shut);
      }
    }
  }

  // --- Stalls: tiled backs, partitions, counters, lightbox signs, kind-specific props ----------------------
  for (const st of FC.stalls) {
    const dark = mixHex(st.color, PALETTE.ink, 0.35);
    const mid = (st.x0 + st.x1) / 2;
    panel(b, st.x0, 0, st.x1, 2.3, wz + 0.006, '#f3f0ea');
    panel(b, st.x0, 1.32, st.x1, 1.42, wz + 0.008, st.color);
    b.box([st.x0 - 0.05, 0, wz], [st.x0 + 0.05, 2.3, cz], { side: dark, top: dark }, 0, { bottom: true });
    b.box([st.x0 + 0.05, 0, cz - 0.5], [st.x1 - 0.05, 1.0, cz], { side: dark, front: st.color, top: '#c9cdd6' }, 0, { bottom: true });
    panel(b, st.x0 + 0.1, 0.1, st.x1 - 0.1, 0.18, cz + 0.004, mixHex(st.color, '#ffffff', 0.4));
    panel(b, mid - 0.14, 0.62, mid + 0.14, 0.82, cz + 0.004, '#fff6e0');
    b.box([st.x0 + 0.02, 2.3, cz - 0.12], [st.x1 - 0.02, 2.88, cz], { side: dark, front: '#fff6e0', top: dark, bottom: dark }, 0.7);
    b.box([st.x0 + 0.1, 0, wz], [st.x1 - 0.1, 0.9, wz + 0.5], { side: '#c9cdd6', top: '#dfe2e8' }, 0, { bottom: true });
    if (detail) {
      ['#f2c14e', '#e0855a', '#f4efe6', '#7cc47f'].forEach((c, i) => panel(b, st.x0 + 0.25 + i * 0.52, 1.6, st.x0 + 0.7 + i * 0.52, 1.95, wz + 0.01, c, 0.15));
    }
    if (st.kind === 'chicken-rice') {
      b.box([st.x0 + 0.3, 1.0, cz - 0.45], [st.x0 + 1.3, 1.6, cz - 0.08], { side: '#d8ecf2', top: '#eaf6fa', front: '#e3f3f8' }, 0.35, { bottom: true });
      for (let i = 0; i < 3; i++) b.lathe([[0, 0], [0.1, 0.05], [0.12, 0.18], [0.06, 0.28], [0, 0.3]], 6, '#d9823b', { center: [st.x0 + 0.5 + i * 0.3, 1.15, cz - 0.26] });
      b.box([st.x1 - 0.9, 0.9, wz + 0.1], [st.x1 - 0.4, 0.97, wz + 0.4], '#b07a50');
    } else if (st.kind === 'laksa') {
      const [px, py, pz] = FC.pot;
      b.cylinder([px, py - 0.1, pz], 0.3, 0.42, 9, '#a9afbd', { top: '#c2652c' });
      b.cylinder([px, py + 0.32, pz], 0.08, 0.05, 6, '#3d4766');
      for (let i = 0; i < 3; i++) b.cylinder([st.x1 - 0.7 + i * 0.06, 1.0 + i * 0.07, cz - 0.25], 0.15, 0.07, 8, '#f4efe6', { radiusTop: 0.18 });
    } else if (st.kind === 'drinks') {
      b.box([st.x1 - 0.8, 0, wz], [st.x1 - 0.15, 1.85, wz + 0.55], { side: '#d9dde6', front: '#e8ebf1', top: '#c9cdd6' }, 0, { bottom: true });
      panel(b, st.x1 - 0.74, 0.15, st.x1 - 0.21, 1.75, wz + 0.555, '#d6f0ff', 0.7);
      if (detail) for (let i = 0; i < 4; i++) panel(b, st.x1 - 0.7, 0.3 + i * 0.38, st.x1 - 0.25, 0.42 + i * 0.38, wz + 0.56, ['#f26b5b', '#f2c14e', '#7cc47f', '#ff7ab0'][i]!, 0.5);
      ['#f59e42', '#c4a3ff', '#7cc47f'].forEach((c, i) => b.cylinder([st.x0 + 0.45 + i * 0.4, 1.0, cz - 0.25], 0.12, 0.38, 7, c, { top: '#c9cdd6', glow: 0.3 }));
    } else {
      for (let i = 0; i < 5; i++) {
        const x = st.x0 + 0.45 + i * 0.22;
        b.lathe([[0.1, 0], [0.07, 0.08], [0, 0.13]], 4, '#3f8f4a', { center: [x, 1.0, cz - 0.22], phase: Math.PI / 4 });
      }
      b.box([st.x1 - 1.0, 1.0, cz - 0.42], [st.x1 - 0.3, 1.05, cz - 0.1], '#c9cdd6');
      if (detail) for (let i = 0; i < 3; i++) b.box([st.x1 - 0.95 + i * 0.22, 1.05, cz - 0.38], [st.x1 - 0.77 + i * 0.22, 1.09, cz - 0.14], ['#d94b3a', '#f2c14e', '#f4efe6'][i]!);
    }
  }
  const last = FC.stalls[FC.stalls.length - 1]!;
  b.box([last.x1 - 0.05, 0, wz], [last.x1 + 0.05, 2.3, cz], { side: mixHex(last.color, PALETTE.ink, 0.35), top: mixHex(last.color, PALETTE.ink, 0.35) }, 0, { bottom: true });

  // --- Tray-return station and a trolley of trays -----------------------------------------------------------
  const tr = FC.trayReturn;
  const green = '#2f9e6e';
  b.box([tr.x0, 0, wz], [tr.x1, tr.h, tr.z1], { side: mixHex(green, PALETTE.ink, 0.3), front: green, top: '#c9cdd6' }, 0, { bottom: true });
  for (let i = 0; i < 3; i++) {
    const y = 0.25 + i * 0.4;
    panel(b, tr.x0 + 0.12, y, tr.x1 - 0.12, y + 0.24, tr.z1 + 0.004, '#1f4f45');
    panel(b, tr.x0 + 0.2, y + 0.02, tr.x1 - 0.2, y + 0.06, tr.z1 + 0.008, '#e8e4da');
  }
  b.box([tr.x0, 1.6, wz], [tr.x1, 2.05, wz + 0.1], { side: mixHex(green, PALETTE.ink, 0.3), front: '#e9fff4' }, 0.7);
  if (detail) {
    b.box([3.0, 0.1, -4.75], [3.45, 0.14, -4.35], '#9aa3b5');
    for (const x of [3.03, 3.42]) b.strut([x, 0, -4.73], [x, 0.95, -4.73], 0.015, 4, '#9aa3b5');
    for (let i = 0; i < 4; i++) b.box([2.98, 0.3 + i * 0.16, -4.78], [3.47, 0.33 + i * 0.16, -4.32], ['#2bb3a3', '#f2c14e', '#2bb3a3', '#f26b5b'][i]!);
  }

  // --- Boba Boleh pop-up booth: backdrop with a bubble-tea cup, wings, counter with samples ----------------
  const bo = FC.booth;
  b.box([bo.x0, 0, bo.backZ - 0.12], [bo.x1, bo.h, bo.backZ], { side: mixHex(BOBA, PALETTE.ink, 0.3), front: BOBA, back: '#c9cdd6', top: BOBA_PINK }, 0, { bottom: true });
  // Arched crown above the backdrop.
  const midX = (bo.x0 + bo.x1) / 2;
  const half = (bo.x1 - bo.x0) / 2;
  const segs = detail ? 10 : 6;
  for (let i = 0; i < segs; i++) {
    const a0 = Math.PI - (i / segs) * Math.PI;
    const a1 = Math.PI - ((i + 1) / segs) * Math.PI;
    const p = (a: number, k: number): [number, number, number] => [midX + Math.cos(a) * half * k, bo.h + Math.sin(a) * 0.55 * k, bo.backZ + 0.002];
    b.quad(p(a0, 0), p(a0, 1), p(a1, 1), p(a1, 0), i % 2 === 0 ? BOBA_PINK : '#fff0f5', 0.35);
  }
  panel(b, bo.x0, 0.9, bo.x1, 1.05, bo.backZ + 0.004, BOBA_PINK, 0.2);
  // The cup: a white trapezoid with a pink lid, dark pearls and a straw.
  const cupB = 1.2;
  const cupT = 2.2;
  b.quad([midX - 0.28, cupB, bo.backZ + 0.006], [midX + 0.28, cupB, bo.backZ + 0.006], [midX + 0.38, cupT, bo.backZ + 0.006], [midX - 0.38, cupT, bo.backZ + 0.006], '#fffaf2', 0.4);
  panel(b, midX - 0.42, cupT, midX + 0.42, cupT + 0.1, bo.backZ + 0.008, BOBA_PINK, 0.4);
  b.quad([midX + 0.05, cupT + 0.1, bo.backZ + 0.008], [midX + 0.13, cupT + 0.1, bo.backZ + 0.008], [midX + 0.3, cupT + 0.5, bo.backZ + 0.008], [midX + 0.22, cupT + 0.5, bo.backZ + 0.008], '#e8505b', 0.4);
  for (let i = 0; i < 7; i++) disc(b, [midX - 0.2 + (i % 4) * 0.13 + (i > 3 ? 0.07 : 0), cupB + 0.1 + (i > 3 ? 0.12 : 0), bo.backZ + 0.01], 0.055, 6, PEARL);
  for (const [x0, x1] of [[bo.x0 - 0.1, bo.x0], [bo.x1, bo.x1 + 0.1]] as const) {
    b.box([x0, 0, bo.backZ - 0.12], [x1, bo.h, bo.backZ + 0.55], { side: BOBA_PINK, top: '#fff0f5' }, 0, { bottom: true });
  }
  const bc = bo.counter;
  b.box([bc.x0, 0, bc.z0], [bc.x1, 1.0, bc.z1], { side: mixHex(BOBA_PINK, PALETTE.ink, 0.25), front: BOBA_PINK, top: '#fff6e0' }, 0, { bottom: true });
  if (detail) for (let i = 0; i < 9; i++) disc(b, [bc.x0 + 0.15 + i * 0.18, 0.25 + (i % 2) * 0.22, bc.z1 + 0.004], 0.05, 6, PEARL);
  for (let i = 0; i < 4; i++) {
    const x = bc.x0 + 0.25 + i * 0.22;
    b.cylinder([x, 1.0, bc.z0 + 0.25], 0.045, 0.14, 6, '#f4e1c4', { radiusTop: 0.055, top: BOBA_PINK });
  }
  b.quad([bc.x1 - 0.5, 1.0, bc.z0 + 0.35], [bc.x1 - 0.15, 1.0, bc.z0 + 0.35], [bc.x1 - 0.15, 1.22, bc.z0 + 0.25], [bc.x1 - 0.5, 1.22, bc.z0 + 0.25], '#fff6e0');
  // "Filming a promo" standee (its words are the clue's DOM label) with a camera pictogram.
  const sd = new GeoBuilder();
  sd.box([-0.32, 0, -0.14], [0.32, 0.05, 0.14], '#3d4766');
  sd.box([-0.28, 0.05, -0.02], [0.28, 1.55, 0.02], { side: '#c9cdd6', front: '#fff6e0', back: '#c9cdd6' }, 0, { bottom: true });
  sd.quad([-0.26, 1.28, 0.022], [0.26, 1.28, 0.022], [0.26, 1.52, 0.022], [-0.26, 1.52, 0.022], BOBA_PINK, 0.3);
  sd.quad([-0.14, 0.85, 0.024], [0.06, 0.85, 0.024], [0.06, 1.03, 0.024], [-0.14, 1.03, 0.024], '#1d2440');
  sd.tri([0.06, 0.94, 0.024], [0.16, 0.86, 0.024], [0.16, 1.02, 0.024], '#1d2440');
  for (let i = 0; i < 3; i++) sd.quad([-0.2, 0.4 + i * 0.1, 0.022], [0.2 - i * 0.08, 0.4 + i * 0.1, 0.022], [0.2 - i * 0.08, 0.44 + i * 0.1, 0.022], [-0.2, 0.44 + i * 0.1, 0.022], '#c9c0aa');
  b.add(sd.build(), { at: FC.standee.at, rotY: FC.standee.yaw });
  // Ring light on a tripod, turned towards the booth, with a phone in the ring.
  const rl = new GeoBuilder();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    rl.strut([Math.sin(a) * 0.32, 0, Math.cos(a) * 0.32], [0, 0.65, 0], 0.012, 3, '#3d4766');
  }
  rl.strut([0, 0.6, 0], [0, 1.45, 0], 0.016, 4, '#3d4766');
  ring(rl, [0, 1.62, 0.02], 0.18, 0.24, detail ? 14 : 8, '#fffdf5', 0.95);
  rl.box([-0.045, 1.53, 0.0], [0.045, 1.71, 0.03], '#1d2440');
  b.add(rl.build(), { at: FC.ringLight.at, rotY: FC.ringLight.yaw });

  // --- Tables with stools, and what is on them; the QR payment sticker --------------------------------------
  FC.tables.forEach((at, i) => {
    b.add(tableSet({ round: true, stools: 4, radius: FC.tableR, top: '#ebe6dc', stool: i % 2 === 0 ? '#e07a5f' : '#2bb3a3' }), { at });
  });
  if (detail) {
    const items: [number, number, string][] = [
      [0, 0.1, '#f2c14e'],
      [1, -0.15, '#f4efe6'],
      [2, 0.2, '#7cc4ff'],
      [3, -0.1, '#f26b5b'],
    ];
    for (const [ti, dx, c] of items) {
      const [x, , z] = FC.tables[ti]!;
      b.box([x + dx - 0.22, 0.77, z - 0.16], [x + dx + 0.22, 0.8, z + 0.16], c, 0, { bottom: true });
      b.cylinder([x + dx + 0.05, 0.8, z], 0.09, 0.06, 7, '#f4efe6', { radiusTop: 0.11 });
    }
    // Tissue packets "holding" seats, a local habit.
    for (const ti of [1, 3]) {
      const [x, , z] = FC.tables[ti]!;
      b.box([x - 0.35, 0.77, z + 0.2], [x - 0.2, 0.81, z + 0.28], '#ffffff', 0.2, { bottom: true });
    }
    const [nx, , nz] = FC.tables[4]!;
    b.cylinder([nx + 0.1, 0.77, nz - 0.15], 0.06, 0.16, 6, '#f59e42', { top: '#f4efe6' });
    b.cylinder([nx - 0.15, 0.77, nz + 0.05], 0.13, 0.04, 8, '#f4efe6');
  }
  const [qx, qy, qz] = FC.qr;
  const flatTop = (x0: number, z0: number, x1: number, z1: number, y: number, c: string, glow = 0) =>
    b.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], c, glow);
  flatTop(qx - 0.12, qz - 0.12, qx + 0.12, qz + 0.12, qy + 0.004, '#e8505b', 0.2);
  flatTop(qx - 0.095, qz - 0.095, qx + 0.095, qz + 0.095, qy + 0.007, '#ffffff', 0.3);
  for (const [dx, dz] of [[-0.075, -0.075], [0.025, -0.075], [-0.075, 0.025], [0.0, 0.0], [0.045, 0.045], [-0.02, 0.05]] as const) {
    const s = dx === 0 || dz === 0.05 || dx === 0.045 ? 0.025 : 0.05;
    flatTop(qx + dx, qz + dz, qx + dx + s, qz + dz + s, qy + 0.01, '#1d2440');
  }

  // --- Steel pillars under the ridge, with braces up to the ridge beam --------------------------------------
  for (const [x, , z] of FC.pillars) {
    b.box([x - 0.13, 0, z - 0.13], [x + 0.13, r.ridgeY - 0.12, z + 0.13], { side: STEEL, top: STEEL }, 0, { bottom: true });
    b.box([x - 0.16, 0, z - 0.16], [x + 0.16, 0.35, z + 0.16], mixHex(STEEL, PALETTE.ink, 0.3), 0, { bottom: true });
    if (detail) {
      b.strut([x, r.ridgeY - 1.0, z], [x - 0.8, r.ridgeY - 0.14, z], 0.04, 4, STEEL);
      b.strut([x, r.ridgeY - 1.0, z], [x + 0.8, r.ridgeY - 0.14, z], 0.04, 4, STEEL);
      // A small blank notice plate at eye level.
      panel(b, x - 0.1, 1.45, x + 0.1, 1.7, z + 0.134, '#fff6e0');
    }
  }

  // --- The zinc roof: sheeted back slope (ribbed above and below), ridge beam, purlins, lights, gable trusses -
  const ribs = detail ? 40 : 20;
  for (let i = 0; i < ribs; i++) {
    const x0 = r.x0 + ((r.x1 - r.x0) * i) / ribs;
    const x1 = r.x0 + ((r.x1 - r.x0) * (i + 1)) / ribs;
    const top = i % 2 === 0 ? ZINC : mixHex(ZINC, PALETTE.ink, 0.12);
    const under = i % 2 === 0 ? '#eef1f6' : '#c3c9d6';
    facingQuad(b, [x0, r.backY + 0.06, r.backZ], [x1, r.backY + 0.06, r.backZ], [x1, r.ridgeY + 0.06, r.ridgeZ], [x0, r.ridgeY + 0.06, r.ridgeZ], [0, 1, -0.4], top);
    // The underside faces away from the lights: a touch of glow keeps the ribbed zinc readable from below.
    facingQuad(b, [x0, r.backY, r.backZ], [x1, r.backY, r.backZ], [x1, r.ridgeY, r.ridgeZ], [x0, r.ridgeY, r.ridgeZ], [0, -1, 0.4], under, 0.12);
  }
  // Eave fascia and the cut ends of the sheets.
  b.box([r.x0, r.backY - 0.14, r.backZ - 0.06], [r.x1, r.backY + 0.08, r.backZ], { side: '#8f99ad', top: '#8f99ad' });
  b.box([r.x0, r.ridgeY - 0.16, r.ridgeZ - 0.12], [r.x1, r.ridgeY + 0.1, r.ridgeZ + 0.12], { side: STEEL, top: mixHex(ZINC, '#ffffff', 0.2), front: STEEL });
  for (const z of [-4.2, -2.8]) {
    const y = roofY(z);
    b.box([r.x0, y - 0.14, z - 0.05], [r.x1, y - 0.02, z + 0.05], mixHex(STEEL, '#ffffff', 0.15));
    for (const x of [-5.95, -1.95, 1.55]) b.box([x - 0.6, y - 0.2, z - 0.04], [x + 0.6, y - 0.14, z + 0.04], '#f2f7ff', night ? 1 : 0.6);
  }
  // Fan rods from the roof down to each hub (the blades turn).
  for (const [x, y, z] of FC.fans) b.strut([x, y + 0.08, z], [x, roofY(z) - 0.02, z], 0.02, 4, '#6d7389');
  // Gable trusses at both ends show the roof's full profile (the front slope is cut away to see in).
  for (const x of [r.x0 + 0.1, r.x1 - 0.1]) {
    b.strut([x, r.backY, r.backZ], [x, r.ridgeY, r.ridgeZ], 0.07, 4, STEEL);
    b.strut([x, r.ridgeY, r.ridgeZ], [x, r.frontY, r.frontZ], 0.07, 4, STEEL);
    b.strut([x, r.frontY - 0.05, r.frontZ], [x, r.backY - 0.05, r.backZ], 0.05, 4, STEEL);
    b.strut([x, r.ridgeY, r.ridgeZ], [x, r.frontY - 0.05 + ((r.backY - r.frontY) * (r.frontZ - r.ridgeZ)) / (r.frontZ - r.backZ), r.ridgeZ], 0.045, 4, STEEL);
    b.box([x - 0.1, 0, r.frontZ - 0.2], [x + 0.1, r.frontY, r.frontZ], { side: STEEL, top: STEEL }, 0, { bottom: true });
  }
  return b.build();
}

// ------------------------------------------------------------------------------------------------------------
// Moving parts: ceiling fans and the steam over the laksa pot (pure functions of time).
// ------------------------------------------------------------------------------------------------------------

const fanLayout: InstanceLayout = (i, time, o: Object3D) => {
  const [x, y, z] = FC.fans[i]!;
  o.position.set(x, y, z);
  o.rotation.y = time * 2.4 + i * 1.3;
};

const PUFFS = 5;

/** A soft low-poly steam puff (glows a little, so it still reads while the world is held). */
export function steamPuff(): BufferGeometry {
  const b = new GeoBuilder();
  b.addPainted(new IcosahedronGeometry(1, 0), (face) => (face.normal.y > 0.2 ? '#ffffff' : '#e9edf5'), undefined, 0.3);
  return b.build();
}

/** Each puff rises from the pot, swells, drifts and fades (shrinks) away; then the next one replaces it. */
export const steamLayout: InstanceLayout = (i, time, o: Object3D) => {
  const s = (((time * 0.32 + i / PUFFS) % 1) + 1) % 1;
  const [px, py, pz] = FC.pot;
  o.position.set(px + Math.sin(i * 2.3 + s * 3.2) * 0.1, py + 0.38 + s * 1.15, pz + 0.06 + s * 0.12);
  o.scale.setScalar((0.07 + s * 0.2) * (1 - s * s * s));
  o.rotation.y = i + s * 1.5;
};

/** The moving meshes (geometry and instance count), for budget checks. */
export function foodCourtMoving(): { geometry: BufferGeometry; count: number }[] {
  return [
    { geometry: ceilingFanBlades('#c9cdd6', 0.6), count: FC.fans.length },
    { geometry: steamPuff(), count: PUFFS },
  ];
}

export default function FoodCourtSet({ quality, frozen, t, timeOfDay }: SetPieceProps) {
  const night = timeOfDay === 'evening' || timeOfDay === 'night';
  const geometry = useKitGeometry(() => buildFoodCourt({ tier: quality, night }), [quality, night]);
  const fan = useKitGeometry(() => ceilingFanBlades('#c9cdd6', 0.6), []);
  const puff = useKitGeometry(() => steamPuff(), []);
  const { time, running } = useAmbient(t, frozen);
  return (
    <group>
      <KitMesh geometry={geometry} />
      <AnimatedInstances geometry={fan} count={FC.fans.length} layout={fanLayout} t={time} running={running} />
      <AnimatedInstances geometry={puff} count={PUFFS} layout={steamLayout} t={time} running={running} />
    </group>
  );
}
