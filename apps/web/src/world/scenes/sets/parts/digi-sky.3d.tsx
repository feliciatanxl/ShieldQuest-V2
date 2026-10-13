// S6 Digi Sky (GAME_DESIGN.md §4.1, §14 "Behind the Stall"): the online city redrawn as light, floating in a
// starry night. Hexagonal islands joined by light bridges: Barang Market (a glossy five-star booth that is a
// cardboard front propped on sticks from behind, under identical review lanterns, beside an honest Barang
// Checkout stall), the ChatLah plaza with its bubble beacon and the link portal, the QuikGig tower with its job
// noticeboard, and the Arcade. Six draw calls: the merged islands, the sky dome (no fog, never hit-tested), the
// booth (mostly warm: players orbit behind it while time is held, so its cardboard must stay readable), and
// three moving meshes (chat bubbles, review lanterns, the portal swirl), pure functions of mission time that
// hold still while frozen. The arcade's magenta neon stutters by dimming its glow inside the merged geometry.
// Lazy-loaded (3D chunk): the set data and Flat View twin live in sets/digi-sky.tsx and parts/digi-sky.layout.ts.
import { useEffect, useLayoutEffect } from 'react';
import { BufferAttribute, type BufferGeometry, type Object3D } from 'three';
import {
  GeoBuilder,
  KitMesh,
  LANTERN_HEIGHT,
  PALETTE,
  bench,
  lantern,
  mixHex,
  seededRandom,
  setGlow,
  useKit,
  useKitGeometry,
  useKitMaterial,
  type KitMaterialUniforms,
} from '../../../kit';
import type { QualityTier } from '../../../quality';
import type { Vec3 } from '../../core/staging';
import type { SetPieceProps } from '../types';
import { AnimatedInstances, useAmbient, type InstanceLayout } from './anim';
import { DS, DS_BUBBLES, DS_LANTERN_POSTS, DS_LANTERNS } from './digi-sky.layout';
import { disc, facingQuad, floatingIsland, panel, ring, speechBubble, star, wireBox } from './props';

const TOP = '#232a5e';
const UNDER = '#272b68';
const VIOLET = PALETTE.digi;
const TEAL = '#2bd4c0';
const MAGENTA = '#ff5fa2';
const GOLD = PALETTE.gold;
const CARD = '#b98b5a';
const CARD_EDGE = '#9a7048';
const TAPE = '#dcc99c';
const STICK = '#8a6a48';
const GLASS = '#1b1f4a';

export interface DigiSkyOptions {
  tier: QualityTier;
  night: boolean;
}

/** A strut that glows (rails, poles, neon tubes at an angle). */
function glowStrut(b: GeoBuilder, from: Vec3, to: Vec3, radius: number, color: string, glow: number, segments = 4): GeoBuilder {
  const g = new GeoBuilder().strut(from, to, radius, segments, color).build();
  setGlow(g, glow);
  return b.add(g);
}

/**
 * The Barang booth in its own frame (facade at z = 0 facing +z): glossy pink and gold with five stars from the
 * front; from behind, plain cardboard with packing tape, propped up on three sticks weighed down with bricks.
 */
export function barangBooth(detail: boolean): BufferGeometry {
  const { w, h, sign } = DS.booth;
  const hw = w / 2;
  const b = new GeoBuilder();
  // The facade board and its sign band: glossy front, cardboard back and edges.
  b.box([-hw, 0, -0.03], [hw, h, 0.03], { side: CARD_EDGE, top: CARD_EDGE, front: '#ffd6ec', back: CARD }, 0, { bottom: true });
  b.box([-hw - 0.05, h, -0.03], [hw + 0.05, h + sign, 0.03], { side: CARD_EDGE, top: CARD_EDGE, bottom: CARD_EDGE, front: '#2a1f5e', back: CARD });
  panel(b, -hw, 0, hw, 0.95, 0.032, MAGENTA, 0.35);
  panel(b, -hw, 0.95, hw, 1.02, 0.033, GOLD, 0.6);
  if (detail) {
    // A gloss sheen: two pale diagonal streaks.
    for (const x of [-0.75, -0.45]) b.quad([x, 1.1, 0.034], [x + 0.12, 1.1, 0.034], [x + 0.42, h - 0.1, 0.034], [x + 0.3, h - 0.1, 0.034], '#ffffff', 0.45);
  }
  for (let i = 0; i < 5; i++) star(b, [-hw + 0.3 + (i * (w - 0.6)) / 4, h + sign / 2, 0.036], 0.19, GOLD, 0.95);
  // Neon outline round the board and sign (violet tubes).
  const tube = (x0: number, y0: number, x1: number, y1: number) => b.box([x0, y0, 0.03], [x1, y1, 0.075], '#c9b6ff', 1);
  tube(-hw - 0.08, 0, -hw - 0.02, h + sign);
  tube(hw + 0.02, 0, hw + 0.08, h + sign);
  tube(-hw - 0.08, h + sign, hw + 0.08, h + sign + 0.06);
  tube(-hw, h - 0.03, hw, h + 0.02);
  // Striped awning (front only).
  const stripes = detail ? 8 : 4;
  for (let i = 0; i < stripes; i++) {
    const x0 = -hw + (w * i) / stripes;
    const x1 = -hw + (w * (i + 1)) / stripes;
    const c = i % 2 === 0 ? MAGENTA : '#fff0f7';
    facingQuad(b, [x0, h - 0.12, 0.03], [x1, h - 0.12, 0.03], [x1, h - 0.48, 0.62], [x0, h - 0.48, 0.62], [0, 1, 0.6], c, 0.2);
    facingQuad(b, [x0, h - 0.12, 0.03], [x1, h - 0.12, 0.03], [x1, h - 0.48, 0.62], [x0, h - 0.48, 0.62], [0, -1, -0.6], mixHex(c, PALETTE.ink, 0.3));
  }
  // The "counter": a glossy front panel and a plank, also just cardboard on two sticks behind.
  b.box([-hw + 0.15, 0, 0.56], [hw - 0.15, 0.95, 0.6], { side: CARD_EDGE, top: CARD_EDGE, front: MAGENTA, back: CARD }, 0.15, { bottom: true });
  panel(b, -hw + 0.15, 0.4, hw - 0.15, 0.48, 0.602, GOLD, 0.6);
  b.box([-hw + 0.1, 0.95, 0.3], [hw - 0.1, 1.0, 0.66], { side: CARD_EDGE, top: '#f4e1c4' });
  for (const x of [-0.75, 0.75]) b.strut([x, 0, 0.4], [x, 0.95, 0.4], 0.025, 4, STICK);
  // The sealed box on offer (glowing) and two card packs.
  b.box([-0.28, 1.0, 0.36], [0.24, 1.4, 0.6], { side: mixHex(GOLD, PALETTE.ink, 0.25), front: GOLD, top: '#ffe9a8' }, 0.55, { bottom: true });
  panel(b, -0.28, 1.15, 0.24, 1.22, 0.602, VIOLET, 0.7);
  for (const [x, c] of [[0.45, TEAL], [0.62, '#ff9ec4']] as const) b.box([x, 1.0, 0.42], [x + 0.13, 1.2, 0.48], c, 0.4, { bottom: true });
  // Behind: packing tape on the cardboard, a batten, three sticks on bricks, and a small paper tag.
  const back = (x0: number, y0: number, x1: number, y1: number, c: string, glow = 0) =>
    facingQuad(b, [x0, y0, -0.033], [x1, y0, -0.033], [x1, y1, -0.033], [x0, y1, -0.033], [0, 0, -1], c, glow);
  back(-hw, 1.55, hw, 1.68, TAPE);
  back(-0.08, 0, 0.08, h, TAPE);
  back(-hw, h + 0.25, hw, h + 0.35, TAPE);
  if (detail) for (let x = -hw + 0.25; x < hw; x += 0.3) back(x, 0.05, x + 0.03, h - 0.05, CARD_EDGE);
  b.box([-hw + 0.1, 1.15, -0.1], [hw - 0.1, 1.23, -0.033], STICK);
  for (const x of [-0.9, 0.05, 0.95]) {
    b.strut([x, 1.75, -0.05], [x + 0.08, 0, -0.95], 0.035, 4, STICK);
    b.box([x - 0.05, 0, -1.08], [x + 0.21, 0.13, -0.86], { side: '#a65a46', top: '#bd6a52' });
  }
  b.strut([0.5, 1.62, -0.035], [0.52, 1.38, -0.06], 0.006, 3, '#efe7d6');
  back(0.4, 1.12, 0.66, 1.38, '#fffaf0', 0.25);
  return b.build();
}

/**
 * The honest stall next door, in its own frame (front +z): a low market cart under a light canopy, so it never
 * hides the Barang booth from an orbit, with a buyer-protection shield on its front.
 */
function marketCart(detail: boolean): BufferGeometry {
  const teal = '#2bb3a3';
  const b = new GeoBuilder();
  b.box([-0.62, 0.16, -0.36], [0.62, 1.0, 0.36], { side: mixHex(teal, PALETTE.ink, 0.3), front: teal, top: '#efe9df' }, 0.1);
  for (const x of [-0.45, 0.45]) b.box([x - 0.12, 0, 0.2], [x + 0.12, 0.24, 0.34], '#1d2440');
  for (const x of [-0.58, 0.58]) b.strut([x, 1.0, -0.32], [x, 2.05, -0.32], 0.025, 4, '#cfe8ff');
  const stripes = detail ? 6 : 3;
  for (let i = 0; i < stripes; i++) {
    const x0 = -0.75 + (1.5 * i) / stripes;
    const x1 = -0.75 + (1.5 * (i + 1)) / stripes;
    const c = i % 2 === 0 ? '#ffffff' : teal;
    facingQuad(b, [x0, 2.05, -0.45], [x1, 2.05, -0.45], [x1, 1.9, 0.62], [x0, 1.9, 0.62], [0, 1, 0.1], c, 0.2);
    facingQuad(b, [x0, 2.05, -0.45], [x1, 2.05, -0.45], [x1, 1.9, 0.62], [x0, 1.9, 0.62], [0, -1, -0.1], mixHex(c, PALETTE.ink, 0.3));
  }
  b.box([-0.62, 1.68, 0.56], [0.62, 1.9, 0.62], { side: teal, front: '#e9fffb' }, 0.6);
  // Neat stock on the counter and the buyer-protection shield.
  for (let i = 0; i < 3; i++) b.box([-0.45 + i * 0.32, 1.0, -0.12], [-0.2 + i * 0.32, 1.22, 0.12], [GOLD, '#cfe8ff', '#ff9ec4'][i]!, 0.25, { bottom: true });
  b.quad([-0.16, 0.62, 0.362], [0.16, 0.62, 0.362], [0.16, 0.84, 0.362], [-0.16, 0.84, 0.362], GOLD, 0.8);
  b.tri([-0.16, 0.62, 0.362], [0, 0.4, 0.362], [0.16, 0.62, 0.362], GOLD, 0.8);
  b.quad([-0.05, 0.56, 0.365], [0.05, 0.56, 0.365], [0.05, 0.78, 0.365], [-0.05, 0.78, 0.365], '#ffffff', 0.6);
  return b.build();
}

/** An arcade cabinet in its own frame (front +z): side art, glowing screen and marquee, joystick and buttons. */
function cabinet(detail: boolean): BufferGeometry {
  const b = new GeoBuilder();
  b.box([-0.34, 0, -0.32], [0.34, 1.78, 0.32], { side: '#2a1f5e', top: '#2a1f5e', front: '#3a2f7a' }, 0, { bottom: true });
  for (const x of [-0.341, 0.341]) {
    const toward: Vec3 = [x < 0 ? -1 : 1, 0, 0];
    facingQuad(b, [x, 0.25, -0.25], [x, 0.25, 0.25], [x, 1.5, 0.25], [x, 1.5, -0.25], toward, x < 0 ? MAGENTA : TEAL, 0.5);
    if (detail) facingQuad(b, [x * 1.001, 0.6, -0.12], [x * 1.001, 0.6, 0.12], [x * 1.001, 1.1, 0.12], [x * 1.001, 1.1, -0.12], toward, '#2a1f5e');
  }
  facingQuad(b, [-0.27, 1.05, 0.322], [0.27, 1.05, 0.322], [0.27, 1.48, 0.27], [-0.27, 1.48, 0.27], [0, 0.1, 1], TEAL, 0.95);
  b.box([-0.36, 1.55, 0.22], [0.36, 1.78, 0.36], { side: '#2a1f5e', front: GOLD }, 0.8);
  facingQuad(b, [-0.34, 0.88, 0.45], [0.34, 0.88, 0.45], [0.34, 1.0, 0.32], [-0.34, 1.0, 0.32], [0, 1, 0.5], '#4d3f9a');
  b.box([-0.34, 0.6, 0.32], [0.34, 0.88, 0.45], { side: '#2a1f5e', front: '#3a2f7a', top: '#4d3f9a' });
  b.strut([-0.15, 0.95, 0.4], [-0.15, 1.08, 0.4], 0.012, 4, '#c9cdd6');
  b.cylinder([-0.15, 1.06, 0.4], 0.035, 0.05, 5, MAGENTA, { glow: 0.6 });
  for (const [x, c] of [[0.05, GOLD], [0.15, TEAL], [0.25, MAGENTA]] as const) b.cylinder([x, 0.94, 0.39], 0.03, 0.03, 5, c, { glow: 0.8 });
  panel(b, -0.08, 0.2, 0.08, 0.4, 0.322, GOLD, 0.4);
  return b.build();
}

/** Claw machine in its own frame (front +z): base, glowing glass frame, prize heap and claw. */
function clawMachine(): BufferGeometry {
  const b = new GeoBuilder();
  b.box([-0.42, 0, -0.42], [0.42, 0.85, 0.42], { side: '#2a1f5e', front: VIOLET, top: '#3a2f7a' }, 0.1, { bottom: true });
  wireBox(b, [-0.42, 0.85, -0.42], [0.42, 1.85, 0.42], '#cfe8ff', 0.7, 0.025);
  b.box([-0.44, 1.85, -0.44], [0.44, 2.05, 0.44], { side: MAGENTA, top: '#2a1f5e' }, 0.7);
  const prizes = [TEAL, GOLD, '#ff9ec4', VIOLET, '#7cc47f', MAGENTA];
  prizes.forEach((c, i) => b.lathe([[0, 0], [0.09, 0.03], [0.1, 0.1], [0, 0.17]], 5, c, { center: [-0.24 + (i % 3) * 0.22, 0.85 + (i > 2 ? 0.09 : 0), -0.12 + (i > 2 ? 0.16 : 0)], glow: 0.2 }));
  b.strut([0.1, 1.85, 0.05], [0.1, 1.5, 0.05], 0.01, 3, '#c9cdd6');
  b.cylinder([0.1, 1.42, 0.05], 0.06, 0.08, 5, '#c9cdd6');
  return b.build();
}

/** Every static part of the sky layer as one kit geometry (the stuttering tubes come last). Pure (testable in Node). */
export function buildDigiSky({ tier }: DigiSkyOptions): BufferGeometry {
  const detail = tier !== 'low';
  const b = new GeoBuilder();
  const { islands: is } = DS;

  // --- Islands and the light bridges between them ---------------------------------------------------------
  floatingIsland(b, is.plaza.at, { radius: is.plaza.r, top: TOP, rim: TEAL, under: UNDER, rings: 2 });
  floatingIsland(b, is.barang.at, { radius: is.barang.r, top: TOP, rim: MAGENTA, under: UNDER, rings: 1 });
  floatingIsland(b, is.tower.at, { radius: is.tower.r, top: TOP, rim: TEAL, under: UNDER, rings: 1 });
  floatingIsland(b, is.arcade.at, { radius: is.arcade.r, top: TOP, rim: VIOLET, under: UNDER, rings: 1 });
  // Tiny islets drifting in the distance.
  if (detail) {
    for (const [at, r, rim] of [
      [[-3.2, -1.9, -4.6], 0.75, VIOLET],
      [[8.6, 0.9, -1.6], 0.6, TEAL],
      [[-9.6, 1.4, -3.4], 0.7, MAGENTA],
      [[1.4, -2.6, 4.6], 0.55, TEAL],
    ] as [Vec3, number, string][]) {
      floatingIsland(b, at, { radius: r, top: TOP, rim, under: UNDER, rings: 0, depth: r * 1.6 });
    }
  }
  for (const [a, c] of DS.bridges) {
    const dx = c[0] - a[0];
    const dz = c[2] - a[2];
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    const nx = -uz * 0.45;
    const nz = ux * 0.45;
    const a0: Vec3 = [a[0] - ux * 0.5, -0.05, a[2] - uz * 0.5];
    const c0: Vec3 = [c[0] + ux * 0.5, -0.05, c[2] + uz * 0.5];
    facingQuad(b, [a0[0] + nx, a0[1], a0[2] + nz], [c0[0] + nx, c0[1], c0[2] + nz], [c0[0] - nx, c0[1], c0[2] - nz], [a0[0] - nx, a0[1], a0[2] - nz], [0, 1, 0], '#2f3775', 0.15);
    facingQuad(b, [a0[0] + nx, -0.16, a0[2] + nz], [c0[0] + nx, -0.16, c0[2] + nz], [c0[0] - nx, -0.16, c0[2] - nz], [a0[0] - nx, -0.16, a0[2] - nz], [0, -1, 0], UNDER);
    for (const s of [1, -1]) {
      facingQuad(b, [a0[0] + nx * s, -0.16, a0[2] + nz * s], [c0[0] + nx * s, -0.16, c0[2] + nz * s], [c0[0] + nx * s, -0.05, c0[2] + nz * s], [a0[0] + nx * s, -0.05, a0[2] + nz * s], [nx * s, 0, nz * s], TEAL, 0.9);
      glowStrut(b, [a[0] + nx * s, 0.55, a[2] + nz * s], [c[0] + nx * s, 0.55, c[2] + nz * s], 0.03, TEAL, 1);
      for (const p of [a, c]) glowStrut(b, [p[0] + nx * s, 0, p[2] + nz * s], [p[0] + nx * s, 0.58, p[2] + nz * s], 0.035, '#cfe8ff', 0.6);
    }
  }

  // --- Barang Market: the five-star booth, the lantern posts and string, the honest stall next door --------
  for (const p of DS_LANTERN_POSTS) {
    b.strut([p[0], 0, p[2]], [p[0], p[1] + 0.1, p[2]], 0.04, 5, '#3a2f7a');
    b.box([p[0] - 0.07, p[1] + 0.1, p[2] - 0.07], [p[0] + 0.07, p[1] + 0.24, p[2] + 0.07], GOLD, 0.9);
  }
  const string = [DS_LANTERN_POSTS[0], ...DS_LANTERNS, DS_LANTERN_POSTS[1]];
  for (let i = 0; i + 1 < string.length; i++) glowStrut(b, string[i]!, string[i + 1]!, 0.012, '#ffe3a8', 0.7, 3);
  b.add(marketCart(detail), { at: DS.neighbour.at, rotY: DS.neighbour.yaw });

  // --- ChatLah plaza: the bubble beacon, the link portal, a bench, light-tile paths ------------------------
  const [bx, , bz] = DS.beacon.at;
  b.cylinder([bx, 0, bz], 0.3, 0.12, 8, '#2f3775', { top: TEAL, glow: 0.3 });
  b.strut([bx, 0.1, bz], [bx, DS.beacon.y - 0.4, bz], 0.05, 6, '#cfe8ff');
  b.add(speechBubble(1.6, 1.0, 0.2, { front: TEAL, back: mixHex(TEAL, PALETTE.ink, 0.35), edge: mixHex(TEAL, '#ffffff', 0.3), dots: '#ffffff', glow: 0.75 }), {
    at: [bx, DS.beacon.y, bz],
    rotY: 0.18,
  });
  const pt = DS.portal;
  const portal = new GeoBuilder();
  ring(portal, [0, pt.y, 0.06], pt.r, pt.r + 0.16, detail ? 24 : 14, VIOLET, 1);
  ring(portal, [0, pt.y, 0.065], pt.r + 0.16, pt.r + 0.22, detail ? 24 : 14, '#c9b6ff', 1);
  // The ring's back face and depth, so it reads from an orbit too.
  const segs = detail ? 24 : 14;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const p = (a: number, r: number, z: number): Vec3 => [Math.cos(a) * r, pt.y + Math.sin(a) * r, z];
    facingQuad(portal, p(a0, pt.r, -0.06), p(a0, pt.r + 0.22, -0.06), p(a1, pt.r + 0.22, -0.06), p(a1, pt.r, -0.06), [0, 0, -1], mixHex(VIOLET, PALETTE.ink, 0.3), 0.5);
    facingQuad(portal, p(a0, pt.r + 0.22, -0.06), p(a0, pt.r + 0.22, 0.065), p(a1, pt.r + 0.22, 0.065), p(a1, pt.r + 0.22, -0.06), [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0], '#5b4bc4', 0.4);
  }
  portal.box([-0.7, 0, -0.3], [0.7, 0.16, 0.3], { side: VIOLET, top: '#3a2f7a' }, 0.3);
  // A chain-link icon above the arch.
  for (const [dx, tilt] of [[-0.14, 0.6], [0.14, 0.6]] as const) {
    const link = new GeoBuilder();
    ring(link, [0, 0, 0], 0.13, 0.19, 10, '#cfe8ff', 1);
    portal.add(link.build(), { at: [dx, pt.y + pt.r + 0.55, 0.05], rotation: [0, 0, tilt], scale: [1.5, 0.85, 1] });
  }
  b.add(portal.build(), { at: pt.at, rotY: pt.yaw });
  b.add(bench({ length: 1.4, color: '#5b4bc4', frame: TEAL }), { at: DS.bench.at, rotY: DS.bench.yaw });
  if (detail) {
    // Glowing tiles leading from the bridges to the plaza centre.
    for (let i = 0; i < 5; i++) {
      for (const [x, z] of [[-2.0 + i * 0.36, -0.2 + i * 0.12], [1.75 - i * 0.32, -1.2 + i * 0.26], [2.3 - i * 0.4, 0.85 - i * 0.12]] as const) {
        b.quad([x - 0.12, 0.012, z + 0.12], [x + 0.12, 0.012, z + 0.12], [x + 0.12, 0.012, z - 0.12], [x - 0.12, 0.012, z - 0.12], i % 2 === 0 ? TEAL : VIOLET, 0.7);
      }
    }
  }

  // --- QuikGig tower: a glass core in a glowing frame, the job noticeboard, window strips, the emblem -------
  const tw = DS.tower;
  const H = tw.floors * tw.floorH;
  b.box([tw.x0, 0, tw.z0], [tw.x1, H, tw.z1], { side: GLASS, front: GLASS, top: '#2f3775' }, 0.05, { bottom: true });
  for (let f = 0; f < tw.floors; f++) {
    wireBox(b, [tw.x0, f * tw.floorH, tw.z0], [tw.x1, (f + 1) * tw.floorH, tw.z1], TEAL, 0.9, 0.045);
    if (f < 2) continue;
    for (let k = 0; k < 3; k++) {
      const y = f * tw.floorH + 0.45 + k * 0.6;
      panel(b, tw.x0 + 0.2, y, tw.x1 - 0.2, y + 0.18, tw.z1 + 0.006, k % 2 === 0 ? TEAL : VIOLET, 0.75);
      facingQuad(b, [tw.x1 + 0.006, y, tw.z1 - 0.2], [tw.x1 + 0.006, y, tw.z0 + 0.2], [tw.x1 + 0.006, y + 0.18, tw.z0 + 0.2], [tw.x1 + 0.006, y + 0.18, tw.z1 - 0.2], [1, 0, 0], k % 2 === 0 ? VIOLET : TEAL, 0.6);
    }
  }
  for (const y of [0.6, 1.4, 3.0, 3.8]) {
    facingQuad(b, [tw.x1 + 0.006, y, tw.z1 - 0.2], [tw.x1 + 0.006, y, tw.z0 + 0.2], [tw.x1 + 0.006, y + 0.14, tw.z0 + 0.2], [tw.x1 + 0.006, y + 0.14, tw.z1 - 0.2], [1, 0, 0], TEAL, 0.5);
  }
  const bd = DS.board;
  b.box([bd.x0, bd.y0, tw.z1], [bd.x1, bd.y1, tw.z1 + 0.06], { side: '#2a1f5e', front: '#3a2f7a', top: '#2a1f5e' }, 0.15);
  const cards = ['#f4efe6', '#ffd6ec', '#cfe8ff', '#fff2b8'];
  const cols = detail ? 4 : 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < cols; c++) {
      const cw = (bd.x1 - bd.x0 - 0.2) / cols;
      const x0 = bd.x0 + 0.1 + c * cw + 0.05;
      const y0 = bd.y0 + 0.12 + r * 0.5;
      const z = tw.z1 + 0.064;
      panel(b, x0, y0, x0 + cw - 0.1, y0 + 0.38, z, cards[(r + c) % cards.length]!, 0.45);
      disc(b, [x0 + (cw - 0.1) / 2, y0 + 0.36, z + 0.003], 0.025, 5, '#ff4d6d', 0.5);
      if ((r * cols + c) % 3 === 1) disc(b, [x0 + 0.12, y0 + 0.12, z + 0.003], 0.07, 8, GOLD, 0.8);
      else if (detail) panel(b, x0 + 0.06, y0 + 0.1, x0 + cw - 0.18, y0 + 0.14, z + 0.003, '#9c97b0');
    }
  }
  // QuikGig emblem on the roof: a "Q" ring with its tail, and a mast.
  const em = new GeoBuilder();
  ring(em, [0, 0, 0], 0.42, 0.56, 16, TEAL, 1);
  em.quad([0.25, -0.35, 0.002], [0.38, -0.45, 0.002], [0.62, -0.7, 0.002], [0.5, -0.6, 0.002], TEAL, 1);
  b.add(em.build(), { at: [(tw.x0 + tw.x1) / 2, H + 0.85, tw.z1 - 0.3] });
  b.strut([(tw.x0 + tw.x1) / 2 + 0.6, H, tw.z0 + 0.4], [(tw.x0 + tw.x1) / 2 + 0.6, H + 1.6, tw.z0 + 0.4], 0.03, 4, '#cfe8ff');

  // --- The Arcade: the sign frame and its neon tubes, cabinets and a claw machine -------------------------
  const as = DS.arcadeSign;
  const sign = new GeoBuilder();
  for (const x of [-as.w / 2, as.w / 2 - 0.16]) sign.box([x, 0, -0.08], [x + 0.16, as.h, 0.08], { side: '#2a1f5e', top: '#2a1f5e' }, 0, { bottom: true });
  sign.box([-as.w / 2, as.h - 0.55, -0.08], [as.w / 2, as.h, 0.08], { side: '#2a1f5e', front: '#1d1748' });
  b.add(sign.build(), { at: as.at, rotY: as.yaw });
  b.add(arcadeNeon(), { at: as.at, rotY: as.yaw });
  for (const c of DS.cabinets) b.add(cabinet(detail), { at: c.at, rotY: c.yaw });
  b.add(clawMachine(), { at: DS.claw.at, rotY: DS.claw.yaw });
  // Added LAST on purpose: the stuttering tubes are the final ARCADE_FLICKER_VERTS vertices of the merged
  // geometry, so the set can dim their glow in place without a draw call of their own.
  b.add(arcadeFlicker(), { at: as.at, rotY: as.yaw });
  return b.build();
}

/** A neon tube on the arcade sign, in the sign's own frame. */
function neonTube(b: GeoBuilder, x0: number, y0: number, x1: number, y1: number, color: string): GeoBuilder {
  return b.box([x0, y0, 0.08], [x1, y1, 0.13], color, 1);
}

/** The arcade sign's steady neon tubes and pixel invader (in the sign's own frame). */
export function arcadeNeon(): BufferGeometry {
  const { w, h } = DS.arcadeSign;
  const b = new GeoBuilder();
  neonTube(b, w / 2 - 0.12, 0.1, w / 2 - 0.04, h - 0.6, TEAL);
  neonTube(b, -w / 2 + 0.05, h - 0.52, w / 2 - 0.05, h - 0.46, TEAL);
  // A little pixel invader at the left of the sign (its word is a DOM label).
  const px = [
    [0, 1, 0, 0, 0, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 1, 0, 0, 0, 1, 0],
  ];
  const s = 0.05;
  px.forEach((row, r) =>
    row.forEach((on, c) => {
      if (on) b.quad([-w / 2 + 0.25 + c * s, h - 0.18 - r * s - s, 0.085], [-w / 2 + 0.25 + (c + 1) * s, h - 0.18 - r * s - s, 0.085], [-w / 2 + 0.25 + (c + 1) * s, h - 0.18 - r * s, 0.085], [-w / 2 + 0.25 + c * s, h - 0.18 - r * s, 0.085], GOLD, 1);
    }),
  );
  return b.build();
}

/** The arcade's tired magenta tubes, which stutter now and then (in the sign's own frame). */
export function arcadeFlicker(): BufferGeometry {
  const { w, h } = DS.arcadeSign;
  const b = new GeoBuilder();
  neonTube(b, -w / 2 + 0.04, 0.1, -w / 2 + 0.12, h - 0.6, MAGENTA);
  neonTube(b, -w / 2 + 0.05, h - 0.12, w / 2 - 0.05, h - 0.06, MAGENTA);
  return b.build();
}

/** Vertices in arcadeFlicker() (two closed boxes: 2 x 6 faces x 2 triangles x 3 vertices). */
export const ARCADE_FLICKER_VERTS = 72;

/** Seconds between two stutters of the magenta tubes. */
export const NEON_PERIOD = 7.3;

/**
 * Glow of the magenta tubes at mission time `time` (1 = fully lit): a double blink once every NEON_PERIOD
 * seconds. Each state lasts at least 0.25 s (well under three flashes a second) and the tubes only dim, never
 * go dark, so the stutter stays a small, gentle detail.
 */
export function neonGlow(time: number): number {
  const p = ((time % NEON_PERIOD) + NEON_PERIOD) % NEON_PERIOD;
  return (p >= 5.0 && p < 5.25) || (p >= 5.5 && p < 5.8) ? 0.35 : 1;
}

/**
 * The night sky around the layer (no fog; never hit-tested): a gradient drum, a star field and the city's
 * lights far below. Pure (testable in Node).
 */
export function buildSkyDome(tier: QualityTier): BufferGeometry {
  const b = new GeoBuilder();
  const cx = -0.5;
  const cz = -1.5;
  const R = 44;
  const segs = 28;
  // Gradient stops (height, colour), resampled into thin bands so the flat-shaded drum reads as a smooth sky.
  const stops: [number, string][] = [
    [30, '#050920'],
    [10, '#0b1239'],
    [-6, '#181b55'],
    [-20, '#2b2170'],
    [-32, '#3a2580'],
    [-48, '#1d1648'],
  ];
  const bands = tier === 'low' ? 8 : 14;
  const colourAt = (y: number) => {
    for (let k = 0; k + 1 < stops.length; k++) {
      const [y0, c0] = stops[k]!;
      const [y1, c1] = stops[k + 1]!;
      if (y <= y0 && y >= y1) return mixHex(c0, c1, (y0 - y) / (y0 - y1));
    }
    return stops[stops.length - 1]![1];
  };
  const at = (a: number, r: number, y: number): Vec3 => [cx + Math.sin(a) * r, y, cz + Math.cos(a) * r];
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const inward: Vec3 = [-Math.sin((a0 + a1) / 2), 0, -Math.cos((a0 + a1) / 2)];
    for (let k = 0; k < bands; k++) {
      const y0 = 30 - (78 * k) / bands;
      const y1 = 30 - (78 * (k + 1)) / bands;
      facingQuad(b, at(a0, R, y0), at(a1, R, y0), at(a1, R, y1), at(a0, R, y1), inward, colourAt((y0 + y1) / 2), 1);
    }
    // The floor far below: the city, in a deep violet haze.
    b.tri([cx, -48, cz], at(a1, R, -48), at(a0, R, -48), '#1a1442', 0.8);
  }
  const rand = seededRandom('digi-sky');
  // The city's lights far below, in loose blocks.
  const blocks = tier === 'low' ? 14 : 26;
  for (let k = 0; k < blocks; k++) {
    const a = rand() * Math.PI * 2;
    const r = 6 + rand() * 28;
    const bx = cx + Math.sin(a) * r;
    const bz = cz + Math.cos(a) * r;
    const colour = [GOLD, TEAL, '#ff9ec4', '#cfe8ff'][k % 4]!;
    for (let j = 0; j < 4; j++) {
      const x = bx + (j % 2) * 1.4 + rand() * 0.4;
      const z = bz + Math.floor(j / 2) * 1.4 + rand() * 0.4;
      const sz = 0.3 + rand() * 0.3;
      facingQuad(b, [x - sz, -47.8, z - sz], [x + sz, -47.8, z - sz], [x + sz, -47.8, z + sz], [x - sz, -47.8, z + sz], [0, 1, 0], colour, 1);
    }
  }
  // Stars, mostly in the band of sky the cameras look into (behind and below the islands).
  const stars = tier === 'low' ? 80 : tier === 'medium' ? 130 : 170;
  for (let i = 0; i < stars; i++) {
    const a = rand() * Math.PI * 2;
    const y = -40 + rand() * 56;
    const s = 0.14 + rand() * rand() * 0.36;
    const r = R - 0.6;
    const tx = Math.cos(a);
    const tz = -Math.sin(a);
    const c: Vec3 = [cx + Math.sin(a) * r, y, cz + Math.cos(a) * r];
    const inward: Vec3 = [-Math.sin(a), 0, -Math.cos(a)];
    const colour = i % 7 === 0 ? '#ffe3a8' : i % 5 === 0 ? '#cfe8ff' : '#ffffff';
    facingQuad(b, [c[0] - tx * s, c[1], c[2] - tz * s], [c[0], c[1] - s, c[2]], [c[0] + tx * s, c[1], c[2] + tz * s], [c[0], c[1] + s, c[2]], inward, colour, 1);
  }
  return b.build();
}

// ------------------------------------------------------------------------------------------------------------
// Moving parts: chat bubbles, review lanterns, the portal swirl and the neon stutter (pure functions of time).
// ------------------------------------------------------------------------------------------------------------

const BUBBLE_COLOURS = [TEAL, VIOLET, GOLD, '#ff9ec4', TEAL, VIOLET, '#7fd6cf'];

const bubbleLayout: InstanceLayout = (i, time, o: Object3D) => {
  const { at, scale } = DS_BUBBLES[i]!;
  o.position.set(at[0] + Math.sin(time * 0.4 + i * 1.9) * 0.08, at[1] + Math.sin(time * 1.15 + i * 1.7) * 0.14, at[2]);
  o.rotation.y = 0.22 + Math.sin(time * 0.5 + i) * 0.1;
  o.rotation.z = Math.sin(time * 0.8 + i * 2.3) * 0.05;
  o.scale.setScalar(scale);
};

/** A review lantern with its paper tag; every one is identical (they were all hung on the same day). */
export function reviewLantern(): BufferGeometry {
  const b = new GeoBuilder();
  b.add(lantern());
  b.strut([0, 0, 0], [0, -0.1, 0], 0.005, 3, '#efe7d6');
  for (const z of [0.006, -0.006]) {
    facingQuad(b, [-0.06, -0.22, z], [0.06, -0.22, z], [0.06, -0.1, z], [-0.06, -0.1, z], [0, 0, Math.sign(z)], '#fffaf0', 0.3);
  }
  star(b, [0, -0.16, 0.008], 0.035, GOLD, 0.6);
  return b.build();
}

const lanternLayout: InstanceLayout = (i, time, o: Object3D) => {
  const top = DS_LANTERNS[i]!;
  const yaw = DS.booth.yaw;
  // Sway in the plane of the string, pivoting at the loop on the string (not at the tassel).
  const sway = Math.sin(time * 1.05 + i * 0.85) * 0.06;
  const side = LANTERN_HEIGHT * Math.sin(sway);
  o.position.set(top[0] - Math.cos(yaw) * side, top[1] - LANTERN_HEIGHT * Math.cos(sway), top[2] + Math.sin(yaw) * side);
  o.rotation.y = yaw;
  o.rotation.z = -sway;
};

/** The swirl inside the link portal (XY plane facing +z, centred; spins about z). */
export function portalSwirl(detail = true): BufferGeometry {
  const b = new GeoBuilder();
  const r = DS.portal.r - 0.02;
  const arms = detail ? 12 : 8;
  for (let i = 0; i < arms; i++) {
    const a0 = (i / arms) * Math.PI * 2;
    const a1 = ((i + 1) / arms) * Math.PI * 2;
    const twist = 0.9;
    const p = (a: number, rr: number, z: number): Vec3 => [Math.cos(a + rr * twist) * rr, Math.sin(a + rr * twist) * rr, z];
    const c = i % 2 === 0 ? TEAL : VIOLET;
    for (const [ra, rb] of [[0, r * 0.5], [r * 0.5, r]] as const) {
      facingQuad(b, p(a0, ra, 0.01), p(a0, rb, 0.01), p(a1, rb, 0.01), p(a1, ra, 0.01), [0, 0, 1], c, ra === 0 ? 1 : 0.8);
      facingQuad(b, p(a0, ra, -0.01), p(a0, rb, -0.01), p(a1, rb, -0.01), p(a1, ra, -0.01), [0, 0, -1], mixHex(c, PALETTE.ink, 0.3), 0.5);
    }
  }
  disc(b, [0, 0, 0.015], 0.16, 8, '#ffffff', 1);
  return b.build();
}

const swirlLayout: InstanceLayout = (_i, time, o: Object3D) => {
  const p = DS.portal;
  o.position.set(p.at[0], p.y, p.at[2]);
  o.rotation.y = p.yaw;
  o.rotation.z = -time * 0.9;
};

/** The booth placed in the set (its own mesh). */
export function placedBooth(detail = true): BufferGeometry {
  return new GeoBuilder().add(barangBooth(detail), { at: DS.booth.at, rotY: DS.booth.yaw }).build();
}

/** The separately drawn meshes besides the merged islands (geometry and instance count), for budget checks. */
export function digiSkyMoving(): { geometry: BufferGeometry; count: number }[] {
  return [
    { geometry: buildSkyDome('high'), count: 1 },
    { geometry: placedBooth(), count: 1 },
    { geometry: speechBubble(), count: DS_BUBBLES.length },
    { geometry: reviewLantern(), count: DS_LANTERNS.length },
    { geometry: portalSwirl(), count: 1 },
  ];
}

/**
 * How much of its colour the booth keeps while time is held (1 = fully warm). Players orbit behind it during
 * the Hold to find the cardboard and sticks, so it must not drain to still-blue; slightly under fully warm,
 * so it does not read as louder than the clue rings.
 */
export const BOOTH_WARMTH = 0.75;

/** The sky dome: kit material (so the Freeze drains it too) but no fog, no shadows and no pointer hits. */
function SkyDome({ quality }: { quality: QualityTier }) {
  const geometry = useKitGeometry(() => buildSkyDome(quality), [quality]);
  const material = useKitMaterial({ fog: false });
  return <mesh geometry={geometry} material={material} raycast={() => null} frustumCulled={false} renderOrder={-1} />;
}

/** The Barang booth: the kit material with partial warmth, so its cardboard back reads during the Hold. */
function Booth({ quality }: { quality: QualityTier }) {
  const geometry = useKitGeometry(() => placedBooth(quality !== 'low'), [quality]);
  const material = useKitMaterial({});
  useLayoutEffect(() => {
    (material.userData.kit as KitMaterialUniforms).uWarm.value = BOOTH_WARMTH;
  }, [material]);
  return <mesh geometry={geometry} material={material} castShadow={quality === 'high'} receiveShadow={quality === 'high'} />;
}

/**
 * Dims the arcade's magenta tubes (the last vertices of the merged set geometry) to neonGlow(time). Writes only
 * when the level changes, so a held or reduced-motion scene never touches the buffer.
 */
function useNeonStutter(geometry: BufferGeometry, time: number, steady: boolean): void {
  const { requestFrame } = useKit();
  const level = steady ? 1 : neonGlow(time);
  useEffect(() => {
    const glow = geometry.getAttribute('glow');
    if (!(glow instanceof BufferAttribute)) return;
    const start = glow.count - ARCADE_FLICKER_VERTS;
    if (start < 0 || Math.abs(glow.getX(glow.count - 1) - level) < 1e-3) return;
    for (let i = start; i < glow.count; i++) glow.setX(i, level);
    glow.clearUpdateRanges();
    glow.addUpdateRange(start, ARCADE_FLICKER_VERTS);
    glow.needsUpdate = true;
    requestFrame();
  }, [geometry, level, requestFrame]);
}

export default function DigiSkySet({ quality, frozen, t, timeOfDay }: SetPieceProps) {
  const night = timeOfDay === 'evening' || timeOfDay === 'night';
  const geometry = useKitGeometry(() => buildDigiSky({ tier: quality, night }), [quality, night]);
  const bubble = useKitGeometry(() => speechBubble(), []);
  const lanternGeo = useKitGeometry(() => reviewLantern(), []);
  const swirl = useKitGeometry(() => portalSwirl(quality !== 'low'), [quality]);
  const { time, running, reduced } = useAmbient(t, frozen);
  // Held time keeps whatever the tubes were doing; reduced motion keeps them steadily lit.
  useNeonStutter(geometry, time, reduced);
  return (
    <group>
      <SkyDome quality={quality} />
      <KitMesh geometry={geometry} />
      <Booth quality={quality} />
      <AnimatedInstances geometry={bubble} count={DS_BUBBLES.length} layout={bubbleLayout} t={time} running={running} colors={BUBBLE_COLOURS} />
      <AnimatedInstances geometry={lanternGeo} count={DS_LANTERNS.length} layout={lanternLayout} t={time} running={running} colors={['#ffd58a']} />
      <AnimatedInstances geometry={swirl} count={1} layout={swirlLayout} t={time} running={running} />
    </group>
  );
}
