import { lazy } from 'react';
import type { Mission } from '@shieldquest/shared';
import type { SetPiece, SetPieceProps } from './types';
import {
  SCHOOL_GATE_ANCHORS,
  SCHOOL_GATE_CAMERA,
  SCHOOL_GATE_OBLIQUE as O,
  SCHOOL_GATE_STAGING,
  SG,
} from '../core/layout/school-gate';
import { FBox, FPoly, FlatSky, flatAnchorsOf, flatPoint, flatStagingOf, isNight, litPattern, pts } from '../core/flat';
import type { FlatTwin, StagedSetPiece, Vec3 } from '../core/staging';

// S1 School Gate and Bus Stop. The 3D geometry is lazy (three.js stays out of the Flat View and the app shell);
// the anchors, camera and Flat View twin are plain data shared with it (core/layout/school-gate.ts).
const SchoolGate3D = lazy(() => import('../core/sets3d/school-gate'));

/** Suspends while the 3D chunk loads, so the scene appears all at once (MissionScene covers it with the Flat View). */
function SchoolGateComponent(props: SetPieceProps) {
  return <SchoolGate3D {...props} />;
}

const W = 400;
const H = 250;
const FENCE = '#2b8f86';
const CREAM = '#efe6d2';
const PAVE = '#b9b2c9';

const quad = (x0: number, x1: number, y0: number, y1: number, z: number): Vec3[] => [
  [x0, y0, z],
  [x1, y0, z],
  [x1, y1, z],
  [x0, y1, z],
];

function windowsGrid(key: string, x0: number, width: number, z: number, base: number, floors: number, cols: number, lit: boolean[]) {
  const span = (width - 1.2) / cols;
  const out = [];
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const xc = x0 + 0.6 + span * (c + 0.5);
      const y0 = base + f * 2.4 + 0.67;
      out.push(<FPoly key={`${key}${f}-${c}`} o={O} fill={lit[f * cols + c] ? '#ffd58a' : '#2b3557'} p={quad(xc - span * 0.28, xc + span * 0.28, y0, y0 + 1.15, z)} />);
    }
  }
  return out;
}

function ParkedCar({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <g>
      <FBox o={O} min={[x - 0.8, 0.28, z - 1.8]} max={[x + 0.8, 0.86, z + 1.8]} front={color} top={color} side="#00000022" />
      <FBox o={O} min={[x - 0.66, 0.86, z - 0.9]} max={[x + 0.66, 1.38, z + 0.4]} front="#33405f" top={color} side="#2a3550" />
    </g>
  );
}

/** Flat View drawing of the school gate, from the front-right like the live camera. */
function SchoolGateFlat({ timeOfDay }: { timeOfDay: Mission['timeOfDay'] }) {
  const night = isNight(timeOfDay);
  const fz = SG.fenceZ;
  const g = SG.guard;
  const sh = SG.shelter;
  const k = SG.kiosk;
  const kx = k.at[0];
  const kBack = k.at[2] - k.depth / 2;
  const kFront = k.at[2] + k.depth / 2;
  const cx = SG.road.crossingX;
  const blockX0 = SG.block.at[0] - SG.block.width / 2;
  const blockZ = SG.block.at[2] + SG.block.depth / 2;
  const schoolX0 = SG.school.at[0] - SG.school.width / 2;
  const schoolZ = SG.school.at[2] + SG.school.depth / 2;
  const bars: number[] = [];
  for (let x = -15; x <= SG.schoolEdgeX; x += 0.45) if ((x < g.x0 || x > g.x1) && (x < SG.gate.x0 - 0.2 || x > SG.gate.x1 + 0.2)) bars.push(x);
  const tree = flatPoint(O, [SG.tree[0], 3.6, SG.tree[2]]);
  return (
    <g>
      <FlatSky width={W} height={H} timeOfDay={timeOfDay} />
      {/* School field and the estate ground. */}
      <FPoly o={O} fill="#4f8c6c" p={[[-15, 0, fz], [SG.schoolEdgeX, 0, fz], [SG.schoolEdgeX, 0, -14], [-15, 0, -14]]} />
      <FPoly o={O} fill="#a7a2b8" p={[[SG.schoolEdgeX, 0, SG.carPark.z0], [17, 0, SG.carPark.z0], [17, 0, -14], [SG.schoolEdgeX, 0, -14]]} />
      {/* The next block (HDB) behind the car park, and the school building. */}
      <FBox o={O} min={[blockX0, 2.76, blockZ - 5]} max={[blockX0 + SG.block.width, 18, blockZ]} front="#e3dcef" side="#c6bfd6" />
      {windowsGrid('b', blockX0, SG.block.width, blockZ, 2.76, 6, 9, litPattern(54, night ? 0.4 : 0.1, 7))}
      <FBox o={O} min={[blockX0, 0, blockZ - 5]} max={[blockX0 + SG.block.width, 2.76, blockZ - 1.2]} front="#8f8aa6" />
      {[0, 1, 2, 3, 4].map((i) => (
        <FBox key={i} o={O} min={[blockX0 + 0.3 + i * 3.35, 0, blockZ - 0.5]} max={[blockX0 + 0.74 + i * 3.35, 2.76, blockZ - 0.06]} front="#e3dcef" />
      ))}
      <FBox o={O} min={[schoolX0, 0, schoolZ - 5]} max={[schoolX0 + SG.school.width, 4.8, schoolZ]} front={CREAM} top="#8f8aa6" side="#d8cdb6" />
      {windowsGrid('s', schoolX0, SG.school.width, schoolZ, 0, 2, 11, litPattern(22, night ? 0.25 : 0.06, 11))}
      <FBox o={O} min={[schoolX0, 0, schoolZ]} max={[schoolX0 + 0.5, 5.1, schoolZ + 0.08]} front="#2bb3a3" />
      <FBox o={O} min={[schoolX0 + SG.school.width - 0.5, 0, schoolZ]} max={[schoolX0 + SG.school.width, 5.1, schoolZ + 0.08]} front="#2bb3a3" />
      {/* Rain tree. */}
      <rect x={flatPoint(O, SG.tree).x - 3} y={tree.y} width={6} height={flatPoint(O, SG.tree).y - tree.y} fill="#7a5a48" />
      <ellipse cx={tree.x} cy={tree.y - 6} rx={52} ry={15} fill="#3a8466" />
      <ellipse cx={tree.x + 10} cy={tree.y - 14} rx={30} ry={9} fill="#57a283" />
      {/* Guard post. */}
      <FBox o={O} min={[g.x0, 0, g.z0]} max={[g.x1, g.h, g.z1]} front={CREAM} top="#8f8aa6" side="#d8cdb6" />
      <FBox o={O} min={[g.x0 - 0.2, g.h, g.z0 - 0.2]} max={[g.x1 + 0.2, g.h + 0.18, g.z1 + 0.35]} front={FENCE} top="#5c6680" />
      <FPoly o={O} fill={night ? '#ffe2a8' : '#cfe8ff'} p={quad(g.x0 + 0.2, g.x1 - 0.2, 1.0, 2.15, g.z1)} />
      {/* School fence, gate pillars and the arch over the gate. */}
      {bars.map((x) => (
        <polyline key={x} points={pts(O, [x, 0, fz], [x, SG.fenceH, fz])} stroke={FENCE} strokeWidth={1} />
      ))}
      <polyline points={pts(O, [-15, SG.fenceH - 0.06, fz], [g.x0, SG.fenceH - 0.06, fz])} stroke={FENCE} strokeWidth={1.4} />
      <polyline points={pts(O, [SG.gate.x1 + 0.2, SG.fenceH - 0.06, fz], [SG.schoolEdgeX, SG.fenceH - 0.06, fz])} stroke={FENCE} strokeWidth={1.4} />
      <polyline points={pts(O, [-15, 0.76, fz], [g.x0, 0.76, fz])} stroke={FENCE} strokeWidth={1.2} />
      <polyline points={pts(O, [SG.gate.x1 + 0.2, 0.76, fz], [SG.schoolEdgeX, 0.76, fz])} stroke={FENCE} strokeWidth={1.2} />
      {[SG.gate.x0 - 0.2, SG.gate.x1 + 0.2].map((x) => (
        <FBox key={x} o={O} min={[x - 0.22, 0, fz - 0.22]} max={[x + 0.22, 2.52, fz + 0.22]} front={CREAM} top={FENCE} side="#d8cdb6" />
      ))}
      <FBox o={O} min={[SG.gate.x0 - 0.4, 2.52, fz - 0.12]} max={[SG.gate.x1 + 0.4, 3.25, fz + 0.12]} front="#f4efe6" top={FENCE} side={FENCE} />
      {/* Pavement, car park and the road with its zebra crossing. */}
      <FPoly o={O} fill={PAVE} p={[[SG.pavement.x0, 0, SG.pavement.z1], [SG.pavement.x1, 0, SG.pavement.z1], [SG.pavement.x1, 0, fz], [SG.pavement.x0, 0, fz]]} />
      {[-12, -9, -6, -3, 0, 3, 6].map((x) => (
        <polyline key={x} points={pts(O, [x, 0, fz], [x, 0, SG.pavement.z1])} stroke="#a7a0b8" strokeWidth={0.6} />
      ))}
      <FPoly o={O} fill="#f2c14e" p={[[cx - 1.4, 0, SG.pavement.z1], [cx + 1.4, 0, SG.pavement.z1], [cx + 1.4, 0, SG.pavement.z1 - 0.5], [cx - 1.4, 0, SG.pavement.z1 - 0.5]]} />
      <FPoly o={O} fill="#3a3f5c" p={[[SG.carPark.x0, 0, SG.carPark.z1], [SG.carPark.x1, 0, SG.carPark.z1], [SG.carPark.x1, 0, SG.carPark.z0], [SG.carPark.x0, 0, SG.carPark.z0]]} />
      {[0, 1, 2, 3].map((i) => (
        <polyline key={i} points={pts(O, [SG.carPark.x0 + 0.6 + i * 2.9, 0, -0.6], [SG.carPark.x0 + 0.6 + i * 2.9, 0, SG.carPark.z0 + 0.2])} stroke="#e8e4da" strokeWidth={1} />
      ))}
      {SG.parked.map(([x, , z], i) => (
        <ParkedCar key={i} x={x} z={z} color={i === 0 ? '#e07a5f' : '#9fb3c8'} />
      ))}
      <FBox o={O} min={[-15, -0.15, 0.6]} max={[15, 0.01, 0.9]} front="#a39db3" top="#c9c3d6" />
      <FPoly o={O} fill="#3a3f5c" p={[[-15, -0.13, 6.3], [15, -0.13, 6.3], [15, -0.13, 0.9], [-15, -0.13, 0.9]]} />
      {[-13, -10, -7, 4, 7, 10, 13].map((x) => (
        <FPoly key={x} o={O} fill="#e8e4da" p={[[x, -0.12, 3.67], [x + 1.5, -0.12, 3.67], [x + 1.5, -0.12, 3.53], [x, -0.12, 3.53]]} />
      ))}
      {[1.3, 2.2, 3.1, 4.0, 4.9, 5.8].map((z) => (
        <FPoly key={z} o={O} fill="#f1ede4" p={[[cx - 1.4, -0.12, z], [cx + 1.4, -0.12, z], [cx + 1.4, -0.12, z - 0.5], [cx - 1.4, -0.12, z - 0.5]]} />
      ))}
      <FBox o={O} min={[-15, -0.15, 6.3]} max={[15, 0.01, 6.6]} front="#a39db3" top="#c9c3d6" />
      <FPoly o={O} fill={PAVE} p={[[-15, 0, 9], [15, 0, 9], [15, 0, 6.6], [-15, 0, 6.6]]} />
      {/* Bus shelter: glass back with a lit ad, bench with a schoolbag on it, posts and roof. */}
      <FBox o={O} min={[sh.x0 + 0.2, 0.3, sh.z0]} max={[sh.x1 - 1.4, 2.2, sh.z0 + 0.05]} front="#4c6585" />
      <FBox o={O} min={[sh.x1 - 1.35, 0.3, sh.z0]} max={[sh.x1 - 0.2, 2.2, sh.z0 + 0.08]} front={night ? '#ffd0e0' : '#f6c7d6'} />
      <FPoly o={O} fill="#f26b5b" p={quad(sh.x1 - 1.2, sh.x1 - 0.35, 0.6, 1.5, sh.z0 + 0.09)} />
      <FBox o={O} min={[SG.shelterBench.at[0] - 0.9, 0.38, SG.shelterBench.at[2] - 0.2]} max={[SG.shelterBench.at[0] + 0.9, 0.44, SG.shelterBench.at[2] + 0.2]} front="#a8744c" top="#c98b5a" />
      <FBox o={O} min={[SG.bag[0] - 0.2, SG.bag[1], SG.bag[2] - 0.12]} max={[SG.bag[0] + 0.2, SG.bag[1] + 0.42, SG.bag[2] + 0.12]} front="#4a90f0" top="#2d6fd6" side="#3b82f6" />
      {[sh.x0 + 0.1, sh.x1 - 0.1].map((x) => (
        <polyline key={x} points={pts(O, [x, 0, sh.z1], [x, sh.h + 0.2, sh.z1])} stroke="#5c6680" strokeWidth={1.6} />
      ))}
      <FPoly o={O} fill="#7fa4a8" p={[[sh.x0 - 0.2, sh.h + 0.25, sh.z1 + 0.35], [sh.x1 + 0.2, sh.h + 0.25, sh.z1 + 0.35], [sh.x1 + 0.2, sh.h + 0.05, sh.z0 - 0.15], [sh.x0 - 0.2, sh.h + 0.05, sh.z0 - 0.15]]} />
      <polyline points={pts(O, SG.busSign, [SG.busSign[0], 2.4, SG.busSign[2]])} stroke="#59607a" strokeWidth={1.4} />
      <FPoly o={O} fill="#f4efe6" stroke="#2b8f86" p={quad(SG.busSign[0] - 0.3, SG.busSign[0] + 0.3, 2.3, 2.8, SG.busSign[2])} />
      <polyline points={pts(O, SG.carParkSign, [SG.carParkSign[0], 2.0, SG.carParkSign[2]])} stroke="#4d5470" strokeWidth={1.4} />
      <FPoly o={O} fill="#3b82f6" p={quad(SG.carParkSign[0] - 0.28, SG.carParkSign[0] + 0.28, 2.0, 2.45, SG.carParkSign[2])} />
      {/* Boba Boleh kiosk (square-on) with its giant cup. */}
      <FBox o={O} min={[kx - 1.1, 0, kBack]} max={[kx + 1.1, 2.5, kBack + 0.15]} front={night ? '#ffc8b8' : '#f6a594'} />
      {Array.from({ length: 8 }, (_, i) => {
        const x0 = kx - 1.2 + (2.4 * i) / 8;
        const x1 = kx - 1.2 + (2.4 * (i + 1)) / 8;
        return <FPoly key={i} o={O} fill={i % 2 === 0 ? '#fff3e0' : '#f2c14e'} p={[[x0, 2.2, kFront + 0.4], [x1, 2.2, kFront + 0.4], [x1, 2.6, kBack], [x0, 2.6, kBack]]} />;
      })}
      <FBox o={O} min={[kx - 1.1, 2.6, kBack + 0.1]} max={[kx + 1.1, 3.1, kBack + 0.3]} front="#f4efe6" top="#c2493b" />
      <FBox o={O} min={[kx - 1.1, 0, kFront - 0.5]} max={[kx + 1.1, 1, kFront]} front="#f26b5b" top="#efe9df" side="#c2493b" />
      <path
        d={`M${flatPoint(O, [kx - 0.85, 3.1, kBack + 0.2]).x} ${flatPoint(O, [kx - 0.85, 3.1, kBack + 0.2]).y} l1 -11 h9 l1 11 z`}
        fill="#e9c9a2"
        stroke="#f4efe6"
        strokeWidth={0.8}
      />
      <rect x={flatPoint(O, [kx - 0.85, 3.1, kBack + 0.2]).x} y={flatPoint(O, [kx - 0.85, 3.1, kBack + 0.2]).y - 14} width={11} height={3.5} rx={1.6} fill="#f26b5b" />
      <line x1={flatPoint(O, [kx - 0.85, 3.1, kBack + 0.2]).x + 7} y1={flatPoint(O, [kx - 0.85, 3.1, kBack + 0.2]).y - 14} x2={flatPoint(O, [kx - 0.85, 3.1, kBack + 0.2]).x + 9} y2={flatPoint(O, [kx - 0.85, 3.1, kBack + 0.2]).y - 20} stroke="#f2c14e" strokeWidth={1.4} />
      {/* Street lamps and the Belisha beacons. */}
      {SG.lamps.map(([x, , z]) => {
        const head = flatPoint(O, [x, 4.7, z + 0.95]);
        return (
          <g key={x}>
            <polyline points={pts(O, [x, 0, z], [x, 4.8, z], [x, 4.8, z + 0.95])} fill="none" stroke="#59607a" strokeWidth={1.6} />
            {night && <circle cx={head.x} cy={head.y} r={8} fill="#ffd58a" opacity={0.45} />}
            <circle cx={head.x} cy={head.y} r={2.4} fill="#fff1c9" />
          </g>
        );
      })}
      {SG.beacons.map(([x, , z]) => {
        const globe = flatPoint(O, [x, 2.3, z]);
        return (
          <g key={`${x}${z}`}>
            <polyline points={pts(O, [x, 0, z], [x, 2.1, z])} stroke="#1d2440" strokeWidth={1.6} strokeDasharray="3 3" />
            <circle cx={globe.x} cy={globe.y} r={3.2} fill="#ffb347" />
          </g>
        );
      })}
    </g>
  );
}

const flat: FlatTwin = {
  viewBox: `0 0 ${W} ${H}`,
  Draw: SchoolGateFlat,
  anchors: flatAnchorsOf(O, SCHOOL_GATE_ANCHORS),
  // Glyphs a little larger than true scale so faces stay readable at phone width.
  staging: flatStagingOf(O, SCHOOL_GATE_ANCHORS, SCHOOL_GATE_STAGING, { beanHeight: 30 }),
};

const schoolGateSet: StagedSetPiece = {
  id: 'school-gate',
  name: 'School gate and bus stop',
  anchors: SCHOOL_GATE_ANCHORS,
  camera: SCHOOL_GATE_CAMERA,
  Component: SchoolGateComponent,
  flat,
  staging: SCHOOL_GATE_STAGING,
};

export const schoolGate: SetPiece = schoolGateSet;
