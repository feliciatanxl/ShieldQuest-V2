import { lazy, useId } from 'react';
import type { SetPiece, SetPieceProps } from './types';
import {
  DIGI_SKY_ANCHORS,
  DIGI_SKY_CAMERA,
  DIGI_SKY_OBLIQUE as O,
  DIGI_SKY_STAGING,
  DS,
  DS_BUBBLES,
  DS_LANTERN_POSTS,
  DS_LANTERNS,
} from './parts/digi-sky.layout';
import { FBox, FPoly, flatAnchorsOf, flatPoint, flatStagingOf, pts } from '../core/flat';
import type { FlatTwin, StagedSetPiece, Vec3 } from '../core/staging';

// S6 Digi Sky: the online city as a glowing night sky layer. The 3D geometry is lazy (three.js stays out of the
// Flat View and the app shell); the anchors, camera and Flat View twin below are plain data shared with it
// (parts/digi-sky.layout.ts). The Digi Sky is always night: its drawing ignores the mission's time of day.
const DigiSky3D = lazy(() => import('./parts/digi-sky.3d'));

/** Suspends while the 3D chunk loads, so the scene appears all at once (MissionScene covers it with the Flat View). */
function DigiSkyComponent(props: SetPieceProps) {
  return <DigiSky3D {...props} />;
}

const W = 400;
const H = 250;
const TOP = '#232a5e';
const UNDER = '#272b68';
const VIOLET = '#8a6cf0';
const TEAL = '#2bd4c0';
const MAGENTA = '#ff5fa2';
const GOLD = '#f2c14e';
const CARD = '#b98b5a';
const STICK = '#8a6a48';
const GLASS = '#1b1f4a';

/** Direction towards the viewer in the oblique projection: faces whose normal points this way are drawn. */
const VIEW: Vec3 = [-O.sx / O.s, O.sz / O.s, 1];

/** Maps a point in a prop's own frame (facing +z, turned by `yaw`, standing at `at`) to world space. */
function frame(at: Readonly<Vec3>, yaw: number) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return (x: number, y: number, z: number): Vec3 => [at[0] + x * c + z * s, at[1] + y, at[2] - x * s + z * c];
}

/** A box in a prop's own frame: only the faces turned towards the viewer (a convex box needs no sorting). */
function RBox({ at, yaw, min, max, front, side, top, back }: { at: Readonly<Vec3>; yaw: number; min: Vec3; max: Vec3; front: string; side?: string; top?: string; back?: string }) {
  const f = frame(at, yaw);
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const turn = (n: Vec3): Vec3 => [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c];
  const faces: { n: Vec3; p: Vec3[]; fill: string }[] = [
    { n: [0, 0, 1], p: [f(x0, y0, z1), f(x1, y0, z1), f(x1, y1, z1), f(x0, y1, z1)], fill: front },
    { n: [0, 0, -1], p: [f(x1, y0, z0), f(x0, y0, z0), f(x0, y1, z0), f(x1, y1, z0)], fill: back ?? side ?? front },
    { n: [1, 0, 0], p: [f(x1, y0, z1), f(x1, y0, z0), f(x1, y1, z0), f(x1, y1, z1)], fill: side ?? front },
    { n: [-1, 0, 0], p: [f(x0, y0, z0), f(x0, y0, z1), f(x0, y1, z1), f(x0, y1, z0)], fill: side ?? front },
    { n: [0, 1, 0], p: [f(x0, y1, z1), f(x1, y1, z1), f(x1, y1, z0), f(x0, y1, z0)], fill: top ?? side ?? front },
  ];
  return (
    <g>
      {faces
        .filter(({ n }) => {
          const w = turn(n);
          return w[0] * VIEW[0] + w[1] * VIEW[1] + w[2] * VIEW[2] > 0.02;
        })
        .map(({ p, fill }, i) => (
          <FPoly key={i} o={O} fill={fill} p={p} />
        ))}
    </g>
  );
}

/** Five-point star polygon centred on a projected point. */
function starPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 10 }, (_, k) => {
    const a = Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? r : r * 0.45;
    return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy - Math.sin(a) * rr).toFixed(1)}`;
  }).join(' ');
}

/** A floating hexagonal island: crystal underside, glowing rim band and the flat top with an inner ring. */
function FlatIsland({ at, r, rim, depth }: { at: Readonly<Vec3>; r: number; rim: string; depth?: number }) {
  const v = (i: number, y: number, k = 1): Vec3 => [at[0] + Math.cos((i * Math.PI) / 3) * r * k, at[1] + y, at[2] + Math.sin((i * Math.PI) / 3) * r * k];
  const d = depth ?? 1.2 + r * 0.45;
  const front = [0, 1, 2, 3];
  return (
    <g>
      <polygon points={pts(O, ...front.map((i) => v(i, -0.22)), [at[0], at[1] - d, at[2]])} fill={UNDER} />
      <polygon points={pts(O, ...front.map((i) => v(i, -0.22)).reverse(), [at[0] - r * 0.3, at[1] - d * 0.55, at[2] + r * 0.2])} fill="#232661" opacity={0.7} />
      <polygon points={pts(O, ...front.map((i) => v(i, 0)), ...front.map((i) => v(i, -0.22)).reverse())} fill={rim} />
      <polygon points={pts(O, ...[0, 1, 2, 3, 4, 5].map((i) => v(i, 0)))} fill={TOP} />
      <polygon points={pts(O, ...[0, 1, 2, 3, 4, 5].map((i) => v(i, 0.01, 0.55)))} fill="none" stroke={rim} strokeWidth={0.9} opacity={0.75} />
    </g>
  );
}

/** A speech bubble facing the viewer (rounded body, tail, three dots). */
function FlatBubble({ at, w, h, fill, dots = '#5b5f86' }: { at: Readonly<Vec3>; w: number; h: number; fill: string; dots?: string }) {
  const c = flatPoint(O, at);
  const bw = w * O.s;
  const bh = h * O.s;
  return (
    <g>
      <polygon points={`${c.x - bw * 0.3},${c.y + bh / 2 - 1} ${c.x - bw * 0.12},${c.y + bh / 2 - 1} ${c.x - bw * 0.36},${c.y + bh / 2 + bh * 0.38}`} fill={fill} />
      <rect x={c.x - bw / 2} y={c.y - bh / 2} width={bw} height={bh} rx={bh * 0.42} fill={fill} />
      {[-0.18, 0, 0.18].map((k) => (
        <circle key={k} cx={c.x + k * bw} cy={c.y} r={Math.max(0.9, bh * 0.1)} fill={dots} />
      ))}
    </g>
  );
}

/** Stars and the far city glow (fixed, so the drawing is identical on every device). */
const SKY_STARS = (() => {
  let a = 7;
  const next = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
  return Array.from({ length: 70 }, () => ({ x: next() * W, y: next() * H * 0.92, r: 0.35 + next() * next() * 1.3 }));
})();

/** Flat View drawing: the same diorama from the front-right, at the same proportions as the 3D set. */
function DigiSkyFlat() {
  const id = `w-dsky-${useId().replace(/:/g, '')}`;
  const { islands: is, booth: bo, tower: tw, board: bd } = DS;
  const B = frame(bo.at, bo.yaw);
  const hw = bo.w / 2;
  const neighbour = DS.neighbour;
  const beacon = DS.beacon;
  const portal = flatPoint(O, [DS.portal.at[0], DS.portal.y, DS.portal.at[2]]);
  const as = DS.arcadeSign;
  const A = frame(as.at, as.yaw);
  const Hgt = tw.floors * tw.floorH;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#050920" />
          <stop offset="0.45" stopColor="#141a4e" />
          <stop offset="1" stopColor="#35237c" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id})`} />
      {SKY_STARS.map((s, i) => (
        <circle key={i} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.r.toFixed(2)} fill={i % 7 === 0 ? '#ffe3a8' : '#ffffff'} opacity={0.85} />
      ))}
      {[0.86, 0.92, 0.97].map((k, i) => (
        <line key={k} x1={0} y1={H * k} x2={W} y2={H * k - 6 + i * 3} stroke={i % 2 === 0 ? TEAL : VIOLET} strokeWidth={0.6} opacity={0.4} />
      ))}
      {/* Back: the QuikGig tower on its island, with the job board and lit window strips. */}
      <FlatIsland at={is.tower.at} r={is.tower.r} rim={TEAL} />
      <FBox o={O} min={[tw.x0, 0, tw.z0]} max={[tw.x1, Hgt, tw.z1]} front={GLASS} side="#151940" top="#2f3775" stroke={TEAL} />
      {Array.from({ length: tw.floors - 1 }, (_, f) => (
        <polyline key={f} points={pts(O, [tw.x0, (f + 1) * tw.floorH, tw.z1], [tw.x1, (f + 1) * tw.floorH, tw.z1], [tw.x1, (f + 1) * tw.floorH, tw.z0])} fill="none" stroke={TEAL} strokeWidth={1.2} />
      ))}
      {[2, 3].flatMap((f) =>
        [0, 1, 2].map((k) => {
          const y = f * tw.floorH + 0.45 + k * 0.6;
          return <FPoly key={`${f}${k}`} o={O} fill={k % 2 === 0 ? TEAL : VIOLET} p={[[tw.x0 + 0.2, y, tw.z1], [tw.x1 - 0.2, y, tw.z1], [tw.x1 - 0.2, y + 0.18, tw.z1], [tw.x0 + 0.2, y + 0.18, tw.z1]]} />;
        }),
      )}
      <FBox o={O} min={[bd.x0, bd.y0, tw.z1]} max={[bd.x1, bd.y1, tw.z1 + 0.06]} front="#3a2f7a" />
      {Array.from({ length: 12 }, (_, i) => {
        const r = Math.floor(i / 4);
        const c = i % 4;
        const x0 = bd.x0 + 0.15 + c * 0.4;
        const y0 = bd.y0 + 0.12 + r * 0.5;
        return (
          <g key={i}>
            <FPoly o={O} fill={['#f4efe6', '#ffd6ec', '#cfe8ff', '#fff2b8'][(r + c) % 4]!} p={[[x0, y0, tw.z1 + 0.06], [x0 + 0.3, y0, tw.z1 + 0.06], [x0 + 0.3, y0 + 0.38, tw.z1 + 0.06], [x0, y0 + 0.38, tw.z1 + 0.06]]} />
            {i % 3 === 1 && <circle cx={flatPoint(O, [x0 + 0.1, y0 + 0.12, tw.z1]).x} cy={flatPoint(O, [x0 + 0.1, y0 + 0.12, tw.z1]).y} r={1.3} fill={GOLD} />}
          </g>
        );
      })}
      {/* Barang Market island: the sticks behind the booth peek out, then the glossy front and its stars. */}
      <FlatIsland at={is.barang.at} r={is.barang.r} rim={MAGENTA} />
      {[-0.9, 0.05, 0.95].map((x) => (
        <polyline key={x} points={pts(O, B(x, 1.75, -0.05), B(x + 0.08, 0, -0.95))} stroke={STICK} strokeWidth={1.6} />
      ))}
      <FPoly o={O} fill={CARD} p={[B(-hw, 0, -0.03), B(-hw, 0, 0.03), B(-hw, bo.h + bo.sign, 0.03), B(-hw, bo.h + bo.sign, -0.03)]} />
      <FPoly o={O} fill="#ffd6ec" p={[B(-hw, 0, 0.03), B(hw, 0, 0.03), B(hw, bo.h, 0.03), B(-hw, bo.h, 0.03)]} stroke="#c9b6ff" />
      <FPoly o={O} fill={MAGENTA} p={[B(-hw, 0, 0.03), B(hw, 0, 0.03), B(hw, 0.95, 0.03), B(-hw, 0.95, 0.03)]} />
      <FPoly o={O} fill="#2a1f5e" p={[B(-hw - 0.05, bo.h, 0.03), B(hw + 0.05, bo.h, 0.03), B(hw + 0.05, bo.h + bo.sign, 0.03), B(-hw - 0.05, bo.h + bo.sign, 0.03)]} stroke="#c9b6ff" />
      {[0, 1, 2, 3, 4].map((i) => {
        const c = flatPoint(O, B(-hw + 0.3 + (i * (bo.w - 0.6)) / 4, bo.h + bo.sign / 2, 0.04));
        return <polygon key={i} points={starPoints(c.x, c.y, 3.4)} fill={GOLD} />;
      })}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const x0 = -hw + (bo.w * i) / 8;
        const x1 = -hw + (bo.w * (i + 1)) / 8;
        return <FPoly key={i} o={O} fill={i % 2 === 0 ? MAGENTA : '#fff0f7'} p={[B(x0, bo.h - 0.12, 0.03), B(x1, bo.h - 0.12, 0.03), B(x1, bo.h - 0.48, 0.62), B(x0, bo.h - 0.48, 0.62)]} />;
      })}
      <FPoly o={O} fill={MAGENTA} p={[B(-hw + 0.15, 0, 0.6), B(hw - 0.15, 0, 0.6), B(hw - 0.15, 0.95, 0.6), B(-hw + 0.15, 0.95, 0.6)]} />
      <FPoly o={O} fill={GOLD} p={[B(-hw + 0.15, 0.4, 0.6), B(hw - 0.15, 0.4, 0.6), B(hw - 0.15, 0.48, 0.6), B(-hw + 0.15, 0.48, 0.6)]} />
      <FPoly o={O} fill={GOLD} p={[B(-0.28, 1.0, 0.6), B(0.24, 1.0, 0.6), B(0.24, 1.4, 0.6), B(-0.28, 1.4, 0.6)]} />
      {/* The review lanterns on their string: all alike, every tag the same. */}
      <polyline points={pts(O, [DS_LANTERN_POSTS[0][0], 0, DS_LANTERN_POSTS[0][2]], DS_LANTERN_POSTS[0])} stroke="#3a2f7a" strokeWidth={1.4} />
      <polyline points={pts(O, [DS_LANTERN_POSTS[1][0], 0, DS_LANTERN_POSTS[1][2]], DS_LANTERN_POSTS[1])} stroke="#3a2f7a" strokeWidth={1.4} />
      <polyline points={pts(O, DS_LANTERN_POSTS[0], ...DS_LANTERNS, DS_LANTERN_POSTS[1])} fill="none" stroke="#ffe3a8" strokeWidth={0.7} />
      {DS_LANTERNS.map((p, i) => {
        const c = flatPoint(O, [p[0], p[1] - 0.32, p[2]]);
        return (
          <g key={i}>
            <rect x={c.x - 3.2} y={c.y - 4.6} width={6.4} height={9.2} rx={3} fill="#ffd58a" />
            <rect x={c.x - 1.1} y={c.y + 6} width={2.2} height={2.4} fill="#fffaf0" />
          </g>
        );
      })}
      {/* The honest stall next door: a low teal cart under a striped canopy, with a buyer-protection shield. */}
      {[-0.58, 0.58].map((x) => (
        <polyline key={x} points={pts(O, frame(neighbour.at, neighbour.yaw)(x, 1, -0.32), frame(neighbour.at, neighbour.yaw)(x, 2.05, -0.32))} stroke="#cfe8ff" strokeWidth={1} />
      ))}
      <RBox at={neighbour.at} yaw={neighbour.yaw} min={[-0.62, 0.16, -0.36]} max={[0.62, 1, 0.36]} front="#2bb3a3" side="#1f8a7f" top="#efe9df" />
      <RBox at={neighbour.at} yaw={neighbour.yaw} min={[-0.75, 1.9, -0.45]} max={[0.75, 2.05, 0.62]} front="#e9fffb" side="#2bb3a3" top="#ffffff" />
      {(() => {
        const c = flatPoint(O, frame(neighbour.at, neighbour.yaw)(0, 0.66, 0.36));
        return <path d={`M ${c.x - 3} ${c.y - 3} h 6 v 3 l -3 3.4 l -3 -3.4 z`} fill={GOLD} />;
      })()}
      {/* ChatLah plaza: the island, the link portal with its swirl, the bubble beacon, a bench, the bubbles. */}
      <FlatIsland at={is.plaza.at} r={is.plaza.r} rim={TEAL} />
      <circle cx={portal.x} cy={portal.y} r={(DS.portal.r + 0.1) * O.s} fill="none" stroke={VIOLET} strokeWidth={0.16 * O.s} />
      <circle cx={portal.x} cy={portal.y} r={DS.portal.r * O.s} fill="#2a2470" />
      {[0, 1, 2, 3].map((k) => (
        <path key={k} d={`M ${portal.x} ${portal.y} q ${8 * Math.cos(k * 1.57)} ${8 * Math.sin(k * 1.57)} ${18 * Math.cos(k * 1.57 + 0.9)} ${18 * Math.sin(k * 1.57 + 0.9)}`} fill="none" stroke={k % 2 === 0 ? TEAL : VIOLET} strokeWidth={2.4} strokeLinecap="round" />
      ))}
      <FBox o={O} min={[DS.portal.at[0] - 0.7, 0, DS.portal.at[2] - 0.3]} max={[DS.portal.at[0] + 0.7, 0.16, DS.portal.at[2] + 0.3]} front={VIOLET} top="#3a2f7a" />
      <polyline points={pts(O, [beacon.at[0], 0, beacon.at[2]], [beacon.at[0], beacon.y - 0.4, beacon.at[2]])} stroke="#cfe8ff" strokeWidth={1.6} />
      <FlatBubble at={[beacon.at[0], beacon.y, beacon.at[2]]} w={1.6} h={1.0} fill={TEAL} dots="#ffffff" />
      <RBox at={DS.bench.at} yaw={DS.bench.yaw} min={[-0.7, 0.38, -0.2]} max={[0.7, 0.42, 0.2]} front="#5b4bc4" top="#7a6ae0" />
      {DS_BUBBLES.map((bb, i) => (
        <FlatBubble key={i} at={bb.at} w={0.9 * bb.scale} h={0.55 * bb.scale} fill={[TEAL, VIOLET, GOLD, '#ff9ec4', TEAL, VIOLET, '#7fd6cf'][i]!} />
      ))}
      {/* Light bridges. */}
      {DS.bridges.map(([a, c], i) => (
        <g key={i}>
          <polyline points={pts(O, a, c)} stroke="#2f3775" strokeWidth={7} />
          <polyline points={pts(O, [a[0], 0.55, a[2]], [c[0], 0.55, c[2]])} stroke={TEAL} strokeWidth={1} />
        </g>
      ))}
      {/* The Arcade: its island, the neon sign frame, two cabinets and a claw machine. */}
      <FlatIsland at={is.arcade.at} r={is.arcade.r} rim={VIOLET} />
      <polyline points={pts(O, A(-as.w / 2 + 0.08, 0, 0), A(-as.w / 2 + 0.08, as.h, 0), A(as.w / 2 - 0.08, as.h, 0), A(as.w / 2 - 0.08, 0, 0))} fill="none" stroke="#2a1f5e" strokeWidth={3} />
      <polyline points={pts(O, A(-as.w / 2 + 0.08, 0.1, 0.1), A(-as.w / 2 + 0.08, as.h - 0.6, 0.1))} stroke={MAGENTA} strokeWidth={1.4} />
      <polyline points={pts(O, A(as.w / 2 - 0.08, 0.1, 0.1), A(as.w / 2 - 0.08, as.h - 0.6, 0.1))} stroke={TEAL} strokeWidth={1.4} />
      <FPoly o={O} fill="#1d1748" p={[A(-as.w / 2, as.h - 0.55, 0.08), A(as.w / 2, as.h - 0.55, 0.08), A(as.w / 2, as.h, 0.08), A(-as.w / 2, as.h, 0.08)]} stroke={MAGENTA} />
      {DS.cabinets.map((c, i) => {
        const C = frame(c.at, c.yaw);
        return (
          <g key={i}>
            <RBox at={c.at} yaw={c.yaw} min={[-0.34, 0, -0.32]} max={[0.34, 1.78, 0.32]} front="#3a2f7a" side={i === 0 ? TEAL : MAGENTA} top="#2a1f5e" />
            <FPoly o={O} fill={TEAL} p={[C(-0.27, 1.05, 0.33), C(0.27, 1.05, 0.33), C(0.27, 1.48, 0.33), C(-0.27, 1.48, 0.33)]} />
            <FPoly o={O} fill={GOLD} p={[C(-0.34, 1.55, 0.33), C(0.34, 1.55, 0.33), C(0.34, 1.76, 0.33), C(-0.34, 1.76, 0.33)]} />
          </g>
        );
      })}
      <RBox at={DS.claw.at} yaw={DS.claw.yaw} min={[-0.42, 0, -0.42]} max={[0.42, 0.85, 0.42]} front={VIOLET} side="#5b4bc4" top="#3a2f7a" />
      <RBox at={DS.claw.at} yaw={DS.claw.yaw} min={[-0.42, 0.85, -0.42]} max={[0.42, 1.85, 0.42]} front="#cfe8ff" side="#a9c6e8" top={MAGENTA} />
    </g>
  );
}

const flat: FlatTwin = {
  viewBox: `0 0 ${W} ${H}`,
  Draw: DigiSkyFlat,
  anchors: flatAnchorsOf(O, DIGI_SKY_ANCHORS),
  staging: flatStagingOf(O, DIGI_SKY_ANCHORS, DIGI_SKY_STAGING),
};

const digiSkySet: StagedSetPiece = {
  id: 'digi-sky',
  name: 'Digi Sky',
  anchors: DIGI_SKY_ANCHORS,
  camera: DIGI_SKY_CAMERA,
  Component: DigiSkyComponent,
  flat,
  staging: DIGI_SKY_STAGING,
};

export const digiSky: SetPiece = digiSkySet;
