// S3 Mall Atrium and MiniMart 24: one layout shared by the 3D set, its geometry builder and its Flat View twin.
// Metres; y up; the camera side is +z. Left: MiniMart 24 cut away (fridges along the back, two low shelf
// gondolas, the counter with a CCTV dome above it, a self-checkout and the sliding door). Right: the mall
// atrium with the lucky-draw booth and, at the back, the phone-accessory shop. The mall's upper storey runs
// along the back above a walkway (the influence window lives there). Shelves are low and open: nothing in the
// aisles is hidden, and no part of the set suggests where cameras cannot see.
import type { AnchorSpot, SetPiece } from '../types';
import type { Oblique, SetStaging, Vec3 } from '../../core/staging';

export const MM = {
  floor: { x0: -7.6, x1: 7.6, z0: -4.5, z1: 3.0 },
  wallZ: -4.5,
  wallH: 3.4,
  /** MiniMart 24 unit: x0..x1 between the back wall and its open shopfront at z = front. */
  shop: { x0: -7.6, x1: 0.8, front: 0.6 },
  /** Sliding door opening in the shopfront (each leaf is half of it). */
  door: { x0: -1.9, x1: -0.3, h: 2.2 },
  /** Drink fridges along the back wall. */
  fridges: { x0: -7.3, x1: -3.1, depth: 0.6, h: 2.0, doors: 6 },
  /** Shelf gondolas (along z, promo end caps facing the camera). */
  gondolas: [
    { x: -5.6, z0: -3.0, z1: -0.4, kind: 'snacks' },
    { x: -3.7, z0: -3.0, z1: -0.4, kind: 'beauty' },
  ] as const,
  /** Wall shelving along the left wall, facing +x. */
  wallShelf: { depth: 0.45, z0: -3.7, z1: 0.1, h: 1.7 },
  counter: { x0: -2.3, x1: 0.1, z0: -3.55, z1: -2.95, h: 1.0 },
  /** Restocking shelf on the wall behind the counter. */
  backShelf: { x0: -2.4, x1: 0.4, depth: 0.32 },
  /** Dome camera on a wall bracket above the counter, with its notice plate below. */
  cctv: [-1.0, 2.75, -4.15] as Vec3,
  /** Self-checkout kiosk (its screen faces the customer standing behind it). */
  kiosk: [-0.5, 0, -1.45] as Vec3,
  /** Brand lightbox high on the shop's back wall (blank: its words are a DOM label). */
  brand: { x0: -6.6, x1: -3.8, y0: 2.3, y1: 2.9 },
  /** Lucky-draw booth: backdrop wall, counter, prize wheel, prize pedestal and QR standee. */
  booth: { x0: 1.8, x1: 4.2, backZ: -2.0, h: 2.4, counter: { x0: 2.2, x1: 3.8, z0: -1.35, z1: -0.85 } },
  wheel: { at: [4.6, 0, -1.1] as Vec3, r: 0.55, y: 1.55, yaw: -0.35 },
  prize: [1.5, 0, -1.05] as Vec3,
  standee: { at: [4.15, 0, -0.25] as Vec3, yaw: -0.5 },
  /** Phone-accessory shop unit at the back right. */
  phoneShop: { x0: 4.8, x1: 7.6, front: -2.6, counter: { x0: 5.2, x1: 7.0, z0: -3.05, z1: -2.65 } },
  /** The mall's upper storey and the walkway along its front. */
  upper: { y0: 3.4, y1: 6.6, z0: -6.9, z1: -4.5 },
  walkway: { y1: 3.6, z1: -3.75 },
  /** Round columns carrying the walkway. */
  columns: [
    [1.05, 0, -4.05],
    [4.55, 0, -4.05],
  ] as Vec3[],
  /** Where the influence window breaks the row of upper shop windows (x centre). */
  influenceX: 2.6,
  planter: { x0: 6.0, x1: 7.4, z0: 1.0, z1: 2.4 },
  bench: { at: [5.0, 0, 1.75] as Vec3, rotY: -0.25, length: 1.6 },
} as const;

/** Balloon arch over the lucky-draw backdrop (centres, before the bob). */
export const MM_BALLOONS: Vec3[] = (() => {
  const out: Vec3[] = [];
  const { x0, x1, backZ, h } = MM.booth;
  const cx = (x0 + x1) / 2;
  const n = 13;
  for (let i = 0; i < n; i++) {
    const a = Math.PI - (i / (n - 1)) * Math.PI;
    out.push([cx + Math.cos(a) * ((x1 - x0) / 2 + 0.15), 0.55 + Math.sin(a) * (h + 0.35 - 0.55), backZ + 0.12]);
  }
  return out;
})();

export const MINIMART_ANCHORS: Record<string, AnchorSpot> = {
  // Between the two gondolas, among the snacks; turned towards the beauty aisle.
  'aisle-snacks': { position: [-4.65, 0, -1.3], facing: 0.6, hotspotOffset: [0, 1.75, 0], label: 'Snack aisle' },
  // Beside the beauty shelf (the right face of the second gondola).
  'aisle-beauty': { position: [-2.85, 0, -1.9], facing: -0.6, hotspotOffset: [0, 1.75, 0], label: 'Beauty aisle' },
  // Behind the counter, in front of the restocking shelf.
  counter: { position: [-1.5, 0, -3.95], facing: 0.15, hotspotOffset: [-0.6, 1.6, 0.7], label: 'Shop counter' },
  'self-checkout': { position: [-0.5, 0, -2.05], facing: 0.15, hotspotOffset: [0.45, 1.5, 0.55], label: 'Self-checkout' },
  // The floor beside the counter; the ring floats at the dome camera on the wall.
  cctv: { position: [0.45, 0, -3.4], facing: -0.4, hotspotOffset: [-0.95, 2.95, -0.7], label: 'Camera and notice above the counter' },
  // Just outside the sliding door, in the atrium.
  door: { position: [-1.2, 0, 1.35], facing: -0.4, hotspotOffset: [0, 1.75, 0], label: 'Sliding door' },
  'atrium-booth': { position: [1.95, 0, -0.1], facing: -0.5, hotspotOffset: [0.35, 1.8, -0.35], label: 'Lucky-draw booth' },
  'phone-shop': { position: [5.9, 0, -1.9], facing: -0.3, hotspotOffset: [0, 1.8, -0.3], label: 'Phone accessory shop' },
};

export const MINIMART_CAMERA: SetPiece['camera'] = {
  live: { position: [3.6, 12.2, 20.4], target: [0.0, 1.2, -1.0], fov: 30 },
  orbit: { target: [0.0, 1.1, -1.0], minDistance: 9, maxDistance: 38 },
};

export const MINIMART_STAGING: SetStaging = {
  // A lit upper-storey window across the atrium, on the walkway behind the booth.
  influence: { position: [MM.influenceX, MM.walkway.y1, -4.15], facing: 0 },
  // Indoors: no rain.
  rain: false,
  labels: [
    { position: [-5.2, 2.6, -4.4], text: 'MiniMart 24' },
    { position: [3.0, 2.05, -1.88], text: 'Lucky Draw' },
    { position: [6.2, 3.0, -2.5], text: 'Phone Accessories' },
    { position: [-1.0, 2.2, -4.4], text: 'CCTV in use', size: 'small' },
    { position: [-0.5, 1.55, -1.25], text: 'Self-checkout', size: 'small' },
  ],
};

/** Flat View projection (viewBox 0 0 400 250): front-right diorama view matching the live camera. */
export const MINIMART_OBLIQUE: Oblique = { ox: 196, oy: 196, s: 20, sz: 9.5, sx: -2.6 };
