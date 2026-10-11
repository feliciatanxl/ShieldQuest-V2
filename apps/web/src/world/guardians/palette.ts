// Guardian colours shared by the 3D models and the 2D icons. Pure (no three.js): GuardianIcon ships in the first
// load, so it must not pull the 3D bundle in.
import type { GuardianId } from '@shieldquest/shared';

/** Second colour unlocked by bond marks II and III (a cosmetic fold, never a gameplay signal). */
export const GUARDIAN_ACCENT: Record<GuardianId, string> = {
  verifox: '#f2c14e',
  echo: '#2dd4bf',
  beacon: '#38bdf8',
  shieldfin: '#f2c14e',
  cluepaw: '#8a6cf0',
  bytebuddy: '#fb7185',
};

export const GUARDIAN_INK = '#1d2440';
export const GUARDIAN_PAPER = '#f4efe6';

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0').slice(0, 6);
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mixes two #rrggbb colours in sRGB (t = 0 -> a, 1 -> b). */
export function blendHex(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  const k = Math.min(1, Math.max(0, t));
  return `#${x
    .map((v, i) => Math.round(v + ((y[i] ?? 0) - v) * k).toString(16).padStart(2, '0'))
    .join('')}`;
}

export interface FlatTones {
  base: string;
  light: string;
  lighter: string;
  dark: string;
  deep: string;
}

/** Paper-fold tones of one colour for flat (SVG) drawings. */
export function flatTones(color: string): FlatTones {
  return {
    base: blendHex(color, color, 0),
    light: blendHex(color, '#ffffff', 0.3),
    lighter: blendHex(color, '#ffffff', 0.55),
    dark: blendHex(color, GUARDIAN_INK, 0.22),
    deep: blendHex(color, GUARDIAN_INK, 0.45),
  };
}
