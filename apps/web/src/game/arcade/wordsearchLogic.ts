// Pure logic for Red-Flag Wordsearch: seeded grid generation, straight-line selection and matching,
// message highlighting and scoring. No React, no DOM, so every rule is unit-tested.
import type { GridDirection } from '@shieldquest/shared';

export interface Cell {
  r: number;
  c: number;
}

export interface Placement {
  word: string;
  cells: Cell[];
}

export interface WordGrid {
  size: number;
  /** Row-major letters, size * size. */
  letters: string[];
  placements: Placement[];
}

export const DIRS: Record<GridDirection, readonly [number, number]> = {
  E: [0, 1],
  S: [1, 0],
  SE: [1, 1],
  NE: [-1, 1],
  W: [0, -1],
  N: [-1, 0],
  NW: [-1, -1],
  SW: [1, -1],
};

// Filler leaves out rare letters so the grid looks natural and hidden words stay the only real words.
const FILLER = 'ABCDEEFGHIKLMNOOPRSTTUWY';

// Filler is re-rolled if it accidentally spells one of these. Kept short and mild on purpose.
const BLOCKED = [
  'ASS', 'SEX', 'DIE', 'KILL', 'HATE', 'DUMB', 'UGLY', 'FAT', 'POO', 'PEE', 'FART', 'BUTT', 'DAMN', 'HELL',
  'CRAP', 'PISS', 'TIT', 'CUM', 'FUK', 'FUCK', 'SHIT', 'DICK', 'COCK', 'CUNT', 'SLUT', 'PORN', 'RAPE', 'NAZI',
];

export const idx = (size: number, cell: Cell): number => cell.r * size + cell.c;
export const sameCell = (a: Cell, b: Cell): boolean => a.r === b.r && a.c === b.c;
export const inGrid = (size: number, cell: Cell): boolean => cell.r >= 0 && cell.c >= 0 && cell.r < size && cell.c < size;

function walk(start: Cell, dir: readonly [number, number], length: number): Cell[] {
  const out: Cell[] = [];
  for (let i = 0; i < length; i++) out.push({ r: start.r + dir[0] * i, c: start.c + dir[1] * i });
  return out;
}

function tryPlaceAll(words: readonly string[], size: number, dirs: readonly GridDirection[], rng: () => number) {
  const letters: string[] = new Array(size * size).fill('');
  const placements: Placement[] = [];
  const order = [...words].sort((a, b) => b.length - a.length);
  for (const word of order) {
    const options: Cell[][] = [];
    for (const d of dirs) {
      const dir = DIRS[d];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const cells = walk({ r, c }, dir, word.length);
          if (!cells.every((cell) => inGrid(size, cell))) continue;
          if (cells.every((cell, i) => letters[idx(size, cell)] === '' || letters[idx(size, cell)] === word[i])) {
            options.push(cells);
          }
        }
      }
    }
    if (options.length === 0) return null;
    const cells = options[Math.floor(rng() * options.length)]!;
    cells.forEach((cell, i) => (letters[idx(size, cell)] = word[i]!));
    placements.push({ word, cells });
  }
  return { letters, placements };
}

/** All straight-line readings of `word` in the grid (any of the 8 directions). */
export function findWord(grid: Pick<WordGrid, 'size' | 'letters'>, word: string): Cell[][] {
  const hits: Cell[][] = [];
  const { size, letters } = grid;
  for (const dir of Object.values(DIRS)) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cells = walk({ r, c }, dir, word.length);
        if (cells.every((cell, i) => inGrid(size, cell) && letters[idx(size, cell)] === word[i])) hits.push(cells);
      }
    }
  }
  return hits;
}

/**
 * Places every word (longest first, overlaps allowed only where letters agree), then fills the gaps.
 * Deterministic for a given rng. Throws only if the words cannot fit at all (content tests prevent that).
 */
export function generateGrid(words: readonly string[], size: number, dirs: readonly GridDirection[], rng: () => number): WordGrid {
  for (let attempt = 0; attempt < 200; attempt++) {
    const placed = tryPlaceAll(words, size, dirs, rng);
    if (!placed) continue;
    const fixed = new Set(placed.placements.flatMap((p) => p.cells.map((cell) => idx(size, cell))));
    let letters = placed.letters;
    for (let fill = 0; fill < 60; fill++) {
      letters = placed.letters.map((l) => l || FILLER[Math.floor(rng() * FILLER.length)]!);
      const grid = { size, letters };
      const clash = BLOCKED.some((bad) => findWord(grid, bad).some((cells) => cells.some((cell) => !fixed.has(idx(size, cell)))));
      if (!clash) break;
    }
    return { size, letters, placements: placed.placements };
  }
  throw new Error(`Wordsearch: could not fit ${words.join(', ')} into ${size}×${size}`);
}

/** Cells on the straight line from a to b (inclusive), or null if a and b are not in a row, column or diagonal. */
export function lineCells(a: Cell, b: Cell): Cell[] | null {
  const dr = b.r - a.r;
  const dc = b.c - a.c;
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
  const len = Math.max(Math.abs(dr), Math.abs(dc));
  return walk(a, [Math.sign(dr), Math.sign(dc)], len + 1);
}

/** For dragging: snaps the pointer cell to the nearest of the 8 directions, clamped inside the grid. */
export function snapLine(a: Cell, b: Cell, size: number): Cell[] {
  const dr = b.r - a.r;
  const dc = b.c - a.c;
  if (dr === 0 && dc === 0) return [a];
  const angle = Math.atan2(dr, dc);
  const step = Math.round(angle / (Math.PI / 4));
  const dir: [number, number] = [Math.round(Math.sin((step * Math.PI) / 4)), Math.round(Math.cos((step * Math.PI) / 4))];
  let len = Math.max(Math.abs(dr), Math.abs(dc)) + 1;
  while (len > 1 && !inGrid(size, { r: a.r + dir[0] * (len - 1), c: a.c + dir[1] * (len - 1) })) len--;
  return walk(a, dir, len);
}

export const readCells = (grid: Pick<WordGrid, 'size' | 'letters'>, cells: readonly Cell[]): string =>
  cells.map((cell) => grid.letters[idx(grid.size, cell)] ?? '').join('');

/** The not-yet-found word spelled by the selection, forwards or backwards; null if none. */
export function matchSelection(
  grid: Pick<WordGrid, 'size' | 'letters'>,
  cells: readonly Cell[],
  words: readonly string[],
  found: readonly string[],
): string | null {
  if (cells.length < 2) return null;
  const s = readCells(grid, cells);
  const rev = [...s].reverse().join('');
  return words.find((w) => !found.includes(w) && (w === s || w === rev)) ?? null;
}

export interface Segment {
  text: string;
  /** The red-flag word (upper case) this piece matches, if any. */
  word?: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Splits a message into plain text and whole-word matches of the given words (case-insensitive), skipping addresses. */
export function segmentMessage(text: string, words: readonly string[]): Segment[] {
  if (words.length === 0) return [{ text }];
  // Whole words only, and never inside a web or email address (so "appeal" in "chatlah-appeal.test" is skipped).
  const re = new RegExp(
    `(?<![A-Za-z0-9.@-])(${[...words].sort((a, b) => b.length - a.length).map(escapeRe).join('|')})(?![A-Za-z0-9@-]|\\.[A-Za-z])`,
    'gi',
  );
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at) });
    out.push({ text: m[0], word: m[0].toUpperCase() });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export const wordsearchScore = (found: number, total: number): number => (total > 0 ? Math.min(1, found / total) : 0);

/** "U _ _ _ _ _" for older bands, who find the words from the message rather than from a list. */
export const wordBlank = (word: string): string => [word[0], ...Array.from({ length: word.length - 1 }, () => '_')].join(' ');
