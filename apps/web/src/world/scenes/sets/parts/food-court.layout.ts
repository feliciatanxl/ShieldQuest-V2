// S4 Food Court and Pop-up Booth: one layout shared by the 3D set, its geometry builder and its Flat View twin.
// Metres; y up; the camera side is +z. Four hawker stalls line the back wall under a pitched zinc roof (cut
// away at the ridge so the camera sees in; the gable trusses at both ends show its full profile). Round tables
// with stools fill the hall between steel pillars; the tray-return station and a Boba Boleh pop-up booth sit
// at the right. A row of two-storey shophouses rises behind the roof (the influence window lives there).
import type { AnchorSpot, SetPiece } from '../types';
import type { Oblique, SetStaging, Vec3 } from '../../core/staging';

export const FC = {
  floor: { x0: -7.6, x1: 7.6, z0: -5.0, z1: 2.8 },
  wallZ: -5.0,
  wallH: 3.6,
  /** Pitched zinc roof: ridge along x; the back slope is sheeted, the front slope is cut away. */
  roof: { x0: -7.7, x1: 7.7, ridgeZ: -1.4, ridgeY: 5.6, backZ: -5.6, backY: 3.9, frontZ: 2.7, frontY: 3.75 },
  stalls: [
    { x0: -7.2, x1: -4.7, color: '#f26b5b', kind: 'chicken-rice' },
    { x0: -4.7, x1: -2.2, color: '#f2a23c', kind: 'laksa' },
    { x0: -2.2, x1: 0.3, color: '#2bb3a3', kind: 'drinks' },
    { x0: 0.3, x1: 2.8, color: '#5aa86a', kind: 'nasi-lemak' },
  ] as const,
  /** Front of the stall counters (stalls are 1.15 m deep). */
  counterZ: -3.85,
  /** Laksa stock pot on the back counter (steam rises from its lid). */
  pot: [-3.95, 1.0, -4.55] as Vec3,
  trayReturn: { x0: 3.6, x1: 5.0, z1: -4.35, h: 1.45 },
  booth: { x0: 5.3, x1: 7.4, backZ: -3.6, h: 2.5, counter: { x0: 5.5, x1: 7.2, z0: -2.35, z1: -1.85 } },
  /** "Filming a promo" standee beside the booth, and the ring light on its tripod. */
  standee: { at: [5.0, 0, -1.45] as Vec3, yaw: -0.35 },
  ringLight: { at: [7.15, 0, -1.25] as Vec3, yaw: -2.6 },
  /** Steel pillars under the ridge beam. */
  pillars: [
    [-4.6, 0, -1.4],
    [-0.4, 0, -1.4],
    [3.2, 0, -1.4],
  ] as Vec3[],
  /** Round tables (centre), each with four stools on the diagonals. */
  tables: [
    [-5.7, 0, -2.4],
    [-1.9, 0, -2.4],
    [1.9, 0, -2.4],
    [-5.7, 0, 0.7],
    [-1.9, 0, 0.7],
    [1.9, 0, 0.7],
  ] as Vec3[],
  tableR: 0.6,
  /** The QR payment sticker on the front-right table's top. */
  qr: [2.05, 0.77, 0.86] as Vec3,
  /** Ceiling fans hanging from the back slope (hub positions). */
  fans: [
    [-5.7, 4.35, -2.6],
    [-1.9, 4.35, -2.6],
    [1.9, 4.35, -2.6],
  ] as Vec3[],
  /** Two-storey shophouse row behind the hall (only what shows above the roof is built). */
  shophouses: { z: -6.6, y0: 1.8, y1: 6.9, width: 3.8, colors: ['#bfe3d2', '#f6cdb4', '#d9cdf2', '#f4e3a6'] },
  /** The influence window replaces this upper window of the shophouse row. */
  influenceX: 0.95,
} as const;

/** Stool positions around a round table at `at` (kit tableSet: four stools on the diagonals). */
export function stoolsOf(at: Readonly<Vec3>): Vec3[] {
  const d = FC.tableR + 0.38;
  return [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    return [at[0] + Math.sin(a) * d, 0, at[2] + Math.cos(a) * d];
  });
}

// Nadia's table is the front-middle one; she sits on its back-left stool facing the table (and the camera).
const SEAT = stoolsOf(FC.tables[4]!)[2]!;

export const FOOD_COURT_ANCHORS: Record<string, AnchorSpot> = {
  stall: { position: [-3.8, 0, -3.35], facing: 0.35, hotspotOffset: [0, 1.75, 0], label: 'Laksa stall' },
  table: { position: SEAT, facing: Math.PI / 4, hotspotOffset: [0.1, 1.55, 0.1], label: 'Round table' },
  'qr-sticker': { position: [1.9, 0, -0.25], facing: 0.1, hotspotOffset: [0.15, 1.05, 1.05], label: 'Payment sticker on a table' },
  'tray-return': { position: [4.3, 0, -3.55], facing: -0.9, hotspotOffset: [0, 1.75, 0], label: 'Tray return' },
  'popup-booth': { position: [6.35, 0, -2.95], facing: 0, hotspotOffset: [-1.35, 1.95, 1.5], label: 'Pop-up booth' },
  pillar: { position: [-0.35, 0, -1.07], facing: -1.0, hotspotOffset: [0, 1.75, 0], label: 'Pillar by the tables' },
};

export const FOOD_COURT_CAMERA: SetPiece['camera'] = {
  live: { position: [3.8, 12.6, 20.8], target: [-0.1, 1.3, -1.5], fov: 30 },
  orbit: { target: [-0.1, 1.2, -1.5], minDistance: 9, maxDistance: 38 },
};

export const FOOD_COURT_STAGING: SetStaging = {
  // A lit upstairs window in the shophouse row behind the roof.
  influence: { position: [FC.influenceX, 3.6, -6.3], facing: 0 },
  // Standing at the table means behind Nadia's stool, not on it.
  seats: { table: [SEAT[0] - 0.1, 0, SEAT[2] - 0.5] },
  // Sheltered under the zinc roof: no rain.
  rain: false,
  labels: [
    { position: [-5.95, 2.6, -3.78], text: 'Chicken Rice' },
    { position: [-3.45, 2.6, -3.78], text: 'Laksa' },
    { position: [-0.95, 2.6, -3.78], text: 'Drinks' },
    { position: [1.55, 2.6, -3.78], text: 'Nasi Lemak' },
    { position: [4.3, 1.85, -4.3], text: 'Tray return', size: 'small' },
    { position: [6.35, 2.75, -3.5], text: 'Boba Boleh pop-up', size: 'small' },
  ],
};

/** Flat View projection (viewBox 0 0 400 250): front-right diorama view matching the live camera. */
export const FOOD_COURT_OBLIQUE: Oblique = { ox: 196, oy: 200, s: 19, sz: 9.5, sx: -2.6 };
