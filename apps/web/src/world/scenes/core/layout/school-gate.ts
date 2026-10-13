// S1 School Gate and Bus Stop: one layout shared by the 3D set, its geometry builder and its Flat View twin.
// Metres; y up; the camera side is +z. North to south (back to front): the school field and building, the
// school fence with its gate and guard post, the pavement with the bus shelter and a Boba Boleh kiosk, then the
// road with a zebra crossing. The car park of the next block sits on the right.
import type { AnchorSpot, SetPiece } from '../../sets/types';
import type { Oblique, SetStaging, Vec3 } from '../staging';

export const SG = {
  pavement: { x0: -15, x1: 7.0, z0: -4.4, z1: 0.6 },
  /** Road centre line along x; its kerbs sit at z 0.6..0.9 and 6.3..6.6. */
  road: { at: [0, -0.15, 3.6] as Vec3, length: 30, width: 5.4, crossingX: -1.8 },
  southStrip: { z0: 6.6, z1: 8.6 },
  fenceZ: -4.4,
  fenceH: 1.7,
  /** The school's boundary runs from the left edge to here, then turns back north. */
  schoolEdgeX: 3.6,
  gate: { x0: -3.4, x1: -0.4 },
  guard: { x0: -6.2, x1: -4.2, z0: -5.8, z1: -4.0, h: 2.6 },
  school: { at: [-5, 0, -11] as Vec3, width: 16, depth: 5, floors: 2 },
  tree: [1.6, 0, -5.6] as Vec3,
  shelter: { x0: 2.0, x1: 5.8, z0: -0.85, z1: 0.55, h: 2.6 },
  shelterBench: { at: [4.7, 0, -0.62] as Vec3, length: 1.8 },
  bag: [4.15, 0.42, -0.52] as Vec3,
  busSign: [6.35, 0, 0.3] as Vec3,
  kiosk: { at: [-7.8, 0, -1.6] as Vec3, rotY: 0.5, width: 2.2, depth: 1.4 },
  carPark: { x0: 7.2, x1: 15, z0: -4.6, z1: 0.6 },
  parked: [
    [8.9, 0, -2.4],
    [11.9, 0, -2.4],
  ] as Vec3[],
  carParkSign: [7.45, 0, 0.25] as Vec3,
  block: { at: [11.5, 0, -7.6] as Vec3, floors: 6, width: 14, depth: 5 },
  lamps: [
    [-9.5, 0, 0.35],
    [0.6, 0, 0.35],
    [9.6, 0, 0.35],
  ] as Vec3[],
  /** Amber Belisha beacons at both ends of the zebra crossing (two on each pavement). */
  beacons: [
    [-3.45, 0, 0.3],
    [-0.15, 0, 0.3],
    [-3.45, 0, 6.95],
    [-0.15, 0, 6.95],
  ] as Vec3[],
  /** The car that drives past on the far (eastbound) lane. */
  laneZ: 2.3,
} as const;

export const SCHOOL_GATE_ANCHORS: Record<string, AnchorSpot> = {
  gate: { position: [-1.9, 0, -3.7], facing: 0.1, hotspotOffset: [0, 1.95, -0.55], label: 'School gate' },
  'guard-post': { position: [-4.3, 0, -3.45], facing: 0.55, hotspotOffset: [-0.6, 1.85, -1.0], label: 'Guard post' },
  'bus-stop': { position: [3.0, 0, 0.0], facing: 0.25, hotspotOffset: [-0.2, 1.8, 0.1], label: 'Bus stop' },
  bench: { position: [4.7, 0, -0.5], facing: 0, hotspotOffset: [-0.5, 1.05, 0.1], label: 'Bus stop bench' },
  crossing: { position: [-1.8, 0, 0.3], facing: 1.15, hotspotOffset: [0, 1.85, 0.1], label: 'Zebra crossing' },
  kiosk: { position: [-6.5, 0, -0.3], facing: 0.65, hotspotOffset: [-0.9, 2.1, -0.7], label: 'Bubble tea kiosk' },
  tree: { position: [1.3, 0, -3.5], facing: 0.2, hotspotOffset: [0.3, 1.8, -0.4], label: 'Rain tree' },
  'car-park': { position: [8.4, 0, -0.8], facing: -1.3, hotspotOffset: [0.6, 1.8, -0.9], label: 'Car park' },
};

export const SCHOOL_GATE_CAMERA: SetPiece['camera'] = {
  live: { position: [4.2, 13.6, 25.6], target: [0.6, 0.9, -1.4], fov: 30 },
  orbit: { target: [0.6, 0.9, -1.6], minDistance: 11, maxDistance: 42 },
};

export const SCHOOL_GATE_STAGING: SetStaging = {
  // A lit window on the first residential floor of the next block, above the car park.
  influence: { position: [7.2, 5.16, -4.75], facing: 0 },
  seats: { bench: [4.7, 0, 0.1] },
  rain: { position: [0, 0, -1.5], area: [30, 12, 18] },
  labels: [
    { position: [-1.9, 2.92, -4.2], text: 'Lumen Park School' },
    { position: [-8.05, 2.85, -1.95], text: 'Boba Boleh' },
    { position: [6.35, 2.55, 0.36], text: 'Bus stop', size: 'small' },
    { position: [7.45, 2.2, 0.32], text: 'P', size: 'small' },
  ],
};

/** Flat View projection (viewBox 0 0 400 250). */
export const SCHOOL_GATE_OBLIQUE: Oblique = { ox: 195, oy: 192, s: 17, sz: 8, sx: -2.5 };
