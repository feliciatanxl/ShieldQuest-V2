// S2 Canteen and Locker Corridor: one layout shared by the 3D set, its geometry builder and its Flat View twin.
// Metres; y up; the camera side is +z. Left to right: the canteen (two hawker-style school stalls against the
// back wall, four long tables with attached benches), the notice board and wall clock, then the locker corridor
// running to the stairwell at the far right, with a small courtyard and a school bench in front of it. The
// classrooms of the next storey sit above the canteen's back overhang (the influence window lives there).
import type { AnchorSpot, SetPiece } from '../types';
import type { Oblique, SetStaging, Vec3 } from '../../core/staging';

export const CT = {
  floor: { x0: -7.2, x1: 8.2, z0: -4.0, z1: 3.2 },
  wallZ: -4.0,
  wallH: 3.2,
  /** Canteen (terrazzo) | corridor and courtyard boundary. */
  splitX: 1.7,
  /** Front edge of the corridor floor; the courtyard lies in front of it. */
  corridorZ: -1.6,
  /** The cut overhang along the back wall: shallow, so the live camera still sees the clock and wall fan. */
  overhang: { z1: -3.2, y0: 3.2, y1: 3.5 },
  stalls: [
    { x0: -7.0, x1: -4.5, color: '#f26b5b', kind: 'noodles' },
    { x0: -4.3, x1: -1.5, color: '#2bb3a3', kind: 'drinks' },
  ] as const,
  /** Stall counter front (the stalls are 1.25 m deep). */
  counterZ: -2.75,
  /** Freestanding menu board at the drinks stall's corner (blank: its words are a DOM label). */
  menu: { at: [-1.85, 0, -2.35] as Vec3, rotY: 0.3, w: 0.8, y0: 0.72, y1: 1.62 },
  fridge: { x0: -2.3, x1: -1.65 },
  /** Long tables (centre; length along x). */
  tables: [
    [-5.6, 0, -0.4],
    [-2.6, 0, -0.4],
    [-5.6, 0, 1.9],
    [-2.6, 0, 1.9],
  ] as Vec3[],
  tableLength: 2.2,
  notice: { x: 0.55, y0: 1.0, w: 1.6, h: 1.05 },
  clock: [0.55, 2.62, -3.98] as Vec3,
  clockR: 0.24,
  lockers: { x0: 2.2, x1: 6.4, depth: 0.45, h: 1.9, cols: 10, rows: 2 },
  cooler: [6.75, 0, -3.72] as Vec3,
  /** Stairwell doorway in the back wall at the corridor's end. */
  stairDoor: { x0: 7.1, x1: 7.8, h: 2.1 },
  /** Short return wall closing the corridor at the far right (the stairwell is behind it). */
  endWall: { x0: 7.85, x1: 8.2, z1: -1.6 },
  pillar: [1.75, 0, -1.75] as Vec3,
  /** Wall fans: pivot, base yaw. One on the back wall, one on the corner pillar. */
  fans: [
    { at: [-0.75, 2.55, -3.66] as Vec3, yaw: 0 },
    { at: [1.47, 2.5, -1.75] as Vec3, yaw: -Math.PI / 2 + 0.2 },
  ],
  bench: { at: [4.6, 0, 0.78] as Vec3, rotY: -0.2, length: 1.8 },
  planter: { x0: 7.45, x1: 8.1, z0: -0.9, z1: 2.9 },
  upper: { y0: 3.5, y1: 6.9, z1: -4.0, z0: -6.4 },
} as const;

export const CANTEEN_ANCHORS: Record<string, AnchorSpot> = {
  // The far bench of the second table (sitters face the camera across the table).
  table: { position: [-2.2, 0, -1.02], facing: 0, hotspotOffset: [0, 1.55, 0.35], label: 'Canteen table' },
  'drinks-stall': { position: [-2.9, 0, -2.1], facing: 0.2, hotspotOffset: [0, 1.85, -0.25], label: 'Drinks stall' },
  lockers: { position: [3.9, 0, -3.0], facing: 0.25, hotspotOffset: [0.2, 1.8, -0.35], label: 'Lockers' },
  corridor: { position: [7.1, 0, -2.75], facing: -1.2, hotspotOffset: [0, 1.8, 0.1], label: 'End of the corridor' },
  noticeboard: { position: [0.55, 0, -3.15], facing: 0.1, hotspotOffset: [0, 1.75, -0.55], label: 'Notice board' },
  bench: { position: [4.59, 0, 0.83], facing: -0.2, hotspotOffset: [0, 1.5, 0.1], label: 'School bench' },
};

export const CANTEEN_CAMERA: SetPiece['camera'] = {
  live: { position: [4.0, 12.0, 20.2], target: [0.5, 1.15, -0.9], fov: 30 },
  orbit: { target: [0.5, 1.1, -1.0], minDistance: 9, maxDistance: 38 },
};

export const CANTEEN_STAGING: SetStaging = {
  // A lit classroom window on the storey above the overhang, over the lockers.
  influence: { position: [5.6, CT.overhang.y1, -3.65], facing: 0 },
  seats: {
    // Standing at the table means the free end of it; standing at the bench means just in front of it.
    table: [-1.15, 0, -0.62],
    bench: [4.46, 0, 1.45],
  },
  // Rain only over the open courtyard.
  rain: { position: [4.95, 0, 0.8], area: [6.3, 7, 4.6], intensity: 0.6 },
  labels: [
    { position: [-5.75, 2.62, -2.68], text: 'Noodles' },
    { position: [-2.9, 2.62, -2.68], text: 'Drinks' },
    { position: [-1.85, 1.5, -2.32], text: 'Menu', size: 'small' },
    { position: [0.55, 2.22, -3.9], text: 'Notices', size: 'small' },
    { position: [4.3, 2.12, -3.7], text: 'Lockers', size: 'small' },
  ],
};

/** Flat View projection (viewBox 0 0 400 250): front-right diorama view matching the live camera. */
export const CANTEEN_OBLIQUE: Oblique = { ox: 184, oy: 190, s: 21, sz: 9.5, sx: -2.6 };
