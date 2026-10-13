// Pure helpers for the City Board and the Locker: ring geometry, tile words, mission picks.
// No React and no storage, so the words the board shows and announces stay consistent.
import {
  BOARD,
  BOARD_DISTRICTS,
  districtById,
  districtTiles,
  miniGameById,
  type BandId,
  type BoardTile,
  type DistrictId,
  type Mission,
  type Progress,
} from '@shieldquest/shared';
import { districtSummary } from '../hub/hubData';

export const TILE_COUNT = BOARD.length;
/** Tile centres sit on this radius (percent of the board width); the token stands just inside it. */
export const TILE_RADIUS = 42;
export const TOKEN_RADIUS = 31;

/** Angle of tile i in degrees, HQ at the top, going clockwise. */
export const tileAngle = (i: number): number => -90 + (i * 360) / TILE_COUNT;

/** Position (percent of the board box) of a point at `radius` for tile i. */
export function ringPoint(i: number, radius: number): { x: number; y: number } {
  const a = (tileAngle(i) * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(a), y: 50 + radius * Math.sin(a) };
}

/** SVG arc path (viewBox 0 0 100 100) covering a district's six tiles. */
export function districtArc(d: DistrictId, radius = TILE_RADIUS): string {
  const idx = BOARD.map((t, i) => (t.district === d ? i : -1)).filter((i) => i >= 0);
  const half = 180 / TILE_COUNT;
  const from = ((tileAngle(idx[0]!) - half + 2) * Math.PI) / 180;
  const to = ((tileAngle(idx[idx.length - 1]!) + half - 2) * Math.PI) / 180;
  const p = (a: number) => `${(50 + radius * Math.cos(a)).toFixed(2)} ${(50 + radius * Math.sin(a)).toFixed(2)}`;
  return `M ${p(from)} A ${radius} ${radius} 0 0 1 ${p(to)}`;
}

export type TileGlyph = 'hq' | 'bonus' | 'quiz' | 'chance' | 'mission' | 'wordsearch' | 'real-or-fake' | 'money-trail';

export function tileGlyph(t: BoardTile): TileGlyph {
  if (t.kind === 'hq') return 'hq';
  if (t.kind === 'bonus') return 'bonus';
  if (t.kind === 'chance') return t.district ? 'chance' : 'quiz';
  if (t.kind === 'mission') return 'mission';
  return t.minigame ?? 'wordsearch';
}

export const isCorner = (t: BoardTile): boolean => t.district === null;

/** The tile's name in sentences ("Real or Fake?", "a Mission", "Signal Check"). */
export function tileName(t: BoardTile): string {
  if (t.kind === 'minigame' && t.minigame) return miniGameById(t.minigame).name;
  if (t.kind === 'mission') return 'Mission';
  return t.label;
}

/** Short kind word shown on cards and in the legend. */
export function tileKindWord(t: BoardTile): string {
  switch (t.kind) {
    case 'minigame':
      return 'Mini-game';
    case 'mission':
      return 'Story mission';
    case 'chance':
      return t.district ? 'Quick question' : 'Pop Quiz corner';
    case 'bonus':
      return 'Bonus corner';
    default:
      return 'Start corner';
  }
}

/** Accessible description of a tile on the ring. */
export function tileAria(t: BoardTile, i: number, claimed: boolean, here: boolean): string {
  const where = t.district ? `, ${districtById(t.district).name}` : '';
  const parts = [`Tile ${i + 1}: ${tileName(t)}${where}`];
  if (claimed) parts.push('claimed');
  if (here) parts.push('your token is here');
  return parts.join(', ');
}

/** "You rolled 4. Landed on Real or Fake? in Retail District." */
export function landingSentence(die: number, t: BoardTile, passedHq: boolean): string {
  const rolled = `You rolled ${die}.`;
  const passed = passedHq ? ' Passed HQ: +10 Stars.' : '';
  if (t.kind === 'bonus') return `${rolled}${passed} Landed on ${t.label}: +15 Stars. Roll again when you like.`;
  if (t.kind === 'hq') return `${rolled}${passed} Landed on ${t.label}. Roll again when you like.`;
  const where = t.district ? ` in ${districtById(t.district).name}` : '';
  const name = t.kind === 'mission' ? 'a Mission tile' : tileName(t);
  return `${rolled}${passed} Landed on ${name}${where}.`;
}

export interface DistrictBoardProgress {
  district: DistrictId;
  name: string;
  color: string;
  claimed: number;
  total: number;
  secured: boolean;
}

export function boardProgress(claimed: readonly string[]): DistrictBoardProgress[] {
  return BOARD_DISTRICTS.map((d) => {
    const tiles = districtTiles(d);
    const n = tiles.filter((t) => claimed.includes(t.id)).length;
    const info = districtById(d);
    return { district: d, name: info.name, color: info.color, claimed: n, total: tiles.length, secured: n === tiles.length };
  });
}

/**
 * Missions to offer on a Mission tile: unplayed ones for the band first (registry order), then replays,
 * least recently played first.
 */
export function missionChoices(district: DistrictId, band: BandId | null, progress: Progress): { mission: Mission; fresh: boolean }[] {
  const list = districtSummary(district, band, progress).missions;
  const fresh = list.filter((m) => !progress.runs[m.id]);
  const played = list
    .filter((m) => progress.runs[m.id])
    .sort((a, b) => (progress.runs[a.id]?.lastAt ?? 0) - (progress.runs[b.id]?.lastAt ?? 0));
  return [...fresh.map((mission) => ({ mission, fresh: true })), ...played.map((mission) => ({ mission, fresh: false }))];
}
