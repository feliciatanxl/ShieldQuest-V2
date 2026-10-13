// Code-built geometry for Lumen (GAME_DESIGN.md §4.1-4.2, §10.2). Every builder returns ONE kit geometry so the
// whole city overview stays inside the 40-draw-call budget: one merged mesh per district plate, one "frame"
// (Stillpoint plaza, tower, viaduct bridges, rim), one train, and instanced trees, lamps and towers.
// Pure three.js (no React): unit-tested in Node for triangle budgets.
import { BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, IcosahedronGeometry, OctahedronGeometry, type ColorRepresentation } from 'three';
import { GeoBuilder, coveredWalkway, fence, ground, hdbBlock, hexPlate, kiosk, lantern, road, shophouse, signboard, tableSet, tree } from '../kit/geometry';
import { seededRandom, type Vec3 } from '../kit/math';
import { mergeKit, mixHex, place, toKitGeometry } from '../kit/paint';
import { PALETTE } from '../kit/uniforms';
import type { QualityTier } from '../quality';
import type { DistrictId } from '@shieldquest/shared';
import { CITY, DISTRICT_SPOTS, frostAmount, hexEdgeDistance, inradius, litWindowFraction, spotById, toWorld, type V3 } from './layout';

// ---------------------------------------------------------------------------------------------------------
// Colour helpers (kit colours are stored linear; Color() converts from sRGB hex)
// ---------------------------------------------------------------------------------------------------------

function recolor(geo: BufferGeometry, fn: (c: Color, glow: number, y: number) => void): BufferGeometry {
  const col = geo.getAttribute('color') as BufferAttribute;
  const glow = geo.getAttribute('glow') as BufferAttribute;
  const pos = geo.getAttribute('position');
  const c = new Color();
  for (let i = 0; i < col.count; i++) {
    c.setRGB(col.getX(i), col.getY(i), col.getZ(i));
    fn(c, glow.getX(i), pos.getY(i));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
  return geo;
}

/** Negative trust: unlit surfaces frost over towards a cold pale blue. */
function frostOver(geo: BufferGeometry, amount: number): BufferGeometry {
  if (amount <= 0) return geo;
  const frost = new Color('#cfdcef');
  return recolor(geo, (c, glow) => {
    if (glow < 0.5) c.lerp(frost, amount);
  });
}

/** Fogged expansion plates: drained, cool and dim; only a few lights keep a glow. */
function mute(geo: BufferGeometry, amount = 0.58): BufferGeometry {
  const fogTone = new Color('#8b95b6');
  recolor(geo, (c) => {
    c.lerp(fogTone, amount);
  });
  const glow = geo.getAttribute('glow') as BufferAttribute;
  for (let i = 0; i < glow.count; i++) glow.setX(i, glow.getX(i) * 0.35);
  glow.needsUpdate = true;
  return geo;
}

/** Multiplies vertex colours by a tint (lanterns are painted neutral paper). */
function tint(geo: BufferGeometry, color: ColorRepresentation): BufferGeometry {
  const t = new Color(color);
  return recolor(geo, (c) => {
    c.multiply(t);
  });
}

/** Rotates a plate-local yaw so `rotY` turns local +x towards a world direction. */
const yawTowards = (dx: number, dz: number) => Math.atan2(-dz, dx);

// ---------------------------------------------------------------------------------------------------------
// Shared small pieces
// ---------------------------------------------------------------------------------------------------------

/** Inverted rocky keel under a floating plate (hex corners on local ±x, like hexPlate). */
function keel(radius: number, top: number, depth: number, color: string): BufferGeometry {
  const cone = new ConeGeometry(radius, depth, 6, 1, false, Math.PI / 2).rotateX(Math.PI);
  const dark = mixHex(color, PALETTE.ink, 0.35);
  const b = new GeoBuilder().addPainted(cone, (f) => (f.normal.x + f.normal.z > 0 ? color : dark), { at: [0, top - depth / 2, 0] });
  return b.build();
}

/** Flat rectangle in a clock face (facing +z), rotated clockwise by `angle` from 12 o'clock. */
function faceRect(b: GeoBuilder, cy: number, z: number, halfW: number, y0: number, y1: number, angle: number, color: string, glow = 0): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const p = (x: number, y: number): Vec3 => [x * c + y * s, cy - x * s + y * c, z];
  b.quad(p(-halfW, y0), p(halfW, y0), p(halfW, y1), p(-halfW, y1), color, glow);
}

/** Gabled roof over [x0, x1] x [z0, z1] at height y; the ridge runs along z when `alongZ`. */
function gable(b: GeoBuilder, x0: number, x1: number, z0: number, z1: number, y: number, rise: number, color: string, alongZ = false): void {
  const dark = mixHex(color, PALETTE.ink, 0.22);
  const end = mixHex(color, '#ffffff', 0.25);
  if (alongZ) {
    const xm = (x0 + x1) / 2;
    b.quad([x1, y, z1], [x1, y, z0], [xm, y + rise, z0], [xm, y + rise, z1], color);
    b.quad([x0, y, z0], [x0, y, z1], [xm, y + rise, z1], [xm, y + rise, z0], dark);
    b.tri([x0, y, z1], [x1, y, z1], [xm, y + rise, z1], end).tri([x1, y, z0], [x0, y, z0], [xm, y + rise, z0], end);
  } else {
    const zm = (z0 + z1) / 2;
    b.quad([x0, y, z1], [x1, y, z1], [x1, y + rise, zm], [x0, y + rise, zm], color);
    b.quad([x1, y, z0], [x0, y, z0], [x0, y + rise, zm], [x1, y + rise, zm], dark);
    b.tri([x1, y, z1], [x1, y, z0], [x1, y + rise, zm], end).tri([x0, y, z0], [x0, y, z1], [x0, y + rise, zm], end);
  }
}

/** Open pavilion: posts and a pitched roof (canteen, food court, chess pavilion). */
function pavilion(w: number, d: number, h: number, roof: string, post = '#d9dde8'): BufferGeometry {
  const b = new GeoBuilder();
  const hw = w / 2;
  const hd = d / 2;
  for (const x of [-hw + 0.3, 0, hw - 0.3]) {
    for (const z of [-hd + 0.3, hd - 0.3]) b.box([x - 0.15, 0, z - 0.15], [x + 0.15, h, z + 0.15], post);
  }
  b.box([-hw - 0.4, h, -hd - 0.4], [hw + 0.4, h + 0.25, hd + 0.4], { side: mixHex(roof, PALETTE.ink, 0.3), top: roof });
  gable(b, -hw - 0.4, hw + 0.4, -hd - 0.4, hd + 0.4, h + 0.25, 1.6, roof);
  return b.build();
}

/** Single-deck city bus (teal livery by default), parked or at a stop. */
function bus(color: string = PALETTE.school): BufferGeometry {
  const b = new GeoBuilder();
  b.box([-4.5, 0.45, -1.25], [4.5, 3.1, 1.25], { side: '#eef1f5', top: '#c9cfdc', front: color, back: color });
  b.box([-4.52, 0.45, -1.27], [4.52, 1.1, 1.27], color);
  for (const z of [1.27, -1.27]) {
    const zz = z > 0 ? z + 0.01 : z - 0.01;
    const quad = z > 0
      ? ([[-4, 1.6, zz], [4, 1.6, zz], [4, 2.7, zz], [-4, 2.7, zz]] as Vec3[])
      : ([[4, 1.6, zz], [-4, 1.6, zz], [-4, 2.7, zz], [4, 2.7, zz]] as Vec3[]);
    b.quad(quad[0]!, quad[1]!, quad[2]!, quad[3]!, '#ffe6b0', 0.7);
  }
  b.quad([4.53, 1.5, 1.0], [4.53, 1.5, -1.0], [4.53, 2.8, -1.0], [4.53, 2.8, 1.0], '#bfe3ff', 0.6);
  for (const x of [-3, 3]) for (const z of [1.2, -1.45]) b.box([x - 0.5, 0, z], [x + 0.5, 0.75, z + 0.25], PALETTE.ink);
  return b.build();
}

/** Tower crane: the "coming soon" sign that needs no words. */
function crane(height: number): BufferGeometry {
  const b = new GeoBuilder();
  const yellow = '#d8b45a';
  const s = 0.9;
  for (const [x, z] of [[-s, -s], [s, -s], [s, s], [-s, s]] as const) b.box([x - 0.15, 0, z - 0.15], [x + 0.15, height, z + 0.15], yellow);
  for (let y = 3; y < height; y += 3.2) {
    b.strut([-s, y, s], [s, y + 3, s], 0.08, 3, yellow).strut([s, y, -s], [-s, y + 3, -s], 0.08, 3, yellow);
    b.strut([s, y, s], [s, y + 3, -s], 0.08, 3, yellow).strut([-s, y, -s], [-s, y + 3, s], 0.08, 3, yellow);
  }
  b.box([-1.4, height, -1.2], [1.4, height + 2, 1.2], { side: '#e9e2cf', front: '#9fc8e8' });
  b.box([-16, height + 2, -0.6], [6, height + 3, 0.6], yellow);
  b.box([3, height + 0.8, -1], [6, height + 2, 1], '#7c7f96');
  b.strut([0, height + 3, 0], [0, height + 6, 0], 0.18, 4, yellow);
  b.strut([0, height + 6, 0], [-14, height + 3, 0], 0.07, 3, '#c9c3d6').strut([0, height + 6, 0], [5.5, height + 3, 0], 0.07, 3, '#c9c3d6');
  b.strut([-11, height + 2, 0], [-11, height - 7, 0], 0.05, 3, '#59607a');
  b.boxAt([-11, height - 7.5, 0], [1.1, 1, 1.1], '#7c7f96');
  b.boxAt([0, height + 6.4, 0], [0.7, 0.7, 0.7], '#ff9f6b', 1);
  return b.build();
}

// ---------------------------------------------------------------------------------------------------------
// Instanced props
// ---------------------------------------------------------------------------------------------------------

/** City-scale street lamp: a glowing head that reads from above (the kit lamp glows only downwards). */
export function cityLamp(): BufferGeometry {
  const b = new GeoBuilder();
  b.cylinder([0, 0, 0], 0.16, 5.6, 5, '#59607a', { radiusTop: 0.1 });
  b.addPainted(new OctahedronGeometry(0.55, 0), '#ffe2a6', { at: [0, 6.05, 0], scale: [1, 1.2, 1] }, 1);
  return b.build();
}

/** Squad tower (projector): a white hex prism so the instance colour paints it in the squad's colour. */
export function squadTower(): BufferGeometry {
  const b = new GeoBuilder();
  const h = CITY.squadTowerHeight;
  b.cylinder([0, 0, 0], 2.0, 0.7, 6, '#c9c5d8');
  b.cylinder([0, 0.7, 0], 1.55, h - 1.5, 6, '#f4f1fb', { radiusTop: 1.25 });
  b.cylinder([0, h - 0.8, 0], 1.6, 0.6, 6, '#ffffff', { glow: 1 });
  b.cylinder([0, h - 0.2, 0], 1.3, 1.5, 6, '#dcd8ea', { radiusTop: 0.2 });
  return b.build();
}

export interface Placed {
  position: V3;
  rotationY?: number;
  scale?: number;
  color?: string;
}

/** Plate-local [x, z, scale] spots for trees (round, cone) and lamps. */
const SCATTER: Record<DistrictId, { round: [number, number, number][]; cone: [number, number, number][]; lamps: [number, number][] }> = {
  'school-street': {
    round: [[-16.5, -6, 1.1], [-17.5, 3, 1], [-4.8, 8.5, 0.9], [4.8, 8.5, 0.9], [16, -9.5, 1], [6.5, -16, 0.9], [-7, -16, 0.95]],
    cone: [[17.5, 6, 1], [12.5, -14, 0.9]],
    lamps: [[-9, 12.2], [-1, 12.2], [7, 12.2], [-5, 3.5], [5, 3.5]],
  },
  'retail-district': {
    round: [[-6.5, 14, 0.9], [-17.5, 2.5, 1], [3, -17, 0.85], [-14.5, -11, 0.9], [17.5, 4, 0.9]],
    cone: [[-9.5, -15, 1], [9.5, -15.5, 0.9]],
    lamps: [[-9, 12.2], [0, 12.2], [9, 12.2], [-4, -3.5], [4, -3.5]],
  },
  'digi-district': {
    round: [[-6, 14, 0.85], [6.5, 14, 0.85], [-16.5, 9.5, 0.9], [17.5, 6, 0.9]],
    cone: [[-6.5, -15.5, 0.9], [6.5, -16, 0.9]],
    lamps: [[-6, 11], [6, 11], [-3, -6], [3, -6]],
  },
  'void-deck-commons': {
    round: [[-15, 1, 1], [15.5, -4, 1], [-2, 14, 0.9], [3, 14.5, 0.85]],
    cone: [[-12, -15, 1]],
    lamps: [[-5, 1], [5, 1]],
  },
  interchange: {
    round: [[-16, 3, 1], [16.5, 3, 0.9], [0, 16, 0.85]],
    cone: [[14, -12, 1]],
    lamps: [[-8, 12], [8, 12]],
  },
};

const LEAF_TINTS = ['#ffffff', '#e8f7e1', '#f5fbe3', '#dff3ee'];
const FOG_TINT = '#a3aecb';

/** World-space trees and lamps for the whole city (static). Low tier keeps fewer trees. */
export function scatter(tier: QualityTier): { round: Placed[]; cone: Placed[]; lamps: Placed[] } {
  const round: Placed[] = [];
  const cone: Placed[] = [];
  const lamps: Placed[] = [];
  const rand = seededRandom('lumen-scatter');
  for (const spot of DISTRICT_SPOTS) {
    const set = SCATTER[spot.id];
    const keep = (i: number) => tier !== 'low' || i % 2 === 0;
    set.round.forEach(([x, z, s], i) => {
      if (!keep(i)) return;
      round.push({ position: toWorld(spot, [x, 0, z]), rotationY: rand() * 6.28, scale: s, color: spot.fogged ? FOG_TINT : LEAF_TINTS[i % LEAF_TINTS.length] });
    });
    set.cone.forEach(([x, z, s], i) => {
      cone.push({ position: toWorld(spot, [x, 0, z]), rotationY: rand() * 6.28, scale: s, color: spot.fogged ? FOG_TINT : LEAF_TINTS[(i + 1) % LEAF_TINTS.length] });
    });
    set.lamps.forEach(([x, z]) => {
      lamps.push({ position: toWorld(spot, [x, 0, z]), color: spot.fogged ? '#8d93ad' : '#ffffff' });
    });
  }
  // Stillpoint plaza: a ring of trees between the squad towers, lamps at the bridge heads.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    if (tier === 'low' && i % 2 === 1) continue;
    round.push({ position: [Math.cos(a) * 12, 0, Math.sin(a) * 12], rotationY: rand() * 6.28, scale: 0.75, color: LEAF_TINTS[i % 4] });
  }
  for (const spot of DISTRICT_SPOTS) {
    const r = hexEdgeDistance(CITY.hub, spot.angle) - 1.2;
    for (const side of [-1, 1]) {
      const a = spot.angle + side * 0.2;
      lamps.push({ position: [Math.cos(a) * r, 0, Math.sin(a) * r] });
    }
  }
  return { round, cone, lamps };
}

export const treeRound = () => tree({ kind: 'round', height: 7, seed: 'lumen-round' });
export const treeCone = () => tree({ kind: 'cone', height: 8.5, seed: 'lumen-cone' });

// ---------------------------------------------------------------------------------------------------------
// The frame: Stillpoint plaza and tower, viaduct bridges, the rim viaduct
// ---------------------------------------------------------------------------------------------------------

/** The Stillpoint clock tower, stuck at 11:59 (§4.1). Hands are geometry; there is no text. */
function stillpoint(): BufferGeometry {
  const b = new GeoBuilder();
  const stone = '#efe6d6';
  const pilaster = '#d6c9b2';
  const gold = PALETTE.gold;
  // Base steps and shaft with corner pilasters and lit slit windows.
  b.box([-4.6, 0, -4.6], [4.6, 1.2, 4.6], { side: '#bdb3cc', top: '#d9cfe0' });
  b.box([-3.8, 1.2, -3.8], [3.8, 2.8, 3.8], { side: '#ddd2c0', top: '#e9dfcd' });
  b.box([-3, 2.8, -3], [3, 24.8, 3], { side: stone, top: stone });
  for (const [x, z] of [[-3, -3], [3, -3], [3, 3], [-3, 3]] as const) b.box([x - 0.45, 2.8, z - 0.45], [x + 0.45, 24.8, z + 0.45], pilaster);
  const slit = (y0: number) => {
    for (const k of [0, 1, 2, 3]) {
      const g = new GeoBuilder();
      g.quad([-0.35, y0, 3.02], [0.35, y0, 3.02], [0.35, y0 + 2.6, 3.02], [-0.35, y0 + 2.6, 3.02], '#ffd58a', 0.9);
      b.add(g.build(), { rotY: (k * Math.PI) / 2 });
    }
  };
  [6, 12, 18].forEach(slit);
  // Clock stage, cornice, belfry with a glowing lantern, pyramid roof and gold finial.
  b.box([-3.5, 24.8, -3.5], [3.5, 31.8, 3.5], { side: '#f4efe6', top: '#d9cdb8' });
  b.box([-3.75, 31.6, -3.75], [3.75, 32.1, 3.75], gold);
  b.box([-3.75, 24.6, -3.75], [3.75, 25.0, 3.75], gold);
  b.box([-2.6, 32.1, -2.6], [2.6, 35.2, 2.6], { side: stone, top: stone });
  for (const k of [0, 1, 2, 3]) {
    const g = new GeoBuilder();
    g.quad([-0.8, 32.6, 2.62], [0.8, 32.6, 2.62], [0.8, 34.5, 2.62], [-0.8, 34.5, 2.62], gold, 1);
    b.add(g.build(), { rotY: (k * Math.PI) / 2 });
  }
  const roof = new ConeGeometry(4.1, 5.2, 4, 1, false, Math.PI / 4);
  b.addPainted(roof, (f) => (f.normal.x + f.normal.z > 0 ? '#4a5aa0' : '#34407e'), { at: [0, 35.2 + 2.6, 0] });
  b.addPainted(new OctahedronGeometry(0.75, 0), gold, { at: [0, 41, 0], scale: [1, 1.5, 1] }, 1);
  // Four clock faces reading 11:59: hour hand at 359.5 degrees, minute hand at 354 (clockwise from 12).
  const hourAngle = ((11 + 59 / 60) / 12) * Math.PI * 2;
  const minuteAngle = (59 / 60) * Math.PI * 2;
  const cy = 28.3;
  for (const k of [0, 1, 2, 3]) {
    const f = new GeoBuilder();
    const disc = new CylinderGeometry(2.6, 2.6, 0.24, 24).rotateX(Math.PI / 2);
    f.addPainted(disc, (face) => (face.normal.z > 0.9 ? '#fff4dc' : gold), { at: [0, cy, 3.58] }, 0.85);
    for (let h = 0; h < 12; h++) {
      const major = h % 3 === 0;
      faceRect(f, cy, 3.72, major ? 0.13 : 0.08, major ? 1.85 : 2.0, 2.35, (h / 12) * Math.PI * 2, PALETTE.ink);
    }
    faceRect(f, cy, 3.74, 0.17, -0.3, 1.45, hourAngle, PALETTE.ink);
    faceRect(f, cy, 3.76, 0.1, -0.4, 2.2, minuteAngle, PALETTE.ink);
    f.addPainted(new CylinderGeometry(0.22, 0.22, 0.1, 8).rotateX(Math.PI / 2), gold, { at: [0, cy, 3.8] });
    b.add(f.build(), { rotY: (k * Math.PI) / 2 });
  }
  return b.build();
}

function hubPlate(): BufferGeometry {
  const b = new GeoBuilder();
  b.add(hexPlate({ radius: CITY.hub, height: CITY.hubDepth, top: '#d9d0df', side: '#4d5486', rim: PALETTE.gold }));
  b.add(keel(CITY.hub * 0.94, -CITY.hubDepth, 4, '#3d4377'));
  // The Stillpoint's source of the Hold: a frost crystal under the plaza.
  b.addPainted(new OctahedronGeometry(1.5, 0), '#cfe8ff', { at: [0, -CITY.hubDepth - 4.6, 0], scale: [1, 1.5, 1] }, 0.9);
  // Paving rings and four planters on the diagonals.
  b.lathe([[9.6, 0.03], [6.8, 0.03]], 24, (_r, s) => (s % 2 === 0 ? '#c8bdd3' : '#cfc5d9'));
  b.lathe([[6.8, 0.04], [0, 0.04]], 24, '#e6dccd');
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const x = Math.cos(a) * 7.6;
    const z = Math.sin(a) * 7.6;
    b.box([x - 1.1, 0, z - 1.1], [x + 1.1, 0.7, z + 1.1], { side: '#a99fbd', top: '#5d9a7a' });
  }
  b.add(stillpoint());
  return b.build();
}

/** A glowing viaduct bridge deck from `a` to `b` (xz), with a pier down to the sea. */
function bridge(a: [number, number], c: [number, number], width = 4, glow = '#a8e1ff'): BufferGeometry {
  const dx = c[0] - a[0];
  const dz = c[1] - a[1];
  const len = Math.hypot(dx, dz);
  const hl = len / 2;
  const hw = width / 2;
  const b = new GeoBuilder();
  b.box([-hl, -0.9, -hw], [hl, 0.05, hw], { top: '#cfc8dc', side: '#7b7fa8', bottom: '#454a7a' });
  for (const z of [hw - 0.25, -hw]) b.box([-hl, 0.05, z], [hl, 0.55, z + 0.25], glow, 1);
  // Arch under the deck and a pier into the sea.
  b.box([-hl * 0.55, -1.8, -hw * 0.6], [hl * 0.55, -0.9, hw * 0.6], '#62679a');
  b.cylinder([0, CITY.sea, 0], 1.2, -1.8 - CITY.sea, 6, '#565b8c', { radiusTop: 0.9 });
  return place(b.build(), { at: [(a[0] + c[0]) / 2, 0, (a[1] + c[1]) / 2], rotY: yawTowards(dx, dz) });
}

function bridges(): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  const plateIn = inradius(CITY.plate);
  for (const s of DISTRICT_SPOTS) {
    const r0 = hexEdgeDistance(CITY.hub, s.angle) - 0.6;
    const r1 = CITY.ring - plateIn + 0.6;
    out.push(bridge([Math.cos(s.angle) * r0, Math.sin(s.angle) * r0], [Math.cos(s.angle) * r1, Math.sin(s.angle) * r1], 4.2, s.fogged ? '#9aa6c4' : '#a8e1ff'));
  }
  // Ring bridges between neighbouring plates.
  const sorted = [...DISTRICT_SPOTS].sort((p, q) => p.angle - q.angle);
  sorted.forEach((p, i) => {
    const q = sorted[(i + 1) % sorted.length]!;
    const dirPQ = Math.atan2(q.z - p.z, q.x - p.x);
    const dirQP = dirPQ + Math.PI;
    const dp = hexEdgeDistance(CITY.plate, dirPQ, -p.rotY) - 0.6;
    const dq = hexEdgeDistance(CITY.plate, dirQP, -q.rotY) - 0.6;
    const a: [number, number] = [p.x + Math.cos(dirPQ) * dp, p.z + Math.sin(dirPQ) * dp];
    const c: [number, number] = [q.x + Math.cos(dirQP) * dq, q.z + Math.sin(dirQP) * dq];
    out.push(bridge(a, c, 3.2, p.fogged || q.fogged ? '#9aa6c4' : '#f5d58a'));
  });
  return out;
}

/** The rim viaduct the MRT runs on, with glowing parapets and piers. */
function rimViaduct(tier: QualityTier): BufferGeometry {
  const b = new GeoBuilder();
  const n = tier === 'low' ? 40 : 64;
  const ri = CITY.rim - 2.4;
  const ro = CITY.rim + 2.4;
  const top = 1.0;
  const pt = (r: number, a: number, y: number): Vec3 => [Math.cos(a) * r, y, Math.sin(a) * r];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    // Deck top, outer and inner sides, underside.
    b.quad(pt(ri, a0, top), pt(ri, a1, top), pt(ro, a1, top), pt(ro, a0, top), '#aaa6c4');
    b.quad(pt(ro, a0, 0), pt(ro, a0, top), pt(ro, a1, top), pt(ro, a1, 0), '#5d6290');
    b.quad(pt(ri, a1, 0), pt(ri, a1, top), pt(ri, a0, top), pt(ri, a0, 0), '#686da0');
    b.quad(pt(ri, a0, 0), pt(ro, a0, 0), pt(ro, a1, 0), pt(ri, a1, 0), '#3d4274');
    // Running rails and glowing parapets.
    for (const r of [CITY.rim - 0.8, CITY.rim + 0.8]) {
      b.quad(pt(r - 0.12, a0, top + 0.12), pt(r - 0.12, a1, top + 0.12), pt(r + 0.12, a1, top + 0.12), pt(r + 0.12, a0, top + 0.12), '#4a4f72');
    }
    for (const [r, sign] of [[ro, 1], [ri, -1]] as const) {
      const rIn = Math.min(r, r - sign * 0.3);
      const rOut = Math.max(r, r - sign * 0.3);
      b.quad(pt(rIn, a0, top + 0.6), pt(rIn, a1, top + 0.6), pt(rOut, a1, top + 0.6), pt(rOut, a0, top + 0.6), '#9fd6ff', 0.9);
      if (sign > 0) b.quad(pt(r, a0, top), pt(r, a0, top + 0.6), pt(r, a1, top + 0.6), pt(r, a1, top), '#8fc8f0', 0.6);
      else b.quad(pt(r, a1, top), pt(r, a1, top + 0.6), pt(r, a0, top + 0.6), pt(r, a0, top), '#8fc8f0', 0.6);
    }
  }
  const piers = tier === 'low' ? 10 : 16;
  for (let i = 0; i < piers; i++) {
    const a = ((i + 0.5) / piers) * Math.PI * 2;
    b.cylinder(pt(CITY.rim, a, CITY.sea), 1.4, -CITY.sea, 6, '#4f548a', { radiusTop: 1.0 });
  }
  return b.build();
}

/** Stillpoint plaza, tower, bridges and rim viaduct: ONE draw call. */
export function buildFrame(tier: QualityTier): BufferGeometry {
  return mergeKit([hubPlate(), ...bridges(), rimViaduct(tier)]);
}

// ---------------------------------------------------------------------------------------------------------
// District plates (plate-local: hex corners on ±x, +z faces outwards from the Stillpoint)
// ---------------------------------------------------------------------------------------------------------

function plateBase(accent: string, top: string, side = '#4b5385'): BufferGeometry[] {
  return [hexPlate({ radius: CITY.plate, height: CITY.plateDepth, top, side, rim: accent }), keel(CITY.plate * 0.94, -CITY.plateDepth, 4.2, '#363b6c')];
}

/** Front road with a zebra crossing along the plate's outer edge. */
const frontRoad = () => place(road({ length: 20, width: 5, crossingAt: -2 }), { at: [0, 0.02, 14.6] });

function schoolStreet(lit: number): BufferGeometry[] {
  const teal = PALETTE.school;
  const parts = plateBase(teal, '#cdd8d1');
  parts.push(place(ground({ width: 22, depth: 14, color: '#ddd5c4', tile: 2.2, thickness: 0.05 }), { at: [0, 0.05, -2] }));
  parts.push(place(hdbBlock({ floors: 4, width: 22, depth: 6, floorHeight: 2.6, body: '#f1ead9', accent: teal, litWindows: lit, seed: 'school-block' }), { at: [0, 0, -11.5] }));
  // Sports hall with a teal gabled roof.
  const hall = new GeoBuilder();
  hall.box([-3, 0, -4.5], [3, 6, 4.5], { side: '#e9e2d0', top: '#d9d2c0', right: mixHex('#e9e2d0', teal, 0.25) });
  hall.quad([3.01, 1.2, 3.5], [3.01, 1.2, -3.5], [3.01, 2.4, -3.5], [3.01, 2.4, 3.5], '#ffd58a', 0.4 + lit * 0.6);
  gable(hall, -3.3, 3.3, -4.8, 4.8, 6, 2.2, mixHex(teal, '#1d2440', 0.1), true);
  parts.push(place(hall.build(), { at: [-13.5, 0, -2] }));
  // Field with goals.
  const field = new GeoBuilder();
  field.box([-4, 0.02, -5.5], [4, 0.1, 5.5], { top: PALETTE.grass, side: '#4f7f69' });
  field.box([-3.6, 0.1, -0.06], [3.6, 0.12, 0.06], '#eef3e8');
  for (const z of [-5, 5]) {
    field.box([-1.4, 0.1, z - 0.08], [-1.25, 2, z + 0.08], '#f4efe6').box([1.25, 0.1, z - 0.08], [1.4, 2, z + 0.08], '#f4efe6');
    field.box([-1.4, 1.85, z - 0.08], [1.4, 2, z + 0.08], '#f4efe6');
  }
  parts.push(place(field.build(), { at: [13, 0, -1.5] }));
  // School gate with a blank sign beam, fences either side and the covered walkway to the block.
  const gate = new GeoBuilder();
  for (const x of [-3.6, 3.6]) gate.box([x - 0.6, 0, -0.6], [x + 0.6, 3.8, 0.6], { side: teal, top: mixHex(teal, '#ffffff', 0.4) });
  gate.box([-4.3, 3.8, -0.5], [4.3, 4.7, 0.5], { side: '#f4efe6', top: teal });
  gate.quad([-2.8, 3.95, 0.51], [2.8, 3.95, 0.51], [2.8, 4.55, 0.51], [-2.8, 4.55, 0.51], '#fff8e6', 0.5);
  parts.push(place(gate.build(), { at: [0, 0, 5.5] }));
  for (const x of [-8.6, 8.6]) parts.push(place(fence({ length: 8.2, height: 1.4, color: '#5c6680' }), { at: [x, 0, 5.5] }));
  parts.push(place(coveredWalkway({ length: 12, width: 2.6, height: 2.8, roof: teal }), { at: [0, 0, -1.6], rotY: Math.PI / 2 }));
  // Canteen under a teal-tinted zinc roof.
  parts.push(place(pavilion(7, 5, 3, mixHex(PALETTE.zinc, teal, 0.35)), { at: [-10.5, 0, 9.2] }));
  for (const x of [-12, -9]) parts.push(place(tableSet({ stools: 4 }), { at: [x, 0, 9.2] }));
  // Bus stop with a bench and a lit timetable board, and a bus pulling in.
  parts.push(place(coveredWalkway({ length: 5, width: 1.8, height: 2.6, roof: teal }), { at: [10.5, 0, 11] }));
  parts.push(place(signboard({ width: 1, height: 1.6, lit: true, panel: '#fff3d6' }), { at: [13.6, 0, 11.6] }));
  parts.push(place(bus(), { at: [4.5, 0.05, 15.4] }));
  parts.push(frontRoad());
  return parts;
}

function retailDistrict(lit: number): BufferGeometry[] {
  const coral = PALETTE.retail;
  const parts = plateBase(coral, '#ddd1d1');
  parts.push(place(ground({ width: 16, depth: 11, color: '#e6d8cd', tile: 2, thickness: 0.05 }), { at: [0, 0.05, 2.5] }));
  // Mall atrium: banded box, glass curtain wall whose panes light up with trust, and a glass dome.
  const mall = new GeoBuilder();
  const rand = seededRandom('mall-glass');
  mall.box([-9, 0, -4.75], [9, 11, 4.75], { side: '#f3e6dc', top: '#cbbfc6', front: '#e9dbd2' });
  for (const y of [3.6, 7.3, 10.6]) mall.box([-9.05, y - 0.35, -4.8], [9.05, y, 4.8], coral);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      const x0 = -8 + col * 2;
      const y0 = 0.5 + row * 3.6;
      const on = rand() < 0.25 + lit;
      mall.quad([x0, y0, 4.77], [x0 + 1.7, y0, 4.77], [x0 + 1.7, y0 + 2.6, 4.77], [x0, y0 + 2.6, 4.77], on ? '#ffd9b0' : '#4a5585', on ? 0.75 : 0);
    }
  }
  mall.box([-3.2, 3.2, 4.75], [3.2, 3.6, 7.2], { side: coral, top: mixHex(coral, '#ffffff', 0.3) });
  mall.lathe([[4.6, 0], [4.2, 1.8], [3, 3.3], [1.4, 4.2], [0, 4.5]], 10, (r) => (r < 2 ? '#bfe3f2' : '#d8f0fa'), { center: [0, 11, 0], glow: 0.35 });
  parts.push(place(mall.build(), { at: [0, 0, -10.5] }));
  // Trust-lit HDB block on the right flank.
  parts.push(place(hdbBlock({ floors: 9, width: 12, depth: 5, body: '#efe1d7', accent: coral, litWindows: lit, seed: 'retail-hdb' }), { at: [13.2, 0, -2.5], rotY: Math.PI / 2 }));
  // Shophouse row on the left flank; the middle one is the always-open MiniMart 24.
  const row: [number, string, number][] = [[-5, '#f6c9b5', 2], [0, '#f6f1e6', 2], [5, '#c9e0d8', 3]];
  for (const [z, color, storeys] of row) {
    const minimart = color === '#f6f1e6';
    parts.push(place(shophouse({ width: 5, depth: 7.5, storeys, color, accent: minimart ? coral : '#3f8f74', lit: minimart || lit > 0.3 }), { at: [-12.6, 0, z], rotY: Math.PI / 2 }));
  }
  // Food court under a zinc roof, with stalls at the back, and the Boba Boleh kiosk.
  parts.push(place(pavilion(9, 7, 3.4, PALETTE.zinc), { at: [9.5, 0, 8] }));
  for (const [x, z] of [[7.5, 7], [11.5, 7], [7.5, 9.6], [11.5, 9.6]] as const) parts.push(place(tableSet({ stools: 4 }), { at: [x, 0, z] }));
  parts.push(place(kiosk({ width: 3, color: '#f4a582', awning: ['#fff3e6', coral], lit: true }), { at: [7.6, 0, 3] }));
  parts.push(place(kiosk({ width: 2.6, color: '#ffd6a5', awning: [coral, '#fff3e6'], lit: true }), { at: [-3, 0, 9] }));
  parts.push(frontRoad());
  return parts;
}

function digiDistrict(lit: number): BufferGeometry[] {
  const violet = PALETTE.digi;
  const pink = '#ff6fd8';
  const parts = plateBase(violet, '#cbc5de');
  // Neon plaza tiles with glowing grid lines.
  const plaza = new GeoBuilder();
  plaza.box([-7, 0, -5], [7, 0.08, 9], { top: '#3b3570', side: '#2e2a5c' });
  for (let x = -7; x <= 7.01; x += 2) plaza.quad([x - 0.05, 0.09, 9], [x + 0.05, 0.09, 9], [x + 0.05, 0.09, -5], [x - 0.05, 0.09, -5], '#a48cf5', 0.8);
  for (let z = -5; z <= 9.01; z += 2) plaza.quad([-7, 0.09, z + 0.05], [7, 0.09, z + 0.05], [7, 0.09, z - 0.05], [-7, 0.09, z - 0.05], '#7fd6ff', 0.6);
  parts.push(plaza.build());
  // Neon void deck: the HDB block whose open ground floor is lit with violet and pink strips.
  const deckH = 2.4 * 1.15;
  parts.push(place(hdbBlock({ floors: 10, width: 16, depth: 5.5, body: '#ddd7ef', accent: violet, litWindows: lit, seed: 'digi-a' }), { at: [-12.5, 0, -1], rotY: Math.PI / 2 }));
  const neon = new GeoBuilder();
  for (const [x, c] of [[-15.1, pink], [-9.9, violet]] as const) neon.box([x - 0.1, deckH - 0.35, -8.6], [x + 0.1, deckH - 0.15, 6.6], c, 1);
  neon.box([-15, 0.09, -8.4], [-10, 0.12, 6.4], '#6a55c9', 0.5);
  parts.push(neon.build());
  parts.push(place(hdbBlock({ floors: 8, width: 14, depth: 5.5, body: '#e4def3', accent: '#5cc4f2', litWindows: lit, seed: 'digi-b' }), { at: [12.5, 0, -2], rotY: Math.PI / 2 }));
  // Phone kiosk and the giant phone screen the DIVE flies into.
  parts.push(place(kiosk({ width: 3, color: '#463a8f', awning: [violet, pink], lit: true }), { at: [-1.5, 0, 5] }));
  const phone = new GeoBuilder();
  phone.box([-1.2, 0, -0.25], [1.2, 4.6, 0.25], { side: '#1f1d3d', top: '#2b2850' });
  phone.quad([-1, 0.4, 0.26], [1, 0.4, 0.26], [1, 4.3, 0.26], [-1, 4.3, 0.26], '#9f8cff', 1);
  phone.quad([1, 0.4, -0.26], [-1, 0.4, -0.26], [-1, 4.3, -0.26], [1, 4.3, -0.26], '#7fd6ff', 0.9);
  parts.push(place(phone.build(), { at: [3.2, 0.1, 4], rotY: -0.3 }));
  // Data hub at the back with a glowing stripe; neon boards on posts.
  const hub = new GeoBuilder();
  hub.box([-6, 0, -2.5], [6, 5, 2.5], { side: '#3a3470', top: '#2b2757' });
  hub.box([-6.05, 3.6, -2.55], [6.05, 4.0, 2.55], '#7fd6ff', 1);
  parts.push(place(hub.build(), { at: [0, 0, -13] }));
  parts.push(place(signboard({ width: 2.4, height: 1.4, elevation: 2.2, lit: true, panel: pink }), { at: [-5.5, 0, 11] }));
  parts.push(place(signboard({ width: 2.4, height: 1.4, elevation: 2.2, lit: true, panel: '#7fd6ff' }), { at: [5.5, 0, 11] }));
  parts.push(frontRoad());
  return parts;
}

function voidDeckCommons(_lit: number): BufferGeometry[] {
  const green = '#34d399';
  const parts = plateBase(green, '#cdd6cf');
  parts.push(place(hdbBlock({ floors: 9, width: 18, depth: 5.5, body: '#d6dbe4', accent: green, litWindows: 0.12, seed: 'vdc' }), { at: [0, 0, -10] }));
  // Playground and a sepak takraw court.
  const play = new GeoBuilder();
  play.box([-3.5, 0, -3], [3.5, 0.1, 3], { top: '#e07a5f', side: '#b8634c' });
  play.box([-1.5, 0.1, -1], [1.5, 2.6, 1], { side: '#ffd166', top: '#ef476f' });
  play.quad([1.5, 2.6, 1], [1.5, 2.6, -1], [3.4, 0.1, -1], [3.4, 0.1, 1], '#06d6a0');
  parts.push(place(play.build(), { at: [-8, 0, 6] }));
  parts.push(place(ground({ width: 7, depth: 10, color: '#2bb3a3', thickness: 0.05 }), { at: [9, 0.06, 5] }));
  parts.push(place(pavilion(5, 5, 2.8, '#c98b5a'), { at: [0, 0, 9] }));
  parts.push(place(crane(26), { at: [12.5, 0, -12] }));
  return parts;
}

function interchange(_lit: number): BufferGeometry[] {
  const amber = PALETTE.gold;
  const parts = plateBase(amber, '#d6d0dc');
  // Elevated MRT station: platform deck on piers with a barrel roof.
  const st = new GeoBuilder();
  for (const x of [-9, -3, 3, 9]) st.box([x - 0.6, 0, -1.2], [x + 0.6, 6, 1.2], '#c9c3d6');
  st.box([-11, 6, -3.5], [11, 7.2, 3.5], { side: '#b9b3c9', top: '#d9d3e3' });
  st.box([-11, 7.2, -3.6], [11, 8.6, -3.3], '#bfe3ff', 0.5);
  st.box([-11, 7.2, 3.3], [11, 8.6, 3.6], '#bfe3ff', 0.5);
  const arch = [-1, -0.6, -0.2, 0.2, 0.6, 1].map((u) => [u * 4, 10.6 - 1.6 * u * u] as const);
  for (let i = 0; i < arch.length - 1; i++) {
    const [z0, y0] = arch[i]!;
    const [z1, y1] = arch[i + 1]!;
    st.quad([-11.5, y0, z0], [11.5, y0, z0], [11.5, y1, z1], [-11.5, y1, z1], mixHex('#9aa3c0', amber, 0.15));
  }
  parts.push(place(st.build(), { at: [0, 0, -6] }));
  // Bus interchange canopy and parked buses.
  const canopy = new GeoBuilder();
  for (const x of [-6, 0, 6]) for (const z of [-3, 3]) canopy.box([x - 0.25, 0, z - 0.25], [x + 0.25, 4.5, z + 0.25], '#d9dde8');
  canopy.box([-7.5, 4.5, -4], [7.5, 5, 4], { side: '#8f95ad', top: amber });
  parts.push(place(canopy.build(), { at: [0, 0, 8] }));
  parts.push(place(bus('#f2c14e'), { at: [-3, 0.05, 8], rotY: Math.PI / 2 }));
  parts.push(place(bus('#2bb3a3'), { at: [3, 0.05, 8], rotY: Math.PI / 2 }));
  parts.push(place(crane(30), { at: [-12, 0, -12], rotY: Math.PI }));
  return parts;
}

/**
 * One district plate with everything on it, in plate-local coordinates (place the mesh at the spot, rotated by
 * spot.rotY). `trust` (-3..3) sets how many windows glow; negative trust frosts the unlit surfaces over.
 */
const DISTRICT_BUILDERS: Record<DistrictId, (lit: number) => BufferGeometry[]> = {
  'school-street': schoolStreet,
  'retail-district': retailDistrict,
  'digi-district': digiDistrict,
  'void-deck-commons': voidDeckCommons,
  interchange,
};

export function buildDistrict(id: DistrictId, trust: number): BufferGeometry {
  const geo = mergeKit(DISTRICT_BUILDERS[id](litWindowFraction(trust)));
  return spotById(id).fogged ? mute(geo) : frostOver(geo, frostAmount(trust));
}

// ---------------------------------------------------------------------------------------------------------
// Fog shrouds over the expansion plates
// ---------------------------------------------------------------------------------------------------------

/** Soft low-poly fog banks over a "coming soon" plate (plate-local; drawn translucent). */
export function buildFog(id: DistrictId, tier: QualityTier): BufferGeometry {
  const rand = seededRandom(`fog-${id}`);
  const b = new GeoBuilder();
  const n = tier === 'low' ? 7 : 12;
  const detail = tier === 'low' ? 0 : 1;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.4;
    const r = i % 3 === 0 ? rand() * 5 : 9 + rand() * 8;
    const y = 2 + rand() * 10;
    const light = rand() > 0.4;
    b.addPainted(
      new IcosahedronGeometry(1, detail),
      (f) => (f.normal.y > 0.3 ? '#eef3fb' : light ? '#d3dcec' : '#b6c2da'),
      { at: [Math.cos(a) * r, y, Math.sin(a) * r], scale: [6 + rand() * 5, 2.6 + rand() * 2.4, 5 + rand() * 4], rotY: rand() * 3 },
      0.15,
    );
  }
  // A low veil hugging the plate.
  b.addPainted(new CylinderGeometry(CITY.plate * 1.02, CITY.plate * 1.08, 3, 12, 1, true), '#c9d3e6', { at: [0, 1.2, 0] }, 0.1);
  return b.build();
}

// ---------------------------------------------------------------------------------------------------------
// Digi Sky: the same blocks redrawn as a glowing wireframe above the Digi-District (§4.1)
// ---------------------------------------------------------------------------------------------------------

/** Line segments with per-vertex colours (attribute `aColor`), for the sky layer's wireframe. */
class LineBuilder {
  private pos: number[] = [];
  private col: number[] = [];
  private tmp = new Color();

  seg(a: Vec3, b: Vec3, color: string): this {
    this.tmp.set(color);
    this.pos.push(...a, ...b);
    this.col.push(this.tmp.r, this.tmp.g, this.tmp.b, this.tmp.r, this.tmp.g, this.tmp.b);
    return this;
  }

  box(min: Vec3, max: Vec3, color: string, floors = 0): this {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const ys = [y0, y1];
    for (const y of ys) {
      this.seg([x0, y, z0], [x1, y, z0], color).seg([x1, y, z0], [x1, y, z1], color);
      this.seg([x1, y, z1], [x0, y, z1], color).seg([x0, y, z1], [x0, y, z0], color);
    }
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] as const) this.seg([x, y0, z], [x, y1, z], color);
    for (let f = 1; f < floors; f++) {
      const y = y0 + ((y1 - y0) * f) / floors;
      this.seg([x0, y, z1], [x1, y, z1], color).seg([x1, y, z0], [x0, y, z0], color);
    }
    return this;
  }

  ring(c: Vec3, r: number, n: number, color: string, phase = 0): this {
    for (let i = 0; i < n; i++) {
      const a0 = phase + (i / n) * Math.PI * 2;
      const a1 = phase + ((i + 1) / n) * Math.PI * 2;
      this.seg([c[0] + Math.cos(a0) * r, c[1], c[2] + Math.sin(a0) * r], [c[0] + Math.cos(a1) * r, c[1], c[2] + Math.sin(a1) * r], color);
    }
    return this;
  }

  dome(c: Vec3, r: number, color: string): this {
    for (let k = 1; k <= 3; k++) {
      const el = (k / 4) * (Math.PI / 2);
      this.ring([c[0], c[1] + Math.sin(el) * r, c[2]], Math.cos(el) * r, 12, color);
    }
    this.ring(c, r, 12, color);
    for (let m = 0; m < 6; m++) {
      const az = (m / 6) * Math.PI * 2;
      let prev: Vec3 = [c[0] + Math.cos(az) * r, c[1], c[2] + Math.sin(az) * r];
      for (let k = 1; k <= 4; k++) {
        const el = (k / 4) * (Math.PI / 2);
        const p: Vec3 = [c[0] + Math.cos(az) * Math.cos(el) * r, c[1] + Math.sin(el) * r, c[2] + Math.sin(az) * Math.cos(el) * r];
        this.seg(prev, p, color);
        prev = p;
      }
    }
    return this;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('aColor', new BufferAttribute(new Float32Array(this.col), 3));
    g.computeBoundingSphere();
    return g;
  }
}

/** Chat bubble: rounded slab with a tail (a solid, glowing app-world sign). */
function chatBubble(color: string, w = 3.4, h = 2): BufferGeometry {
  const b = new GeoBuilder();
  const hw = w / 2;
  const hh = h / 2;
  b.box([-hw, -hh + 0.25, -0.22], [hw, hh - 0.25, 0.22], color, 0.85);
  b.box([-hw + 0.25, -hh, -0.22], [hw - 0.25, hh, 0.22], color, 0.85);
  b.tri([-hw + 0.5, -hh, 0.22], [-hw + 1.3, -hh, 0.22], [-hw + 0.3, -hh - 0.8, 0.22], color, 0.85);
  b.tri([-hw + 1.3, -hh, -0.22], [-hw + 0.5, -hh, -0.22], [-hw + 0.3, -hh - 0.8, -0.22], color, 0.85);
  for (const x of [-0.8, 0, 0.8]) b.boxAt([x, 0, 0.24], [0.42, 0.42, 0.05], '#2a2f6b', 0.2);
  return b.build();
}

export interface DigiSky {
  /** Translucent glowing solids (platform, bubbles, booth lanterns, the DIVE beam). Plate-local. */
  fill: BufferGeometry;
  /** Wireframe (LineSegments with an `aColor` attribute). Plate-local. */
  lines: BufferGeometry;
}

export function buildDigiSky(tier: QualityTier): DigiSky {
  const base = CITY.skyBase;
  const violet = '#a48cf5';
  const cyan = '#7fd6ff';
  const pink = '#ff7ad9';
  const L = new LineBuilder();
  // Floating hex platform outline with a faint grid.
  L.ring([0, base, 0], CITY.plate * 0.82, 6, violet).ring([0, base, 0], CITY.plate * 0.62, 6, '#6f5cc8');
  for (let i = -3; i <= 3; i++) L.seg([i * 4, base, -13], [i * 4, base, 13], '#5a4bb0');
  // The ground blocks redrawn as glowing wireframes, plus app "places".
  L.box([-15.25, base, -9], [-9.75, base + 11, 7], violet, 6);
  L.box([9.75, base, -9], [15.25, base + 9, 5], cyan, 5);
  L.box([4, base, -13], [8, base + CITY.skyTop - base - 1, -9], pink, 8); // QuikGig tower
  L.ring([6, CITY.skyTop - 1, -11], 3.2, 8, pink);
  L.dome([-4.5, base, -10], 4, cyan); // the Arcade
  L.ring([0, base + 0.2, -1], 4.5, 8, '#c9b8ff'); // ChatLah plaza
  for (const x of [-7.5, -2.5, 2.5, 7.5]) {
    // Barang Market booths with awnings.
    L.box([x - 1.2, base, 5.2], [x + 1.2, base + 2.4, 6.8], '#f5d58a');
    L.seg([x - 1.3, base + 2.2, 7.3], [x + 1.3, base + 2.2, 7.3], '#f5d58a').seg([x - 1.3, base + 2.2, 7.3], [x - 1.2, base + 2.4, 6.8], '#f5d58a');
    L.seg([x + 1.3, base + 2.2, 7.3], [x + 1.2, base + 2.4, 6.8], '#f5d58a');
  }
  const F = new GeoBuilder();
  // Translucent floor.
  F.lathe([[CITY.plate * 0.82, base - 0.05], [0, base - 0.05]], 6, '#4b3d9e', { glow: 0.25, phase: Math.PI / 6 });
  // Chat bubbles over ChatLah plaza.
  const bubbles: [Vec3, string, number][] = [
    [[-2.5, base + 5, -1], '#f4efe6', 0.4],
    [[2.4, base + 7.4, 0.5], '#b8a6ff', -0.5],
    [[-0.5, base + 9.8, -2.5], '#7ee0d4', 0.2],
    [[3.5, base + 4, -3], '#ffd1ec', -0.2],
  ];
  const nb = tier === 'low' ? 2 : bubbles.length;
  for (const [at, color, rotY] of bubbles.slice(0, nb)) F.add(chatBubble(color), { at, rotY });
  // Review lanterns hanging over the market booths.
  for (const x of [-7.5, -2.5, 2.5, 7.5]) {
    for (const dx of [-0.6, 0.6]) F.add(tint(lantern(), '#f2c14e'), { at: [x + dx, base + 3, 6], scale: 2.4 });
  }
  // QuikGig tower beacon.
  F.addPainted(new OctahedronGeometry(0.9, 0), pink, { at: [6, CITY.skyTop + 0.6, -11] }, 1);
  // DIVE beam from the ground phone up into the sky layer.
  F.addPainted(new CylinderGeometry(0.55, 0.9, base - 4.7, 6, 1, true), '#b8a6ff', { at: [3.2, 4.7 + (base - 4.7) / 2, 4] }, 1);
  return { fill: F.build(), lines: L.build() };
}

// ---------------------------------------------------------------------------------------------------------
// The MRT train (§4.1): built along the rim from angle 0 forwards; spin the mesh about y to run it
// ---------------------------------------------------------------------------------------------------------

export const TRAIN_CARS = 4;

export function buildTrain(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const carLen = 11;
  const gap = 0.7;
  const y = 1.25;
  for (let i = 0; i < TRAIN_CARS; i++) {
    const b = new GeoBuilder();
    const hl = carLen / 2;
    b.box([-hl, 0.5, -1.45], [hl, 3.5, 1.45], { side: '#eef1f7', top: '#c5cbd9', front: '#dfe4ee', back: '#dfe4ee' });
    b.box([-hl - 0.02, 1.0, -1.47], [hl + 0.02, 1.35, 1.47], PALETTE.digi);
    for (const z of [1.47, -1.47]) {
      const zz = z + Math.sign(z) * 0.01;
      const pts = z > 0
        ? ([[-hl + 0.6, 1.6, zz], [hl - 0.6, 1.6, zz], [hl - 0.6, 2.75, zz], [-hl + 0.6, 2.75, zz]] as Vec3[])
        : ([[hl - 0.6, 1.6, zz], [-hl + 0.6, 1.6, zz], [-hl + 0.6, 2.75, zz], [hl - 0.6, 2.75, zz]] as Vec3[]);
      b.quad(pts[0]!, pts[1]!, pts[2]!, pts[3]!, '#ffe9bf', 0.85);
    }
    b.box([-hl + 1.2, 0, -1.1], [-hl + 2.8, 0.5, 1.1], PALETTE.ink).box([hl - 2.8, 0, -1.1], [hl - 1.2, 0.5, 1.1], PALETTE.ink);
    if (i === TRAIN_CARS - 1) {
      // Leading car: sloped windscreen and headlights.
      b.quad([hl + 0.03, 1.7, 1.2], [hl + 0.03, 1.7, -1.2], [hl + 0.03, 3.1, -1.2], [hl + 0.03, 3.1, 1.2], '#26305a');
      b.boxAt([hl + 0.05, 1.1, 0.9], [0.1, 0.3, 0.45], '#fff6d6', 1).boxAt([hl + 0.05, 1.1, -0.9], [0.1, 0.3, 0.45], '#fff6d6', 1);
    }
    // Centre of car i along the arc; rotY turns local +x along the direction of travel (increasing angle).
    const theta = ((i * (carLen + gap) + carLen / 2) / CITY.rim);
    parts.push(place(b.build(), { at: [Math.cos(theta) * CITY.rim, y, Math.sin(theta) * CITY.rim], rotY: -theta - Math.PI / 2 }));
  }
  return mergeKit(parts);
}

/** Spin (radians about y, applied to the train mesh) at time `t` seconds: one lap per CITY.trainPeriod. */
export const trainSpin = (t: number) => -((t % CITY.trainPeriod) / CITY.trainPeriod) * Math.PI * 2;

// ---------------------------------------------------------------------------------------------------------
// The bay under the floating city (§4.1): one wide disc with a soft radial gradient and each district's
// accent reflected in the water. The far rim fades into the Lighting fog, so it reads as a hazy horizon.
// ---------------------------------------------------------------------------------------------------------

const SEA_RADII = [0, 12, 24, 34, 42, 50, 58, 68, 78, 90, 110, 140, 190, 260, 360, 520, 800, 1200, 1700];
export const SEA_RADIUS = SEA_RADII[SEA_RADII.length - 1]!;

export function buildSea(segments = 64): BufferGeometry {
  const near = new Color('#3b4893');
  const mid = new Color('#283373');
  const far = new Color('#1d2556');
  const rimGlow = new Color('#7fb2e8');
  const reflections = DISTRICT_SPOTS.map((s) => ({ x: s.x, z: s.z, color: new Color(s.fogged ? '#8b95b6' : s.color), weight: s.fogged ? 0.1 : 0.32 }));
  const c = new Color();
  const colorAt = (x: number, z: number): Color => {
    const r = Math.hypot(x, z);
    c.copy(near).lerp(mid, Math.min(1, r / 95));
    if (r > 95) c.lerp(far, Math.min(1, (r - 95) / 260));
    for (const f of reflections) {
      const d = Math.hypot(x - f.x, z - f.z) / 24;
      if (d < 3) c.lerp(f.color, Math.exp(-d * d) * f.weight);
    }
    const k = (r - CITY.rim) / 7;
    if (Math.abs(k) < 3) c.lerp(rimGlow, Math.exp(-k * k) * 0.22);
    return c;
  };
  const pos: number[] = [];
  const col: number[] = [];
  const y = CITY.sea;
  const push = (x: number, z: number) => {
    pos.push(x, y, z);
    const k = colorAt(x, z);
    col.push(k.r, k.g, k.b);
  };
  for (let i = 0; i + 1 < SEA_RADII.length; i++) {
    const r0 = SEA_RADII[i]!;
    const r1 = SEA_RADII[i + 1]!;
    for (let j = 0; j < segments; j++) {
      const a0 = (j / segments) * Math.PI * 2;
      const a1 = ((j + 1) / segments) * Math.PI * 2;
      const p00: [number, number] = [Math.cos(a0) * r0, Math.sin(a0) * r0];
      const p01: [number, number] = [Math.cos(a1) * r0, Math.sin(a1) * r0];
      const p10: [number, number] = [Math.cos(a0) * r1, Math.sin(a0) * r1];
      const p11: [number, number] = [Math.cos(a1) * r1, Math.sin(a1) * r1];
      // Counter-clockwise seen from above (front faces up).
      if (r0 > 0) {
        push(...p00);
        push(...p01);
        push(...p11);
      }
      push(...p00);
      push(...p11);
      push(...p10);
    }
  }
  const geo = new BufferGeometry();
  const n = pos.length / 3;
  const normals = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) normals[i * 3 + 1] = 1;
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('normal', new BufferAttribute(normals, 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  // A little self-light so the water keeps its gradient under the dim Blue Hour key light.
  geo.setAttribute('glow', new BufferAttribute(new Float32Array(n).fill(0.35), 1));
  geo.computeBoundingSphere();
  return geo;
}

/** Ensures a geometry has kit attributes (for tests and defensive use). */
export const asKit = (g: BufferGeometry) => toKitGeometry(g);

/** World-space centre of a district plate (convenience for tests and the scene). */
export const plateCentre = (id: DistrictId): V3 => {
  const s = spotById(id);
  return [s.x, 0, s.z];
};
