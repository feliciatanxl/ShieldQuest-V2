import { describe, expect, it } from 'vitest';
import { BANDS, WORDSEARCH_GRID, WORDSEARCH_PUZZLES, hashSeed, mulberry32, type GridDirection } from '@shieldquest/shared';
import {
  DIRS,
  findWord,
  generateGrid,
  lineCells,
  matchSelection,
  readCells,
  segmentMessage,
  snapLine,
  wordBlank,
  wordsearchScore,
} from './wordsearchLogic';

const dirOf = (cells: { r: number; c: number }[]): GridDirection => {
  const a = cells[0]!;
  const b = cells[1]!;
  const d = [b.r - a.r, b.c - a.c];
  return (Object.entries(DIRS).find(([, v]) => v[0] === d[0] && v[1] === d[1])![0]) as GridDirection;
};

describe('generateGrid', () => {
  it('places every word of every puzzle, for every band, across many seeds', () => {
    for (const p of WORDSEARCH_PUZZLES) {
      for (const band of p.bands) {
        const spec = WORDSEARCH_GRID[band];
        const words = p.flags.map((f) => f.word);
        for (let seed = 0; seed < 25; seed++) {
          const g = generateGrid(words, spec.size, spec.directions, mulberry32(hashSeed(p.id, band, seed)));
          expect(g.letters).toHaveLength(spec.size * spec.size);
          expect(g.letters.every((l) => /^[A-Z]$/.test(l))).toBe(true);
          expect(g.placements.map((x) => x.word).sort()).toEqual([...words].sort());
          for (const pl of g.placements) {
            expect(readCells(g, pl.cells)).toBe(pl.word);
            expect(spec.directions).toContain(dirOf(pl.cells));
          }
        }
      }
    }
  });

  it('never runs junior words backwards or diagonally', () => {
    const p = WORDSEARCH_PUZZLES.find((x) => x.bands.includes('junior'))!;
    for (let seed = 0; seed < 50; seed++) {
      const g = generateGrid(
        p.flags.map((f) => f.word),
        8,
        WORDSEARCH_GRID.junior.directions,
        mulberry32(seed),
      );
      for (const pl of g.placements) expect(['E', 'S']).toContain(dirOf(pl.cells));
    }
  });

  it('is deterministic for a seed', () => {
    const words = ['URGENT', 'OTP', 'FREE'];
    const a = generateGrid(words, 10, WORDSEARCH_GRID.teen.directions, mulberry32(99));
    const b = generateGrid(words, 10, WORDSEARCH_GRID.teen.directions, mulberry32(99));
    expect(a).toEqual(b);
  });

  it('throws when the words cannot fit', () => {
    expect(() => generateGrid(['TOOLONGWORD'], 4, ['E'], mulberry32(1))).toThrow();
  });

  it('keeps blocked words out of the filler where it can', () => {
    for (const band of BANDS) {
      const spec = WORDSEARCH_GRID[band.id];
      for (let seed = 0; seed < 40; seed++) {
        const g = generateGrid(['FREE', 'CODE'], spec.size, spec.directions, mulberry32(seed));
        expect(findWord(g, 'SHIT')).toHaveLength(0);
        expect(findWord(g, 'KILL')).toHaveLength(0);
      }
    }
  });
});

describe('selection', () => {
  it('builds straight lines in 8 directions and rejects bends', () => {
    expect(lineCells({ r: 0, c: 0 }, { r: 0, c: 3 })).toHaveLength(4);
    expect(lineCells({ r: 3, c: 3 }, { r: 0, c: 0 })).toEqual([
      { r: 3, c: 3 },
      { r: 2, c: 2 },
      { r: 1, c: 1 },
      { r: 0, c: 0 },
    ]);
    expect(lineCells({ r: 0, c: 0 }, { r: 1, c: 2 })).toBeNull();
    expect(lineCells({ r: 2, c: 2 }, { r: 2, c: 2 })).toEqual([{ r: 2, c: 2 }]);
  });

  it('snaps a wobbly drag to the nearest direction and stays inside the grid', () => {
    expect(snapLine({ r: 0, c: 0 }, { r: 1, c: 4 }, 8)).toEqual([0, 1, 2, 3, 4].map((c) => ({ r: 0, c })));
    expect(snapLine({ r: 0, c: 0 }, { r: 3, c: 4 }, 8)).toHaveLength(5);
    expect(dirOf(snapLine({ r: 0, c: 0 }, { r: 3, c: 4 }, 8))).toBe('SE');
    const clamped = snapLine({ r: 6, c: 6 }, { r: 9, c: 9 }, 8);
    expect(clamped[clamped.length - 1]).toEqual({ r: 7, c: 7 });
    expect(snapLine({ r: 2, c: 2 }, { r: 2, c: 2 }, 8)).toEqual([{ r: 2, c: 2 }]);
  });

  it('matches words forwards and backwards, once each', () => {
    const size = 4;
    // F R E E
    // O X X X
    // T X X X
    // P X X X
    const letters = 'FREEOXXXTXXXPXXX'.split('');
    const grid = { size, letters };
    const words = ['FREE', 'PTO'];
    const row0 = [0, 1, 2, 3].map((c) => ({ r: 0, c }));
    expect(matchSelection(grid, row0, words, [])).toBe('FREE');
    expect(matchSelection(grid, [...row0].reverse(), words, [])).toBe('FREE');
    expect(matchSelection(grid, row0, words, ['FREE'])).toBeNull();
    const col0 = [3, 2, 1].map((r) => ({ r, c: 0 }));
    expect(matchSelection(grid, col0, words, [])).toBe('PTO');
    expect(matchSelection(grid, [{ r: 0, c: 0 }], words, [])).toBeNull();
    expect(matchSelection(grid, row0.slice(0, 3), words, [])).toBeNull();
  });
});

describe('message highlighting', () => {
  it('splits out whole words only, any case', () => {
    const segs = segmentMessage('Send the OTP now. Not otp-ish words like OTPS or NOTP.', ['OTP', 'NOW']);
    expect(segs.filter((s) => s.word).map((s) => s.word)).toEqual(['OTP', 'NOW']);
    expect(segs.map((s) => s.text).join('')).toBe('Send the OTP now. Not otp-ish words like OTPS or NOTP.');
  });

  it('skips words inside web and email addresses', () => {
    const segs = segmentMessage('To appeal, go to chatlah-appeal.test or appeal.test or mail appeal@x.test. Appeal.', ['APPEAL']);
    expect(segs.filter((s) => s.word)).toHaveLength(2);
    expect(segs[1]).toEqual({ text: 'appeal', word: 'APPEAL' });
  });

  it('finds every flag word in its own message', () => {
    for (const p of WORDSEARCH_PUZZLES) {
      const words = p.flags.map((f) => f.word);
      const hit = new Set(segmentMessage(p.message, words).flatMap((s) => (s.word ? [s.word] : [])));
      expect([...hit].sort()).toEqual([...words].sort());
      if (p.plainMessage) {
        const plainHit = new Set(segmentMessage(p.plainMessage, words).flatMap((s) => (s.word ? [s.word] : [])));
        expect([...plainHit].sort()).toEqual([...words].sort());
      }
    }
  });

  it('returns the text untouched when there are no words', () => {
    expect(segmentMessage('hello', [])).toEqual([{ text: 'hello' }]);
  });
});

describe('scoring and hints', () => {
  it('scores found / total', () => {
    expect(wordsearchScore(3, 6)).toBe(0.5);
    expect(wordsearchScore(6, 6)).toBe(1);
    expect(wordsearchScore(0, 0)).toBe(0);
  });

  it('shows the first letter and blanks', () => {
    expect(wordBlank('URGENT')).toBe('U _ _ _ _ _');
  });
});
