// S1 School Gate and Bus Stop (GAME_DESIGN.md §4.1): the gate with its guard post, the school fence, a bus
// shelter with a bench, a zebra crossing with Belisha beacons, the Boba Boleh bubble-tea kiosk, a rain tree and
// the car park of the next block. Static props are ONE merged geometry; the passing car and the blinking beacon
// globes are two small meshes animated as a pure function of mission time (they hold still while time is held).
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { BufferGeometry, Group } from 'three';
import {
  GeoBuilder,
  KitMesh,
  PALETTE,
  bench,
  fence,
  hdbBlock,
  kiosk,
  lampPost,
  mixHex,
  road,
  tree,
  useKitGeometry,
} from '../../../kit';
import type { QualityTier } from '../../../quality';
import type { SetPieceProps } from '../../sets/types';
import { SG } from '../layout/school-gate';
import { car, pooled, tiledFloor, useSmoothTime, type LightPool } from './common';

const PAVE = '#b9b2c9';
const FENCE = '#2b8f86';
const GRASS = '#4f8c6c';
const CREAM = '#efe6d2';

export interface SchoolGateOptions {
  tier: QualityTier;
  night: boolean;
}

function pools(night: boolean): LightPool[] {
  const s = night ? 1 : 0.3;
  return [
    ...SG.lamps.map((l): LightPool => ({ at: [l[0], l[2] + 0.95], radius: 3.6, color: '#ffd58a', strength: 0.42 * s })),
    { at: [SG.kiosk.at[0] + 0.6, SG.kiosk.at[2] + 1.0], radius: 3.2, color: '#ffc2a8', strength: 0.4 * s },
    { at: [(SG.guard.x0 + SG.guard.x1) / 2, SG.guard.z1 + 0.8], radius: 2.6, color: '#fff1c9', strength: 0.35 * s },
    { at: [SG.shelter.x0 + 0.6, SG.shelter.z0 + 0.6], radius: 2.4, color: '#bfe3ff', strength: 0.3 * s },
  ];
}

/** A tapered bubble-tea cup with lid, straw and pearls (the kiosk's rooftop sign). */
function bobaCup(b: GeoBuilder, at: [number, number, number]): void {
  const [x, y, z] = at;
  b.lathe(
    [
      [0, 0],
      [0.2, 0],
      [0.27, 0.62],
      [0.29, 0.66],
      [0.22, 0.76],
      [0, 0.8],
    ],
    10,
    (row) => (row === 0 ? '#f4efe6' : row === 1 ? '#e9c9a2' : row === 2 ? '#f4efe6' : '#f26b5b'),
    { center: [x, y, z] },
  );
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.boxAt([x + Math.sin(a) * 0.215, y + 0.1, z + Math.cos(a) * 0.215], [0.07, 0.07, 0.07], '#2b211f');
  }
  b.strut([x + 0.05, y + 0.7, z], [x + 0.16, y + 1.12, z + 0.02], 0.03, 5, '#f2c14e');
}

/** Every static prop of the school gate as one kit geometry. Pure (testable in Node). */
export function buildSchoolGate({ tier, night }: SchoolGateOptions): BufferGeometry {
  const light = pools(night);
  const detail = tier !== 'low';
  const b = new GeoBuilder();
  const pave = SG.pavement;

  // --- Ground: estate grass under everything, the school field, the road and both pavements ---------------
  b.box([-17, -0.6, -16], [17, -0.16, 10], { top: '#3f6f5c', side: '#2f5246' });
  tiledFloor(b, -15, SG.schoolEdgeX, -14, SG.fenceZ, -0.02, 2, (_x, _z, i, j) => ((i + j) % 2 === 0 ? GRASS : mixHex(GRASS, '#ffffff', 0.05)));
  b.box([-15, -0.16, -14], [SG.schoolEdgeX, -0.02, SG.fenceZ], { side: '#3a6a55' }, 0, { top: true });
  // Estate ground behind the car park.
  b.box([SG.schoolEdgeX, -0.16, -14], [17, -0.02, SG.carPark.z0], { top: '#a7a2b8', side: '#8d879f' });
  // Pavement slab with tiles and the yellow tactile strip at the crossing.
  b.box([pave.x0, -0.16, pave.z0], [pave.x1, 0, pave.z1], { side: '#8d879f' }, 0, { top: true });
  tiledFloor(b, pave.x0, pave.x1, pave.z0, pave.z1, 0, detail ? 1 : 2.5, (x, z, i, j) =>
    pooled((i + j) % 2 === 0 ? PAVE : mixHex(PAVE, PALETTE.ink, 0.06), x, z, light),
  );
  const cx = SG.road.crossingX;
  b.quad([cx - 1.4, 0.005, pave.z1], [cx + 1.4, 0.005, pave.z1], [cx + 1.4, 0.005, pave.z1 - 0.5], [cx - 1.4, 0.005, pave.z1 - 0.5], '#f2c14e');
  b.add(road({ length: SG.road.length, width: SG.road.width, crossingAt: cx }), { at: SG.road.at });
  b.box([-15, -0.16, SG.southStrip.z0], [15, 0, SG.southStrip.z1], { top: PAVE, side: '#8d879f' });

  // --- Car park of the next block: asphalt, bay lines, two parked cars, a sign -----------------------------
  const cp = SG.carPark;
  b.box([cp.x0 - 0.2, -0.16, cp.z0], [cp.x0, 0.25, cp.z1], { top: '#5d9a7a', side: '#8d879f' });
  b.box([cp.x0, -0.16, cp.z0], [cp.x1, -0.02, cp.z1], { top: pooled(PALETTE.asphalt, 9.6, -1, light), side: '#2c3149' });
  for (let i = 0; i <= 3; i++) {
    const x = cp.x0 + 0.6 + i * 2.9;
    b.quad([x - 0.06, -0.015, -0.6], [x + 0.06, -0.015, -0.6], [x + 0.06, -0.015, cp.z0 + 0.2], [x - 0.06, -0.015, cp.z0 + 0.2], '#e8e4da');
  }
  car(b, [SG.parked[0]![0], -0.02, SG.parked[0]![2]], '#e07a5f', false, Math.PI / 2);
  if (detail) car(b, [SG.parked[1]![0], -0.02, SG.parked[1]![2]], '#9fb3c8', false, Math.PI / 2);
  const ps = SG.carParkSign;
  b.box([ps[0] - 0.05, 0, ps[2] - 0.05], [ps[0] + 0.05, 2.0, ps[2] + 0.05], '#4d5470');
  b.box([ps[0] - 0.28, 2.0, ps[2] - 0.03], [ps[0] + 0.28, 2.45, ps[2] + 0.03], { side: '#2d6fd6', front: '#3b82f6' });

  // --- School fence (with the gate opening), the gate pillars and arch, and the retracted sliding gate -----
  const fz = SG.fenceZ;
  const runs: [number, number][] = [
    [-15, SG.guard.x0],
    [SG.guard.x1, SG.gate.x0 - 0.2],
    [SG.gate.x1 + 0.2, SG.schoolEdgeX],
  ];
  for (const [x0, x1] of runs) {
    b.add(fence({ length: x1 - x0, height: SG.fenceH, spacing: detail ? 0.45 : 1.2, color: FENCE }), { at: [(x0 + x1) / 2, 0, fz] });
  }
  b.add(fence({ length: 9.6, height: SG.fenceH, spacing: detail ? 0.9 : 2, color: FENCE }), { at: [SG.schoolEdgeX, 0, fz - 4.8], rotY: Math.PI / 2 });
  for (const x of [SG.gate.x0 - 0.2, SG.gate.x1 + 0.2]) {
    b.box([x - 0.22, 0, fz - 0.22], [x + 0.22, 2.4, fz + 0.22], { side: CREAM, top: FENCE });
    b.box([x - 0.26, 2.4, fz - 0.26], [x + 0.26, 2.52, fz + 0.26], FENCE);
  }
  b.box([SG.gate.x0 - 0.4, 2.52, fz - 0.12], [SG.gate.x1 + 0.4, 3.25, fz + 0.12], { side: FENCE, front: '#f4efe6', top: mixHex(FENCE, '#ffffff', 0.2) });
  b.add(fence({ length: 3, height: 1.6, spacing: detail ? 0.25 : 0.75, color: mixHex(FENCE, PALETTE.ink, 0.2) }), { at: [SG.gate.x1 + 1.9, 0, fz - 0.35] });

  // --- Guard post: booth with a lit window, door and roof overhang ------------------------------------------
  const g = SG.guard;
  b.box([g.x0, 0, g.z0], [g.x1, g.h, g.z1], { side: CREAM, front: CREAM, top: '#8f8aa6' });
  b.box([g.x0 - 0.2, g.h, g.z0 - 0.2], [g.x1 + 0.2, g.h + 0.18, g.z1 + 0.35], { side: FENCE, top: '#5c6680', bottom: '#d9d3e3' });
  b.quad([g.x0 + 0.2, 1.0, g.z1 + 0.01], [g.x1 - 0.2, 1.0, g.z1 + 0.01], [g.x1 - 0.2, 2.15, g.z1 + 0.01], [g.x0 + 0.2, 2.15, g.z1 + 0.01], night ? '#ffe2a8' : '#cfe8ff', night ? 1 : 0.2);
  b.box([g.x0 + 0.15, 0.95, g.z1], [g.x1 - 0.15, 1.02, g.z1 + 0.25], '#c9c3d6');
  b.quad([g.x1 + 0.01, 0, g.z1 - 0.3], [g.x1 + 0.01, 0, g.z1 - 1.2], [g.x1 + 0.01, 2.0, g.z1 - 1.2], [g.x1 + 0.01, 2.0, g.z1 - 0.3], '#5c6680');
  if (detail) b.cylinder([g.x0 + 0.3, 0, g.z1 + 0.35], 0.2, 0.4, 7, '#b0674c', { top: '#3f8f74' });

  // --- School building and rain tree ------------------------------------------------------------------------
  b.add(
    hdbBlock({
      floors: SG.school.floors,
      width: SG.school.width,
      depth: SG.school.depth,
      voidDeck: false,
      litWindows: night ? 0.25 : 0.06,
      body: CREAM,
      accent: PALETTE.school,
      seed: 'lumen-park',
      ao: detail,
    }),
    { at: SG.school.at },
  );
  b.add(tree({ kind: 'rain', height: 5, seed: 'sg-rain-tree', leaf: '#3a8466' }), { at: SG.tree });
  if (detail) {
    b.add(tree({ kind: 'round', height: 3.6, seed: 'sg-field-1' }), { at: [-12.5, 0, -6.4] });
    b.add(tree({ kind: 'cone', height: 4.4, seed: 'sg-field-2' }), { at: [-9.2, 0, -12.6] });
  }

  // --- Bus shelter: posts, sloped roof, glass back with a lit ad panel, the bench and a schoolbag on it -----
  const sh = SG.shelter;
  for (const x of [sh.x0 + 0.1, sh.x1 - 0.1]) {
    b.box([x - 0.06, 0, sh.z0], [x + 0.06, sh.h, sh.z0 + 0.12], '#5c6680');
    b.box([x - 0.06, 0, sh.z1 - 0.12], [x + 0.06, sh.h + 0.2, sh.z1], '#5c6680');
  }
  b.quad([sh.x0 - 0.2, sh.h + 0.25, sh.z1 + 0.35], [sh.x1 + 0.2, sh.h + 0.25, sh.z1 + 0.35], [sh.x1 + 0.2, sh.h + 0.05, sh.z0 - 0.15], [sh.x0 - 0.2, sh.h + 0.05, sh.z0 - 0.15], '#7fa4a8');
  b.quad([sh.x1 + 0.2, sh.h + 0.18, sh.z1 + 0.35], [sh.x0 - 0.2, sh.h + 0.18, sh.z1 + 0.35], [sh.x0 - 0.2, sh.h - 0.02, sh.z0 - 0.15], [sh.x1 + 0.2, sh.h - 0.02, sh.z0 - 0.15], '#d9d3e3');
  b.box([sh.x0 - 0.2, sh.h + 0.05, sh.z1 + 0.25], [sh.x1 + 0.2, sh.h + 0.25, sh.z1 + 0.35], '#5f8f99');
  b.box([sh.x0 + 0.2, 0.3, sh.z0], [sh.x1 - 1.4, 2.2, sh.z0 + 0.05], { side: '#3e5470', front: '#4c6585' });
  b.box([sh.x1 - 1.35, 0.3, sh.z0], [sh.x1 - 0.2, 2.2, sh.z0 + 0.08], { side: '#3e5470', front: night ? '#ffd0e0' : '#f6c7d6' }, night ? 0.9 : 0.25);
  b.box([sh.x1 - 1.2, 0.6, sh.z0 + 0.081], [sh.x1 - 0.35, 1.5, sh.z0 + 0.09], '#f26b5b', night ? 0.7 : 0.1);
  b.add(bench({ length: SG.shelterBench.length, color: '#c98b5a', back: false }), { at: SG.shelterBench.at });
  const [bx, by, bz] = SG.bag;
  b.box([bx - 0.2, by, bz - 0.12], [bx + 0.2, by + 0.42, bz + 0.12], { side: '#3b82f6', top: '#2d6fd6', front: '#4a90f0' });
  b.box([bx - 0.17, by + 0.18, bz + 0.12], [bx + 0.17, by + 0.4, bz + 0.17], '#2d6fd6');
  b.box([bx + 0.08, by + 0.05, bz + 0.17], [bx + 0.18, by + 0.15, bz + 0.19], '#f4efe6');
  const bs = SG.busSign;
  b.cylinder([bs[0], 0, bs[2]], 0.05, 2.4, 6, '#59607a');
  b.box([bs[0] - 0.3, 2.3, bs[2] - 0.03], [bs[0] + 0.3, 2.8, bs[2] + 0.03], { side: '#2b8f86', front: '#f4efe6' });

  // --- Boba Boleh kiosk with its giant cup ------------------------------------------------------------------
  const k = SG.kiosk;
  const kb = new GeoBuilder();
  kb.add(kiosk({ width: k.width, depth: k.depth, color: '#f26b5b', awning: ['#fff3e0', '#f2c14e'], lit: night }));
  bobaCup(kb, [-0.6, 3.1, -k.depth / 2 + 0.2]);
  if (detail) for (const x of [-0.5, 0, 0.5]) kb.cylinder([x, 1.0, k.depth / 2 - 0.25], 0.06, 0.18, 6, '#e9c9a2', { top: '#f4efe6' });
  b.add(kb.build(), { at: k.at, rotY: k.rotY });

  // --- Street lamps and the beacon poles (black and white bands) --------------------------------------------
  for (const l of SG.lamps) b.add(lampPost({ height: 4.8, lit: night }), { at: l });
  for (const [x, , z] of SG.beacons) {
    for (let i = 0; i < 5; i++) b.cylinder([x, i * 0.42, z], 0.05, 0.42, 6, i % 2 === 0 ? '#1d2440' : '#f4efe6');
  }
  // Next block (HDB) behind the car park.
  b.add(
    hdbBlock({
      floors: SG.block.floors,
      width: SG.block.width,
      depth: SG.block.depth,
      litWindows: night ? 0.4 : 0.1,
      body: '#e3dcef',
      accent: PALETTE.school,
      seed: 'blk-next',
      ao: detail,
    }),
    { at: SG.block.at },
  );
  return b.build();
}

function buildBeacons(): BufferGeometry {
  const b = new GeoBuilder();
  for (const [x, , z] of SG.beacons) {
    b.lathe([[0, 0], [0.16, 0.06], [0.2, 0.2], [0.16, 0.34], [0, 0.4]], 8, '#ffb347', { center: [x, 2.1, z], glow: 1 });
  }
  return b.build();
}

function buildCar(): BufferGeometry {
  return car(new GeoBuilder(), [0, 0, 0], '#5b7fd6', true).build();
}

const CAR_CYCLE = 13;
const CAR_SPEED = 7;

/** The passing car's x (or null while it is off stage): one pass every 13 s along the far lane. */
export function carX(time: number): number | null {
  const phase = (((time + 3) % CAR_CYCLE) + CAR_CYCLE) % CAR_CYCLE;
  const x = -19 + CAR_SPEED * phase;
  return x > 19 ? null : x;
}

/** Beacon globes blink at about 1.2 Hz (pure function of mission time). */
export const beaconOn = (time: number) => Math.floor(time * 2.4) % 2 === 0;

export default function SchoolGateSet({ quality, frozen, t, timeOfDay }: SetPieceProps) {
  const night = timeOfDay === 'evening' || timeOfDay === 'night';
  const geometry = useKitGeometry(() => buildSchoolGate({ tier: quality, night }), [quality, night]);
  const beacons = useKitGeometry(buildBeacons, []);
  const carGeo = useKitGeometry(buildCar, []);
  const time = useSmoothTime(t, !frozen);
  const carRef = useRef<Group>(null);
  useFrame(() => {
    const x = carX(time.current);
    const g = carRef.current;
    if (g) {
      g.visible = x !== null;
      if (x !== null) g.position.set(x, -0.13, SG.laneZ);
    }
  });
  return (
    <group>
      <KitMesh geometry={geometry} />
      <group ref={carRef} visible={false}>
        <KitMesh geometry={carGeo} castShadow={false} />
      </group>
      <KitMesh geometry={beacons} visible={frozen || beaconOn(t)} castShadow={false} receiveShadow={false} />
    </group>
  );
}
