import { lazy } from 'react';
import type { Mission } from '@shieldquest/shared';
import type { SetPiece, SetPieceProps } from './types';
import { FC, FOOD_COURT_ANCHORS, FOOD_COURT_CAMERA, FOOD_COURT_OBLIQUE as O, FOOD_COURT_STAGING, stoolsOf } from './parts/food-court.layout';
import { FBox, FPoly, FlatSky, flatAnchorsOf, flatPoint, flatStagingOf, isNight, litPattern, pts } from '../core/flat';
import type { FlatTwin, StagedSetPiece, Vec3 } from '../core/staging';

// S4 Food Court and Pop-up Booth. The 3D geometry is lazy (three.js stays out of the Flat View and the app
// shell); the anchors, camera and Flat View twin below are plain data shared with it (parts/food-court.layout.ts).
const FoodCourt3D = lazy(() => import('./parts/food-court.3d'));

/** Suspends while the 3D chunk loads, so the scene appears all at once (MissionScene covers it with the Flat View). */
function FoodCourtComponent(props: SetPieceProps) {
  return <FoodCourt3D {...props} />;
}

const W = 400;
const H = 250;
const TILE = '#c98c6a';
const WALL = '#efe7d6';
const STEEL = '#4f8f84';
const BOBA = '#e8c9a0';
const BOBA_PINK = '#f4a6c0';

const face = (x0: number, y0: number, x1: number, y1: number, z: number): Vec3[] => [
  [x0, y0, z],
  [x1, y0, z],
  [x1, y1, z],
  [x0, y1, z],
];

/** A horizontal disc (table top, stool seat) as a projected ellipse with a little thickness. */
function FlatDisc({ at, r, y, top, side, h = 0.06 }: { at: Readonly<Vec3>; r: number; y: number; top: string; side: string; h?: number }) {
  const c = flatPoint(O, [at[0], y, at[2]]);
  const rx = r * O.s;
  const ry = r * O.sz;
  return (
    <g>
      <ellipse cx={c.x} cy={c.y + h * O.s} rx={rx} ry={ry} fill={side} />
      <rect x={c.x - rx} y={c.y} width={rx * 2} height={h * O.s} fill={side} />
      <ellipse cx={c.x} cy={c.y} rx={rx} ry={ry} fill={top} />
    </g>
  );
}

/** A round hawker table: back stools, pedestal and top, then front stools (so depth order holds). */
function FlatTable({ at, stool }: { at: Readonly<Vec3>; stool: string }) {
  const stools = stoolsOf(at);
  const seat = (p: Vec3, i: number) => (
    <g key={i}>
      <polyline points={pts(O, [p[0], 0, p[2]], [p[0], 0.4, p[2]])} stroke="#a7a1b4" strokeWidth={4.6} />
      <FlatDisc at={p} r={0.16} y={0.42} top={stool} side="#8d7f78" h={0.03} />
    </g>
  );
  return (
    <g>
      {stools.filter((p) => p[2] < at[2]).map(seat)}
      <polyline points={pts(O, [at[0], 0, at[2]], [at[0], 0.7, at[2]])} stroke="#b9b2a6" strokeWidth={4} />
      <FlatDisc at={at} r={FC.tableR} y={0.77} top="#ebe6dc" side="#c9c1b3" h={0.07} />
      {stools.filter((p) => p[2] >= at[2]).map(seat)}
    </g>
  );
}

/** A ceiling fan, drawn still (the Flat View is a snapshot). */
function FlatFan({ at }: { at: Readonly<Vec3> }) {
  const c = flatPoint(O, at);
  return (
    <g>
      <ellipse cx={c.x} cy={c.y} rx={0.6 * O.s} ry={0.6 * O.sz} fill="#c9cdd6" opacity={0.4} />
      <line x1={c.x - 11} y1={c.y - 2} x2={c.x + 11} y2={c.y + 2} stroke="#c9cdd6" strokeWidth={2.2} strokeLinecap="round" />
      <line x1={c.x - 3} y1={c.y + 5} x2={c.x + 3} y2={c.y - 5} stroke="#c9cdd6" strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={c.x} cy={c.y} r={2} fill="#d9d4c7" />
    </g>
  );
}

/** Flat View drawing: the same diorama from the front-right, at the same proportions as the 3D set. */
function FoodCourtFlat({ timeOfDay }: { timeOfDay: Mission['timeOfDay'] }) {
  const night = isNight(timeOfDay);
  const { floor: f, wallZ: wz, wallH, roof: r, counterZ: cz, shophouses: sh, booth: bo, trayReturn: tr } = FC;
  const lit = litPattern(8, night ? 0.7 : 0, 17);
  const units = Math.round((f.x1 - f.x0) / sh.width);
  const pot = flatPoint(O, FC.pot);
  const qr = FC.qr;
  const midX = (bo.x0 + bo.x1) / 2;
  const crown = flatPoint(O, [midX, bo.h, bo.backZ]);
  const st = FC.standee.at;
  const ring = flatPoint(O, [FC.ringLight.at[0], 1.62, FC.ringLight.at[2]]);
  return (
    <g>
      <FlatSky width={W} height={H} timeOfDay={timeOfDay} />
      {/* The shophouse row behind the roof: pastel fronts, shuttered upstairs windows, tiled roofs. */}
      {Array.from({ length: units }, (_, u) => {
        const x0 = f.x0 + u * sh.width;
        const x1 = x0 + sh.width;
        const c = sh.colors[u % sh.colors.length]!;
        return (
          <g key={u}>
            <FPoly o={O} fill={u % 2 === 0 ? '#c7735a' : '#b8664f'} p={[[x0, sh.y1 - 0.12, sh.z + 0.3], [x1, sh.y1 - 0.12, sh.z + 0.3], [x1, sh.y1 + 0.5, sh.z - 1.2], [x0, sh.y1 + 0.5, sh.z - 1.2]]} />
            <FPoly o={O} fill={c} p={face(x0, sh.y0, x1, sh.y1, sh.z)} />
            <FPoly o={O} fill="#ffffff" opacity={0.35} p={face(x0, sh.y1 - 0.3, x1, sh.y1 - 0.12, sh.z)} />
            {[-0.95, 0.95].map((dx, k) => {
              const cx = (x0 + x1) / 2 + dx;
              if (Math.abs(cx - FC.influenceX) < 0.2) return null;
              const on = lit[u * 2 + k]!;
              return (
                <g key={dx}>
                  <FPoly o={O} fill="#6d6f86" p={face(cx - 0.86, 4.3, cx + 0.86, 5.5, sh.z)} />
                  <FPoly o={O} fill={on ? '#ffd58a' : night ? '#2b3557' : '#bcd3ea'} p={face(cx - 0.55, 4.3, cx + 0.55, 5.5, sh.z)} />
                </g>
              );
            })}
          </g>
        );
      })}
      {/* Underside of the zinc roof's back slope (seen through the cut), with its ribs. */}
      <FPoly o={O} fill="#d6dae2" p={[[r.x0, r.backY, r.backZ], [r.x1, r.backY, r.backZ], [r.x1, r.ridgeY, r.ridgeZ], [r.x0, r.ridgeY, r.ridgeZ]]} />
      {Array.from({ length: 19 }, (_, i) => {
        const x = r.x0 + 0.4 + i * 0.8;
        return <polyline key={i} points={pts(O, [x, r.backY, r.backZ], [x, r.ridgeY, r.ridgeZ])} stroke="#b9bfcc" strokeWidth={1.2} />;
      })}
      {/* Back wall, slab and quarry-tile floor with the front drain. */}
      <FPoly o={O} fill={WALL} p={face(f.x0, 0, f.x1, wallH, wz)} />
      <FPoly o={O} fill={STEEL} p={face(f.x0, 2.95, f.x1, 3.15, wz)} />
      <FBox o={O} min={[f.x0, -0.5, f.z0]} max={[f.x1, 0, f.z1]} front="#8f6550" top={TILE} side="#7d5848" />
      {[-5.2, -2.8, -0.4, 2.0, 4.4].map((x) => (
        <polyline key={x} points={pts(O, [x, 0, f.z0], [x, 0, f.z1 - 0.3])} stroke="#d9a27f" strokeWidth={0.7} />
      ))}
      {[-3.4, -1.0, 1.4].map((z) => (
        <polyline key={z} points={pts(O, [f.x0, 0, z], [f.x1, 0, z])} stroke="#d9a27f" strokeWidth={0.7} />
      ))}
      <FPoly o={O} fill="#6d6f86" p={[[f.x0, 0, f.z1], [f.x1, 0, f.z1], [f.x1, 0, f.z1 - 0.3], [f.x0, 0, f.z1 - 0.3]]} />
      {/* Stalls: tiled backs, partitions, counters and lightbox signs, with their wares. */}
      {FC.stalls.map((s) => {
        const dark = s.kind === 'drinks' ? '#1f6f67' : s.kind === 'nasi-lemak' ? '#3c7447' : s.kind === 'laksa' ? '#a86a26' : '#9c4238';
        return (
          <g key={s.kind}>
            <FPoly o={O} fill="#f3f0ea" p={face(s.x0, 0, s.x1, 2.3, wz)} />
            <FPoly o={O} fill={s.color} p={face(s.x0, 1.32, s.x1, 1.42, wz)} />
            <FBox o={O} min={[s.x0 + 0.1, 0, wz]} max={[s.x1 - 0.1, 0.9, wz + 0.5]} front="#c9cdd6" top="#dfe2e8" />
            <FBox o={O} min={[s.x0 - 0.05, 0, wz]} max={[s.x0 + 0.05, 2.3, cz]} front={dark} side={dark} />
            <FBox o={O} min={[s.x0 + 0.05, 0, cz - 0.5]} max={[s.x1 - 0.05, 1, cz]} front={s.color} top="#c9cdd6" />
            <FBox o={O} min={[s.x0 + 0.02, 2.3, cz - 0.12]} max={[s.x1 - 0.02, 2.88, cz]} front="#fff6e0" side={dark} top={dark} stroke={dark} />
          </g>
        );
      })}
      <FBox o={O} min={[2.75, 0, wz]} max={[2.85, 2.3, cz]} front="#3c7447" side="#3c7447" />
      <ellipse cx={pot.x} cy={pot.y} rx={5.6} ry={2.2} fill="#c2652c" stroke="#a9afbd" strokeWidth={1.2} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={pot.x + (i - 1) * 2.4} cy={pot.y - 8 - i * 6} r={2.6 + i} fill="#ffffff" opacity={0.75 - i * 0.18} />
      ))}
      <FBox o={O} min={[-6.9, 1, cz - 0.45]} max={[-5.9, 1.6, cz - 0.08]} front="#e3f3f8" top="#eaf6fa" />
      {[0, 1, 2].map((i) => {
        const c = flatPoint(O, [-6.7 + i * 0.3, 1.3, cz - 0.08]);
        return <ellipse key={i} cx={c.x} cy={c.y} rx={2.2} ry={3} fill="#d9823b" />;
      })}
      <FBox o={O} min={[-0.5, 0, wz]} max={[0.15, 1.85, wz + 0.55]} front="#d6f0ff" side="#d9dde6" top="#c9cdd6" />
      {[0, 1, 2, 3, 4].map((i) => {
        const c = flatPoint(O, [0.75 + i * 0.22, 1.0, cz - 0.22]);
        return <polygon key={i} points={`${c.x - 2.2},${c.y} ${c.x + 2.2},${c.y} ${c.x},${c.y - 3}`} fill="#3f8f4a" />;
      })}
      {/* Tray-return station and its trolley. */}
      <FBox o={O} min={[tr.x0, 0, wz]} max={[tr.x1, tr.h, tr.z1]} front="#2f9e6e" top="#c9cdd6" side="#226f50" />
      {[0, 1, 2].map((i) => (
        <FPoly key={i} o={O} fill="#1f4f45" p={face(tr.x0 + 0.12, 0.25 + i * 0.4, tr.x1 - 0.12, 0.49 + i * 0.4, tr.z1)} />
      ))}
      <FPoly o={O} fill="#e9fff4" p={face(tr.x0, 1.6, tr.x1, 2.05, wz + 0.1)} stroke="#226f50" />
      <FBox o={O} min={[2.98, 0.1, -4.78]} max={[3.47, 0.95, -4.32]} front="#2bb3a3" top="#9aa3b5" />
      {/* Boba Boleh pop-up: backdrop with its cup, arched crown and wings; counter; standee; ring light. */}
      <path d={`M ${crown.x - (bo.x1 - bo.x0) / 2 * O.s} ${crown.y} A ${((bo.x1 - bo.x0) / 2) * O.s} ${0.55 * O.s} 0 0 1 ${crown.x + ((bo.x1 - bo.x0) / 2) * O.s} ${crown.y} Z`} fill={BOBA_PINK} />
      <FBox o={O} min={[bo.x0, 0, bo.backZ - 0.12]} max={[bo.x1, bo.h, bo.backZ]} front={BOBA} side="#b99b73" />
      <FPoly o={O} fill={BOBA_PINK} p={face(bo.x0, 0.9, bo.x1, 1.05, bo.backZ)} />
      <FPoly o={O} fill="#fffaf2" p={[[midX - 0.28, 1.2, bo.backZ], [midX + 0.28, 1.2, bo.backZ], [midX + 0.38, 2.2, bo.backZ], [midX - 0.38, 2.2, bo.backZ]]} />
      <FPoly o={O} fill={BOBA_PINK} p={face(midX - 0.42, 2.2, midX + 0.42, 2.3, bo.backZ)} />
      <polyline points={pts(O, [midX + 0.09, 2.3, bo.backZ], [midX + 0.26, 2.7, bo.backZ])} stroke="#e8505b" strokeWidth={1.8} />
      {[0, 1, 2, 3].map((i) => {
        const c = flatPoint(O, [midX - 0.18 + i * 0.12, 1.32, bo.backZ]);
        return <circle key={i} cx={c.x} cy={c.y} r={1.2} fill="#5a3b2e" />;
      })}
      <FBox o={O} min={[bo.x1, 0, bo.backZ - 0.12]} max={[bo.x1 + 0.1, bo.h, bo.backZ + 0.55]} front={BOBA_PINK} side={BOBA_PINK} />
      <FBox o={O} min={[bo.counter.x0, 0, bo.counter.z0]} max={[bo.counter.x1, 1, bo.counter.z1]} front={BOBA_PINK} top="#fff6e0" side="#c47f97" />
      <FPoly o={O} fill="#fff6e0" p={face(st[0] - 0.28, 0.05, st[0] + 0.28, 1.55, st[2])} stroke="#c9cdd6" />
      <FPoly o={O} fill={BOBA_PINK} p={face(st[0] - 0.26, 1.28, st[0] + 0.26, 1.52, st[2])} />
      <FPoly o={O} fill="#1d2440" p={face(st[0] - 0.14, 0.85, st[0] + 0.06, 1.03, st[2])} />
      <polyline points={pts(O, [FC.ringLight.at[0], 0, FC.ringLight.at[2]], [FC.ringLight.at[0], 1.45, FC.ringLight.at[2]])} stroke="#3d4766" strokeWidth={1} />
      <circle cx={ring.x} cy={ring.y} r={4.2} fill="none" stroke="#fffdf5" strokeWidth={1.6} />
      {/* Back row of tables, then the pillars, then the front row (depth order). */}
      {FC.tables.slice(0, 3).map((at, i) => (
        <FlatTable key={i} at={at} stool={i % 2 === 0 ? '#e07a5f' : '#2bb3a3'} />
      ))}
      {FC.pillars.map((p) => (
        <g key={p[0]}>
          <FBox o={O} min={[p[0] - 0.13, 0, p[2] - 0.13]} max={[p[0] + 0.13, r.ridgeY - 0.12, p[2] + 0.13]} front={STEEL} side="#3f7a70" />
          <FPoly o={O} fill="#fff6e0" p={face(p[0] - 0.1, 1.45, p[0] + 0.1, 1.7, p[2] + 0.13)} />
        </g>
      ))}
      {FC.tables.slice(3).map((at, i) => (
        <FlatTable key={i} at={at} stool={(i + 3) % 2 === 0 ? '#e07a5f' : '#2bb3a3'} />
      ))}
      <FPoly o={O} fill="#e8505b" p={[[qr[0] - 0.12, qr[1], qr[2] + 0.12], [qr[0] + 0.12, qr[1], qr[2] + 0.12], [qr[0] + 0.12, qr[1], qr[2] - 0.12], [qr[0] - 0.12, qr[1], qr[2] - 0.12]]} />
      <FPoly o={O} fill="#ffffff" p={[[qr[0] - 0.08, qr[1], qr[2] + 0.08], [qr[0] + 0.08, qr[1], qr[2] + 0.08], [qr[0] + 0.08, qr[1], qr[2] - 0.08], [qr[0] - 0.08, qr[1], qr[2] - 0.08]]} />
      {/* Ridge beam, fans and the gable trusses at both ends. */}
      <polyline points={pts(O, [r.x0, r.ridgeY - 0.03, r.ridgeZ], [r.x1, r.ridgeY - 0.03, r.ridgeZ])} stroke={STEEL} strokeWidth={4} />
      {FC.fans.map((p) => (
        <FlatFan key={p[0]} at={p} />
      ))}
      {[r.x0 + 0.1, r.x1 - 0.1].map((x) => (
        <g key={x}>
          <polyline points={pts(O, [x, r.backY, r.backZ], [x, r.ridgeY, r.ridgeZ], [x, r.frontY, r.frontZ], [x, 0, r.frontZ])} fill="none" stroke={STEEL} strokeWidth={2.2} strokeLinejoin="round" />
          <polyline points={pts(O, [x, r.frontY, r.frontZ], [x, r.backY, r.backZ])} stroke={STEEL} strokeWidth={1.2} />
        </g>
      ))}
    </g>
  );
}

const flat: FlatTwin = {
  viewBox: `0 0 ${W} ${H}`,
  Draw: FoodCourtFlat,
  anchors: flatAnchorsOf(O, FOOD_COURT_ANCHORS),
  staging: flatStagingOf(O, FOOD_COURT_ANCHORS, FOOD_COURT_STAGING),
};

const foodCourtSet: StagedSetPiece = {
  id: 'food-court',
  name: 'Food court and pop-up booth',
  anchors: FOOD_COURT_ANCHORS,
  camera: FOOD_COURT_CAMERA,
  Component: FoodCourtComponent,
  flat,
  staging: FOOD_COURT_STAGING,
};

export const foodCourt: SetPiece = foodCourtSet;
