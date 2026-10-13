// S3 Mall Atrium and MiniMart 24 (GAME_DESIGN.md §4.1): a convenience store cut away beside a mall atrium.
// Fridges, two low gondolas, a counter under a plainly visible dome camera and its notice, a self-checkout,
// a sliding door; in the atrium a lucky-draw booth with a prize wheel and balloon arch, and the
// phone-accessory shop at the back. All static props are ONE merged geometry; the sliding door leaves, the
// prize wheel and the balloons are three small instanced meshes moved by pure functions of mission time.
// Lazy-loaded (3D chunk): the set data and Flat View twin live in sets/minimart.tsx and parts/minimart.layout.ts.
import { CylinderGeometry, type BufferGeometry, type Object3D } from 'three';
import { GeoBuilder, KitMesh, PALETTE, bench, mixHex, smoothstep, tree, useKitGeometry } from '../../../kit';
import type { QualityTier } from '../../../quality';
import { pooled, tiledFloor, type LightPool } from '../../core/sets3d/common';
import type { SetPieceProps } from '../types';
import { AnimatedInstances, useAmbient, type InstanceLayout } from './anim';
import { MM, MM_BALLOONS } from './minimart.layout';
import { disc, facingQuad, floorRing, gondola, panel, ring } from './props';

const SHOP_FLOOR = '#eef3f6';
const SHOP_WALL = '#e3efea';
const MALL_FLOOR = '#efe6d6';
const MALL_WALL = '#efe6d8';
const BRAND = '#e8505b';
const BRAND_DARK = mixHex(BRAND, PALETTE.ink, 0.35);
const WOOD = '#c99a6b';
const STEEL = '#9aa3b5';

export interface MinimartOptions {
  tier: QualityTier;
  night: boolean;
}

function pools(night: boolean): LightPool[] {
  return [
    { at: [-5.6, -1.8], radius: 2.8, color: '#f4fbff', strength: 0.28 },
    { at: [-2.6, -2.4], radius: 2.6, color: '#f4fbff', strength: 0.24 },
    { at: [-5.2, -3.8], radius: 2.2, color: '#cfeaff', strength: 0.3 },
    { at: [3.0, -0.9], radius: 2.8, color: '#ffe3a8', strength: night ? 0.34 : 0.24 },
    { at: [6.2, -3.4], radius: 2.0, color: '#f2f0ff', strength: 0.3 },
    // Daylight from the mall's glass roof falls on the open atrium.
    { at: [3.4, 1.6], radius: 4.2, color: night ? '#c9cff5' : '#fff8e6', strength: night ? 0.1 : 0.2 },
  ];
}

/** Rows of product fronts on a face: `face(x0, y0, x1, y1, colour)` draws one product. */
function productRows(
  rows: number,
  per: number,
  y0: number,
  y1: number,
  colours: readonly string[],
  face: (u0: number, v0: number, u1: number, v1: number, color: string) => void,
) {
  const rowH = (y1 - y0) / rows;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < per; i++) {
      const u0 = i / per + 0.012;
      const u1 = (i + 1) / per - 0.012;
      const h = rowH * (0.55 + 0.35 * (((i * 5 + r * 3) % 4) / 3));
      face(u0, y0 + r * rowH + 0.04, u1, y0 + r * rowH + 0.04 + h - 0.06, colours[(i + r * 2) % colours.length]!);
    }
  }
}

/** Every static prop of the mall and shop as one kit geometry. Pure (testable in Node). */
export function buildMinimart({ tier, night }: MinimartOptions): BufferGeometry {
  const { floor: f, wallZ: wz, wallH, shop } = MM;
  const light = pools(night);
  const detail = tier !== 'low';
  const b = new GeoBuilder();

  // --- Slab and floors: shop tiles, mall stone, phone-shop planks ---------------------------------------------
  b.box([f.x0, -0.5, f.z0], [f.x1, 0, f.z1], { side: mixHex(MALL_FLOOR, PALETTE.ink, 0.42), top: MALL_FLOOR }, 0, { top: true });
  tiledFloor(b, shop.x0, shop.x1, f.z0, shop.front, 0, detail ? 0.6 : 1.2, (x, z, i, j) =>
    pooled((i + j) % 2 === 0 ? SHOP_FLOOR : mixHex(SHOP_FLOOR, '#9fc0d8', 0.22), x, z, light),
  );
  tiledFloor(b, shop.x0, shop.x1, shop.front, f.z1, 0, 1.2, (x, z, i) => pooled(i % 2 === 0 ? MALL_FLOOR : mixHex(MALL_FLOOR, PALETTE.ink, 0.05), x, z, light));
  tiledFloor(b, shop.x1, MM.phoneShop.x0, f.z0, f.z1, 0, 1.2, (x, z, i, j) => pooled((i + j) % 2 === 0 ? MALL_FLOOR : mixHex(MALL_FLOOR, PALETTE.ink, 0.05), x, z, light));
  tiledFloor(b, MM.phoneShop.x0, f.x1, MM.phoneShop.front, f.z1, 0, 1.2, (x, z, i, j) => pooled((i + j) % 2 === 1 ? MALL_FLOOR : mixHex(MALL_FLOOR, PALETTE.ink, 0.05), x, z, light));
  tiledFloor(b, MM.phoneShop.x0, f.x1, f.z0, MM.phoneShop.front, 0, 0.48, (x, z, i) => pooled(i % 2 === 0 ? WOOD : mixHex(WOOD, PALETTE.ink, 0.1), x, z, light));
  // A gold inlay ring on the atrium floor under the lucky-draw booth.
  floorRing(b, 3.0, -0.9, 2.1, 2.22, 0.004, detail ? 20 : 12, mixHex(PALETTE.gold, MALL_FLOOR, 0.35));

  // --- Back walls: shop (mint, coral skirting) and mall (cream) ----------------------------------------------
  b.box([shop.x0, 0, wz - 0.25], [shop.x1, wallH, wz], { side: '#3d4a7a', front: SHOP_WALL, top: '#3d4a7a' }, 0, { bottom: true });
  b.box([shop.x1, 0, wz - 0.25], [f.x1, wallH, wz], { side: '#3d4a7a', front: MALL_WALL, top: '#3d4a7a' }, 0, { bottom: true });
  panel(b, shop.x0, 0, shop.x1, 0.14, wz + 0.004, BRAND);
  // Left wall of the shop (its inside face looks at the camera) and the partition to the atrium.
  b.box([shop.x0 - 0.15, 0, wz], [shop.x0, wallH, shop.front], { side: SHOP_WALL, left: mixHex(SHOP_WALL, PALETTE.ink, 0.3), top: '#3d4a7a' }, 0, { bottom: true });
  b.box([shop.x1 - 0.08, 0, wz], [shop.x1 + 0.08, wallH, shop.front], { side: MALL_WALL, left: SHOP_WALL, top: '#cfc6b4', front: BRAND }, 0, { bottom: true });

  // --- Shopfront: low sill, corner posts, the sliding-door frame and its sensor --------------------------------
  const d = MM.door;
  const sill = { side: mixHex(BRAND, PALETTE.ink, 0.15), top: '#f4efe6', front: BRAND };
  b.box([shop.x0, 0, shop.front - 0.12], [d.x0 - 0.05, 0.35, shop.front], sill, 0, { bottom: true });
  b.box([d.x1 + 0.05, 0, shop.front - 0.12], [shop.x1, 0.35, shop.front], sill, 0, { bottom: true });
  // The glass line above the sill reads as a faint glowing edge (the panes themselves are cut away).
  b.box([shop.x0, 0.35, shop.front - 0.07], [d.x0 - 0.05, 0.4, shop.front - 0.05], '#cfe8ff', 0.5, { bottom: true });
  b.box([d.x1 + 0.05, 0.35, shop.front - 0.07], [shop.x1, 0.4, shop.front - 0.05], '#cfe8ff', 0.5, { bottom: true });
  for (const x of [shop.x0, d.x0 - 0.05, d.x1 + 0.05, shop.x1]) {
    const top = x === shop.x0 || x === shop.x1 ? wallH : d.h + 0.18;
    b.box([x - 0.05, 0, shop.front - 0.1], [x + 0.05, top, shop.front + 0.02], { side: '#c9cdd6', top: '#9aa3b5' }, 0, { bottom: true });
  }
  b.box([d.x0 - 0.85, d.h, shop.front - 0.04], [d.x1 + 0.85, d.h + 0.18, shop.front + 0.14], { side: '#c9cdd6', front: '#dfe2e8', bottom: '#9aa3b5' });
  b.box([(d.x0 + d.x1) / 2 - 0.16, d.h + 0.18, shop.front + 0.02], [(d.x0 + d.x1) / 2 + 0.16, d.h + 0.28, shop.front + 0.12], '#2c3149');
  panel(b, (d.x0 + d.x1) / 2 - 0.05, d.h + 0.2, (d.x0 + d.x1) / 2 + 0.05, d.h + 0.26, shop.front + 0.122, PALETTE.safe, 1);
  // Door mat with a coral border.
  b.quad([d.x0 + 0.05, 0.006, shop.front + 0.95], [d.x1 - 0.05, 0.006, shop.front + 0.95], [d.x1 - 0.05, 0.006, shop.front + 0.2], [d.x0 + 0.05, 0.006, shop.front + 0.2], BRAND);
  b.quad([d.x0 + 0.13, 0.008, shop.front + 0.87], [d.x1 - 0.13, 0.008, shop.front + 0.87], [d.x1 - 0.13, 0.008, shop.front + 0.28], [d.x0 + 0.13, 0.008, shop.front + 0.28], '#3d4766');

  // --- Fridges along the back wall, and the brand lightbox above them ----------------------------------------
  const fr = MM.fridges;
  b.box([fr.x0, 0, wz], [fr.x1, fr.h, wz + fr.depth], { side: '#dfe5ee', front: '#eef2f7', top: '#c9d3e0' }, 0, { bottom: true });
  panel(b, fr.x0, fr.h - 0.2, fr.x1, fr.h - 0.04, wz + fr.depth + 0.004, BRAND, 0.8);
  const doorW = (fr.x1 - fr.x0) / fr.doors;
  for (let i = 0; i < fr.doors; i++) {
    const x0 = fr.x0 + i * doorW + 0.05;
    const x1 = x0 + doorW - 0.1;
    const zf = wz + fr.depth + 0.006;
    panel(b, x0, 0.12, x1, fr.h - 0.26, zf, '#d6f0ff', 0.75);
    if (detail) {
      productRows(4, 4, 0.18, fr.h - 0.32, ['#f26b5b', '#f2c14e', '#2bb3a3', '#ff7ab0', '#7cc4ff', '#7cc47f'], (u0, v0, u1, v1, c) =>
        panel(b, x0 + 0.04 + u0 * (x1 - x0 - 0.08), v0, x0 + 0.04 + u1 * (x1 - x0 - 0.08), v0 + (v1 - v0) * 0.85, zf + 0.004, c, 0.45),
      );
    }
    b.box([x1 - 0.05, 0.75, zf], [x1 - 0.02, 1.25, zf + 0.04], STEEL);
  }
  const br = MM.brand;
  b.box([br.x0, br.y0, wz], [br.x1, br.y1, wz + 0.12], { side: BRAND_DARK, front: '#fff6e0', top: BRAND_DARK }, 0.7, { bottom: false });
  disc(b, [br.x0 + 0.32, (br.y0 + br.y1) / 2, wz + 0.125], 0.22, 10, PALETTE.gold, 0.7);
  disc(b, [br.x0 + 0.32, (br.y0 + br.y1) / 2, wz + 0.128], 0.14, 10, BRAND, 0.7);

  // --- Gondolas (low and open) and the wall shelving --------------------------------------------------------
  const snack = ['#f59e42', '#f2c14e', '#e8505b', '#7cc47f', '#f4efe6', '#c2652c'];
  const beauty = ['#ff9ec4', '#c4a3ff', '#f4efe6', '#7fd6cf', '#f27aa0', '#e9d5ff'];
  for (const g of MM.gondolas) {
    const isSnacks = g.kind === 'snacks';
    b.add(
      gondola({
        length: g.z1 - g.z0,
        left: isSnacks ? snack : ['#f2c14e', '#7cc4ff', '#f26b5b', '#2bb3a3'],
        right: isSnacks ? snack.slice().reverse() : beauty,
        cap: isSnacks ? '#f59e42' : '#f27aa0',
        perShelf: detail ? 7 : 3,
      }),
      { at: [g.x, 0, (g.z0 + g.z1) / 2] },
    );
  }
  const ws = MM.wallShelf;
  const wx = shop.x0 + ws.depth;
  b.box([shop.x0, 0, ws.z0], [wx, ws.h, ws.z1], { side: '#d9dde6', right: '#cfd5e0', top: '#b9c1cf' }, 0, { bottom: true });
  for (let s = 0; s < 4; s++) {
    const y = 0.12 + s * 0.4;
    b.box([wx - 0.02, y, ws.z0], [wx + 0.02, y + 0.03, ws.z1], '#b9c1cf', 0, { bottom: true });
    if (detail || s % 2 === 0) {
      const per = detail ? 9 : 4;
      for (let i = 0; i < per; i++) {
        const z0 = ws.z0 + 0.05 + (i * (ws.z1 - ws.z0 - 0.1)) / per;
        const z1 = z0 + (ws.z1 - ws.z0 - 0.1) / per - 0.04;
        const top = y + 0.1 + 0.22 * (((i * 3 + s) % 4) / 3);
        const c = ['#7cc4ff', '#f2c14e', '#f4efe6', '#2bb3a3', '#f26b5b'][(i + s) % 5]!;
        b.quad([wx + 0.025, y + 0.03, z1], [wx + 0.025, y + 0.03, z0], [wx + 0.025, top, z0], [wx + 0.025, top, z1], c);
      }
    }
  }

  // --- Counter, restocking shelf, register; the dome camera and its notice -----------------------------------
  const ct = MM.counter;
  b.box([ct.x0, 0, ct.z0], [ct.x1, ct.h, ct.z1], { side: BRAND_DARK, front: BRAND, top: '#e4e7ee' }, 0, { bottom: true });
  panel(b, ct.x0 + 0.06, 0.45, ct.x1 - 0.06, 0.55, ct.z1 + 0.004, '#fff6e0');
  b.box([-0.75, ct.h, -3.42], [-0.35, ct.h + 0.18, -3.12], '#3d4766');
  facingQuad(b, [-0.72, ct.h + 0.2, -3.36], [-0.38, ct.h + 0.2, -3.36], [-0.38, ct.h + 0.42, -3.28], [-0.72, ct.h + 0.42, -3.28], [0, 0.35, -1], '#7fd6cf', 0.8);
  facingQuad(b, [-0.72, ct.h + 0.2, -3.36], [-0.38, ct.h + 0.2, -3.36], [-0.38, ct.h + 0.42, -3.28], [-0.72, ct.h + 0.42, -3.28], [0, 0.2, 1], '#2c3149');
  b.box([-0.25, ct.h, -3.15], [-0.1, ct.h + 0.06, -3.02], '#2c3149');
  if (detail) {
    b.box([ct.x0 + 0.15, ct.h, -3.2], [ct.x0 + 0.65, ct.h + 0.32, -3.0], { side: '#c9cdd6', front: '#f4efe6', top: '#dfe2e8' }, 0, { bottom: true });
    ['#f26b5b', '#f2c14e', '#7cc47f', '#ff9ec4'].forEach((c, i) => panel(b, ct.x0 + 0.19 + i * 0.115, ct.h + 0.04, ct.x0 + 0.29 + i * 0.115, ct.h + 0.26, -2.995, c));
  }
  const bs = MM.backShelf;
  b.box([bs.x0, 0, wz], [bs.x1, 2.0, wz + bs.depth], { side: '#5b6487', front: '#4d5470', top: '#7f8fb5' }, 0, { bottom: true });
  for (let s = 0; s < 3; s++) {
    const y = 0.55 + s * 0.48;
    b.box([bs.x0, y, wz + bs.depth - 0.02], [bs.x1, y + 0.03, wz + bs.depth + 0.02], '#c9cdd6');
    productRows(1, detail ? 10 : 5, y + 0.03, y + 0.42, ['#f4efe6', '#7cc4ff', '#f2c14e', '#c4a3ff', '#f26b5b'], (u0, v0, u1, v1, c) =>
      panel(b, bs.x0 + 0.05 + u0 * (bs.x1 - bs.x0 - 0.1), v0, bs.x0 + 0.05 + u1 * (bs.x1 - bs.x0 - 0.1), v1, wz + bs.depth + 0.006, c),
    );
  }
  const [ccx, ccy, ccz] = MM.cctv;
  b.box([ccx - 0.07, ccy + 0.02, wz], [ccx + 0.07, ccy + 0.12, ccz + 0.04], '#e4e7ee');
  b.cylinder([ccx, ccy - 0.02, ccz], 0.17, 0.05, 10, '#f4efe6', { top: '#e4e7ee' });
  b.lathe(
    [
      [0, -0.17],
      [0.09, -0.15],
      [0.14, -0.09],
      [0.16, -0.02],
    ],
    10,
    '#2c3149',
    { center: [ccx, ccy, ccz], glow: (row) => (row === 0 ? 0.1 : 0) },
  );
  // The notice under it: a yellow plate with a camera pictogram (its words are a DOM label).
  panel(b, ccx - 0.36, 2.04, ccx + 0.36, 2.36, wz + 0.006, PALETTE.gold, 0.35);
  panel(b, ccx - 0.3, 2.08, ccx - 0.08, 2.32, wz + 0.008, '#1d2440');
  b.tri([ccx - 0.2, 2.13, wz + 0.01], [ccx - 0.1, 2.2, wz + 0.01], [ccx - 0.2, 2.27, wz + 0.01], PALETTE.gold);

  // --- Self-checkout: pedestal, screen towards the customer, bagging shelf, status light ---------------------
  const [kx, , kz] = MM.kiosk;
  b.box([kx - 0.25, 0, kz - 0.2], [kx + 0.25, 0.95, kz + 0.2], { side: '#d9dde6', front: '#eef2f7', top: '#c9cdd6' }, 0, { bottom: true });
  panel(b, kx - 0.25, 0.7, kx + 0.25, 0.78, kz + 0.204, BRAND);
  b.box([kx - 0.3, 0.95, kz - 0.12], [kx + 0.3, 1.38, kz + 0.02], { side: '#3d4766', front: '#4d5470', top: '#3d4766' });
  b.quad([kx + 0.26, 0.99, kz - 0.124], [kx - 0.26, 0.99, kz - 0.124], [kx - 0.26, 1.34, kz - 0.124], [kx + 0.26, 1.34, kz - 0.124], '#7fd6cf', 0.9);
  b.box([kx - 0.2, 0.95, kz - 0.32], [kx + 0.2, 0.99, kz - 0.18], '#2c3149');
  b.box([kx + 0.25, 0.72, kz - 0.2], [kx + 0.62, 0.76, kz + 0.2], STEEL, 0, { bottom: true });
  b.strut([kx + 0.6, 0.76, kz - 0.18], [kx + 0.6, 1.2, kz - 0.18], 0.012, 4, STEEL);
  b.strut([kx + 0.6, 0.76, kz + 0.18], [kx + 0.6, 1.2, kz + 0.18], 0.012, 4, STEEL);
  b.strut([kx - 0.22, 1.38, kz - 0.05], [kx - 0.22, 1.82, kz - 0.05], 0.02, 4, STEEL);
  b.cylinder([kx - 0.22, 1.82, kz - 0.05], 0.07, 0.1, 8, PALETTE.safe, { glow: 0.9 });

  // --- Lucky-draw booth: backdrop with a gold burst, counter with drink samples, prize pedestal, wheel stand ---
  const bo = MM.booth;
  const bz = bo.backZ;
  b.box([bo.x0, 0, bz - 0.12], [bo.x1, bo.h, bz], { side: mixHex(BRAND, PALETTE.ink, 0.25), front: BRAND, back: '#c9cdd6', top: PALETTE.gold }, 0, { bottom: true });
  disc(b, [(bo.x0 + bo.x1) / 2, 1.95, bz + 0.004], 0.62, detail ? 16 : 10, (i) => (i % 2 === 0 ? PALETTE.gold : '#ffd97a'), 0.55);
  ring(b, [(bo.x0 + bo.x1) / 2, 1.95, bz + 0.006], 0.62, 0.7, detail ? 16 : 10, '#fff6e0', 0.6);
  panel(b, bo.x0 + 0.08, 0.08, bo.x1 - 0.08, 0.16, bz + 0.004, '#fff6e0');
  if (detail) {
    const confetti = ['#fff6e0', '#7fd6cf', PALETTE.gold, '#ff9ec4'];
    for (let i = 0; i < 18; i++) {
      const x = bo.x0 + 0.2 + ((i * 0.37) % 1) * (bo.x1 - bo.x0 - 0.4);
      const y = 0.4 + ((i * 0.53) % 1) * 1.0;
      if (Math.abs(x - (bo.x0 + bo.x1) / 2) < 0.7 && y > 1.2) continue;
      b.quad([x, y, bz + 0.005], [x + 0.07, y + 0.02, bz + 0.005], [x + 0.05, y + 0.09, bz + 0.005], [x - 0.02, y + 0.07, bz + 0.005], confetti[i % 4]!, 0.3);
    }
  }
  const bc = bo.counter;
  b.box([bc.x0, 0, bc.z0], [bc.x1, 1.0, bc.z1], { side: mixHex(PALETTE.gold, PALETTE.ink, 0.25), front: PALETTE.gold, top: '#fff6e0' }, 0, { bottom: true });
  for (let i = 0; i < 4; i++) panel(b, bc.x0 + 0.1 + i * 0.4, 0.1, bc.x0 + 0.26 + i * 0.4, 0.9, bc.z1 + 0.004, BRAND);
  // Free drink samples (three cups) and a stack of entry forms; a tablet showing the form (illustration only).
  ['#f4d6a8', '#d9b0e8', '#f4d6a8'].forEach((c, i) => {
    b.cylinder([bc.x0 + 0.3 + i * 0.2, 1.0, bc.z0 + 0.28], 0.06, 0.18, 6, c, { radiusTop: 0.075, top: '#f4efe6' });
    if (detail) b.strut([bc.x0 + 0.3 + i * 0.2, 1.18, bc.z0 + 0.28], [bc.x0 + 0.33 + i * 0.2, 1.3, bc.z0 + 0.26], 0.008, 3, '#e8505b');
  });
  b.box([bc.x1 - 0.55, 1.0, bc.z0 + 0.12], [bc.x1 - 0.2, 1.06, bc.z0 + 0.38], '#f4efe6');
  b.box([bc.x0 + 0.95, 1.0, bc.z0 + 0.25], [bc.x0 + 1.1, 1.05, bc.z0 + 0.35], '#3d4766');
  facingQuad(b, [bc.x0 + 0.85, 1.05, bc.z0 + 0.32], [bc.x0 + 1.2, 1.05, bc.z0 + 0.32], [bc.x0 + 1.2, 1.3, bc.z0 + 0.2], [bc.x0 + 0.85, 1.3, bc.z0 + 0.2], [0, 0.4, 1], '#cfe8ff', 0.8);
  // Prize pedestal with the boxed tablet on a stand and a gold ribbon.
  const [px, , pz] = MM.prize;
  b.cylinder([px, 0, pz], 0.32, 0.95, 8, '#f4efe6', { top: PALETTE.gold });
  b.box([px - 0.04, 0.95, pz - 0.05], [px + 0.04, 1.12, pz + 0.05], '#3d4766');
  b.box([px - 0.26, 1.05, pz - 0.02], [px + 0.26, 1.42, pz + 0.02], { side: '#2c3149', front: '#2c3149' });
  panel(b, px - 0.23, 1.08, px + 0.23, 1.39, pz + 0.024, '#9fd8ff', 0.9);
  b.box([px - 0.33, 0.6, pz + 0.3], [px + 0.33, 0.68, pz + 0.33], PALETTE.gold);
  // Prize-wheel stand: an A-frame with a gold pointer on top (the wheel turns on it).
  const wh = MM.wheel;
  const wb = new GeoBuilder();
  wb.strut([-0.4, 0, -0.12], [0, wh.y, -0.12], 0.03, 4, '#3d4766');
  wb.strut([0.4, 0, -0.12], [0, wh.y, -0.12], 0.03, 4, '#3d4766');
  wb.box([-0.5, 0, -0.3], [0.5, 0.06, 0.1], '#3d4766');
  wb.tri([-0.09, wh.y + wh.r + 0.14, 0.08], [0.09, wh.y + wh.r + 0.14, 0.08], [0, wh.y + wh.r - 0.06, 0.08], PALETTE.gold, 0.5);
  wb.tri([0.09, wh.y + wh.r + 0.14, 0.06], [-0.09, wh.y + wh.r + 0.14, 0.06], [0, wh.y + wh.r - 0.06, 0.06], mixHex(PALETTE.gold, PALETTE.ink, 0.3));
  b.add(wb.build(), { at: wh.at, rotY: wh.yaw });
  // QR standee (a blank code pattern: nothing scannable is ever drawn).
  const st = new GeoBuilder();
  st.box([-0.32, 0, -0.15], [0.32, 0.05, 0.15], '#3d4766');
  st.box([-0.3, 0.05, -0.02], [0.3, 1.7, 0.02], { side: '#c9cdd6', front: '#fff6e0', back: '#c9cdd6' }, 0, { bottom: true });
  st.quad([-0.28, 1.4, 0.022], [0.28, 1.4, 0.022], [0.28, 1.66, 0.022], [-0.28, 1.66, 0.022], BRAND, 0.3);
  st.quad([-0.18, 0.75, 0.022], [0.18, 0.75, 0.022], [0.18, 1.11, 0.022], [-0.18, 1.11, 0.022], '#ffffff', 0.4);
  for (const [qx, qy] of [[-0.15, 0.78], [0.05, 0.78], [-0.15, 0.98], [-0.03, 0.88], [0.07, 0.98], [0.1, 0.86]] as const) {
    st.quad([qx, qy, 0.024], [qx + 0.08, qy, 0.024], [qx + 0.08, qy + 0.1, 0.024], [qx, qy + 0.1, 0.024], '#1d2440');
  }
  st.tri([-0.12, 0.4, 0.022], [0.12, 0.4, 0.022], [0, 0.58, 0.022], PALETTE.gold);
  b.add(st.build(), { at: MM.standee.at, rotY: MM.standee.yaw });

  // --- Phone-accessory shop: walls, display of cases, glass counter, SIM rack, the blank fascia lightbox ------
  const ps = MM.phoneShop;
  b.box([ps.x0 - 0.08, 0, wz], [ps.x0 + 0.08, wallH, ps.front], { side: MALL_WALL, front: '#6c5bd6', top: '#3d4a7a' }, 0, { bottom: true });
  b.box([ps.x1, 0, wz], [ps.x1 + 0.15, wallH, ps.front], { side: MALL_WALL, top: '#3d4a7a' }, 0, { bottom: true });
  b.box([ps.x0 - 0.08, 2.75, ps.front - 0.12], [ps.x1 + 0.15, 3.3, ps.front], { side: '#4b3fa8', front: '#f4f1ff', bottom: '#3d4766' }, 0.75);
  panel(b, ps.x0 - 0.08, 2.75, ps.x1 + 0.15, 2.81, ps.front + 0.004, PALETTE.digi, 0.9);
  b.box([ps.x0 + 0.2, 0.6, wz], [ps.x1 - 0.2, 2.4, wz + 0.04], { side: '#3d4766', front: '#4d5470' });
  const cases = ['#ff9ec4', '#7fd6cf', '#f2c14e', '#c4a3ff', '#f26b5b', '#f4efe6', '#7cc4ff'];
  const cols = detail ? 8 : 4;
  const rows = detail ? 4 : 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cw = (ps.x1 - ps.x0 - 0.6) / cols;
      const ch = 1.6 / rows;
      const x0 = ps.x0 + 0.3 + c * cw + cw * 0.22;
      const y0 = 0.7 + r * ch + ch * 0.12;
      panel(b, x0, y0, x0 + cw * 0.56, y0 + ch * 0.76, wz + 0.046, cases[(c + r * 3) % cases.length]!, 0.2);
    }
  }
  const pc = ps.counter;
  b.box([pc.x0, 0, pc.z0], [pc.x1, 1.0, pc.z1], { side: '#9fb8d8', front: '#cfe8ff', top: '#e9f4ff' }, 0.35, { bottom: true });
  b.box([pc.x0, 0, pc.z0], [pc.x1, 0.12, pc.z1 + 0.01], '#4d5470', 0, { bottom: true });
  if (detail) for (let i = 0; i < 6; i++) panel(b, pc.x0 + 0.15 + i * 0.27, 0.35, pc.x0 + 0.33 + i * 0.27, 0.7, pc.z1 + 0.006, cases[i]!, 0.3);
  b.box([pc.x0 + 0.2, 1.0, pc.z0 + 0.1], [pc.x0 + 0.5, 1.45, pc.z0 + 0.2], { side: '#3d4766', front: '#4d5470' });
  for (let i = 0; i < 3; i++) panel(b, pc.x0 + 0.23, 1.06 + i * 0.13, pc.x0 + 0.47, 1.15 + i * 0.13, pc.z0 + 0.204, ['#f2c14e', '#7fd6cf', '#ff9ec4'][i]!, 0.3);
  b.box([pc.x1 - 0.5, 1.0, pc.z0 + 0.15], [pc.x1 - 0.42, 1.06, pc.z0 + 0.25], '#3d4766');
  facingQuad(b, [pc.x1 - 0.56, 1.06, pc.z0 + 0.24], [pc.x1 - 0.36, 1.06, pc.z0 + 0.24], [pc.x1 - 0.36, 1.42, pc.z0 + 0.17], [pc.x1 - 0.56, 1.42, pc.z0 + 0.17], [0, 0.2, 1], '#9fd8ff', 0.85);

  // --- The mall's upper storey: walkway, rail, shop windows, columns ----------------------------------------
  const up = MM.upper;
  const wk = MM.walkway;
  b.box([f.x0, up.y0, up.z0], [f.x1, up.y1, up.z1], { side: '#d8cdbb', front: '#efe6d8', top: '#8f9ab8' }, 0, { bottom: true });
  b.box([f.x0, up.y0, up.z1], [f.x1, wk.y1, wk.z1], { side: '#efe6d8', front: '#f4efe6', top: '#d8cdbb', bottom: '#e4dccb' });
  b.box([f.x0 - 0.05, up.y1, up.z0], [f.x1 + 0.05, up.y1 + 0.22, up.z1 + 0.2], { side: BRAND_DARK, top: '#8f9ab8' });
  if (detail) for (let x = -6.6; x < 7.5; x += 2.4) b.quad([x - 0.2, up.y0 - 0.002, wk.z1 + 0.3], [x + 0.2, up.y0 - 0.002, wk.z1 + 0.3], [x + 0.2, up.y0 - 0.002, wk.z1 + 0.6], [x - 0.2, up.y0 - 0.002, wk.z1 + 0.6], '#fff6e0', 1);
  const gap0 = MM.influenceX - 0.95;
  const gap1 = MM.influenceX + 0.95;
  let wi = 0;
  for (let x = -7.3; x < 7.2; x += 1.85) {
    wi++;
    if (x + 1.5 > gap0 && x < gap1) continue;
    const lit = night ? wi % 4 !== 2 : wi % 3 === 0;
    const shopColour = ['#2bb3a3', '#f26b5b', '#8a6cf0', '#f2c14e'][wi % 4]!;
    panel(b, x, 3.95, x + 1.5, 5.6, up.z1 + 0.006, lit ? PALETTE.windowLit : night ? PALETTE.windowDark : '#bcd3ea', lit ? 0.85 : night ? 0 : 0.25);
    panel(b, x - 0.05, 5.65, x + 1.55, 5.95, up.z1 + 0.006, shopColour, 0.35);
    if (detail && lit) panel(b, x + 0.25, 3.95, x + 0.6, 4.6, up.z1 + 0.008, mixHex(shopColour, PALETTE.ink, 0.25));
  }
  // Walkway rail: posts and a softly lit glass top edge (left open in front of the influence window).
  for (const [x0, x1] of [[f.x0 + 0.1, gap0 - 0.2], [gap1 + 0.2, f.x1 - 0.1]] as const) {
    b.box([x0, wk.y1 + 0.78, wk.z1 + 0.02], [x1, wk.y1 + 0.84, wk.z1 + 0.1], '#cfe8ff', 0.6);
    b.box([x0, wk.y1, wk.z1 + 0.04], [x1, wk.y1 + 0.06, wk.z1 + 0.08], STEEL, 0, { bottom: true });
    const n = Math.max(1, Math.round((x1 - x0) / 1.25));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      b.box([x - 0.025, wk.y1, wk.z1 + 0.04], [x + 0.025, wk.y1 + 0.8, wk.z1 + 0.08], STEEL, 0, { bottom: true, top: true });
    }
  }
  for (const c of MM.columns) b.cylinder([c[0], 0, c[2]], 0.22, up.y0, detail ? 10 : 6, '#f4efe6');

  // --- Atrium: a planter with a tree and a bench -----------------------------------------------------------
  const pl = MM.planter;
  b.box([pl.x0, 0, pl.z0], [pl.x1, 0.5, pl.z1], { side: '#c9b8a2', top: '#5a4a3e' }, 0, { bottom: true });
  b.add(tree({ kind: 'round', height: 2.3, seed: 'mm-planter' }), { at: [(pl.x0 + pl.x1) / 2, 0.48, (pl.z0 + pl.z1) / 2] });
  b.add(bench({ length: MM.bench.length, back: false, color: WOOD }), { at: MM.bench.at, rotY: MM.bench.rotY });
  return b.build();
}

// ------------------------------------------------------------------------------------------------------------
// Moving parts: the sliding door leaves, the prize wheel and the balloon arch (all pure functions of time).
// ------------------------------------------------------------------------------------------------------------

/** How far the sliding door is open (0..1): open at t = 0, shutting for a few seconds every 18 s. */
export function doorOpen(time: number): number {
  const p = (((time + 6) % 18) + 18) % 18;
  if (p < 10) return 1;
  if (p < 11.2) return 1 - smoothstep(10, 11.2, p);
  if (p < 16.8) return 0;
  return smoothstep(16.8, 18, p);
}

/** One sliding glass leaf: an aluminium frame with safety-decal strips (the glass itself is left clear). */
export function doorLeaf(): BufferGeometry {
  const w = (MM.door.x1 - MM.door.x0) / 2;
  const h = MM.door.h - 0.02;
  const b = new GeoBuilder();
  const hw = w / 2;
  const frame = { side: '#c9cdd6', front: '#dfe2e8', back: '#c9cdd6' };
  b.box([-hw, 0, -0.025], [-hw + 0.06, h, 0.025], frame);
  b.box([hw - 0.06, 0, -0.025], [hw, h, 0.025], frame);
  b.box([-hw + 0.06, 0, -0.025], [hw - 0.06, 0.1, 0.025], frame);
  b.box([-hw + 0.06, h - 0.08, -0.025], [hw - 0.06, h, 0.025], frame);
  for (const y of [0.95, 1.5]) {
    b.box([-hw + 0.06, y, -0.006], [hw - 0.06, y + 0.07, 0.006], { side: '#fff6e0', front: BRAND, back: BRAND });
  }
  b.box([hw - 0.16, 0.9, 0.025], [hw - 0.12, 1.3, 0.06], STEEL);
  return b.build();
}

/** The prize wheel (in the XY plane facing +z, centred on its hub; spins about z). */
export function prizeWheel(detail = true): BufferGeometry {
  const r = MM.wheel.r;
  const segs = 12;
  const b = new GeoBuilder();
  const colours = [BRAND, PALETTE.gold, '#2bb3a3', '#fff6e0', '#8a6cf0', PALETTE.gold];
  disc(b, [0, 0, 0.032], r, segs, (i) => colours[i % colours.length]!, 0.3);
  ring(b, [0, 0, 0.034], r, r + 0.06, segs, '#fff6e0', 0.45);
  disc(b, [0, 0, 0.036], 0.08, 8, '#3d4766');
  if (detail) {
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const x = Math.cos(a) * (r + 0.03);
      const y = Math.sin(a) * (r + 0.03);
      b.quad([x - 0.018, y - 0.018, 0.04], [x + 0.018, y - 0.018, 0.04], [x + 0.018, y + 0.018, 0.04], [x - 0.018, y + 0.018, 0.04], PALETTE.gold, 0.8);
    }
  }
  const back = new CylinderGeometry(r + 0.06, r + 0.06, 0.06, segs);
  b.addPainted(back, '#4d5470', { rotation: [Math.PI / 2, 0, 0] });
  return b.build();
}

/** A balloon on a short string (near-white so the instance colour tints it), origin at its centre. */
export function balloon(): BufferGeometry {
  const b = new GeoBuilder();
  b.lathe(
    [
      [0, -0.2],
      [0.11, -0.15],
      [0.16, -0.03],
      [0.15, 0.09],
      [0.09, 0.18],
      [0, 0.21],
    ],
    6,
    (_row, seg) => (seg % 2 === 0 ? '#ffffff' : '#ece8f2'),
    { glow: 0.15 },
  );
  b.tri([-0.03, -0.25, 0], [0.03, -0.25, 0], [0, -0.19, 0], '#e6e2ec');
  b.strut([0, -0.25, 0], [0.02, -0.5, 0.01], 0.006, 3, '#d9d4e6');
  return b.build();
}

const BALLOON_COLOURS = [BRAND, PALETTE.gold, '#ffffff', '#2bb3a3', '#ff9ec4'];

const leafLayout: InstanceLayout = (i, time, o: Object3D) => {
  const d = MM.door;
  const w = (d.x1 - d.x0) / 2;
  const open = doorOpen(time);
  const x = i === 0 ? d.x0 + w / 2 - open * w * 0.98 : d.x1 - w / 2 + open * w * 0.98;
  o.position.set(x, 0.01, MM.shop.front + 0.06 + (i === 0 ? 0 : 0.06));
};

const wheelLayout: InstanceLayout = (_i, time, o: Object3D) => {
  const w = MM.wheel;
  o.position.set(w.at[0] + Math.sin(w.yaw) * 0.05, w.y, w.at[2] + Math.cos(w.yaw) * 0.05);
  o.rotation.y = w.yaw;
  o.rotation.z = -time * 0.55;
};

const balloonLayout: InstanceLayout = (i, time, o: Object3D) => {
  const p = MM_BALLOONS[i]!;
  o.position.set(p[0] + Math.sin(time * 0.5 + i * 2.1) * 0.025, p[1] + Math.sin(time * 1.1 + i * 1.3) * 0.04, p[2]);
  o.rotation.z = Math.sin(time * 0.7 + i) * 0.08;
  o.scale.setScalar(0.92 + ((i * 7) % 3) * 0.06);
};

/** The moving meshes (geometry and instance count), for budget checks. */
export function minimartMoving(): { geometry: BufferGeometry; count: number }[] {
  return [
    { geometry: doorLeaf(), count: 2 },
    { geometry: prizeWheel(), count: 1 },
    { geometry: balloon(), count: MM_BALLOONS.length },
  ];
}

export default function MinimartSet({ quality, frozen, t, timeOfDay }: SetPieceProps) {
  const night = timeOfDay === 'evening' || timeOfDay === 'night';
  const geometry = useKitGeometry(() => buildMinimart({ tier: quality, night }), [quality, night]);
  const leaf = useKitGeometry(() => doorLeaf(), []);
  const wheel = useKitGeometry(() => prizeWheel(quality !== 'low'), [quality]);
  const balloons = useKitGeometry(() => balloon(), []);
  const { time, running } = useAmbient(t, frozen);
  return (
    <group>
      <KitMesh geometry={geometry} />
      <AnimatedInstances geometry={leaf} count={2} layout={leafLayout} t={time} running={running} />
      <AnimatedInstances geometry={wheel} count={1} layout={wheelLayout} t={time} running={running} />
      <AnimatedInstances geometry={balloons} count={MM_BALLOONS.length} layout={balloonLayout} t={time} running={running} colors={BALLOON_COLOURS} />
    </group>
  );
}
