// S6 Digi Sky: the online city as a glowing night sky layer (GAME_DESIGN.md §4.1): one layout shared by the 3D
// set, its geometry builder and its Flat View twin. Metres; y up; the camera side is +z. Floating hexagonal
// islands joined by light bridges: Barang Market on the left (the glossy five-star booth that is cardboard on
// sticks from behind, under a string of review lanterns, with an honest Barang Checkout stall beside it), the
// ChatLah plaza in the middle (floating chat bubbles, the link portal), the QuikGig tower at the back right
// (the job noticeboard; the influence window is on its second floor) and the Arcade at the front right.
import type { AnchorSpot, SetPiece } from '../types';
import type { Oblique, SetStaging, Vec3 } from '../../core/staging';

export const DS = {
  islands: {
    plaza: { at: [0, 0, 0.3] as Vec3, r: 2.9 },
    barang: { at: [-5.9, 0, -0.8] as Vec3, r: 2.5 },
    tower: { at: [4.3, 0, -3.5] as Vec3, r: 2.2 },
    arcade: { at: [5.3, 0, 1.7] as Vec3, r: 1.9 },
  },
  /** Light bridges across the gaps (deck endpoints on the two islands). */
  bridges: [
    [
      [-2.45, 0, -0.25],
      [-3.75, 0, -0.65],
    ],
    [
      [1.95, 0, -1.35],
      [3.35, 0, -2.15],
    ],
    [
      [2.6, 0, 0.95],
      [3.75, 0, 1.45],
    ],
  ] as [Vec3, Vec3][],
  /**
   * The Barang booth: a facade board facing `yaw` (towards the plaza and the camera). From behind it is plain
   * cardboard propped on sticks, which an orbit round to the left (or a look from above) reveals.
   */
  booth: { at: [-5.9, 0, -1.0] as Vec3, yaw: 1.15, w: 2.4, h: 2.35, sign: 0.6 },
  /** The honest stall next door ("Pay with Barang Checkout"): a low cart that never hides the booth. */
  neighbour: { at: [-7.35, 0, 0.45] as Vec3, yaw: 0.75 },
  /** ChatLah beacon: a pole carrying the big bubble logo. */
  beacon: { at: [1.35, 0, -1.3] as Vec3, y: 3.6 },
  portal: { at: [-1.0, 0, -1.5] as Vec3, yaw: 0.15, r: 1.05, y: 1.35 },
  bench: { at: [-1.75, 0, 1.55] as Vec3, yaw: 0.7 },
  tower: { x0: 3.2, x1: 5.4, z0: -4.6, z1: -2.6, floors: 4, floorH: 2.3 },
  /** Job noticeboard on the tower's ground floor (front face). */
  board: { x0: 3.4, x1: 5.2, y0: 0.45, y1: 2.15 },
  /** Arcade: neon sign frame, two cabinets and a claw machine. */
  arcadeSign: { at: [5.95, 0, 0.75] as Vec3, yaw: -0.5, w: 2.4, h: 3.0 },
  cabinets: [
    { at: [5.15, 0, 1.3] as Vec3, yaw: -0.5 },
    { at: [5.95, 0, 1.75] as Vec3, yaw: -0.5 },
  ],
  claw: { at: [6.45, 0, 2.55] as Vec3, yaw: -0.6 },
} as const;

/** Points along a sagging string from a to c (pure maths: this file ships in the app shell, without three.js). */
function sag(a: Vec3, c: Vec3, depth: number, count: number): Vec3[] {
  return Array.from({ length: count }, (_, i): Vec3 => {
    const s = count === 1 ? 0.5 : i / (count - 1);
    return [a[0] + (c[0] - a[0]) * s, a[1] + (c[1] - a[1]) * s - depth * 4 * s * (1 - s), a[2] + (c[2] - a[2]) * s];
  });
}

const yawDir = (yaw: number): [number, number] => [Math.sin(yaw), Math.cos(yaw)];
const tangent = (yaw: number): [number, number] => [Math.cos(yaw), -Math.sin(yaw)];

/** The review-lantern string: parallel to the booth's facade, just behind and above it. */
export const DS_LANTERN_POSTS: [Vec3, Vec3] = (() => {
  const { at, yaw, w } = DS.booth;
  const [tx, tz] = tangent(yaw);
  const [fx, fz] = yawDir(yaw);
  const half = w / 2 + 0.45;
  const back = -0.42;
  return [
    [at[0] - tx * half + fx * back, 4.05, at[2] - tz * half + fz * back],
    [at[0] + tx * half + fx * back, 4.05, at[2] + tz * half + fz * back],
  ];
})();

/** Where each review lantern hangs (the top of its loop), along the sagging string. */
export const DS_LANTERNS: Vec3[] = sag(DS_LANTERN_POSTS[0], DS_LANTERN_POSTS[1], 0.32, 9).slice(1, -1);

/** Floating chat-bubble centres around the ChatLah beacon (before their bob). */
export const DS_BUBBLES: { at: Vec3; scale: number }[] = [
  { at: [0.35, 2.75, -1.75], scale: 0.9 },
  { at: [2.2, 2.45, -0.55], scale: 0.8 },
  { at: [0.75, 4.35, -1.1], scale: 1.0 },
  { at: [2.45, 3.75, -1.85], scale: 0.85 },
  { at: [-0.35, 3.75, -2.35], scale: 0.75 },
  { at: [1.85, 5.1, -2.2], scale: 0.7 },
  { at: [-1.95, 3.15, 0.25], scale: 0.7 },
];

const [bfx, bfz] = yawDir(DS.booth.yaw);
const [btx, btz] = tangent(DS.booth.yaw);

export const DIGI_SKY_ANCHORS: Record<string, AnchorSpot> = {
  // In front of the glossy stall; the ring floats behind the facade, where the cardboard and sticks are.
  'barang-booth': {
    position: [DS.booth.at[0] + bfx * 1.0, 0, DS.booth.at[2] + bfz * 1.0],
    facing: 0.2,
    hotspotOffset: [-bfx * 1.65, 1.25, -bfz * 1.65],
    label: 'Five-star market booth',
  },
  // Under the middle of the lantern string (the ring floats among the lanterns).
  'review-lanterns': {
    position: [DS.booth.at[0] - bfx * 0.42 - btx * 0.5, 0, DS.booth.at[2] - bfz * 0.42 - btz * 0.5],
    facing: 0.4,
    hotspotOffset: [0, 3.75, 0],
    label: 'Review lanterns',
  },
  'chatlah-plaza': { position: [-0.1, 0, 0.9], facing: 0.35, hotspotOffset: [0, 1.75, 0], label: 'Chat plaza' },
  'quikgig-tower': { position: [3.65, 0, -1.8], facing: 0.25, hotspotOffset: [0.65, 1.35, -0.72], label: 'Job tower noticeboard' },
  // Leaning on the left arcade cabinet, turned towards the plaza.
  arcade: { position: [4.5, 0, 1.85], facing: -1.1, hotspotOffset: [0, 1.75, 0], label: 'Arcade' },
  'link-portal': { position: [-0.9, 0, -0.75], facing: 0.2, hotspotOffset: [-0.1, 1.35, -0.72], label: 'Link portal' },
};

export const DIGI_SKY_CAMERA: SetPiece['camera'] = {
  live: { position: [3.6, 12.6, 21.0], target: [-0.5, 1.5, -1.0], fov: 30 },
  orbit: { target: [-0.5, 1.4, -1.0], minDistance: 9, maxDistance: 38 },
};

export const DIGI_SKY_STAGING: SetStaging = {
  // The second-floor window of the QuikGig tower, over the job board.
  influence: { position: [4.3, DS.tower.floorH, -2.3], facing: 0 },
  // Nothing falls in the online sky.
  rain: false,
  labels: [
    { position: [DS.booth.at[0] + bfx * 0.1, 2.68, DS.booth.at[2] + bfz * 0.1], text: 'Barang Market' },
    { position: [DS.neighbour.at[0], 2.3, DS.neighbour.at[2]], text: 'Barang Checkout', size: 'small' },
    { position: [DS.beacon.at[0], DS.beacon.y, DS.beacon.at[2] + 0.12], text: 'ChatLah' },
    { position: [(DS.board.x0 + DS.board.x1) / 2, DS.board.y1 + 0.02, DS.tower.z1 + 0.1], text: 'QuikGig jobs', size: 'small' },
    { position: [DS.arcadeSign.at[0], DS.arcadeSign.h - 0.05, DS.arcadeSign.at[2] + 0.05], text: 'Arcade' },
  ],
};

/** Flat View projection (viewBox 0 0 400 250): front-right diorama view matching the live camera. */
export const DIGI_SKY_OBLIQUE: Oblique = { ox: 206, oy: 192, s: 19, sz: 9.5, sx: -2.6 };
