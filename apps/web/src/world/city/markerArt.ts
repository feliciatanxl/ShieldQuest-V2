// Mission marker icons (GAME_DESIGN.md §4.2-4.3): one set of SVG path data drawn by both the 3D city (into a
// canvas atlas via Path2D) and the 2D map (as <path> elements), so the two views always agree. State is carried
// by SHAPE + ICON, never colour alone: circle + spark (new), shield + tick (done), diamond + "!" (Aftershock,
// the same diamond the hub's "attention" status badge uses). The words live in the DOM.
// Pure data (no three.js, no DOM).
import type { MarkerState } from './layout';

/** Every icon is drawn in a 48 x 48 box. */
export const MARKER_BOX = 48;

export interface MarkerOp {
  d: string;
  fill?: string;
  stroke?: string;
  width?: number;
  dash?: readonly number[];
}

/** SVG path for a circle (two arcs), usable by SVG and Path2D alike. */
export const circlePath = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

export const MARKER_COLORS = {
  gold: '#f2c14e',
  navy: '#142033',
  paper: '#f4efe6',
  ink: '#1d2440',
  safe: '#1fb5a8',
  frost: '#cfe8ff',
  frostDark: '#26346a',
} as const;

const C = MARKER_COLORS;

export const MARKER_ART: Record<MarkerState, readonly MarkerOp[]> = {
  // New: a dotted gold ring round a dark disc with a four-point spark.
  new: [
    { d: circlePath(24, 24, 21.5), stroke: C.gold, width: 3.2, dash: [4.2, 3.4] },
    { d: circlePath(24, 24, 16.5), fill: C.navy, stroke: C.gold, width: 2.6 },
    { d: 'M24 12.5L26.7 21.3L35.5 24L26.7 26.7L24 35.5L21.3 26.7L12.5 24L21.3 21.3Z', fill: C.gold },
  ],
  // Done: a calm shield with a tick.
  done: [
    { d: 'M24 3.5L40.5 10.2V22C40.5 32.4 33.4 40.4 24 43.4C14.6 40.4 7.5 32.4 7.5 22V10.2Z', fill: C.safe, stroke: C.paper, width: 2.6 },
    { d: 'M15.8 23.6L21.6 29.3L32.6 17.6', stroke: C.ink, width: 4.2 },
  ],
  // Aftershock: a frosted diamond with "!" (something is still in motion).
  aftershock: [
    { d: 'M24 2.5L45.5 24L24 45.5L2.5 24Z', fill: C.frostDark, stroke: C.frost, width: 3 },
    { d: 'M24 9.5L38.5 24L24 38.5L9.5 24Z', stroke: C.frost, width: 1.2, dash: [2.2, 2.4] },
    { d: 'M24 15.5V27', stroke: C.frost, width: 4.4 },
    { d: circlePath(24, 32.8, 2.6), fill: C.frost },
  ],
};

/** Atlas cell per state (3D pins sample a 3-cell strip). */
export const MARKER_CELL: Record<MarkerState, number> = { new: 0, done: 1, aftershock: 2 };
