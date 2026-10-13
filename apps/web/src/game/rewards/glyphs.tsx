// Small decorative glyphs for Stars, streaks and rolls. Tiny on purpose: the city hub imports these.
// Always paired with a number and a word (or sr-only text) by the caller, never shown alone.

/** A Star (the reward you earn by playing). */
export function StarGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2.8l2.75 5.6 6.15.9-4.45 4.35 1.05 6.12L12 16.9l-5.5 2.87 1.05-6.12L3.1 9.3l6.15-.9z"
        fill="var(--gold)"
        stroke="var(--gold)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.6 10.4l1.5-.2" stroke="var(--ink)" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

/** Streak flame. Unlit (dashed outline) when the streak is 0. */
export function FlameGlyph({ size = 18, lit = true }: { size?: number; lit?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 21.5c-4 0-7-2.8-7-6.6 0-3.3 2.2-5.4 3.6-7.4.5 1.6 1.4 2.6 2.4 3 0-3.4 1.6-6.2 4.2-8 .1 3.1 1.6 5 3 7 1.1 1.6 1.8 3.2 1.8 5.4 0 3.8-3 6.6-8 6.6z"
        fill={lit ? '#ff8a4c' : 'none'}
        stroke={lit ? '#ff8a4c' : 'currentColor'}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeDasharray={lit ? undefined : '2.5 2'}
      />
      {lit && <path d="M12 20c-1.8 0-3-1.2-3-2.9 0-1.6 1.2-2.6 2-3.7.4 1 1 1.4 1.6 1.6.2-1 .7-1.8 1.4-2.4.4 1.4 1 2.4 1 3.9 0 2-1.2 3.5-3 3.5z" fill="var(--gold)" />}
    </svg>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[12, 12]],
  2: [[8, 8], [16, 16]],
  3: [[7.5, 7.5], [12, 12], [16.5, 16.5]],
  4: [[8, 8], [16, 8], [8, 16], [16, 16]],
  5: [[7.5, 7.5], [16.5, 7.5], [12, 12], [7.5, 16.5], [16.5, 16.5]],
  6: [[8, 7], [16, 7], [8, 12], [16, 12], [8, 17], [16, 17]],
};

/** A die face (1-6). Used for the rolls chip and the City Board dice. */
export function DieGlyph({ size = 18, face = 5, filled = true }: { size?: number | string; face?: number; filled?: boolean }) {
  const pips = PIPS[face] ?? PIPS[5]!;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="4.5"
        fill={filled ? 'var(--paper)' : 'none'}
        stroke={filled ? 'var(--paper)' : 'currentColor'}
        strokeWidth="1.8"
      />
      {pips.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.75" fill={filled ? 'var(--ink)' : 'currentColor'} />
      ))}
    </svg>
  );
}

/** A badge medal: filled with a check when earned, dashed with a lock when not (never colour alone). */
export function BadgeMedal({ earned, size = 44 }: { earned: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" focusable="false">
      <path d="M14 4h6l3 10h-6zM30 4h-6l-3 10h6z" fill={earned ? 'var(--retail)' : 'none'} stroke={earned ? 'var(--ink)' : 'currentColor'} strokeWidth="1.6" strokeLinejoin="round" strokeDasharray={earned ? undefined : '2.5 2'} />
      <circle
        cx="22"
        cy="27"
        r="13"
        fill={earned ? 'var(--gold)' : 'none'}
        stroke={earned ? 'var(--ink)' : 'currentColor'}
        strokeWidth="2"
        strokeDasharray={earned ? undefined : '3 2.5'}
      />
      {earned ? (
        <path d="M16 27.5l4 4 8-8.5" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M17.5 26h9v7.5h-9zM19.5 26v-2.2a2.5 2.5 0 0 1 5 0V26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      )}
    </svg>
  );
}

const navIcon = (d: string, size: number | string) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d={d} />
  </svg>
);

/** Arcade (mini-games) nav icon. */
export function GamepadGlyph({ size = '1.25em' }: { size?: number | string }) {
  return navIcon(
    'M7 7.5h10a4.5 4.5 0 0 1 4.4 5.4l-.9 4.3a2.5 2.5 0 0 1-4.3 1.2L14 16h-4l-2.2 2.4a2.5 2.5 0 0 1-4.3-1.2l-.9-4.3A4.5 4.5 0 0 1 7 7.5zM8 10.5v3M6.5 12h3M15.5 11h.01M17.5 13h.01',
    size,
  );
}

/** Explore nav icon (compass). */
export function CompassGlyph({ size = '1.25em' }: { size?: number | string }) {
  return navIcon('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z', size);
}

/** City Board nav icon (a die outline). */
export function BoardNavGlyph({ size = '1.25em' }: { size?: number | string }) {
  return navIcon('M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01', size);
}
