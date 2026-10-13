// S5 Neon Void Deck and Phone Kiosk: one layout shared by the 3D set, its geometry builder and its Flat View twin.
// Metres; y up; the camera side is +z. The void deck is the open ground floor of an HDB-style slab block, drawn
// as a cutaway: the upper floors rise behind the back wall, the deck itself is open to the camera.
import type { AnchorSpot, SetPiece } from '../../sets/types';
import type { Oblique, SetStaging, Vec3 } from '../staging';

export const VD = {
  deck: { x0: -6.6, x1: 6.6, z0: -3.6, z1: 2.4 },
  wallZ: -3.6,
  wallH: 3.0,
  lift: { x0: -6.4, x1: -3.8, z1: -2.2 },
  letterboxes: { x0: -3.3, x1: -1.3, y0: 0.5, y1: 2.1 },
  notice: { x: 2.2, y0: 1.0, w: 1.6, h: 1.05 },
  table: [-0.6, 0, -0.6] as Vec3,
  /** Stool positions around the stone table (radius 0.98 at 45°, 135°, ...). */
  stools: [
    [0.09, 0, 0.09],
    [0.09, 0, -1.29],
    [-1.29, 0, -1.29],
    [-1.29, 0, 0.09],
  ] as Vec3[],
  bench: { at: [-3.4, 0, 1.0] as Vec3, rotY: 0.25, length: 1.8 },
  backBench: { at: [-0.1, 0, -3.0] as Vec3, rotY: 0, length: 1.6 },
  pillars: [
    [-6.1, 0, 1.6],
    [1.6, 0, 1.6],
  ] as Vec3[],
  kiosk: { at: [4.4, 0, -1.3] as Vec3, rotY: -0.35, width: 2.3, depth: 1.5 },
  lamp: [5.3, 0, 4.1] as Vec3,
  tree: [-5.6, 0, 5.4] as Vec3,
  block: { at: [0, 3.0, -5.8] as Vec3, floors: 3, width: 15, depth: 4.4 },
} as const;

export const VOID_DECK_ANCHORS: Record<string, AnchorSpot> = {
  bench: { position: [-3.4, 0, 1.06], facing: 0.25, hotspotOffset: [0, 1.75, 0.15], label: 'Bench' },
  'stone-table': { position: [0.09, 0, -1.29], facing: -0.785, hotspotOffset: [-0.4, 1.55, 0.4], label: 'Stone table' },
  letterboxes: { position: [-2.3, 0, -2.45], facing: 0.35, hotspotOffset: [0, 1.75, -0.6], label: 'Letterboxes' },
  'notice-board': { position: [2.2, 0, -2.45], facing: 0.1, hotspotOffset: [0, 1.6, -0.85], label: 'Notice board' },
  'lift-lobby': { position: [-5.1, 0, -1.35], facing: 0.15, hotspotOffset: [0, 1.75, -0.4], label: 'Lift lobby' },
  'phone-kiosk': { position: [3.15, 0, -0.15], facing: 1.1, hotspotOffset: [0.85, 1.9, -0.55], label: 'Phone kiosk' },
  pillar: { position: [1.6, 0, 2.18], facing: 0.15, hotspotOffset: [0, 1.75, -0.2], label: 'Pillar' },
};

export const VOID_DECK_CAMERA: SetPiece['camera'] = {
  live: { position: [3.1, 10.2, 16.9], target: [-0.5, 1.0, -0.6], fov: 30 },
  orbit: { target: [0, 1.1, -0.6], minDistance: 9, maxDistance: 34 },
};

export const VOID_DECK_STAGING: SetStaging = {
  // A lit window on the first residential floor, right of centre: the "skyline" end of the influence string.
  influence: { position: [3.6, 3.0, -3.25], facing: 0 },
  seats: {
    bench: [-3.26, 0, 1.6],
    'stone-table': [0.44, 0, -1.64],
  },
  // Rain falls beyond the shelter edge only (the open front and the far right).
  rain: { position: [0, 0, 4.3], area: [18, 7, 3.6], intensity: 0.8 },
  labels: [
    { position: [1.6, 2.55, 1.93], text: 'BLK 23' },
    { position: [4.6, 2.85, -1.7], text: 'Phone Fix & Cases', size: 'small' },
  ],
};

/** Flat View projection (viewBox 0 0 400 250): front-right diorama view matching the live camera. */
export const VOID_DECK_OBLIQUE: Oblique = { ox: 196, oy: 186, s: 24, sz: 11, sx: -3 };
