// S7 Bedroom Cutaway (night Peer Shield scenes): one layout shared by the 3D set, its geometry builder and its
// Flat View twin. Metres; y up; the camera side is +z. Only the back wall (z = -2.2) and the left wall
// (x = -2.6) stand, the diorama way, so the camera looks in from the front and the right. The flat is on an
// upper floor: the city's blocks and the rain sit outside, behind and to the left.
import type { AnchorSpot, SetPiece } from '../../sets/types';
import type { Oblique, SetStaging, Vec3 } from '../staging';

export const BR = {
  room: { x0: -2.6, x1: 2.6, z0: -2.2, z1: 2.0, h: 2.7 },
  bed: { x0: -2.55, x1: -0.55, z0: -2.15, z1: -0.75, top: 0.45 },
  /** Window in the left wall (spans z, y). */
  window: { z0: -0.35, z1: 0.95, y0: 1.0, y1: 2.15 },
  desk: { x0: -0.25, x1: 1.35, z0: -2.15, z1: -1.5, top: 0.75 },
  laptop: [0.85, 0.75, -1.85] as Vec3,
  lamp: [0.05, 0.75, -1.95] as Vec3,
  chair: [0.55, 0, -1.0] as Vec3,
  /** Door in the back wall (spans x), ajar, with the hallway light behind it. */
  door: { x0: 1.6, x1: 2.5, h: 2.05 },
  shelf: { x0: -2.6, x1: -2.22, z0: 1.05, z1: 1.95, h: 1.8 },
  rug: { x0: -1.1, x1: 1.5, z0: -0.5, z1: 1.3 },
  /** A standing fan in the front-right corner (its blades turn with mission time). */
  fan: [1.95, 0, 1.15] as Vec3,
  /** Phone lying on the bed (its notification glow blinks). */
  phone: [-1.0, 0.47, -1.15] as Vec3,
} as const;

export const BEDROOM_ANCHORS: Record<string, AnchorSpot> = {
  desk: { position: [0.55, 0, -1.0], facing: 2.6, hotspotOffset: [-0.45, 1.35, -0.55], label: 'Desk' },
  bed: { position: [-1.35, 0, -0.62], facing: 0.25, hotspotOffset: [0.35, 1.25, -0.5], label: 'Bed' },
  window: { position: [-1.95, 0, 0.3], facing: -1.2, hotspotOffset: [-0.55, 1.75, 0], label: 'Window' },
  laptop: { position: [0.85, 0, -1.4], facing: Math.PI, hotspotOffset: [0, 1.3, -0.45], label: 'Laptop' },
  door: { position: [2.05, 0, -1.45], facing: 0.3, hotspotOffset: [0, 1.75, -0.6], label: 'Bedroom door' },
  shelf: { position: [-1.8, 0, 1.5], facing: -1.3, hotspotOffset: [-0.35, 1.95, 0], label: 'Shelf' },
};

export const BEDROOM_CAMERA: SetPiece['camera'] = {
  live: { position: [3.9, 5.7, 8.7], target: [-0.1, 0.9, -0.3], fov: 30 },
  orbit: { target: [-0.1, 0.9, -0.4], minDistance: 5, maxDistance: 16 },
};

export const BEDROOM_STAGING: SetStaging = {
  // A lit window in the block across the street, seen to the right of the room above the city.
  influence: { position: [3.6, 1.6, -10.15], facing: 0 },
  seats: {
    bed: [-1.35, 0, -0.15],
    desk: [0.55, 0, -0.45],
  },
  // Rain falls outside: behind the back wall and beyond the window.
  rain: { position: [-0.5, -2.5, -6.2], area: [16, 10, 7.5], intensity: 0.8 },
  labels: [],
};

/** Flat View projection (viewBox 0 0 400 250): the room fills the middle, the skyline the top and right. */
export const BEDROOM_OBLIQUE: Oblique = { ox: 200, oy: 202, s: 42, sz: 22, sx: -6 };
