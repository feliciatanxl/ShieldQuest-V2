// S7 Bedroom Cutaway (GAME_DESIGN.md §4.1): a teenager's room at night, cut away the diorama way (back and left
// walls only, single-sided so an orbiting camera always sees in). Bed with a glowing phone, desk with a laptop
// and a warm lamp, a window onto the rainy city, a door ajar onto the hallway light, a shelf with trophies and a
// plush. The lamp's warm pool is baked into vertex colours. Static props are ONE merged geometry; the fan's
// blades and the phone's notification glow are two small meshes (pure functions of mission time).
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { IcosahedronGeometry, type BufferGeometry, type Group } from 'three';
import { GeoBuilder, KitMesh, PALETTE, hdbBlock, mixHex, useKitGeometry } from '../../../kit';
import type { QualityTier } from '../../../quality';
import type { SetPieceProps } from '../../sets/types';
import { BEDROOM_ANCHORS, BR } from '../layout/bedroom';
import { pooled, useSmoothTime, wallQuad, type LightPool } from './common';
import type { Vec3 } from '../staging';

const WALL = '#b3a7d4';
const SECTION = '#2f2c58';
const PLANK = '#b98d68';
const WOOD = '#8a5f45';
const SHEET = '#eef1f6';
const BLANKET = '#2bb3a3';
const FAN_YAW = -2.3;
const FAN_HEAD: Vec3 = [BR.fan[0], 1.25, BR.fan[2]];

export interface BedroomOptions {
  tier: QualityTier;
  night: boolean;
}

function pools(night: boolean): LightPool[] {
  const s = night ? 1 : 0.4;
  return [
    { at: [BR.lamp[0] + 0.1, BR.lamp[2] + 0.5], radius: 3.4, color: '#ffcf8a', strength: 0.55 * s },
    { at: [BR.laptop[0], BR.laptop[2] + 0.6], radius: 1.8, color: '#9fd0ff', strength: 0.35 * s },
    { at: [(BR.door.x0 + BR.door.x1) / 2, BR.room.z0 + 0.6], radius: 1.6, color: '#ffe9c2', strength: 0.4 * s },
    { at: [BR.phone[0], BR.phone[2]], radius: 1.1, color: '#bfe3ff', strength: 0.3 * s },
  ];
}

/** Wall surface split into strips so the light pools can be baked across it (a pool lights the wall near it). */
function bakedWall(b: GeoBuilder, from: Vec3, to: Vec3, light: readonly LightPool[], step = 0.4): void {
  const alongX = from[2] === to[2];
  const a0 = alongX ? from[0] : from[2];
  const a1 = alongX ? to[0] : to[2];
  const n = Math.max(1, Math.round(Math.abs(a1 - a0) / step));
  const rows = [from[1], (from[1] + to[1]) / 2, to[1]];
  for (let i = 0; i < n; i++) {
    const s0 = a0 + ((a1 - a0) * i) / n;
    const s1 = a0 + ((a1 - a0) * (i + 1)) / n;
    for (let r = 0; r < 2; r++) {
      const mid = (s0 + s1) / 2;
      // Upper wall is a touch darker than the lamp-lit lower half.
      const base = r === 0 ? WALL : mixHex(WALL, SECTION, 0.12);
      const c = alongX ? pooled(base, mid, from[2] + 0.4, light) : pooled(base, from[0] + 0.4, mid, light);
      if (alongX) wallQuad(b, [s0, rows[r]!, from[2]], [s1, rows[r + 1]!, from[2]], c);
      else wallQuad(b, [from[0], rows[r]!, s0], [from[0], rows[r + 1]!, s1], c);
    }
  }
}

/** Every static prop of the bedroom as one kit geometry. Pure (testable in Node). */
export function buildBedroom({ tier, night }: BedroomOptions): BufferGeometry {
  const light = pools(night);
  const detail = tier !== 'low';
  const { room } = BR;
  const b = new GeoBuilder();

  // --- Floor: planks with the light pools baked in, on a cut slab -----------------------------------------
  b.box([room.x0 - 0.18, -1.1, room.z0 - 0.18], [room.x1, 0, room.z1], { side: SECTION, front: SECTION, top: SECTION }, 0, { top: true });
  const plankW = 0.3;
  for (let j = 0, z = room.z0; z < room.z1 - 1e-6; j++, z += plankW) {
    const z1 = Math.min(room.z1, z + plankW);
    const offset = (j % 3) * 0.45;
    for (let x = room.x0 - offset; x < room.x1; x += 1.35) {
      const xa = Math.max(room.x0, x);
      const xb = Math.min(room.x1, x + 1.35);
      if (xb - xa < 0.02) continue;
      const tone = (j * 5 + Math.round(x * 3)) % 3 === 0 ? mixHex(PLANK, PALETTE.ink, 0.08) : PLANK;
      b.quad([xa, 0, z1], [xb, 0, z1], [xb, 0, z], [xa, 0, z], pooled(tone, (xa + xb) / 2, (z + z1) / 2, light));
    }
  }

  // --- Walls: back wall around the door, left wall around the window, section caps and skirting ------------
  const d = BR.door;
  const w = BR.window;
  bakedWall(b, [room.x0, 0, room.z0], [d.x0, room.h, room.z0], light);
  wallQuad(b, [d.x0, d.h, room.z0], [d.x1, room.h, room.z0], WALL);
  wallQuad(b, [d.x1, 0, room.z0], [room.x1, room.h, room.z0], WALL);
  bakedWall(b, [room.x0, 0, room.z1], [room.x0, room.h, w.z1], light);
  bakedWall(b, [room.x0, 0, w.z0], [room.x0, room.h, room.z0], light);
  wallQuad(b, [room.x0, 0, w.z1], [room.x0, w.y0, w.z0], WALL);
  wallQuad(b, [room.x0, w.y1, w.z1], [room.x0, room.h, w.z0], WALL);
  b.box([room.x0 - 0.18, room.h, room.z0 - 0.18], [room.x1, room.h + 0.06, room.z0], SECTION);
  b.box([room.x0 - 0.18, room.h, room.z0], [room.x0, room.h + 0.06, room.z1], SECTION);
  b.quad([room.x0 - 0.18, -1.1, room.z1], [room.x0, -1.1, room.z1], [room.x0, room.h + 0.06, room.z1], [room.x0 - 0.18, room.h + 0.06, room.z1], SECTION);
  b.quad([room.x1, -1.1, room.z0], [room.x1, -1.1, room.z0 - 0.18], [room.x1, room.h + 0.06, room.z0 - 0.18], [room.x1, room.h + 0.06, room.z0], SECTION);
  b.box([room.x0, 0, room.z0], [d.x0, 0.1, room.z0 + 0.02], '#e9e2d4');
  b.box([room.x0, 0, room.z0], [room.x0 + 0.02, 0.1, room.z1], '#e9e2d4');

  // --- Window: frame, sill and half-drawn curtains (the city and the rain are outside) ----------------------
  const wx = room.x0;
  b.box([wx - 0.18, w.y0 - 0.06, w.z0 - 0.06], [wx + 0.12, w.y0, w.z1 + 0.06], '#e9e2d4');
  b.box([wx - 0.18, w.y1, w.z0 - 0.06], [wx + 0.04, w.y1 + 0.06, w.z1 + 0.06], '#e9e2d4');
  for (const z of [w.z0 - 0.06, w.z1]) b.box([wx - 0.18, w.y0, z], [wx + 0.04, w.y1, z + 0.06], '#e9e2d4');
  b.box([wx - 0.12, w.y0, (w.z0 + w.z1) / 2 - 0.02], [wx - 0.08, w.y1, (w.z0 + w.z1) / 2 + 0.02], '#e9e2d4');
  const curtain = '#e07a9f';
  b.quad([wx + 0.06, 0.95, w.z1 + 0.3], [wx + 0.06, 0.95, w.z1 - 0.1], [wx + 0.06, w.y1 + 0.2, w.z1 - 0.18], [wx + 0.06, w.y1 + 0.2, w.z1 + 0.3], curtain);
  b.quad([wx + 0.06, 0.95, w.z0 + 0.12], [wx + 0.06, 0.95, w.z0 - 0.3], [wx + 0.06, w.y1 + 0.2, w.z0 - 0.3], [wx + 0.06, w.y1 + 0.2, w.z0 + 0.2], mixHex(curtain, PALETTE.ink, 0.1));
  b.box([wx + 0.02, w.y1 + 0.2, w.z0 - 0.4], [wx + 0.1, w.y1 + 0.24, w.z1 + 0.4], '#8d879f');

  // --- Door ajar onto the lit hallway --------------------------------------------------------------------
  b.quad([d.x0, 0, room.z0 - 0.35], [d.x1, 0, room.z0 - 0.35], [d.x1, d.h, room.z0 - 0.35], [d.x0, d.h, room.z0 - 0.35], '#ffe9c2', 1);
  b.quad([d.x0, 0.001, room.z0], [d.x1, 0.001, room.z0], [d.x1, 0.001, room.z0 - 0.35], [d.x0, 0.001, room.z0 - 0.35], '#f0d7b0', 0.6);
  for (const x of [d.x0 - 0.08, d.x1]) b.box([x, 0, room.z0], [x + 0.08, d.h + 0.08, room.z0 + 0.05], '#e9e2d4');
  b.box([d.x0 - 0.08, d.h, room.z0], [d.x1 + 0.08, d.h + 0.08, room.z0 + 0.05], '#e9e2d4');
  const leaf = new GeoBuilder();
  leaf.box([-(d.x1 - d.x0) + 0.02, 0, -0.02], [0, d.h - 0.02, 0.02], { side: '#e9e2d4', front: '#f1ebdf' });
  leaf.box([-(d.x1 - d.x0) + 0.1, 0.95, 0.02], [-(d.x1 - d.x0) + 0.2, 1.0, 0.06], '#c9a86a');
  b.add(leaf.build(), { at: [d.x1, 0, room.z0 + 0.03], rotY: 0.55 });

  // --- Bed: frame, mattress, blanket, pillow, headboard; the phone lies on it (its glow is animated) -------
  const bd = BR.bed;
  b.box([bd.x0, 0, bd.z0], [bd.x1, 0.3, bd.z1], WOOD);
  b.box([bd.x0 + 0.03, 0.3, bd.z0 + 0.03], [bd.x1 - 0.03, bd.top, bd.z1 - 0.03], SHEET);
  b.box([bd.x0 + 0.62, bd.top, bd.z0], [bd.x1 + 0.02, bd.top + 0.07, bd.z1 + 0.02], { side: mixHex(BLANKET, PALETTE.ink, 0.2), top: BLANKET });
  b.box([bd.x0 + 0.62, bd.top + 0.07, bd.z0], [bd.x0 + 0.85, bd.top + 0.1, bd.z1 + 0.02], '#f4efe6');
  b.box([bd.x0 + 0.1, bd.top, bd.z0 + 0.15], [bd.x0 + 0.55, bd.top + 0.16, bd.z1 - 0.15], { side: '#dfe4ee', top: '#f8f9fc' });
  b.box([bd.x0 - 0.05, 0, bd.z0], [bd.x0 + 0.05, 1.0, bd.z1], { side: WOOD, top: mixHex(WOOD, '#ffffff', 0.15) });
  const [phx, phy, phz] = BR.phone;
  b.box([phx - 0.05, phy, phz - 0.09], [phx + 0.05, phy + 0.015, phz + 0.09], '#1d2440');
  b.quad([phx - 0.04, phy + 0.016, phz + 0.08], [phx + 0.04, phy + 0.016, phz + 0.08], [phx + 0.04, phy + 0.016, phz - 0.08], [phx - 0.04, phy + 0.016, phz - 0.08], '#5b7fd6', night ? 0.6 : 0.2);
  // Slippers by the bed.
  for (const dz of [-0.06, 0.12]) b.box([-0.55 + 0.08, 0, bd.z1 + 0.25 + dz], [-0.55 + 0.34, 0.05, bd.z1 + 0.35 + dz], '#f26b5b');

  // --- Desk: top, legs, drawer unit; laptop with a glowing screen; the warm lamp; a mug; the chair ----------
  const dk = BR.desk;
  b.box([dk.x0, dk.top - 0.04, dk.z0], [dk.x1, dk.top, dk.z1], { side: mixHex('#e9e2d4', PALETTE.ink, 0.1), top: '#e9e2d4' });
  b.box([dk.x0, 0, dk.z0], [dk.x0 + 0.5, dk.top - 0.04, dk.z1 - 0.02], { side: '#d8d0c2', front: '#e1d9cb' });
  b.box([dk.x0 + 0.05, 0.42, dk.z1 - 0.02], [dk.x0 + 0.45, 0.46, dk.z1], '#8d879f');
  for (const x of [dk.x1 - 0.06]) for (const z of [dk.z0 + 0.04, dk.z1 - 0.06]) b.box([x - 0.03, 0, z - 0.03], [x + 0.03, dk.top - 0.04, z + 0.03], '#8d879f');
  const [lx, ly, lz] = BR.laptop;
  b.box([lx - 0.18, ly, lz - 0.1], [lx + 0.18, ly + 0.02, lz + 0.14], '#9fa6bd');
  b.quad([lx - 0.17, ly + 0.02, lz - 0.1], [lx + 0.17, ly + 0.02, lz - 0.1], [lx + 0.17, ly + 0.25, lz - 0.17], [lx - 0.17, ly + 0.25, lz - 0.17], '#bfe3ff', 1);
  b.quad([lx + 0.17, ly + 0.02, lz - 0.11], [lx - 0.17, ly + 0.02, lz - 0.11], [lx - 0.17, ly + 0.25, lz - 0.18], [lx + 0.17, ly + 0.25, lz - 0.18], '#6d7389');
  const [ax, ay, az] = BR.lamp;
  b.cylinder([ax, ay, az], 0.09, 0.03, 8, '#4d5470');
  b.strut([ax, ay + 0.03, az], [ax + 0.05, ay + 0.38, az + 0.06], 0.015, 5, '#4d5470');
  b.strut([ax + 0.05, ay + 0.38, az + 0.06], [ax + 0.22, ay + 0.36, az + 0.18], 0.015, 5, '#4d5470');
  b.cylinder([ax + 0.22, ay + 0.24, az + 0.18], 0.11, 0.13, 8, '#f2c14e', { radiusTop: 0.05, top: '#f2c14e' });
  b.quad([ax + 0.13, ay + 0.24, az + 0.27], [ax + 0.31, ay + 0.24, az + 0.27], [ax + 0.31, ay + 0.24, az + 0.09], [ax + 0.13, ay + 0.24, az + 0.09], '#fff1c9', 1);
  b.cylinder([lx + 0.38, ly, lz + 0.05], 0.045, 0.1, 7, '#f26b5b', { top: '#5a3b2a' });
  if (detail) b.box([lx - 0.62, ly, lz - 0.05], [lx - 0.34, ly + 0.03, lz + 0.15], { side: '#f4efe6', top: '#8a6cf0' });
  const chair = new GeoBuilder();
  chair.cylinder([0, 0, 0], 0.24, 0.04, 6, '#4d5470');
  chair.cylinder([0, 0.04, 0], 0.03, 0.37, 5, '#4d5470');
  chair.cylinder([0, 0.41, 0], 0.22, 0.05, 9, '#3d3a66', { top: '#5f5aa0' });
  chair.box([-0.2, 0.46, -0.27], [0.2, 0.86, -0.22], { side: '#3d3a66', front: '#5f5aa0' });
  chair.box([-0.02, 0.41, -0.26], [0.02, 0.5, -0.2], '#4d5470');
  // The chair (and whoever sits on it) faces the desk, turned a little towards the room.
  b.add(chair.build(), { at: BR.chair, rotY: BEDROOM_ANCHORS.desk?.facing ?? Math.PI });

  // --- Shelf (open towards +x) with books, trophies and a plush ---------------------------------------------
  const sf = BR.shelf;
  b.box([sf.x0, 0, sf.z0], [sf.x0 + 0.04, sf.h, sf.z1], WOOD);
  for (const z of [sf.z0, sf.z1 - 0.04]) b.box([sf.x0, 0, z], [sf.x1, sf.h, z + 0.04], { side: WOOD, front: mixHex(WOOD, '#ffffff', 0.12) });
  for (const y of [0, 0.45, 0.9, 1.35, sf.h - 0.04]) b.box([sf.x0, y, sf.z0], [sf.x1, y + 0.04, sf.z1], { side: mixHex(WOOD, '#ffffff', 0.12), top: mixHex(WOOD, '#ffffff', 0.2) });
  const bookColors = ['#f26b5b', '#2bb3a3', '#f2c14e', '#8a6cf0', '#5b7fd6', '#e07a9f', '#f4efe6'];
  for (const [shelfY, n] of [
    [0.04, 7],
    [0.49, 5],
  ] as const) {
    let z = sf.z0 + 0.06;
    for (let i = 0; i < n && z < sf.z1 - 0.1; i++) {
      const t = 0.06 + (i % 3) * 0.015;
      const h = 0.3 + ((i * 7) % 4) * 0.025;
      b.box([sf.x0 + 0.06, shelfY, z], [sf.x1 - 0.04, shelfY + h, z + t], bookColors[(i + (shelfY > 0.1 ? 3 : 0)) % bookColors.length]!);
      z += t + 0.01;
    }
  }
  // Plush: a round pink friend with ears on the middle shelf.
  b.addPainted(new IcosahedronGeometry(0.15, 1), (f) => (f.normal.x > 0.5 && f.centroid.y > 0.02 ? '#ffd1e0' : '#f6a6c1'), { at: [sf.x1 - 0.17, 0.9 + 0.17, (sf.z0 + sf.z1) / 2], scale: [1, 0.95, 1] });
  for (const dz of [-0.09, 0.09]) b.addPainted(new IcosahedronGeometry(0.05, 0), '#f6a6c1', { at: [sf.x1 - 0.18, 0.9 + 0.33, (sf.z0 + sf.z1) / 2 + dz] });
  b.box([sf.x1 - 0.04, 0.9 + 0.17, (sf.z0 + sf.z1) / 2 - 0.04], [sf.x1 - 0.02, 0.9 + 0.2, (sf.z0 + sf.z1) / 2 + 0.04], '#1d2440');
  // Trophies on the top shelves (gold resists the Freeze a little).
  for (const [z, s] of [
    [sf.z0 + 0.22, 1],
    [sf.z0 + 0.48, 0.8],
    [sf.z0 + 0.7, 0.9],
  ] as const) {
    const y = 1.39;
    b.box([sf.x1 - 0.22, y, z - 0.06 * s], [sf.x1 - 0.1, y + 0.06, z + 0.06 * s], '#4d5470');
    b.cylinder([sf.x1 - 0.16, y + 0.06, z], 0.02 * s, 0.12 * s, 5, PALETTE.gold, { glow: 0.25 });
    b.cylinder([sf.x1 - 0.16, y + 0.06 + 0.12 * s, z], 0.03 * s, 0.13 * s, 7, PALETTE.gold, { radiusTop: 0.08 * s, glow: 0.25 });
  }

  // --- Rug, a backpack, a poster, fairy lights and the wall clock (it is past 2am) --------------------------
  const rg = BR.rug;
  b.box([rg.x0, 0, rg.z0], [rg.x1, 0.012, rg.z1], { side: '#5f5aa0', top: pooled('#7d78c2', 0.2, 0.4, light) });
  b.quad([rg.x0 + 0.15, 0.013, rg.z1 - 0.15], [rg.x1 - 0.15, 0.013, rg.z1 - 0.15], [rg.x1 - 0.15, 0.013, rg.z0 + 0.15], [rg.x0 + 0.15, 0.013, rg.z0 + 0.15], pooled('#9a95d6', 0.2, 0.4, light));
  b.box([1.45, 0, -1.25], [1.8, 0.45, -1.05], { side: '#2b8f86', top: '#22756e', front: '#33a397' });
  b.quad([-2.2, 1.3, room.z0 + 0.01], [-1.2, 1.3, room.z0 + 0.01], [-1.2, 2.25, room.z0 + 0.01], [-2.2, 2.25, room.z0 + 0.01], '#2a2f6b');
  b.quad([-2.1, 1.4, room.z0 + 0.012], [-1.3, 1.4, room.z0 + 0.012], [-1.3, 2.15, room.z0 + 0.012], [-2.1, 2.15, room.z0 + 0.012], '#8a6cf0');
  b.quad([-1.95, 1.55, room.z0 + 0.014], [-1.45, 1.55, room.z0 + 0.014], [-1.7, 2.0, room.z0 + 0.014], [-1.7, 2.0, room.z0 + 0.014], PALETTE.gold, 0.3);
  if (detail) {
    const bulbs = 14;
    for (let i = 0; i < bulbs; i++) {
      const x = room.x0 + 0.2 + (i * (d.x0 - room.x0 - 0.5)) / (bulbs - 1);
      const sag = Math.sin((i / (bulbs - 1)) * Math.PI * 3) * 0.06;
      b.boxAt([x, 2.42 - Math.abs(sag), room.z0 + 0.04], [0.05, 0.06, 0.05], i % 2 === 0 ? '#ffd58a' : '#ffb3c8', 1);
    }
  }
  b.box([0.45, 2.1, room.z0], [0.75, 2.4, room.z0 + 0.035], { side: '#8d879f', front: '#f4efe6' });
  const clockZ = room.z0 + 0.045;
  b.quad([0.585, 2.24, clockZ], [0.615, 2.24, clockZ], [0.615, 2.36, clockZ], [0.585, 2.36, clockZ], '#1d2440');
  b.quad([0.6, 2.235, clockZ], [0.69, 2.27, clockZ], [0.68, 2.29, clockZ], [0.59, 2.255, clockZ], '#1d2440');

  // --- Standing fan: base and pole (the head is animated) ---------------------------------------------------
  const [fx, , fz] = BR.fan;
  b.cylinder([fx, 0, fz], 0.2, 0.04, 9, '#e9e2d4');
  b.cylinder([fx, 0.04, fz], 0.025, FAN_HEAD[1] - 0.12, 6, '#e9e2d4');

  // --- Outside: the blocks across the street (the influence window sits on the right one) -------------------
  // Far enough across the street that the room stays the subject; fog folds them into the night.
  b.add(hdbBlock({ floors: 5, width: 9, depth: 3, voidDeck: false, litWindows: night ? 0.4 : 0.1, body: '#a69fc4', accent: '#8a6cf0', seed: 'across', ao: false }), { at: [4.2, -8, -12] });
  b.add(hdbBlock({ floors: 9, width: 14, depth: 4, voidDeck: false, litWindows: night ? 0.35 : 0.08, body: '#9891b8', accent: '#2bb3a3', seed: 'far', ao: false }), { at: [-6, -14, -20] });
  if (detail) b.add(hdbBlock({ floors: 6, width: 12, depth: 4, voidDeck: false, litWindows: night ? 0.45 : 0.1, body: '#a69fc4', accent: '#f26b5b', seed: 'left', ao: false }), { at: [-13.5, -10, -1], rotY: Math.PI / 2 });
  return b.build();
}

function buildFanHead(): { blades: BufferGeometry; cage: BufferGeometry } {
  const blades = new GeoBuilder();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const p = (r: number, w: number): Vec3 => [c * r - s * w, s * r + c * w, 0.02];
    blades.quad(p(0.04, -0.04), p(0.25, -0.09), p(0.27, 0.07), p(0.04, 0.04), '#7cc4ff');
    blades.quad(p(0.04, 0.04), p(0.27, 0.07), p(0.25, -0.09), p(0.04, -0.04), '#6ab0ea');
  }
  blades.boxAt([0, 0, 0.01], [0.1, 0.1, 0.07], '#e9e2d4');
  const blade = blades.build();
  const cage = new GeoBuilder();
  // Motor housing behind the blades (the fan blows along its local +z).
  cage.box([-0.08, -0.08, -0.24], [0.08, 0.08, -0.03], { side: '#e9e2d4', back: '#d8d0c2' });
  const ringSeg = 16;
  for (let i = 0; i < ringSeg; i++) {
    const a0 = (i / ringSeg) * Math.PI * 2;
    const a1 = ((i + 1) / ringSeg) * Math.PI * 2;
    cage.strut([Math.cos(a0) * 0.3, Math.sin(a0) * 0.3, 0.02], [Math.cos(a1) * 0.3, Math.sin(a1) * 0.3, 0.02], 0.012, 4, '#e9e2d4');
  }
  const cageGeo = cage.build();
  return { blades: blade, cage: cageGeo };
}

/** The phone's notification glow blinks for a moment every few seconds (pure function of mission time). */
export const phoneBlink = (t: number) => (t % 4.5) < 0.9 && Math.floor((t % 4.5) * 5) % 2 === 0;

export default function BedroomSet({ quality, frozen, t, timeOfDay }: SetPieceProps) {
  const night = timeOfDay === 'evening' || timeOfDay === 'night';
  const geometry = useKitGeometry(() => buildBedroom({ tier: quality, night }), [quality, night]);
  const fan = useKitGeometry(() => buildFanHead().blades, []);
  const cage = useKitGeometry(() => buildFanHead().cage, []);
  const glow = useKitGeometry(() => {
    const b = new GeoBuilder();
    const [x, y, z] = BR.phone;
    b.quad([x - 0.12, y + 0.02, z + 0.16], [x + 0.12, y + 0.02, z + 0.16], [x + 0.12, y + 0.02, z - 0.16], [x - 0.12, y + 0.02, z - 0.16], '#bfe3ff', 1);
    return b.build();
  }, []);
  const time = useSmoothTime(t, !frozen);
  const spin = useRef<Group>(null);
  useFrame(() => {
    // The fan turns at ~1.2 rev/s; while time is held it stops mid-turn.
    if (spin.current) spin.current.rotation.z = time.current * 7.5;
  });
  return (
    <group>
      <KitMesh geometry={geometry} />
      <group position={FAN_HEAD} rotation={[0, FAN_YAW, 0]}>
        <KitMesh geometry={cage} castShadow={false} />
        <group ref={spin}>
          <KitMesh geometry={fan} castShadow={false} side="double" />
        </group>
      </group>
      <KitMesh geometry={glow} visible={phoneBlink(t)} castShadow={false} receiveShadow={false} />
    </group>
  );
}
