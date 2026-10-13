import { lazy } from 'react';
import type { Mission } from '@shieldquest/shared';
import type { SetPiece, SetPieceProps } from './types';
import { BEDROOM_ANCHORS, BEDROOM_CAMERA, BEDROOM_OBLIQUE as O, BEDROOM_STAGING, BR } from '../core/layout/bedroom';
import { FBox, FPoly, FlatSky, flatAnchorsOf, flatPoint, flatStagingOf, isNight, litPattern, pts } from '../core/flat';
import type { FlatTwin, StagedSetPiece, Vec3 } from '../core/staging';

// S7 Bedroom Cutaway (night Peer Shield scenes). The 3D geometry is lazy (three.js stays out of the Flat View and
// the app shell); the anchors, camera and Flat View twin are plain data shared with it (core/layout/bedroom.ts).
const Bedroom3D = lazy(() => import('../core/sets3d/bedroom'));

/** Suspends while the 3D chunk loads, so the scene appears all at once (MissionScene covers it with the Flat View). */
function BedroomComponent(props: SetPieceProps) {
  return <Bedroom3D {...props} />;
}

const W = 400;
const H = 250;
const WALL = '#b3a7d4';
const SECTION = '#2f2c58';
const WOOD = '#8a5f45';
const PLANK = '#b98d68';

/** The influence window across the street, in Flat View units (centre-bottom of its lit pane). */
const FLAT_INFLUENCE = { x: 364, y: 104 };

const zQuad = (x0: number, x1: number, y0: number, y1: number, z: number): Vec3[] => [
  [x0, y0, z],
  [x1, y0, z],
  [x1, y1, z],
  [x0, y1, z],
];
const xQuad = (x: number, z0: number, z1: number, y0: number, y1: number): Vec3[] => [
  [x, y0, z1],
  [x, y0, z0],
  [x, y1, z0],
  [x, y1, z1],
];

/** Flat View drawing of the bedroom at night, cut away like the 3D set. */
function BedroomFlat({ timeOfDay }: { timeOfDay: Mission['timeOfDay'] }) {
  const night = isNight(timeOfDay);
  const { room, bed: bd, desk: dk, door: d, window: w, shelf: sf, rug: rg } = BR;
  const outside = night ? '#1b2340' : '#7fa0c8';
  const lit = litPattern(48, night ? 0.4 : 0.12, 5);
  const lamp = flatPoint(O, [BR.lamp[0] + 0.22, BR.lamp[1] + 0.3, BR.lamp[2] + 0.18]);
  const laptop = BR.laptop;
  const chair = flatPoint(O, BR.chair);
  const fan = flatPoint(O, [BR.fan[0], 1.25, BR.fan[2]]);
  return (
    <g>
      <FlatSky width={W} height={H} timeOfDay={timeOfDay} />
      {/* The city outside: a far block over the room, and the block across the street on the right. */}
      <rect x={120} y={4} width={150} height={60} fill={night ? '#3a3763' : '#9891b8'} />
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={i} x={128 + (i % 8) * 17.5} y={12 + Math.floor(i / 8) * 16} width={9} height={8} fill={lit[i] ? '#ffd58a' : '#2b3557'} />
      ))}
      <rect x={330} y={36} width={74} height={220} fill={night ? '#4a4670' : '#a69fc4'} />
      <rect x={330} y={36} width={6} height={220} fill="#8a6cf0" />
      {Array.from({ length: 24 }, (_, i) => {
        const c = i % 3;
        const r = Math.floor(i / 3);
        const x = 342 + c * 20;
        const y = 48 + r * 26;
        // Leave the influence window's slot dark; the scene draws it lit when the string is pulled.
        if (Math.abs(x + 5 - FLAT_INFLUENCE.x) < 12 && Math.abs(y + 10 - (FLAT_INFLUENCE.y - 10)) < 14) return null;
        return <rect key={i} x={x} y={y} width={11} height={13} fill={lit[16 + i] ? '#ffd58a' : '#2b3557'} />;
      })}
      {/* The cut slab and floorboards. */}
      <FBox o={O} min={[room.x0 - 0.18, -1.1, room.z0 - 0.18]} max={[room.x1, 0, room.z1]} front={SECTION} side="#25234a" />
      <FPoly o={O} fill={PLANK} p={[[room.x0, 0, room.z1], [room.x1, 0, room.z1], [room.x1, 0, room.z0], [room.x0, 0, room.z0]]} />
      {[-1.6, -1.0, -0.4, 0.2, 0.8, 1.4].map((z) => (
        <polyline key={z} points={pts(O, [room.x0, 0, z], [room.x1, 0, z])} stroke="#a37a58" strokeWidth={0.7} />
      ))}
      <ellipse cx={flatPoint(O, [0.2, 0, -1.4]).x} cy={flatPoint(O, [0.2, 0, -1.4]).y} rx={80} ry={24} fill="#ffcf8a" opacity={night ? 0.32 : 0.12} />
      <FPoly o={O} fill="#7d78c2" p={[[rg.x0, 0, rg.z1], [rg.x1, 0, rg.z1], [rg.x1, 0, rg.z0], [rg.x0, 0, rg.z0]]} />
      <FPoly o={O} fill="#9a95d6" p={[[rg.x0 + 0.15, 0, rg.z1 - 0.15], [rg.x1 - 0.15, 0, rg.z1 - 0.15], [rg.x1 - 0.15, 0, rg.z0 + 0.15], [rg.x0 + 0.15, 0, rg.z0 + 0.15]]} />
      {/* Back wall with the door ajar onto the hallway light. */}
      <FPoly o={O} fill={WALL} p={zQuad(room.x0, room.x1, 0, room.h, room.z0)} />
      <ellipse cx={lamp.x} cy={lamp.y + 8} rx={46} ry={40} fill="#ffcf8a" opacity={night ? 0.28 : 0.1} />
      <FPoly o={O} fill="#ffe9c2" p={zQuad(d.x0, d.x1, 0, d.h, room.z0)} />
      <FPoly o={O} fill="#f1ebdf" stroke="#d8cdb6" p={[[d.x1, 0, room.z0 + 0.03], [d.x1 - 0.74, 0, room.z0 + 0.49], [d.x1 - 0.74, d.h - 0.02, room.z0 + 0.49], [d.x1, d.h - 0.02, room.z0 + 0.03]]} />
      {/* Poster, fairy lights and the clock (past 2am). */}
      <FPoly o={O} fill="#2a2f6b" p={zQuad(-2.2, -1.2, 1.3, 2.25, room.z0)} />
      <FPoly o={O} fill="#8a6cf0" p={zQuad(-2.1, -1.3, 1.4, 2.15, room.z0)} />
      <FPoly o={O} fill="#f2c14e" p={[[-1.95, 1.55, room.z0], [-1.45, 1.55, room.z0], [-1.7, 2.0, room.z0]]} />
      {Array.from({ length: 12 }, (_, i) => {
        const x = room.x0 + 0.2 + (i * (d.x0 - room.x0 - 0.5)) / 11;
        const p = flatPoint(O, [x, 2.42 - Math.abs(Math.sin((i / 11) * Math.PI * 3)) * 0.06, room.z0]);
        return <circle key={i} cx={p.x} cy={p.y} r={1.8} fill={i % 2 === 0 ? '#ffd58a' : '#ffb3c8'} />;
      })}
      <FPoly o={O} fill="#f4efe6" stroke="#8d879f" p={zQuad(0.45, 0.75, 2.1, 2.4, room.z0)} />
      <polyline points={pts(O, [0.6, 2.25, room.z0], [0.6, 2.36, room.z0])} stroke="#1d2440" strokeWidth={1.2} />
      <polyline points={pts(O, [0.6, 2.25, room.z0], [0.68, 2.28, room.z0])} stroke="#1d2440" strokeWidth={1.2} />
      {/* Left wall with the window onto the rainy city. */}
      <FPoly o={O} fill="#a69ac8" p={xQuad(room.x0, room.z0, room.z1, 0, room.h)} />
      <FPoly o={O} fill={outside} p={xQuad(room.x0, w.z0, w.z1, w.y0, w.y1)} />
      {[0.1, 0.45, 0.75].map((z, i) => {
        const p = flatPoint(O, [room.x0, w.y0 + 0.4 + i * 0.22, z]);
        return <rect key={z} x={p.x - 1.5} y={p.y - 1.5} width={3} height={3} fill="#ffd58a" opacity={night ? 1 : 0.5} />;
      })}
      <polyline points={pts(O, [room.x0, w.y0, w.z0], [room.x0, w.y0, w.z1], [room.x0, w.y1, w.z1], [room.x0, w.y1, w.z0], [room.x0, w.y0, w.z0])} fill="none" stroke="#e9e2d4" strokeWidth={2} />
      <FPoly o={O} fill="#e07a9f" p={xQuad(room.x0 + 0.06, w.z1 - 0.15, w.z1 + 0.3, 0.95, w.y1 + 0.2)} />
      <FPoly o={O} fill="#cf6d92" p={xQuad(room.x0 + 0.06, w.z0 - 0.3, w.z0 + 0.15, 0.95, w.y1 + 0.2)} />
      {/* Bed with the glowing phone. */}
      <FBox o={O} min={[bd.x0 - 0.05, 0, bd.z0]} max={[bd.x0 + 0.05, 1.0, bd.z1]} front={WOOD} side="#9c6d50" top="#a47a5c" />
      <FBox o={O} min={[bd.x0, 0, bd.z0]} max={[bd.x1, 0.3, bd.z1]} front={WOOD} side="#74503a" />
      <FBox o={O} min={[bd.x0 + 0.03, 0.3, bd.z0]} max={[bd.x1 - 0.03, bd.top, bd.z1 - 0.03]} front="#eef1f6" top="#f8f9fc" side="#dfe4ee" />
      <FBox o={O} min={[bd.x0 + 0.62, bd.top, bd.z0]} max={[bd.x1 + 0.02, bd.top + 0.07, bd.z1 + 0.02]} front="#22917f" top="#2bb3a3" side="#22917f" />
      <FBox o={O} min={[bd.x0 + 0.1, bd.top, bd.z0 + 0.15]} max={[bd.x0 + 0.55, bd.top + 0.16, bd.z1 - 0.15]} front="#dfe4ee" top="#f8f9fc" />
      <FPoly o={O} fill="#5b7fd6" p={[[BR.phone[0] - 0.05, BR.phone[1], BR.phone[2] + 0.09], [BR.phone[0] + 0.05, BR.phone[1], BR.phone[2] + 0.09], [BR.phone[0] + 0.05, BR.phone[1], BR.phone[2] - 0.09], [BR.phone[0] - 0.05, BR.phone[1], BR.phone[2] - 0.09]]} />
      <circle cx={flatPoint(O, BR.phone).x} cy={flatPoint(O, BR.phone).y} r={6} fill="#bfe3ff" opacity={0.35} />
      {/* Desk with the laptop, warm lamp and mug; the chair. */}
      <FBox o={O} min={[dk.x0, 0, dk.z0]} max={[dk.x0 + 0.5, dk.top - 0.04, dk.z1 - 0.02]} front="#e1d9cb" side="#d8d0c2" />
      <FBox o={O} min={[dk.x1 - 0.09, 0, dk.z1 - 0.09]} max={[dk.x1 - 0.03, dk.top - 0.04, dk.z1 - 0.03]} front="#8d879f" />
      <FBox o={O} min={[dk.x0, dk.top - 0.04, dk.z0]} max={[dk.x1, dk.top, dk.z1]} front="#cfc6b6" top="#e9e2d4" side="#cfc6b6" />
      <FPoly o={O} fill="#bfe3ff" p={[[laptop[0] - 0.17, laptop[1] + 0.02, laptop[2] - 0.1], [laptop[0] + 0.17, laptop[1] + 0.02, laptop[2] - 0.1], [laptop[0] + 0.17, laptop[1] + 0.25, laptop[2] - 0.17], [laptop[0] - 0.17, laptop[1] + 0.25, laptop[2] - 0.17]]} />
      <FBox o={O} min={[laptop[0] - 0.18, laptop[1], laptop[2] - 0.1]} max={[laptop[0] + 0.18, laptop[1] + 0.02, laptop[2] + 0.14]} front="#8d93aa" top="#9fa6bd" />
      <polyline points={pts(O, [BR.lamp[0], BR.lamp[1], BR.lamp[2]], [BR.lamp[0] + 0.05, BR.lamp[1] + 0.38, BR.lamp[2] + 0.06], [BR.lamp[0] + 0.22, BR.lamp[1] + 0.36, BR.lamp[2] + 0.18])} fill="none" stroke="#4d5470" strokeWidth={1.4} />
      <path d={`M${lamp.x - 5} ${lamp.y + 4} L${lamp.x - 2} ${lamp.y - 3} L${lamp.x + 3} ${lamp.y - 3} L${lamp.x + 6} ${lamp.y + 4} Z`} fill="#f2c14e" />
      <circle cx={lamp.x + 0.5} cy={lamp.y + 5} r={night ? 7 : 3} fill="#fff1c9" opacity={night ? 0.7 : 0.9} />
      <FBox o={O} min={[laptop[0] + 0.34, laptop[1], laptop[2] + 0.01]} max={[laptop[0] + 0.43, laptop[1] + 0.1, laptop[2] + 0.1]} front="#f26b5b" top="#5a3b2a" />
      <rect x={chair.x - 1.2} y={chair.y - 18} width={2.4} height={18} fill="#4d5470" />
      <ellipse cx={chair.x} cy={chair.y - 19} rx={10} ry={3.5} fill="#5f5aa0" />
      <ellipse cx={chair.x} cy={chair.y} rx={9} ry={2.6} fill="#4d5470" />
      {/* Shelf (open to the room) with books, a plush and trophies. */}
      <FBox o={O} min={[sf.x0, 0, sf.z0]} max={[sf.x1, sf.h, sf.z1]} front="#9c6d50" side="#4a3226" top="#a47a5c" />
      {[0.45, 0.9, 1.35].map((y) => (
        <polyline key={y} points={pts(O, [sf.x1, y, sf.z0], [sf.x1, y, sf.z1])} stroke="#a47a5c" strokeWidth={1.4} />
      ))}
      {Array.from({ length: 6 }, (_, i) => {
        const z = sf.z0 + 0.08 + i * 0.12;
        const fill = ['#f26b5b', '#2bb3a3', '#f2c14e', '#8a6cf0', '#5b7fd6', '#e07a9f'][i]!;
        return <FPoly key={i} o={O} fill={fill} p={xQuad(sf.x1, z, z + 0.08, 0.04, 0.36 + (i % 3) * 0.03)} />;
      })}
      <circle cx={flatPoint(O, [sf.x1, 1.07, (sf.z0 + sf.z1) / 2]).x} cy={flatPoint(O, [sf.x1, 1.07, (sf.z0 + sf.z1) / 2]).y} r={6} fill="#f6a6c1" />
      {[-0.09, 0.09].map((dz) => {
        const p = flatPoint(O, [sf.x1, 1.23, (sf.z0 + sf.z1) / 2 + dz]);
        return <circle key={dz} cx={p.x} cy={p.y} r={2.2} fill="#f6a6c1" />;
      })}
      {[sf.z0 + 0.22, sf.z0 + 0.48, sf.z0 + 0.7].map((z) => {
        const p = flatPoint(O, [sf.x1, 1.39, z]);
        return <path key={z} d={`M${p.x - 3} ${p.y} h6 l-1 -3 h-1 v-3 l3 -4 h-10 l3 4 v3 h-1 z`} fill="#f2c14e" />;
      })}
      {/* Standing fan. */}
      <polyline points={pts(O, BR.fan, [BR.fan[0], 1.2, BR.fan[2]])} stroke="#e9e2d4" strokeWidth={1.6} />
      <ellipse cx={flatPoint(O, BR.fan).x} cy={flatPoint(O, BR.fan).y} rx={8} ry={2.5} fill="#e9e2d4" />
      <circle cx={fan.x} cy={fan.y} r={12} fill="none" stroke="#e9e2d4" strokeWidth={1.4} />
      {[0, 120, 240].map((a) => (
        <ellipse key={a} cx={fan.x} cy={fan.y - 5} rx={2.6} ry={6} fill="#7cc4ff" transform={`rotate(${a} ${fan.x} ${fan.y})`} />
      ))}
      {/* Section caps on the cut walls. */}
      <FBox o={O} min={[room.x0 - 0.18, room.h, room.z0 - 0.18]} max={[room.x1, room.h + 0.06, room.z0]} front={SECTION} top={SECTION} />
      <FBox o={O} min={[room.x0 - 0.18, room.h, room.z0]} max={[room.x0, room.h + 0.06, room.z1]} front={SECTION} top={SECTION} side={SECTION} />
      <FPoly o={O} fill={SECTION} p={zQuad(room.x0 - 0.18, room.x0, 0, room.h + 0.06, room.z1)} />
    </g>
  );
}

const flat: FlatTwin = {
  viewBox: `0 0 ${W} ${H}`,
  Draw: BedroomFlat,
  anchors: flatAnchorsOf(O, BEDROOM_ANCHORS),
  staging: flatStagingOf(O, BEDROOM_ANCHORS, BEDROOM_STAGING, {
    // The skyline is drawn freely around the room, so the influence window and the rain are placed by hand.
    influence: FLAT_INFLUENCE,
    rain: [
      { x: 318, y: 0, w: 82, h: 250 },
      { x: 0, y: 0, w: 318, h: 38 },
    ],
  }),
};

const bedroomSet: StagedSetPiece = {
  id: 'bedroom',
  name: 'Bedroom at night',
  anchors: BEDROOM_ANCHORS,
  camera: BEDROOM_CAMERA,
  Component: BedroomComponent,
  flat,
  staging: BEDROOM_STAGING,
};

export const bedroom: SetPiece = bedroomSet;
