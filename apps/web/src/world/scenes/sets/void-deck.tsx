import { lazy } from 'react';
import type { Mission } from '@shieldquest/shared';
import type { SetPiece, SetPieceProps } from './types';
import {
  VD,
  VOID_DECK_ANCHORS,
  VOID_DECK_CAMERA,
  VOID_DECK_OBLIQUE as O,
  VOID_DECK_STAGING,
} from '../core/layout/void-deck';
import { FBox, FPoly, FlatSky, flatAnchorsOf, flatPoint, flatStagingOf, isNight, litPattern, pts } from '../core/flat';
import type { FlatTwin, StagedSetPiece } from '../core/staging';

// S5 Neon Void Deck and Phone Kiosk. The 3D geometry is lazy (three.js stays out of the Flat View and the app
// shell); the anchors, camera and Flat View twin below are plain data shared with it (core/layout/void-deck.ts).
const VoidDeck3D = lazy(() => import('../core/sets3d/void-deck'));

/** Suspends while the 3D chunk loads, so the scene appears all at once (MissionScene covers it with the Flat View). */
function VoidDeckComponent(props: SetPieceProps) {
  return <VoidDeck3D {...props} />;
}

const W = 400;
const H = 250;
const WALL = '#e6dfd0';
const DADO = '#7fa4a8';
const SECTION = '#3d3a66';
const FLOOR = '#b3adc2';

/** Flat View drawing: the same diorama from the front-right, at the same proportions as the 3D set. */
function VoidDeckFlat({ timeOfDay }: { timeOfDay: Mission['timeOfDay'] }) {
  const night = isNight(timeOfDay);
  const { deck, lift, letterboxes: lb, notice: nb, kiosk: k } = VD;
  const wz = VD.wallZ;
  const lit = litPattern(30, night ? 0.42 : 0.12, 23);
  const windows = [];
  for (let f = 0; f < 3; f++) {
    for (let c = 0; c < 10; c++) {
      const xc = -6.9 + 1.38 * (c + 0.5);
      const y0 = 3 + f * 2.4 + 0.67;
      const on = lit[f * 10 + c];
      windows.push(
        <FPoly key={`${f}-${c}`} o={O} fill={on ? '#ffd58a' : '#2b3557'} p={[[xc - 0.38, y0, wz], [xc + 0.38, y0, wz], [xc + 0.38, y0 + 1.15, wz], [xc - 0.38, y0 + 1.15, wz]]} />,
      );
    }
  }
  const doorX = (lift.x0 + lift.x1) / 2;
  const kx = k.at[0];
  const kz = k.at[2];
  const kFront = kz + k.depth / 2;
  const kBack = kz - k.depth / 2;
  const tubeGlow = night ? 0.9 : 0.35;
  const table = flatPoint(O, VD.table);
  const stool = (p: readonly [number, number, number], key: string) => {
    const c = flatPoint(O, p);
    return (
      <g key={key}>
        <rect x={c.x - 4} y={c.y - 10} width={8} height={10} fill="#a8a196" />
        <ellipse cx={c.x} cy={c.y - 10} rx={4.6} ry={2} fill="#cfc8b8" />
      </g>
    );
  };
  return (
    <g>
      <FlatSky width={W} height={H} timeOfDay={timeOfDay} />
      {/* The slab block above the void deck, cut away in front. */}
      <FBox o={O} min={[-7.5, 3, -8]} max={[7.5, 10.4, wz]} front="#d8d2e6" side="#b9b2cf" />
      {windows}
      <FBox o={O} min={[-7.5, 3, -8]} max={[-7, 10.4, wz + 0.08]} front="#8a6cf0" />
      <FBox o={O} min={[7, 3, -8]} max={[7.5, 10.4, wz + 0.08]} front="#8a6cf0" side="#6b52c4" />
      {/* Ground outside: grass, the path, then the deck slab and its tiled floor. */}
      <FPoly o={O} fill="#4d8a6e" p={[[-10, -0.14, 7.4], [10, -0.14, 7.4], [10, -0.14, deck.z1], [-10, -0.14, deck.z1]]} />
      <FPoly o={O} fill="#7d7a96" p={[[-10, -0.13, 4.3], [10, -0.13, 4.3], [10, -0.13, 2.9], [-10, -0.13, 2.9]]} />
      <FBox o={O} min={[deck.x0, -0.6, deck.z0]} max={[deck.x1, 0, deck.z1]} front="#857f99" top={FLOOR} side="#6f6a86" />
      {[-4, -2, 0, 2, 4].map((x) => (
        <polyline key={x} points={pts(O, [x, 0, deck.z0], [x, 0, deck.z1])} stroke="#a39db5" strokeWidth={0.6} />
      ))}
      <FPoly o={O} fill="#8f8aa6" p={[[lift.x0, 0.001, lift.z1 + 0.6], [lift.x1, 0.001, lift.z1 + 0.6], [lift.x1, 0.001, deck.z0], [lift.x0, 0.001, deck.z0]]} />
      {/* Light pools baked into the floor (fluorescent tubes, the neon kiosk). */}
      {[-4.6, -1.5, 1.6, 4.5].map((x) => {
        const c = flatPoint(O, [x, 0, -2.1]);
        return <ellipse key={x} cx={c.x} cy={c.y} rx={36} ry={11} fill="#f2f7ff" opacity={0.22 * tubeGlow} />;
      })}
      <ellipse cx={flatPoint(O, [3.7, 0, -0.3]).x} cy={flatPoint(O, [3.7, 0, -0.3]).y} rx={58} ry={17} fill="#a58cff" opacity={night ? 0.35 : 0.14} />
      {/* Back wall: dado tiles below, paint above. */}
      <FBox o={O} min={[deck.x0, 0, wz - 0.25]} max={[deck.x1, 1.1, wz]} front={DADO} />
      <FBox o={O} min={[deck.x0, 1.1, wz - 0.25]} max={[deck.x1, VD.wallH, wz]} front={WALL} />
      {/* Lift lobby: lift doors, floor indicator, call button and alcove walls. */}
      <FPoly o={O} fill="#8d879f" p={[[doorX - 0.75, 0, wz], [doorX + 0.75, 0, wz], [doorX + 0.75, 2.35, wz], [doorX - 0.75, 2.35, wz]]} />
      <FPoly o={O} fill="#c3cad8" p={[[doorX - 0.6, 0, wz], [doorX - 0.02, 0, wz], [doorX - 0.02, 2.15, wz], [doorX - 0.6, 2.15, wz]]} />
      <FPoly o={O} fill="#b7bfce" p={[[doorX + 0.02, 0, wz], [doorX + 0.6, 0, wz], [doorX + 0.6, 2.15, wz], [doorX + 0.02, 2.15, wz]]} />
      <FPoly o={O} fill="#ffb35c" p={[[doorX - 0.18, 2.42, wz], [doorX + 0.18, 2.42, wz], [doorX + 0.18, 2.62, wz], [doorX - 0.18, 2.62, wz]]} />
      <FPoly o={O} fill="#ffd58a" p={[[doorX + 0.85, 1.05, wz], [doorX + 0.97, 1.05, wz], [doorX + 0.97, 1.3, wz], [doorX + 0.85, 1.3, wz]]} />
      <FBox o={O} min={[lift.x0 - 0.2, 0, wz]} max={[lift.x0, VD.wallH, lift.z1]} front={SECTION} side="#d8d0c2" />
      <FBox o={O} min={[lift.x1, 0, wz]} max={[lift.x1 + 0.25, VD.wallH, lift.z1]} front={SECTION} />
      {/* Letterboxes. */}
      <FBox o={O} min={[lb.x0 - 0.06, lb.y0 - 0.06, wz]} max={[lb.x1 + 0.06, lb.y1 + 0.06, wz + 0.32]} front="#8f8ca6" top="#a9a6bd" side="#7c7a92" />
      {Array.from({ length: 30 }, (_, i) => {
        const c = i % 6;
        const r = Math.floor(i / 6);
        const x0 = lb.x0 + ((lb.x1 - lb.x0) * c) / 6 + 0.03;
        const x1 = lb.x0 + ((lb.x1 - lb.x0) * (c + 1)) / 6 - 0.03;
        const y0 = lb.y0 + ((lb.y1 - lb.y0) * r) / 5 + 0.03;
        const y1 = lb.y0 + ((lb.y1 - lb.y0) * (r + 1)) / 5 - 0.03;
        const z = wz + 0.32;
        return <FPoly key={i} o={O} fill={(c * 7 + r * 3) % 5 === 0 ? '#cfd6e4' : '#bfc6d6'} p={[[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]} />;
      })}
      {/* Notice board with posters (and the community poster's QR square). */}
      <FPoly o={O} fill="#5c6680" p={[[nb.x - 0.86, nb.y0 - 0.06, wz + 0.1], [nb.x + 0.86, nb.y0 - 0.06, wz + 0.1], [nb.x + 0.86, nb.y0 + nb.h + 0.06, wz + 0.1], [nb.x - 0.86, nb.y0 + nb.h + 0.06, wz + 0.1]]} />
      <FPoly o={O} fill="#c9b48f" p={[[nb.x - 0.8, nb.y0, wz + 0.1], [nb.x + 0.8, nb.y0, wz + 0.1], [nb.x + 0.8, nb.y0 + nb.h, wz + 0.1], [nb.x - 0.8, nb.y0 + nb.h, wz + 0.1]]} />
      {(
        [
          [-0.72, 0.08, -0.12, 0.92, '#2bb3a3'],
          [-0.04, 0.5, 0.36, 0.95, '#f4efe6'],
          [-0.04, 0.1, 0.36, 0.44, '#f2c14e'],
          [0.42, 0.12, 0.74, 0.86, '#f4efe6'],
          [-0.62, 0.16, -0.36, 0.42, '#f4efe6'],
          [-0.58, 0.2, -0.4, 0.38, '#1d2440'],
        ] as const
      ).map(([x0, y0, x1, y1, fill], i) => (
        <FPoly key={i} o={O} fill={fill} p={[[nb.x + x0, nb.y0 + y0, wz + 0.1], [nb.x + x1, nb.y0 + y0, wz + 0.1], [nb.x + x1, nb.y0 + y1, wz + 0.1], [nb.x + x0, nb.y0 + y1, wz + 0.1]]} />
      ))}
      {/* The cut overhang and its fluorescent tubes. */}
      <FBox o={O} min={[deck.x0, VD.wallH, wz]} max={[deck.x1, VD.wallH + 0.32, -1.6]} front={SECTION} top="#8f8aa6" />
      {[-4.6, -1.5, 1.6, 4.5].map((x) => (
        <FPoly key={x} o={O} fill="#eef6ff" opacity={0.4 + 0.6 * tubeGlow} p={[[x - 0.62, 2.9, -1.62], [x + 0.62, 2.9, -1.62], [x + 0.62, 2.97, -1.62], [x - 0.62, 2.97, -1.62]]} />
      ))}
      {/* Back bench. */}
      <FBox o={O} min={[-0.9, 0.38, -3.18]} max={[0.7, 0.44, -2.82]} front="#7d5670" top="#9c6b8a" />
      <FBox o={O} min={[-0.8, 0, -2.95]} max={[-0.7, 0.38, -2.85]} front="#4d5470" />
      <FBox o={O} min={[0.5, 0, -2.95]} max={[0.6, 0.38, -2.85]} front="#4d5470" />
      {/* Neon phone-accessory kiosk (drawn square-on). */}
      <FBox o={O} min={[kx - 1.15, 0, kBack]} max={[kx + 1.15, 2.5, kBack + 0.15]} front={night ? '#c8b6ff' : '#9b86e6'} side="#3f2c86" />
      {Array.from({ length: 12 }, (_, i) => {
        const c = i % 6;
        const r = Math.floor(i / 6);
        const x = kx - 0.85 + c * 0.34;
        const y = 1.35 + r * 0.4;
        const fill = ['#ff7ab0', '#2bb3a3', '#f2c14e', '#7cc4ff', '#f4efe6', '#ff4d8d'][(r * 2 + c) % 6]!;
        return <FPoly key={i} o={O} fill={fill} p={[[x - 0.09, y, kBack + 0.16], [x + 0.09, y, kBack + 0.16], [x + 0.09, y + 0.28, kBack + 0.16], [x - 0.09, y + 0.28, kBack + 0.16]]} />;
      })}
      <FBox o={O} min={[kx - 1.15, 0, kBack]} max={[kx - 1.03, 2.5, kFront]} front="#3f2c86" />
      <FBox o={O} min={[kx + 1.03, 0, kBack]} max={[kx + 1.15, 2.5, kFront]} front="#3f2c86" side="#33246e" />
      <FBox o={O} min={[kx - 1.15, 2.6, kBack + 0.1]} max={[kx + 1.15, 3.1, kBack + 0.3]} front="#f4efe6" top="#3f2c86" />
      <polyline points={pts(O, [kx - 1.15, 3.12, kBack + 0.3], [kx + 1.15, 3.12, kBack + 0.3])} stroke="#ff7ab0" strokeWidth={1.4} />
      <rect x={flatPoint(O, [kx - 0.13, 3.02, kBack + 0.3]).x} y={flatPoint(O, [kx, 3.02, kBack + 0.3]).y} width={6.2} height={8} rx={1.4} fill="none" stroke="#8a6cf0" strokeWidth={1.2} />
      {Array.from({ length: 8 }, (_, i) => {
        const x0 = kx - 1.25 + (2.5 * i) / 8;
        const x1 = kx - 1.25 + (2.5 * (i + 1)) / 8;
        return <FPoly key={i} o={O} fill={i % 2 === 0 ? '#f4efe6' : '#8a6cf0'} p={[[x0, 2.2, kFront + 0.4], [x1, 2.2, kFront + 0.4], [x1, 2.6, kBack], [x0, 2.6, kBack]]} />;
      })}
      <FBox o={O} min={[kx - 1.15, 0, kFront - 0.5]} max={[kx + 1.15, 1, kFront]} front="#7a5fd6" top="#efe9df" side="#5a3fb8" />
      <polyline points={pts(O, [kx - 1.1, 0.95, kFront], [kx + 1.1, 0.95, kFront])} stroke="#c4a8ff" strokeWidth={1.3} />
      {/* The stone table and its four stools (back ones first). */}
      {VD.stools.filter((s) => s[2] < VD.table[2]).map((s, i) => stool(s, `b${i}`))}
      <rect x={table.x - 4} y={table.y - 17} width={8} height={17} fill="#a8a196" />
      <ellipse cx={table.x} cy={table.y - 17} rx={15} ry={5.5} fill="#d8d2c4" stroke="#b3ab9b" strokeWidth={0.6} />
      {VD.stools.filter((s) => s[2] >= VD.table[2]).map((s, i) => stool(s, `f${i}`))}
      {/* Front bench. */}
      <FBox o={O} min={[VD.bench.at[0] - 0.9, 0.52, VD.bench.at[2] - 0.25]} max={[VD.bench.at[0] + 0.9, 0.82, VD.bench.at[2] - 0.2]} front="#b07a50" />
      <FBox o={O} min={[VD.bench.at[0] - 0.9, 0.38, VD.bench.at[2] - 0.2]} max={[VD.bench.at[0] + 0.9, 0.44, VD.bench.at[2] + 0.2]} front="#a8744c" top="#c98b5a" />
      <FBox o={O} min={[VD.bench.at[0] - 0.8, 0, VD.bench.at[2]]} max={[VD.bench.at[0] - 0.72, 0.38, VD.bench.at[2] + 0.1]} front="#4d5470" />
      <FBox o={O} min={[VD.bench.at[0] + 0.72, 0, VD.bench.at[2]]} max={[VD.bench.at[0] + 0.8, 0.38, VD.bench.at[2] + 0.1]} front="#4d5470" />
      {/* Front pillars (cut at the overhang) with the block number plate, and a litter bin. */}
      {VD.pillars.map(([x, , z]) => (
        <g key={x}>
          <FBox o={O} min={[x - 0.28, 0, z - 0.28]} max={[x + 0.28, VD.wallH + 0.32, z + 0.28]} front={WALL} top={SECTION} side="#cfc7b8" />
          <FBox o={O} min={[x - 0.3, 0, z - 0.3]} max={[x + 0.3, 0.45, z + 0.3]} front="#8d879f" side="#77728c" />
        </g>
      ))}
      <FPoly o={O} fill="#2a2f6b" p={[[1.36, 2.38, 1.89], [1.84, 2.38, 1.89], [1.84, 2.72, 1.89], [1.36, 2.72, 1.89]]} />
      <FBox o={O} min={[2.03, 0, 1.47]} max={[2.47, 0.85, 1.93]} front="#2bb3a3" top="#1d2440" side="#22917f" />
      {/* Street lamp and a tree at the edge. */}
      <polyline points={pts(O, [VD.lamp[0], -0.14, VD.lamp[2]], [VD.lamp[0], 4.6, VD.lamp[2]], [VD.lamp[0], 4.6, VD.lamp[2] - 0.95])} fill="none" stroke="#59607a" strokeWidth={2} />
      <circle cx={flatPoint(O, [VD.lamp[0], 4.5, VD.lamp[2] - 0.95]).x} cy={flatPoint(O, [VD.lamp[0], 4.5, VD.lamp[2] - 0.95]).y} r={night ? 9 : 3} fill="#ffd58a" opacity={night ? 0.45 : 0.9} />
      <circle cx={flatPoint(O, [VD.lamp[0], 4.5, VD.lamp[2] - 0.95]).x} cy={flatPoint(O, [VD.lamp[0], 4.5, VD.lamp[2] - 0.95]).y} r={3} fill="#fff1c9" />
      <rect x={flatPoint(O, [-7.6, 0, 5.4]).x - 2.5} y={flatPoint(O, [-7.6, 2.1, 5.4]).y} width={5} height={50} fill="#7a5a48" />
      <circle cx={flatPoint(O, [-7.6, 3, 5.4]).x} cy={flatPoint(O, [-7.6, 3, 5.4]).y} r={24} fill="#3f8f74" />
      <circle cx={flatPoint(O, [-7.1, 3.6, 5.4]).x} cy={flatPoint(O, [-7.1, 3.6, 5.4]).y} r={14} fill="#5aa88a" />
    </g>
  );
}

const flatStaging = flatStagingOf(O, VOID_DECK_ANCHORS, VOID_DECK_STAGING);

const flat: FlatTwin = {
  viewBox: `0 0 ${W} ${H}`,
  Draw: VoidDeckFlat,
  anchors: flatAnchorsOf(O, VOID_DECK_ANCHORS),
  staging: flatStaging,
};

const voidDeckSet: StagedSetPiece = {
  id: 'void-deck',
  name: 'Neon void deck',
  anchors: VOID_DECK_ANCHORS,
  camera: VOID_DECK_CAMERA,
  Component: VoidDeckComponent,
  flat,
  staging: VOID_DECK_STAGING,
};

export const voidDeck: SetPiece = voidDeckSet;
