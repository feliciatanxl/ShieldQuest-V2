// Board tokens and token colours (cosmetics). Inline SVG only: no images, no network, crisp at any size.
// Shared by the City Board, the Locker and Explore. Keep the API stable:
//   <TokenArt id="token-otter" color="color-coral" size={48} />
//   TOKEN_COLORS['color-coral'] -> '#ff8a75'
import type { ReactNode } from 'react';

/** CSS colour for every colour cosmetic id in COSMETICS. */
export const TOKEN_COLORS: Readonly<Record<string, string>> = {
  'color-teal': '#3cc8b8',
  'color-coral': '#ff8a75',
  'color-violet': '#a48cf5',
  'color-sunny': '#ffd84d',
  'color-night': '#3d4fa8',
  'color-gold': '#f2b632',
};

export const DEFAULT_TOKEN = 'token-shield';
export const DEFAULT_COLOR = 'color-teal';

/** Resolves a colour cosmetic id (or any CSS colour) to a CSS colour. */
export function tokenColor(color: string | undefined): string {
  if (!color) return TOKEN_COLORS[DEFAULT_COLOR]!;
  return TOKEN_COLORS[color] ?? color;
}

const INK = '#1d2440';
const PAPER = '#f4efe6';
const GOLD = '#f2c14e';

type Draw = (c: string) => ReactNode;

const line = { fill: 'none', stroke: INK, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const body = (c: string) => ({ fill: c, stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' as const });

const ART: Record<string, Draw> = {
  'token-shield': (c) => (
    <>
      <path d="M24 5l15 6v10c0 10-6.4 17.6-15 21-8.6-3.4-15-11-15-21V11z" {...body(c)} />
      <path d="M24 10.5l10 4v6.8c0 7-4.2 12.4-10 15-5.8-2.6-10-8-10-15v-6.8z" fill={PAPER} opacity="0.35" />
      <path d="M24 15.5l2.4 5 5.4.6-4 3.7 1.1 5.4-4.9-2.8-4.9 2.8 1.1-5.4-4-3.7 5.4-.6z" fill={PAPER} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
    </>
  ),
  'token-crane': (c) => (
    <>
      <path d="M8 31l16-8 16 8-16 5z" {...body(c)} />
      <path d="M24 23l7-16 1 24z" {...body(c)} />
      <path d="M24 23l-6-12 6 13" fill={PAPER} opacity="0.55" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M11 30.5L5.5 17l3.5-.5 6 13" {...body(c)} />
      <path d="M37 30.5l7-10-1 11" {...body(c)} />
      <path d="M24 23v13" {...line} strokeWidth={1.4} opacity="0.6" />
    </>
  ),
  'token-otter': (c) => (
    <>
      <circle cx="13" cy="13" r="4.5" {...body(c)} />
      <circle cx="35" cy="13" r="4.5" {...body(c)} />
      <path d="M24 8c9.5 0 15 7 15 15.5S33 41 24 41 9 32 9 23.5 14.5 8 24 8z" {...body(c)} />
      <ellipse cx="24" cy="30" rx="9" ry="7.5" fill={PAPER} />
      <circle cx="18" cy="21" r="2.2" fill={INK} />
      <circle cx="30" cy="21" r="2.2" fill={INK} />
      <circle cx="18.7" cy="20.3" r="0.7" fill={PAPER} />
      <circle cx="30.7" cy="20.3" r="0.7" fill={PAPER} />
      <path d="M21.5 26.5h5l-2.5 2.6z" fill={INK} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M24 29v2.2M21 32.5c1.6 1.2 4.4 1.2 6 0" {...line} strokeWidth={1.6} />
      <path d="M13 28l-5-1M13 31l-5 1M35 28l5-1M35 31l5 1" {...line} strokeWidth={1.3} />
    </>
  ),
  'token-kopi': (c) => (
    <>
      <path d="M17 6c-2 2.5 2 3.5 0 6M24 5c-2 2.5 2 3.5 0 6M31 6c-2 2.5 2 3.5 0 6" {...line} strokeWidth={1.6} opacity="0.75" />
      <ellipse cx="24" cy="39" rx="17" ry="4" fill={PAPER} stroke={INK} strokeWidth="2" />
      <path d="M36 21h2.5a5 5 0 0 1 0 10H35" {...line} strokeWidth={2.4} />
      <path d="M11 16h26l-3 19c-.3 2-2 3.5-4 3.5H18c-2 0-3.7-1.5-4-3.5z" {...body(c)} />
      <ellipse cx="24" cy="16" rx="13" ry="3.4" fill="#8a5a3b" stroke={INK} strokeWidth="2" />
      <path d="M16 24h16" stroke={PAPER} strokeWidth="2.6" strokeLinecap="round" opacity="0.7" />
    </>
  ),
  'token-hornbill': (c) => (
    <>
      <path d="M10 42c0-9 3-16 9-20" {...body(c)} />
      <circle cx="19" cy="20" r="10" {...body(c)} />
      <path d="M26 13.5c5-3.5 12-3 16 1-3.5 0-8 .8-12 3z" fill="#ff8a3d" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M27.5 18c5 0 11 2.5 15.5 9-6 .5-11.5-1-16.5-4.5z" fill={GOLD} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="20" cy="18" r="3.2" fill={PAPER} stroke={INK} strokeWidth="1.4" />
      <circle cx="20.6" cy="18" r="1.5" fill={INK} />
      <path d="M12 27c2.5 3 6 4 10 3" {...line} strokeWidth={1.4} opacity="0.6" />
    </>
  ),
  'token-train': (c) => (
    <>
      <path d="M15 41l-3 4M33 41l3 4" {...line} />
      <rect x="10" y="6" width="28" height="35" rx="8" {...body(c)} />
      <rect x="14" y="11" width="20" height="13" rx="3" fill={PAPER} stroke={INK} strokeWidth="1.8" />
      <path d="M24 11v13" {...line} strokeWidth={1.4} />
      <path d="M10 29h28" {...line} strokeWidth={1.6} />
      <circle cx="16.5" cy="34.5" r="2.4" fill={GOLD} stroke={INK} strokeWidth="1.4" />
      <circle cx="31.5" cy="34.5" r="2.4" fill={GOLD} stroke={INK} strokeWidth="1.4" />
      <path d="M21 34.5h6" {...line} strokeWidth={1.6} />
    </>
  ),
  'token-durian': (c) => (
    <>
      <path
        d="M24 9l3 3.5 4-2.5 1.5 4.5 4.5-.5-.5 4.5 4.5 1.5-2.5 4 3.5 3-3.5 3 2.5 4-4.5 1.5.5 4.5-4.5-.5-1.5 4.5-4-2.5-3 3.5-3-3.5-4 2.5-1.5-4.5-4.5.5.5-4.5-4.5-1.5 2.5-4-3.5-3 3.5-3-2.5-4 4.5-1.5-.5-4.5 4.5.5 1.5-4.5 4 2.5z"
        {...body(c)}
      />
      <path d="M24 9V4.5c0-1 1-1.5 2-1" {...line} strokeWidth={2.4} stroke="#6b4a2b" />
      <path d="M18 22l2 2M28 22l2 2M17 30l2 2M27 31l2 2M23 26l2 2" {...line} strokeWidth={1.5} opacity="0.55" />
      <circle cx="20" cy="27" r="1.6" fill={INK} />
      <circle cx="28" cy="27" r="1.6" fill={INK} />
      <path d="M21.5 31c1.4 1 3.6 1 5 0" {...line} strokeWidth={1.5} />
    </>
  ),
  'token-lantern': (c) => (
    <>
      <path d="M19 4.5h10M24 4.5v4" {...line} />
      <path d="M12 16c0-4.4 5.4-8 12-8s12 3.6 12 8v14c0 4.4-5.4 8-12 8s-12-3.6-12-8z" {...body(c)} />
      <path d="M17 9.5c-2 4-2 23 0 27M31 9.5c2 4 2 23 0 27M24 8v30" {...line} strokeWidth={1.3} opacity="0.5" />
      <ellipse cx="24" cy="23" rx="6" ry="9" fill={GOLD} opacity="0.55" />
      <path d="M17 8.5h14M17 37.5h14" {...line} strokeWidth={2.4} />
      <path d="M22 38.5l-1 6M26 38.5l1 6" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
};

/** Ids that have token art (every token cosmetic in COSMETICS). */
export const TOKEN_IDS = Object.keys(ART);

export interface TokenArtProps {
  /** A token cosmetic id, e.g. 'token-otter'. Unknown ids fall back to the Shield. */
  id: string;
  /** A colour cosmetic id ('color-coral') or any CSS colour. */
  color?: string;
  size?: number | string;
  /** Accessible name. Without it the token is decorative. */
  label?: string;
  className?: string;
}

export function TokenArt({ id, color, size = 48, label, className }: TokenArtProps) {
  const draw = ART[id] ?? ART[DEFAULT_TOKEN]!;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {draw(tokenColor(color))}
    </svg>
  );
}

/** A colour swatch for colour cosmetics: a token-shaped disc with a ring so it reads on any background. */
export function ColorSwatch({ color, size = 40 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="16" fill={tokenColor(color)} stroke={INK} strokeWidth="2" />
      <path d="M11 15a10 10 0 0 1 9-6" fill="none" stroke={PAPER} strokeWidth="2.6" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
