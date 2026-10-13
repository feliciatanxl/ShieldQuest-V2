// Tile glyphs for the City Board (decorative; tiles carry their names in text / aria-labels).
import type { TileGlyph } from './boardData';

const PATHS: Record<TileGlyph, string> = {
  // shield with a door: HQ
  hq: 'M12 3l7 3v5.5c0 4.5-3 8.2-7 9.5-4-1.3-7-5-7-9.5V6zM10 18.5V14h4v4.5',
  // steaming bowl: Hawker Break
  bonus: 'M4 12.5h16a8 7 0 0 1-16 0zM8.5 9c0-1.5 1.5-1.5 1.5-3M12 9c0-1.5 1.5-1.5 1.5-3M15.5 9c0-1.5 1.5-1.5 1.5-3',
  // lightning bolt: Pop Quiz
  quiz: 'M13.5 2.5L5 13.5h6l-1 8 8.5-11h-6z',
  // signal waves with a dot: Signal Check
  chance: 'M12 17.5h.01M8.5 14a5 5 0 0 1 7 0M5.5 11a9 9 0 0 1 13 0M2.5 8a13 13 0 0 1 19 0',
  // flag: story mission
  mission: 'M6 21V3.5M6 4h11.5l-2.5 4 2.5 4H6',
  // magnifier: wordsearch
  wordsearch: 'M10.5 16.5a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM15 15l5.5 5.5M8 10.5h5',
  // card with a question mark: real or fake
  'real-or-fake': 'M6.5 3.5h11A1.5 1.5 0 0 1 19 5v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5zM10 9.5a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5M12 16h.01',
  // winding trail to a coin: money trail
  'money-trail': 'M3.5 20c3-1 3-5 6-6s4 1 6-2M18 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 20h.01',
};

export function BoardGlyph({ glyph, size = '1.25em' }: { glyph: TileGlyph; size?: number | string }) {
  const filled = glyph === 'quiz';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[glyph]} />
    </svg>
  );
}
