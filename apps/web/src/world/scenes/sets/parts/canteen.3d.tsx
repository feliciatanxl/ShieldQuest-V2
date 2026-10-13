// S2 Canteen and Locker Corridor (GAME_DESIGN.md §4.1): a school canteen cut away so the camera sees in. Two
// stalls with a blank menu board, long tables with attached benches, the notice board under a wall clock, a
// corridor of lockers running to the stairwell, and a courtyard bench outside. All static props are ONE merged
// geometry; the two oscillating wall fans and the clock's second hand are three small instanced meshes.
// Lazy-loaded (3D chunk): the set data and Flat View twin live in sets/canteen.tsx and parts/canteen.layout.ts.
import type { BufferGeometry, Object3D } from 'three';
import { GeoBuilder, KitMesh, PALETTE, bench, mixHex, signboard, tree, useKitGeometry } from '../../../kit';
import type { QualityTier } from '../../../quality';
import { pooled, tiledFloor, type LightPool } from '../../core/sets3d/common';
import type { SetPieceProps } from '../types';
import { AnimatedInstances, useAmbient, type InstanceLayout } from './anim';
import { CT } from './canteen.layout';
import { canteenTable, clockHand, decal, fanBlades, fanHead, panel, star, wallClock } from './props';

const TERRAZZO = '#ddd3c2';
const CORRIDOR = '#b9c6c1';
const WALL = '#ede5d5';
const DADO = '#7fb3aa';
const FASCIA = '#2b8f86';
const GRASS = '#5d9a7a';
const PAVING = '#c9c3b3';
const LOCKER = ['#4f7fc2', '#5b8bd0', '#4a76b6'];

export interface CanteenOptions {
  tier: QualityTier;
  night: boolean;
}

function pools(night: boolean): LightPool[] {
  const s = night ? 1 : 0.45;
  return [
    ...CT.stalls.map((st): LightPool => ({ at: [(st.x0 + st.x1) / 2, CT.counterZ + 0.9], radius: 2.6, color: '#ffe3a8', strength: 0.3 * s })),
    { at: [3.4, -3.0], radius: 2.4, color: '#f2f7ff', strength: 0.3 * s },
    { at: [6.0, -3.0], radius: 2.4, color: '#f2f7ff', strength: 0.3 * s },
    // Daylight spilling in from the open courtyard side.
    { at: [1.0, 2.8], radius: 4.5, color: '#fff4dc', strength: night ? 0 : 0.18 },
  ];
}

/** The freestanding menu board: an easel-backed lightbox with blank menu lines (the word "Menu" is a DOM label). */
function buildMenuStand(detail: boolean): BufferGeometry {
  const m = CT.menu;
  const b = new GeoBuilder();
  const hw = m.w / 2;
  const frame = '#2c3149';
  b.box([-hw - 0.04, m.y0 - 0.04, -0.03], [hw + 0.04, m.y1 + 0.04, 0.03], frame);
  panel(b, -hw, m.y0, hw, m.y1, 0.032, '#fdf6e3', 0.6);
  panel(b, -hw + 0.08, m.y1 - 0.2, hw - 0.08, m.y1 - 0.08, 0.034, '#2bb3a3', 0.6);
  if (detail) {
    for (let i = 0; i < 4; i++) {
      const y = m.y0 + 0.12 + i * 0.13;
      panel(b, -hw + 0.08, y, 0.05 - (i % 2) * 0.12, y + 0.04, 0.034, '#c9c0aa', 0.4);
      panel(b, hw - 0.22, y, hw - 0.08, y + 0.04, 0.034, '#f26b5b', 0.4);
    }
  }
  b.strut([-hw + 0.06, 0, 0.0], [-hw + 0.06, m.y0, 0], 0.025, 4, frame);
  b.strut([hw - 0.06, 0, 0.0], [hw - 0.06, m.y0, 0], 0.025, 4, frame);
  b.strut([0, m.y1 - 0.1, -0.03], [0, 0, -0.42], 0.025, 4, frame);
  return b.build();
}

/** Every static prop of the canteen as one kit geometry. Pure (testable in Node). */
export function buildCanteen({ tier, night }: CanteenOptions): BufferGeometry {
  const { floor: f, wallZ: wz, wallH, splitX, corridorZ } = CT;
  const light = pools(night);
  const detail = tier !== 'low';
  const b = new GeoBuilder();

  // --- Slab and floors: terrazzo canteen, corridor tiles, courtyard grass with a paved path -----------------
  b.box([f.x0, -0.5, f.z0], [f.x1, 0, f.z1], { side: mixHex(TERRAZZO, PALETTE.ink, 0.4), top: TERRAZZO }, 0, { top: true });
  tiledFloor(b, f.x0, splitX, f.z0, f.z1, 0, 0.8, (x, z, i, j) => pooled((i + j) % 2 === 0 ? TERRAZZO : mixHex(TERRAZZO, PALETTE.ink, 0.06), x, z, light));
  tiledFloor(b, splitX, f.x1, f.z0, corridorZ, 0, 0.6, (x, z, i, j) => pooled((i + j) % 2 === 0 ? CORRIDOR : mixHex(CORRIDOR, '#ffffff', 0.12), x, z, light));
  tiledFloor(b, splitX, f.x1, corridorZ, f.z1, -0.04, 0.9, (x, z) => pooled(x > 2.3 && x < 3.5 ? PAVING : GRASS, x, z, light));
  b.box([splitX, -0.04, corridorZ - 0.02], [f.x1, 0.06, corridorZ + 0.14], { side: '#a7a3b4', top: '#c9c5d4' }, 0, { bottom: true });

  // --- Back wall: dado tiles, paint, high corridor windows, the stairwell door ------------------------------
  b.box([f.x0, 0, wz - 0.25], [f.x1, wallH, wz], { side: '#3d4a7a', front: WALL, top: '#3d4a7a' }, 0, { bottom: true });
  panel(b, -1.5, 0, f.x1, 0.95, wz + 0.004, DADO);
  if (detail) for (let x = -1.2; x < f.x1; x += 0.3) panel(b, x, 0.02, x + 0.015, 0.93, wz + 0.006, mixHex(DADO, PALETTE.ink, 0.15));
  for (let x = 2.3; x < 7.0; x += 1.2) panel(b, x, 2.25, x + 1.05, 2.95, wz + 0.006, night ? '#3a4a78' : '#cfe4f5', night ? 0.25 : 0.55);
  const sd = CT.stairDoor;
  panel(b, sd.x0, 0, sd.x1, sd.h, wz + 0.006, '#2c3149');
  panel(b, sd.x0 + 0.12, sd.h + 0.08, sd.x1 - 0.12, sd.h + 0.3, wz + 0.008, '#3ccf7a', 1);

  // --- Cut overhang along the back with its tube lights; the corner pillar and its beam --------------------
  const oh = CT.overhang;
  b.box([f.x0, oh.y0, wz], [f.x1, oh.y1, oh.z1], { side: FASCIA, top: '#8f9ab8', bottom: '#e6e0d4' });
  for (const x of [-5.75, -2.9, 3.4, 6.0]) b.box([x - 0.6, oh.y0 - 0.06, oh.z1 - 0.3], [x + 0.6, oh.y0, oh.z1 - 0.2], '#f2f7ff', night ? 1 : 0.6);
  b.box([CT.pillar[0] - 0.2, 0, CT.pillar[2] - 0.2], [CT.pillar[0] + 0.2, oh.y1, CT.pillar[2] + 0.2], { side: WALL, top: FASCIA }, 0, { bottom: true });
  b.box([CT.pillar[0] - 0.12, oh.y0, oh.z1], [CT.pillar[0] + 0.12, oh.y1, CT.pillar[2] - 0.2], { side: FASCIA, bottom: '#e6e0d4' }, 0, { top: true });
  b.box([CT.pillar[0] - 0.22, 0, CT.pillar[2] - 0.22], [CT.pillar[0] + 0.22, 0.4, CT.pillar[2] + 0.22], DADO, 0, { bottom: true });

  // --- The storey above: classrooms with a window band (the influence window is added by MissionScene) -----
  const up = CT.upper;
  b.box([f.x0, up.y0, up.z0], [f.x1, up.y1, up.z1], { side: '#cfc6b4', front: '#e9e2d0', top: '#8f9ab8' }, 0, { bottom: true });
  b.box([f.x0 - 0.05, up.y1, up.z0], [f.x1 + 0.05, up.y1 + 0.22, up.z1 + 0.2], { side: FASCIA, top: '#24766f' });
  panel(b, f.x0, up.y0, f.x1, up.y0 + 0.22, up.z1 + 0.004, FASCIA);
  if (detail) for (const x of [-3.95, 0.55, 5.05]) b.box([x - 0.1, up.y0 + 0.22, up.z1], [x + 0.1, up.y1, up.z1 + 0.32], { side: FASCIA, top: '#24766f' }, 0, { bottom: true });
  let w = 0;
  for (let x = -6.8; x < 7.6; x += 1.5) {
    w++;
    if (x > 4.5 && x < 6.3) continue;
    const lit = night ? w % 3 !== 1 : false;
    panel(b, x, 4.35, x + 1.05, 5.4, up.z1 + 0.006, lit ? PALETTE.windowLit : night ? PALETTE.windowDark : '#a9c6e8', lit ? 1 : night ? 0 : 0.2);
    if (detail) panel(b, x + 0.51, 4.35, x + 0.54, 5.4, up.z1 + 0.008, '#e9e2d0');
    // Sunshade over each window and a sill below it.
    b.box([x - 0.1, 5.5, up.z1], [x + 1.15, 5.56, up.z1 + 0.4], { side: '#cfc6b4', top: '#b9b0a0', bottom: '#d8d0bf' });
    if (detail) b.box([x - 0.04, 4.27, up.z1], [x + 1.09, 4.33, up.z1 + 0.08], '#d8d0bf');
  }

  // --- Stalls: partitions, tiled backs, counters, lightbox signs --------------------------------------------
  const cz = CT.counterZ;
  for (const st of CT.stalls) {
    const dark = mixHex(st.color, PALETTE.ink, 0.35);
    panel(b, st.x0, 0, st.x1, 2.3, wz + 0.004, '#f3f0ea');
    panel(b, st.x0, 1.32, st.x1, 1.42, wz + 0.006, st.color);
    b.box([st.x0 - 0.08, 0, wz], [st.x0 + 0.02, 2.35, cz], { side: dark, top: dark }, 0, { bottom: true });
    b.box([st.x1 - 0.02, 0, wz], [st.x1 + 0.08, 2.35, cz], { side: dark, top: dark }, 0, { bottom: true });
    b.box([st.x0 + 0.02, 0, cz - 0.45], [st.x1 - 0.02, 1.0, cz], { side: dark, front: st.color, top: '#c9cdd6' }, 0, { bottom: true });
    if (detail) panel(b, st.x0 + 0.1, 0.12, st.x1 - 0.1, 0.2, cz + 0.004, mixHex(st.color, '#ffffff', 0.35));
    b.add(signboard({ width: st.x1 - st.x0 - 0.06, height: 0.5, posts: false, elevation: 2.37, panel: '#fff6e0', frame: dark, lit: true }), { at: [(st.x0 + st.x1) / 2, 0, cz] });
  }
  // Noodle stall: glass display on the counter, a stock pot and a photo menu.
  const [noodle, drinks] = CT.stalls;
  b.box([noodle.x0 + 0.25, 1.0, cz - 0.4], [noodle.x1 - 0.25, 1.3, cz - 0.08], { side: '#d8ecf2', top: '#eaf6fa' }, 0.3, { bottom: true });
  b.box([noodle.x0 + 0.1, 0, wz], [noodle.x1 - 0.1, 0.9, wz + 0.5], { side: '#c9cdd6', top: '#dfe2e8' }, 0, { bottom: true });
  b.cylinder([noodle.x0 + 0.7, 0.9, wz + 0.25], 0.24, 0.34, 8, '#a9afbd', { top: '#c2652c' });
  if (detail) {
    const photos = ['#f2c14e', '#e0855a', '#f4efe6', '#c2652c', '#7cc47f', '#f2c14e'];
    photos.forEach((c, i) => {
      const x = noodle.x0 + 0.35 + (i % 3) * 0.62;
      const y = 1.6 + Math.floor(i / 3) * 0.36;
      panel(b, x, y, x + 0.5, y + 0.3, wz + 0.008, c, 0.15);
    });
  }
  // Drinks stall: a price strip and cup shelf on the back, the freestanding menu board at its corner.
  panel(b, drinks.x0 + 0.2, 1.6, drinks.x1 - 1.0, 2.15, wz + 0.006, '#fdf6e3', 0.4);
  for (let i = 0; i < 3; i++) panel(b, drinks.x0 + 0.32, 1.7 + i * 0.14, drinks.x0 + 1.2 - (i % 2) * 0.25, 1.74 + i * 0.14, wz + 0.008, '#c9c0aa', 0.3);
  b.box([drinks.x0 + 0.15, 1.15, wz], [drinks.x1 - 0.95, 1.2, wz + 0.25], '#c9cdd6', 0, { bottom: true });
  if (detail) for (let i = 0; i < 6; i++) b.cylinder([drinks.x0 + 0.3 + i * 0.26, 1.2, wz + 0.12], 0.06, 0.14, 6, '#f4efe6', { top: '#e3ddd0' });
  b.add(buildMenuStand(detail), { at: CT.menu.at, rotY: CT.menu.rotY });
  const fr = CT.fridge;
  b.box([fr.x0, 0, wz], [fr.x1, 1.9, wz + 0.55], { side: '#d9dde6', front: '#e8ebf1', top: '#c9cdd6' }, 0, { bottom: true });
  panel(b, fr.x0 + 0.06, 0.15, fr.x1 - 0.06, 1.8, wz + 0.555, '#d6f0ff', 0.7);
  if (detail) {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const x = fr.x0 + 0.1 + c * 0.13;
        const y = 0.3 + r * 0.38;
        panel(b, x, y, x + 0.08, y + 0.22, wz + 0.56, ['#f26b5b', '#f2c14e', '#2bb3a3', '#ff7ab0'][(r + c) % 4]!, 0.5);
      }
    }
  }
  ['#f59e42', '#f27aa0', '#7cc47f'].forEach((c, i) => {
    const x = drinks.x0 + 0.45 + i * 0.4;
    b.cylinder([x, 1.0, cz - 0.24], 0.13, 0.4, 7, c, { top: '#c9cdd6', glow: 0.35 });
  });

  // --- Tables with attached benches; a few trays and cups ---------------------------------------------------
  CT.tables.forEach((at, i) => {
    b.add(canteenTable({ length: CT.tableLength, seat: i % 2 === 0 ? '#2b9c8f' : '#4f7fc2' }), { at });
  });
  if (detail) {
    for (const [x, z, c] of [[-5.9, -0.45, '#f26b5b'], [-2.2, 1.95, '#f2c14e'], [-5.2, 1.85, '#7cc4ff']] as const) {
      b.box([x - 0.22, 0.76, z - 0.15], [x + 0.22, 0.79, z + 0.15], c, 0, { bottom: true });
      b.cylinder([x + 0.08, 0.79, z], 0.05, 0.12, 6, '#f4efe6');
    }
  }
  b.cylinder([-1.1, 0, wz + 0.4], 0.22, 0.72, 8, '#2b8f86', { top: '#1d2440' });

  // --- Notice board (blank posters; the showcase poster carries a star) and the wall clock -----------------
  const nb = CT.notice;
  b.add(signboard({ width: nb.w, height: nb.h, posts: false, elevation: nb.y0, panel: '#c9a46b', frame: '#3d4766' }), { at: [nb.x, 0, wz + 0.06] });
  const pz = wz + 0.112;
  const posters: [number, number, number, number, string][] = [
    [-0.72, 0.1, -0.2, 0.9, '#2bb3a3'],
    [-0.12, 0.5, 0.3, 0.95, '#f4efe6'],
    [-0.12, 0.08, 0.3, 0.42, '#f2c14e'],
    [0.38, 0.14, 0.74, 0.88, '#f4efe6'],
  ];
  for (const [x0, y0, x1, y1, c] of posters) panel(b, nb.x + x0, nb.y0 + y0, nb.x + x1, nb.y0 + y1, pz, c);
  star(b, [nb.x - 0.46, nb.y0 + 0.6, pz + 0.003], 0.16, PALETTE.gold, 0.4);
  wallClock(b, CT.clock, CT.clockR);
  // Wall-fan brackets (the heads and blades move).
  b.box([CT.fans[0]!.at[0] - 0.05, CT.fans[0]!.at[1] - 0.25, wz], [CT.fans[0]!.at[0] + 0.05, CT.fans[0]!.at[1] - 0.08, wz + 0.2], '#c9c3b3');

  // --- Lockers, water cooler and the corridor's end wall ----------------------------------------------------
  const lk = CT.lockers;
  b.box([lk.x0, 0, wz], [lk.x1, lk.h, wz + lk.depth], { side: '#3f5a8a', top: '#7f8fb5', front: '#3f5a8a' }, 0, { bottom: true });
  const lz = wz + lk.depth + 0.004;
  const colW = (lk.x1 - lk.x0) / lk.cols;
  const rowH = lk.h / lk.rows;
  for (let c = 0; c < lk.cols; c++) {
    for (let r = 0; r < lk.rows; r++) {
      const x0 = lk.x0 + c * colW + 0.02;
      const x1 = x0 + colW - 0.04;
      const y0 = r * rowH + 0.04;
      const y1 = y0 + rowH - 0.06;
      const color = c === 3 && r === 1 ? '#2bb3a3' : LOCKER[(c + r * 2) % LOCKER.length]!;
      panel(b, x0, y0, x1, y1, lz, color);
      panel(b, x1 - 0.08, y0 + rowH * 0.4, x1 - 0.05, y0 + rowH * 0.55, lz + 0.003, '#d9dde6');
      if (detail) for (let v = 0; v < 3; v++) panel(b, x0 + 0.08, y1 - 0.12 - v * 0.06, x1 - 0.12, y1 - 0.095 - v * 0.06, lz + 0.003, mixHex(color, PALETTE.ink, 0.4));
    }
  }
  const [cx, , czc] = CT.cooler;
  b.box([cx - 0.23, 0, czc - 0.2], [cx + 0.23, 1.05, czc + 0.2], { side: '#dfe5ee', front: '#eef2f7', top: '#c9d3e0' }, 0, { bottom: true });
  panel(b, cx - 0.16, 0.6, cx + 0.16, 0.95, czc + 0.205, '#7cc4ff', 0.35);
  b.box([cx - 0.04, 0.86, czc + 0.2], [cx + 0.04, 0.92, czc + 0.3], '#9aa3b5');
  const ew = CT.endWall;
  b.box([ew.x0, 0, wz], [ew.x1, wallH, ew.z1], { side: WALL, top: '#3d4a7a', left: mixHex(WALL, PALETTE.ink, 0.06) }, 0, { bottom: true });
  b.box([ew.x0 - 0.04, 0, wz], [ew.x0, 0.95, ew.z1], { side: DADO, top: DADO }, 0, { bottom: true });

  // --- Courtyard: the school bench, a planter of shrubs ------------------------------------------------------
  b.add(bench({ length: CT.bench.length, color: '#c98b5a' }), { at: CT.bench.at, rotY: CT.bench.rotY });
  const pl = CT.planter;
  b.box([pl.x0, -0.04, pl.z0], [pl.x1, 0.45, pl.z1], { side: '#b3adc2', top: '#5a4a3e' }, 0, { bottom: true });
  if (detail) {
    for (const z of [-0.3, 1.0, 2.3]) b.add(tree({ kind: 'round', height: 1.25, seed: `ct-shrub${z}` }), { at: [(pl.x0 + pl.x1) / 2, 0.42, z] });
  }
  // Paving joints on the path.
  if (detail) for (let z = corridorZ + 0.6; z < f.z1; z += 0.9) decal(b, 2.32, z, 3.48, z + 0.03, -0.035, mixHex(PAVING, PALETTE.ink, 0.2));
  return b.build();
}

// ------------------------------------------------------------------------------------------------------------
// Moving parts: oscillating wall fans and the clock's second hand (all pure functions of time).
// ------------------------------------------------------------------------------------------------------------

const fanYaw = (i: number, time: number) => CT.fans[i]!.yaw + 0.55 * Math.sin(time * 0.6 + i * 1.7);

const fanHeadLayout: InstanceLayout = (i, time, o: Object3D) => {
  o.position.set(...CT.fans[i]!.at);
  o.rotation.y = fanYaw(i, time);
};

const fanBladeLayout: InstanceLayout = (i, time, o: Object3D) => {
  const yaw = fanYaw(i, time);
  const [x, y, z] = CT.fans[i]!.at;
  o.position.set(x + Math.sin(yaw) * 0.02, y, z + Math.cos(yaw) * 0.02);
  o.rotation.y = yaw;
  o.rotation.z = -time * 13;
};

/** The second hand ticks once a second (and stops dead while time is held). */
export const secondAngle = (time: number) => -((Math.floor(time) + 12) / 60) * Math.PI * 2;

const handLayout: InstanceLayout = (_i, time, o: Object3D) => {
  o.position.set(CT.clock[0], CT.clock[1], CT.clock[2]);
  o.rotation.z = secondAngle(time);
};

/** The moving meshes (geometry and instance count), for budget checks. */
export function canteenMoving(): { geometry: BufferGeometry; count: number }[] {
  return [
    { geometry: fanHead(), count: CT.fans.length },
    { geometry: fanBlades(), count: CT.fans.length },
    { geometry: clockHand(), count: 1 },
  ];
}

export default function CanteenSet({ quality, frozen, t, timeOfDay }: SetPieceProps) {
  const night = timeOfDay === 'evening' || timeOfDay === 'night';
  const geometry = useKitGeometry(() => buildCanteen({ tier: quality, night }), [quality, night]);
  const head = useKitGeometry(() => fanHead(), []);
  const blades = useKitGeometry(() => fanBlades(), []);
  const hand = useKitGeometry(() => clockHand(), []);
  const { time, running } = useAmbient(t, frozen);
  return (
    <group>
      <KitMesh geometry={geometry} />
      <AnimatedInstances geometry={head} count={CT.fans.length} layout={fanHeadLayout} t={time} running={running} />
      <AnimatedInstances geometry={blades} count={CT.fans.length} layout={fanBladeLayout} t={time} running={running} />
      {/* The clock keeps ticking under reduced motion (a discrete tick, not motion); it stops only while held. */}
      <AnimatedInstances geometry={hand} count={1} layout={handLayout} t={t} running={!frozen} />
    </group>
  );
}
