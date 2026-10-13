import { lazy } from 'react';
import type { Mission } from '@shieldquest/shared';
import type { SetPiece, SetPieceProps } from './types';
import { CANTEEN_ANCHORS, CANTEEN_CAMERA, CANTEEN_OBLIQUE as O, CANTEEN_STAGING, CT } from './parts/canteen.layout';
import { FBox, FPoly, FlatSky, flatAnchorsOf, flatPoint, flatStagingOf, isNight, litPattern, pts } from '../core/flat';
import type { FlatTwin, StagedSetPiece } from '../core/staging';

// S2 Canteen and Locker Corridor. The 3D geometry is lazy (three.js stays out of the Flat View and the app
// shell); the anchors, camera and Flat View twin below are plain data shared with it (parts/canteen.layout.ts).
const Canteen3D = lazy(() => import('./parts/canteen.3d'));

/** Suspends while the 3D chunk loads, so the scene appears all at once (MissionScene covers it with the Flat View). */
function CanteenComponent(props: SetPieceProps) {
  return <Canteen3D {...props} />;
}

const W = 400;
const H = 250;
const TERRAZZO = '#ddd3c2';
const WALL = '#ede5d5';
const DADO = '#7fb3aa';
const FASCIA = '#2b8f86';
const LOCKERS = ['#4f7fc2', '#5b8bd0', '#4a76b6'];

/** A long table with its two benches, seen from the front-right. */
function FlatTable({ at, seat }: { at: readonly [number, number, number]; seat: string }) {
  const [x, , z] = at;
  const hl = CT.tableLength / 2;
  return (
    <g>
      <FBox o={O} min={[x - hl + 0.05, 0.38, z - 0.77]} max={[x + hl - 0.05, 0.42, z - 0.47]} front="#1f7a70" top={seat} side="#1f7a70" />
      <FBox o={O} min={[x - hl + 0.26, 0, z - 0.05]} max={[x - hl + 0.34, 0.71, z + 0.05]} front="#59607a" />
      <FBox o={O} min={[x + hl - 0.34, 0, z - 0.05]} max={[x + hl - 0.26, 0.71, z + 0.05]} front="#59607a" />
      <FBox o={O} min={[x - hl, 0.71, z - 0.4]} max={[x + hl, 0.76, z + 0.4]} front="#bdb4a2" top="#e8e0cc" side="#bdb4a2" />
      <FBox o={O} min={[x - hl + 0.05, 0.38, z + 0.47]} max={[x + hl - 0.05, 0.42, z + 0.77]} front="#1f7a70" top={seat} side="#1f7a70" />
    </g>
  );
}

/** A wall fan, drawn still (the Flat View is a snapshot). */
function FlatFan({ at }: { at: readonly [number, number, number] }) {
  const c = flatPoint(O, at);
  return (
    <g>
      <circle cx={c.x} cy={c.y} r={6.4} fill="#e7e2d6" opacity={0.35} stroke="#c9c3b3" strokeWidth={0.8} />
      {[0, 120, 240].map((a) => (
        <ellipse key={a} cx={c.x} cy={c.y - 3} rx={1.6} ry={3.2} fill="#9fc7d8" transform={`rotate(${a + 20} ${c.x} ${c.y})`} />
      ))}
      <circle cx={c.x} cy={c.y} r={1.2} fill="#59607a" />
    </g>
  );
}

/** The freestanding menu board at the drinks stall's corner (blank lines: its word is a DOM label). */
function FlatMenu() {
  const m = CT.menu;
  const c = Math.cos(m.rotY);
  const s = Math.sin(m.rotY);
  // Board-local (x along the board, y up, z out of its face) to world, turned by the board's yaw.
  const w = (x: number, y: number, z = 0.035): [number, number, number] => [m.at[0] + x * c + z * s, y, m.at[2] - x * s + z * c];
  const hw = m.w / 2;
  return (
    <g>
      <polyline points={pts(O, w(-hw + 0.06, 0), w(-hw + 0.06, m.y0))} stroke="#2c3149" strokeWidth={1.4} />
      <polyline points={pts(O, w(hw - 0.06, 0), w(hw - 0.06, m.y0))} stroke="#2c3149" strokeWidth={1.4} />
      <FPoly o={O} fill="#2c3149" p={[w(-hw - 0.05, m.y0 - 0.05), w(hw + 0.05, m.y0 - 0.05), w(hw + 0.05, m.y1 + 0.05), w(-hw - 0.05, m.y1 + 0.05)]} />
      <FPoly o={O} fill="#fdf6e3" p={[w(-hw, m.y0), w(hw, m.y0), w(hw, m.y1), w(-hw, m.y1)]} />
      <FPoly o={O} fill="#2bb3a3" p={[w(-hw + 0.08, m.y1 - 0.2), w(hw - 0.08, m.y1 - 0.2), w(hw - 0.08, m.y1 - 0.08), w(-hw + 0.08, m.y1 - 0.08)]} />
      {[0, 1, 2, 3].map((i) => {
        const y = m.y0 + 0.14 + i * 0.13;
        return (
          <g key={i}>
            <polyline points={pts(O, w(-hw + 0.08, y), w(0.05 - (i % 2) * 0.12, y))} stroke="#c9c0aa" strokeWidth={0.9} />
            <polyline points={pts(O, w(hw - 0.22, y), w(hw - 0.08, y))} stroke="#f26b5b" strokeWidth={0.9} />
          </g>
        );
      })}
    </g>
  );
}

/** Flat View drawing: the same diorama from the front-right, at the same proportions as the 3D set. */
function CanteenFlat({ timeOfDay }: { timeOfDay: Mission['timeOfDay'] }) {
  const night = isNight(timeOfDay);
  const { floor: f, wallZ: wz, wallH, splitX, corridorZ, overhang: oh, upper: up, lockers: lk, notice: nb, fridge: fr } = CT;
  const lit = litPattern(12, night ? 0.6 : 0, 41);
  const windows = [];
  let wi = 0;
  for (let x = -6.8; x < 7.6; x += 1.5) {
    wi++;
    if (x > 4.5 && x < 6.3) continue;
    const on = lit[wi]!;
    windows.push(<FPoly key={x} o={O} fill={on ? '#ffd58a' : night ? '#2b3557' : '#a9c6e8'} p={[[x, 4.35, up.z1], [x + 1.05, 4.35, up.z1], [x + 1.05, 5.4, up.z1], [x, 5.4, up.z1]]} />);
  }
  const colW = (lk.x1 - lk.x0) / lk.cols;
  const rowH = lk.h / lk.rows;
  const lz = wz + lk.depth;
  const clock = flatPoint(O, CT.clock);
  const [cx, , cz] = CT.cooler;
  const bench = CT.bench.at;
  return (
    <g>
      <FlatSky width={W} height={H} timeOfDay={timeOfDay} />
      {/* The classroom storey above the canteen. */}
      <FBox o={O} min={[f.x0, up.y0, up.z0]} max={[f.x1, up.y1, up.z1]} front="#e9e2d0" side="#cfc6b4" top="#8f9ab8" />
      <FPoly o={O} fill={FASCIA} p={[[f.x0, up.y0, up.z1], [f.x1, up.y0, up.z1], [f.x1, up.y0 + 0.22, up.z1], [f.x0, up.y0 + 0.22, up.z1]]} />
      <FBox o={O} min={[f.x0 - 0.05, up.y1, up.z0]} max={[f.x1 + 0.05, up.y1 + 0.22, up.z1 + 0.2]} front={FASCIA} top="#24766f" />
      {windows}
      {/* Slab and floors: terrazzo, corridor tiles, courtyard grass with a path. */}
      <FBox o={O} min={[f.x0, -0.5, f.z0]} max={[f.x1, 0, f.z1]} front="#a69d8f" top={TERRAZZO} side="#8f877b" />
      <FPoly o={O} fill="#b9c6c1" p={[[splitX, 0, f.z0], [f.x1, 0, f.z0], [f.x1, 0, corridorZ], [splitX, 0, corridorZ]]} />
      <FPoly o={O} fill="#5d9a7a" p={[[splitX, 0, corridorZ], [f.x1, 0, corridorZ], [f.x1, 0, f.z1], [splitX, 0, f.z1]]} />
      <FPoly o={O} fill="#c9c3b3" p={[[2.3, 0, corridorZ], [3.5, 0, corridorZ], [3.5, 0, f.z1], [2.3, 0, f.z1]]} />
      <polyline points={pts(O, [splitX, 0, corridorZ], [f.x1, 0, corridorZ])} stroke="#c9c5d4" strokeWidth={1.6} />
      {[-5.6, -4, -2.4, -0.8, 0.8].map((x) => (
        <polyline key={x} points={pts(O, [x, 0, f.z0], [x, 0, f.z1])} stroke="#cfc4b1" strokeWidth={0.5} />
      ))}
      {/* Back wall: paint, dado, high corridor windows, the stairwell door and its exit sign. */}
      <FBox o={O} min={[f.x0, 0, wz - 0.25]} max={[f.x1, wallH, wz]} front={WALL} />
      <FPoly o={O} fill={DADO} p={[[-1.5, 0, wz], [f.x1, 0, wz], [f.x1, 0.95, wz], [-1.5, 0.95, wz]]} />
      {[2.3, 3.5, 4.7, 5.9].map((x) => (
        <FPoly key={x} o={O} fill={night ? '#3a4a78' : '#cfe4f5'} p={[[x, 2.25, wz], [x + 1.05, 2.25, wz], [x + 1.05, 2.95, wz], [x, 2.95, wz]]} />
      ))}
      <FPoly o={O} fill="#2c3149" p={[[CT.stairDoor.x0, 0, wz], [CT.stairDoor.x1, 0, wz], [CT.stairDoor.x1, CT.stairDoor.h, wz], [CT.stairDoor.x0, CT.stairDoor.h, wz]]} />
      <FPoly o={O} fill="#3ccf7a" p={[[7.22, 2.18, wz], [7.68, 2.18, wz], [7.68, 2.4, wz], [7.22, 2.4, wz]]} />
      {/* Stalls: tiled backs, the menu board, fridge, stock pot, then partitions, counters and lightbox signs. */}
      {CT.stalls.map((st) => (
        <g key={st.kind}>
          <FPoly o={O} fill="#f3f0ea" p={[[st.x0, 0, wz], [st.x1, 0, wz], [st.x1, 2.3, wz], [st.x0, 2.3, wz]]} />
          <FPoly o={O} fill={st.color} p={[[st.x0, 1.32, wz], [st.x1, 1.32, wz], [st.x1, 1.42, wz], [st.x0, 1.42, wz]]} />
        </g>
      ))}
      <FBox o={O} min={[fr.x0, 0, wz]} max={[fr.x1, 1.9, wz + 0.55]} front="#e8ebf1" side="#d9dde6" top="#c9cdd6" />
      <FPoly o={O} fill="#d6f0ff" p={[[fr.x0 + 0.06, 0.15, wz + 0.55], [fr.x1 - 0.06, 0.15, wz + 0.55], [fr.x1 - 0.06, 1.8, wz + 0.55], [fr.x0 + 0.06, 1.8, wz + 0.55]]} />
      <FBox o={O} min={[CT.stalls[0].x0 + 0.1, 0, wz]} max={[CT.stalls[0].x1 - 0.1, 0.9, wz + 0.5]} front="#c9cdd6" top="#dfe2e8" />
      <ellipse cx={flatPoint(O, [CT.stalls[0].x0 + 0.7, 1.24, wz + 0.25]).x} cy={flatPoint(O, [CT.stalls[0].x0 + 0.7, 1.24, wz + 0.25]).y} rx={5} ry={2} fill="#c2652c" stroke="#a9afbd" strokeWidth={1.2} />
      {CT.stalls.map((st) => {
        const dark = st.kind === 'drinks' ? '#1f6f67' : '#9c4238';
        return (
          <g key={`${st.kind}-front`}>
            <FBox o={O} min={[st.x0 - 0.08, 0, wz]} max={[st.x0 + 0.02, 2.35, CT.counterZ]} front={dark} />
            <FBox o={O} min={[st.x1 - 0.02, 0, wz]} max={[st.x1 + 0.08, 2.35, CT.counterZ]} front={dark} side={dark} />
            <FBox o={O} min={[st.x0 + 0.02, 0, CT.counterZ - 0.45]} max={[st.x1 - 0.02, 1, CT.counterZ]} front={st.color} top="#c9cdd6" />
            <FBox o={O} min={[st.x0 - 0.03, 2.31, CT.counterZ - 0.06]} max={[st.x1 + 0.03, 2.93, CT.counterZ + 0.04]} front="#fff6e0" side={dark} top={dark} stroke={dark} />
          </g>
        );
      })}
      <FBox o={O} min={[CT.stalls[0].x0 + 0.25, 1, CT.counterZ - 0.4]} max={[CT.stalls[0].x1 - 0.25, 1.3, CT.counterZ - 0.08]} front="#d8ecf2" top="#eaf6fa" />
      {['#f59e42', '#f27aa0', '#7cc47f'].map((c, i) => {
        const p = flatPoint(O, [CT.stalls[1].x0 + 0.45 + i * 0.4, 1, CT.counterZ - 0.24]);
        return <rect key={c} x={p.x - 2.7} y={p.y - 8.4} width={5.4} height={8.4} rx={1.5} fill={c} stroke="#c9cdd6" strokeWidth={0.6} />;
      })}
      <FlatMenu />
      {/* Bin, notice board with its posters (the showcase poster carries a star), the wall clock. */}
      <rect x={flatPoint(O, [-1.32, 0, wz + 0.4]).x} y={flatPoint(O, [-1.32, 0.72, wz + 0.4]).y} width={9.2} height={15} rx={2} fill="#2b8f86" />
      <FBox o={O} min={[nb.x - nb.w / 2 - 0.06, nb.y0 - 0.06, wz]} max={[nb.x + nb.w / 2 + 0.06, nb.y0 + nb.h + 0.06, wz + 0.1]} front="#3d4766" />
      <FPoly o={O} fill="#c9a46b" p={[[nb.x - nb.w / 2, nb.y0, wz + 0.1], [nb.x + nb.w / 2, nb.y0, wz + 0.1], [nb.x + nb.w / 2, nb.y0 + nb.h, wz + 0.1], [nb.x - nb.w / 2, nb.y0 + nb.h, wz + 0.1]]} />
      {(
        [
          [-0.72, 0.1, -0.2, 0.9, '#2bb3a3'],
          [-0.12, 0.5, 0.3, 0.95, '#f4efe6'],
          [-0.12, 0.08, 0.3, 0.42, '#f2c14e'],
          [0.38, 0.14, 0.74, 0.88, '#f4efe6'],
        ] as const
      ).map(([x0, y0, x1, y1, fill], i) => (
        <FPoly key={i} o={O} fill={fill} p={[[nb.x + x0, nb.y0 + y0, wz + 0.1], [nb.x + x1, nb.y0 + y0, wz + 0.1], [nb.x + x1, nb.y0 + y1, wz + 0.1], [nb.x + x0, nb.y0 + y1, wz + 0.1]]} />
      ))}
      <polygon
        points={Array.from({ length: 10 }, (_, k) => {
          const a = Math.PI / 2 + (k * Math.PI) / 5;
          const r = k % 2 === 0 ? 3.6 : 1.6;
          const c = flatPoint(O, [nb.x - 0.46, nb.y0 + 0.6, wz + 0.1]);
          return `${(c.x + Math.cos(a) * r).toFixed(1)},${(c.y - Math.sin(a) * r).toFixed(1)}`;
        }).join(' ')}
        fill="#f2c14e"
      />
      <circle cx={clock.x} cy={clock.y} r={CT.clockR * O.s + 0.8} fill="#fbf8f1" stroke="#3d4766" strokeWidth={1} />
      <polyline points={`${clock.x},${clock.y} ${clock.x + 2.6},${clock.y + 1}`} stroke="#1d2440" strokeWidth={0.9} />
      <polyline points={`${clock.x},${clock.y} ${clock.x - 1.2},${clock.y - 3.6}`} stroke="#1d2440" strokeWidth={0.7} />
      <FlatFan at={CT.fans[0]!.at} />
      {/* Lockers, water cooler and the corridor's end wall. */}
      <FBox o={O} min={[lk.x0, 0, wz]} max={[lk.x1, lk.h, lz]} front="#3f5a8a" top="#7f8fb5" side="#344c78" />
      {Array.from({ length: lk.cols * lk.rows }, (_, i) => {
        const c = i % lk.cols;
        const r = Math.floor(i / lk.cols);
        const x0 = lk.x0 + c * colW + 0.02;
        const x1 = x0 + colW - 0.04;
        const y0 = r * rowH + 0.04;
        const y1 = y0 + rowH - 0.06;
        const fill = c === 3 && r === 1 ? '#2bb3a3' : LOCKERS[(c + r * 2) % LOCKERS.length]!;
        return (
          <g key={i}>
            <FPoly o={O} fill={fill} p={[[x0, y0, lz], [x1, y0, lz], [x1, y1, lz], [x0, y1, lz]]} />
            <polyline points={pts(O, [x1 - 0.07, y0 + rowH * 0.4, lz], [x1 - 0.07, y0 + rowH * 0.55, lz])} stroke="#d9dde6" strokeWidth={0.9} />
          </g>
        );
      })}
      <FBox o={O} min={[cx - 0.23, 0, cz - 0.2]} max={[cx + 0.23, 1.05, cz + 0.2]} front="#eef2f7" top="#c9d3e0" side="#dfe5ee" />
      <FPoly o={O} fill="#7cc4ff" p={[[cx - 0.16, 0.6, cz + 0.2], [cx + 0.16, 0.6, cz + 0.2], [cx + 0.16, 0.95, cz + 0.2], [cx - 0.16, 0.95, cz + 0.2]]} />
      <FBox o={O} min={[CT.endWall.x0, 0, wz]} max={[CT.endWall.x1, wallH, CT.endWall.z1]} front={WALL} side="#d8d0c0" top="#3d4a7a" />
      {/* The cut overhang with its tubes, and the corner pillar with its beam and fan. */}
      <FBox o={O} min={[f.x0, oh.y0, wz]} max={[f.x1, oh.y1, oh.z1]} front={FASCIA} top="#8f9ab8" />
      <FBox o={O} min={[CT.pillar[0] - 0.12, oh.y0, oh.z1]} max={[CT.pillar[0] + 0.12, oh.y1, CT.pillar[2] - 0.2]} front={FASCIA} side={FASCIA} />
      <FBox o={O} min={[CT.pillar[0] - 0.2, 0, CT.pillar[2] - 0.2]} max={[CT.pillar[0] + 0.2, oh.y1, CT.pillar[2] + 0.2]} front={WALL} side="#d8d0c0" top={FASCIA} />
      <FBox o={O} min={[CT.pillar[0] - 0.22, 0, CT.pillar[2] - 0.22]} max={[CT.pillar[0] + 0.22, 0.4, CT.pillar[2] + 0.22]} front={DADO} side="#6a9a92" />
      <FlatFan at={CT.fans[1]!.at} />
      {/* Tables (back row first) and the trays on them. */}
      {CT.tables.map((at, i) => (
        <FlatTable key={i} at={at} seat={i % 2 === 0 ? '#2b9c8f' : '#4f7fc2'} />
      ))}
      {/* Courtyard: the school bench and the planter of shrubs. */}
      <FBox o={O} min={[bench[0] - 0.9, 0.52, bench[2] - 0.25]} max={[bench[0] + 0.9, 0.82, bench[2] - 0.2]} front="#b07a50" />
      <FBox o={O} min={[bench[0] - 0.9, 0.38, bench[2] - 0.2]} max={[bench[0] + 0.9, 0.42, bench[2] + 0.2]} front="#a8744c" top="#c98b5a" />
      <FBox o={O} min={[bench[0] - 0.8, 0, bench[2]]} max={[bench[0] - 0.72, 0.38, bench[2] + 0.1]} front="#4d5470" />
      <FBox o={O} min={[bench[0] + 0.72, 0, bench[2]]} max={[bench[0] + 0.8, 0.38, bench[2] + 0.1]} front="#4d5470" />
      <FBox o={O} min={[CT.planter.x0, 0, CT.planter.z0]} max={[CT.planter.x1, 0.45, CT.planter.z1]} front="#b3adc2" top="#5a4a3e" side="#9a94ab" />
      {[-0.3, 1.0, 2.3].map((z) => {
        const c = flatPoint(O, [(CT.planter.x0 + CT.planter.x1) / 2, 1.05, z]);
        return <circle key={z} cx={c.x} cy={c.y} r={9} fill={z === 1 ? '#5aa88a' : '#3f8f74'} />;
      })}
    </g>
  );
}

const flat: FlatTwin = {
  viewBox: `0 0 ${W} ${H}`,
  Draw: CanteenFlat,
  anchors: flatAnchorsOf(O, CANTEEN_ANCHORS),
  staging: flatStagingOf(O, CANTEEN_ANCHORS, CANTEEN_STAGING),
};

const canteenSet: StagedSetPiece = {
  id: 'canteen',
  name: 'Canteen and locker corridor',
  anchors: CANTEEN_ANCHORS,
  camera: CANTEEN_CAMERA,
  Component: CanteenComponent,
  flat,
  staging: CANTEEN_STAGING,
};

export const canteen: SetPiece = canteenSet;
