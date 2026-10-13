// S5 Neon Void Deck and Phone Kiosk (GAME_DESIGN.md §4.1): the open ground floor of an HDB-style slab block, cut
// away so the camera sees in. Fluorescent tubes under the overhang, a letterbox wall, a stone table, the lift
// lobby and a neon phone-accessory kiosk. All static props are ONE merged geometry; the flickering tube and the
// neon trim are one small second mesh. Lazy-loaded (3D chunk): the set's data and Flat View twin live in
// sets/void-deck.tsx and core/layout/void-deck.ts.
import type { BufferGeometry } from 'three';
import {
  GeoBuilder,
  KitMesh,
  PALETTE,
  bakeAO,
  bench,
  hdbBlock,
  kiosk,
  lampPost,
  mixHex,
  signboard,
  tableSet,
  tree,
  useKitGeometry,
} from '../../../kit';
import type { QualityTier } from '../../../quality';
import type { SetPieceProps } from '../../sets/types';
import { VD } from '../layout/void-deck';
import { pooled, tiledFloor, type LightPool } from './common';

const WALL = '#e6dfd0';
const DADO = '#7fa4a8';
const SECTION = '#3d3a66';
const FLOOR = '#b3adc2';
const TUBE = '#eef6ff';
const NEON = '#c4a8ff';
const NEON_PINK = '#ff7ab0';
const TUBES_X = [-4.6, -1.5, 1.6, 4.5];
const TUBE_Z = -2.55;
const FLICKER_TUBE = 2;

export interface VoidDeckOptions {
  tier: QualityTier;
  night: boolean;
}

function pools(night: boolean): LightPool[] {
  const s = night ? 1 : 0.35;
  return [
    ...TUBES_X.map((x): LightPool => ({ at: [x, TUBE_Z + 0.4], radius: 3.2, color: '#f2f7ff', strength: 0.32 * s })),
    { at: [VD.kiosk.at[0] - 0.6, VD.kiosk.at[2] + 0.9], radius: 3.6, color: '#a58cff', strength: 0.42 * s },
    // The lamp is turned to face the deck, so its head (and pool) sits about a metre behind the post.
    { at: [VD.lamp[0], VD.lamp[2] - 0.95], radius: 3.4, color: '#ffd58a', strength: 0.4 * s },
  ];
}

/** Every static prop of the void deck as one kit geometry. Pure (testable in Node). */
export function buildVoidDeck({ tier, night }: VoidDeckOptions): BufferGeometry {
  const { deck } = VD;
  const light = pools(night);
  const detail = tier !== 'low';
  const b = new GeoBuilder();

  // --- Ground outside the shelter: grass, a paved path and the kerb drop ----------------------------------
  tiledFloor(b, -10, 10, deck.z1, 7.4, -0.14, 1.25, (x, z) =>
    pooled(z < 4.3 && z > 2.9 ? '#7d7a96' : '#4d8a6e', x, z, light),
  );
  b.box([deck.x0 - 3.4, -0.6, deck.z1], [deck.x1 + 3.4, -0.14, 7.4], { side: '#3f5d55', top: '#4d8a6e' }, 0, { top: true });
  // Drain along the deck edge.
  b.quad([deck.x0, -0.13, deck.z1 + 0.32], [deck.x1, -0.13, deck.z1 + 0.32], [deck.x1, -0.13, deck.z1 + 0.06], [deck.x0, -0.13, deck.z1 + 0.06], '#2c3149');

  // --- Deck slab and tiled floor (light pools baked in) ----------------------------------------------------
  b.box([deck.x0, -0.6, deck.z0], [deck.x1, 0, deck.z1], { side: mixHex(FLOOR, PALETTE.ink, 0.3), top: FLOOR }, 0, { top: true });
  tiledFloor(b, deck.x0, deck.x1, deck.z0, deck.z1, 0, 0.6, (x, z, i, j) => {
    const lobby = x < VD.lift.x1 && z < VD.lift.z1 + 0.6;
    const base = lobby ? '#8f8aa6' : (i + j) % 2 === 0 ? FLOOR : mixHex(FLOOR, PALETTE.ink, 0.06);
    return pooled(base, x, z, light);
  });

  // --- Back wall (dado tiles below, painted above) and the cut overhang with fluorescent tubes --------------
  const wz = VD.wallZ;
  b.box([deck.x0, 0, wz - 0.25], [deck.x1, 1.1, wz], { side: SECTION, front: DADO, top: mixHex(DADO, '#ffffff', 0.2) });
  b.box([deck.x0, 1.1, wz - 0.25], [deck.x1, VD.wallH, wz], { side: SECTION, front: WALL, top: SECTION });
  if (detail) for (let x = deck.x0 + 0.4; x < deck.x1; x += 0.4) b.quad([x, 0.02, wz + 0.005], [x + 0.02, 0.02, wz + 0.005], [x + 0.02, 1.08, wz + 0.005], [x, 1.08, wz + 0.005], mixHex(DADO, PALETTE.ink, 0.15));
  b.box([deck.x0, VD.wallH, wz], [deck.x1, VD.wallH + 0.32, -1.6], { bottom: '#d9d3e3', side: SECTION, front: SECTION, top: '#8f8aa6' });
  TUBES_X.forEach((x, i) => {
    if (i === FLICKER_TUBE) return;
    b.box([x - 0.62, VD.wallH - 0.08, TUBE_Z - 0.05], [x + 0.62, VD.wallH - 0.02, TUBE_Z + 0.05], TUBE, night ? 1 : 0.5);
  });
  // Fixture for the flickering tube (the tube itself is in the animated mesh).
  const fx = TUBES_X[FLICKER_TUBE]!;
  b.box([fx - 0.66, VD.wallH - 0.03, TUBE_Z - 0.07], [fx + 0.66, VD.wallH, TUBE_Z + 0.07], '#c9c3d6');

  // --- Lift lobby: alcove walls, lift doors, floor indicator and call button --------------------------------
  const lift = VD.lift;
  b.box([lift.x0 - 0.2, 0, wz], [lift.x0, VD.wallH, lift.z1], { side: WALL, top: SECTION, front: SECTION });
  b.box([lift.x1, 0, wz], [lift.x1 + 0.25, VD.wallH, lift.z1], { side: WALL, top: SECTION, front: SECTION, left: mixHex(WALL, PALETTE.ink, 0.08) });
  const doorX = (lift.x0 + lift.x1) / 2;
  b.box([doorX - 0.75, 0, wz], [doorX + 0.75, 2.35, wz + 0.06], '#8d879f');
  b.box([doorX - 0.6, 0, wz + 0.06], [doorX - 0.01, 2.15, wz + 0.09], { side: '#aeb7c9', front: '#c3cad8' });
  b.box([doorX + 0.01, 0, wz + 0.06], [doorX + 0.6, 2.15, wz + 0.09], { side: '#aeb7c9', front: '#b7bfce' });
  b.box([doorX - 0.18, 2.42, wz + 0.02], [doorX + 0.18, 2.62, wz + 0.08], '#ffb35c', 1);
  b.box([doorX + 0.85, 1.05, wz + 0.02], [doorX + 0.97, 1.3, wz + 0.07], '#ffd58a', 0.9);
  if (detail) {
    // Two potted plants either side of the lobby.
    for (const x of [lift.x0 + 0.25, lift.x1 - 0.3]) {
      b.cylinder([x, 0, lift.z1 + 0.3], 0.22, 0.42, 7, '#b0674c', { radiusTop: 0.26 });
      b.add(tree({ kind: 'round', height: 1.1, seed: `pot${x}` }), { at: [x, 0.3, lift.z1 + 0.3] });
    }
  }

  // --- Letterbox wall: a grid of little doors with slots -----------------------------------------------------
  const lb = VD.letterboxes;
  b.box([lb.x0 - 0.06, lb.y0 - 0.06, wz], [lb.x1 + 0.06, lb.y1 + 0.06, wz + 0.32], { side: '#7c7a92', front: '#8f8ca6', top: '#a9a6bd' });
  const cols = 6;
  const rows = detail ? 5 : 3;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x0 = lb.x0 + ((lb.x1 - lb.x0) * c) / cols + 0.03;
      const x1 = lb.x0 + ((lb.x1 - lb.x0) * (c + 1)) / cols - 0.03;
      const y0 = lb.y0 + ((lb.y1 - lb.y0) * r) / rows + 0.03;
      const y1 = lb.y0 + ((lb.y1 - lb.y0) * (r + 1)) / rows - 0.03;
      const z = wz + 0.325;
      const tint = (c * 7 + r * 3) % 5 === 0 ? '#cfd6e4' : '#bfc6d6';
      b.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], tint);
      b.quad([x0 + 0.05, y1 - 0.09, z + 0.002], [x1 - 0.05, y1 - 0.09, z + 0.002], [x1 - 0.05, y1 - 0.06, z + 0.002], [x0 + 0.05, y1 - 0.06, z + 0.002], '#2c3149');
    }
  }

  // --- Notice board with blank posters (their words live in the DOM clue text) -----------------------------
  const nb = VD.notice;
  b.add(signboard({ width: nb.w, height: nb.h, posts: false, elevation: nb.y0, panel: '#c9b48f', frame: '#5c6680' }), { at: [nb.x, 0, wz + 0.06] });
  const posters: [number, number, number, number, string][] = [
    [-0.72, 0.08, -0.12, 0.92, '#2bb3a3'],
    [-0.04, 0.5, 0.36, 0.95, '#f4efe6'],
    [-0.04, 0.1, 0.36, 0.44, '#f2c14e'],
    [0.42, 0.12, 0.74, 0.86, '#f4efe6'],
  ];
  for (const [x0, y0, x1, y1, color] of posters) {
    const z = wz + 0.115;
    b.quad([nb.x + x0, nb.y0 + y0, z], [nb.x + x1, nb.y0 + y0, z], [nb.x + x1, nb.y0 + y1, z], [nb.x + x0, nb.y0 + y1, z], color);
  }
  // The community poster's QR square (a sticker can hide over it).
  b.quad([nb.x - 0.62, nb.y0 + 0.16, wz + 0.118], [nb.x - 0.36, nb.y0 + 0.16, wz + 0.118], [nb.x - 0.36, nb.y0 + 0.42, wz + 0.118], [nb.x - 0.62, nb.y0 + 0.42, wz + 0.118], '#f4efe6');
  b.quad([nb.x - 0.58, nb.y0 + 0.2, wz + 0.12], [nb.x - 0.4, nb.y0 + 0.2, wz + 0.12], [nb.x - 0.4, nb.y0 + 0.38, wz + 0.12], [nb.x - 0.58, nb.y0 + 0.38, wz + 0.12], PALETTE.ink);

  // --- Seating: the stone table with four stools, two benches -----------------------------------------------
  b.add(tableSet({ round: true, stools: 4, radius: 0.6 }), { at: VD.table });
  b.add(bench({ length: VD.bench.length, color: '#c98b5a' }), { at: VD.bench.at, rotY: VD.bench.rotY });
  b.add(bench({ length: VD.backBench.length, color: '#9c6b8a', back: false }), { at: VD.backBench.at, rotY: VD.backBench.rotY });

  // --- Front pillars, cut at the overhang height (section tops), with the block number plate ---------------
  for (const [x, , z] of VD.pillars) {
    b.box([x - 0.3, 0, z - 0.3], [x + 0.3, 0.45, z + 0.3], '#8d879f');
    b.box([x - 0.28, 0.45, z - 0.28], [x + 0.28, VD.wallH + 0.32, z + 0.28], { side: WALL, top: SECTION });
  }
  const [px, , pz] = VD.pillars[1]!;
  b.box([px - 0.24, 2.38, pz + 0.28], [px + 0.24, 2.72, pz + 0.31], '#2a2f6b');
  b.add(bakeAO(new GeoBuilder().cylinder([px + 0.65, 0, pz + 0.1], 0.24, 0.85, 8, '#2bb3a3', { top: '#1d2440' }).build(), { ground: 0.75 }));

  // --- The neon phone-accessory kiosk with cases on its back wall ----------------------------------------
  const k = VD.kiosk;
  const kb = new GeoBuilder();
  kb.add(kiosk({ width: k.width, depth: k.depth, color: '#5a3fb8', awning: ['#f4efe6', '#8a6cf0'], lit: true }));
  if (detail) {
    const caseColors = ['#ff7ab0', '#2bb3a3', '#f2c14e', '#7cc4ff', '#f4efe6', '#ff4d8d'];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 6; c++) {
        const x = -k.width / 2 + 0.3 + c * ((k.width - 0.6) / 5);
        const y = 1.25 + r * 0.33;
        kb.box([x - 0.08, y, -k.depth / 2 + 0.15], [x + 0.08, y + 0.26, -k.depth / 2 + 0.2], caseColors[(r * 2 + c) % caseColors.length]!, 0.35);
      }
    }
    // Glass counter top with phones on it.
    for (const x of [-0.6, -0.1, 0.4]) kb.box([x - 0.1, 1.0, k.depth / 2 - 0.35], [x + 0.1, 1.02, k.depth / 2 - 0.15], '#1d2440');
  }
  b.add(kb.build(), { at: k.at, rotY: k.rotY });

  // --- Outside: street lamp, trees, the slab block above ----------------------------------------------------
  b.add(lampPost({ height: 4.6, lit: night }), { at: VD.lamp, rotY: Math.PI });
  b.add(tree({ kind: 'round', height: 4.6, seed: 'vd-angsana' }), { at: [VD.tree[0], -0.14, VD.tree[2]] });
  if (detail) b.add(tree({ kind: 'cone', height: 5.2, seed: 'vd-casuarina' }), { at: [8.2, -0.14, 5.9] });
  b.add(
    hdbBlock({
      floors: VD.block.floors,
      width: VD.block.width,
      depth: VD.block.depth,
      voidDeck: false,
      litWindows: night ? 0.42 : 0.12,
      body: '#d8d2e6',
      accent: '#8a6cf0',
      seed: 'blk23',
      ao: false,
    }),
    { at: VD.block.at },
  );
  return b.build();
}

/** The flickering tube and the kiosk's neon trim (glow strips that resist the Freeze). */
function buildNeon(): BufferGeometry {
  const b = new GeoBuilder();
  const fx = TUBES_X[FLICKER_TUBE]!;
  b.box([fx - 0.62, VD.wallH - 0.08, TUBE_Z - 0.05], [fx + 0.62, VD.wallH - 0.02, TUBE_Z + 0.05], TUBE, 1);
  return b.build();
}

function buildKioskNeon(): BufferGeometry {
  const k = VD.kiosk;
  const b = new GeoBuilder();
  const hw = k.width / 2;
  const front = k.depth / 2 + 0.005;
  // Neon outline along the counter front and up the sign band edges.
  b.box([-hw + 0.05, 0.92, front], [hw - 0.05, 0.97, front + 0.04], NEON, 1);
  b.box([-hw + 0.05, 0.08, front], [-hw + 0.1, 0.92, front + 0.04], NEON_PINK, 1);
  b.box([hw - 0.1, 0.08, front], [hw - 0.05, 0.92, front + 0.04], NEON_PINK, 1);
  b.box([-hw, 3.08, -k.depth / 2 + 0.3], [hw, 3.13, -k.depth / 2 + 0.34], NEON_PINK, 1);
  // A neon phone outline on the sign band.
  b.box([-0.12, 2.68, -k.depth / 2 + 0.31], [0.12, 2.72, -k.depth / 2 + 0.34], NEON, 1);
  b.box([-0.12, 2.98, -k.depth / 2 + 0.31], [0.12, 3.02, -k.depth / 2 + 0.34], NEON, 1);
  b.box([-0.14, 2.68, -k.depth / 2 + 0.31], [-0.1, 3.02, -k.depth / 2 + 0.34], NEON, 1);
  b.box([0.1, 2.68, -k.depth / 2 + 0.31], [0.14, 3.02, -k.depth / 2 + 0.34], NEON, 1);
  return b.build();
}

/** Tube flicker as a pure function of mission time (a stutter every ~7 s). */
export function tubeOn(t: number): boolean {
  const phase = (t * 0.83 + 0.4) % 7;
  return !(phase < 0.35 && Math.floor(phase * 22) % 2 === 0);
}

export default function VoidDeckSet({ quality, frozen, t, timeOfDay }: SetPieceProps) {
  const night = timeOfDay === 'evening' || timeOfDay === 'night';
  const geometry = useKitGeometry(() => buildVoidDeck({ tier: quality, night }), [quality, night]);
  const tube = useKitGeometry(buildNeon, []);
  const neon = useKitGeometry(buildKioskNeon, []);
  // Frozen: the stutter holds wherever it was (t stops); the neon never flickers off while held.
  const lit = frozen || tubeOn(t);
  return (
    <group>
      <KitMesh geometry={geometry} />
      <KitMesh geometry={tube} visible={night && lit} castShadow={false} receiveShadow={false} />
      <KitMesh geometry={neon} position={VD.kiosk.at} rotation={[0, VD.kiosk.rotY, 0]} castShadow={false} receiveShadow={false} />
    </group>
  );
}
