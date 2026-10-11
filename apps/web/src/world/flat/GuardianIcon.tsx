// Flat origami Guardian icons (the 2D twin of GuardianFigure): folded-paper silhouettes in 2-3 tones of each
// Guardian's colour. Level 0 is a folded paper square with a "?" crease; bond marks II and III add small
// second-colour stars. Pure SVG (no three.js): this ships in the first load and in Flat View.
import { memo, type ReactElement } from 'react';
import { guardianById, type GuardianId } from '@shieldquest/shared';
import { GUARDIAN_ACCENT, GUARDIAN_INK as INK, GUARDIAN_PAPER as PAPER, blendHex, flatTones, type FlatTones } from '../guardians/palette';

export interface GuardianIconProps {
  guardian: GuardianId;
  /** Bond level: 0 = not yet earned (folded sheet), 1-3 = earned. Default 1. */
  level?: number;
  /** Rendered size in CSS pixels (square). Default 48. */
  size?: number;
}

const FROST = '#cfe8ff';
const SCREEN = '#bfe9ff';
const PINK = '#f7b2a6';

type Draw = (t: FlatTones) => ReactElement;

const VeriFox: Draw = (t) => (
  <>
    {/* Tail sweeping up into the magnifier fold. */}
    <path d="M29 42 L40 39 L44 30 L37 31 Z" fill={t.dark} />
    <path d="M37 31 L44 30 L44.5 24.5 L40.5 22 Z" fill={t.base} />
    <path d="M40.5 22 L44.5 24.5 L43 19.5 Z" fill={PAPER} />
    <circle cx="40.5" cy="13.5" r="5.6" fill={FROST} stroke={PAPER} strokeWidth="2.4" />
    <path d="M38 11.5 L40.5 10" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
    {/* Body and chest. */}
    <path d="M14 43 L24 43 L24 25 L18.5 25 Z" fill={t.light} />
    <path d="M24 43 L34 43 L29.5 25 L24 25 Z" fill={t.base} />
    <path d="M20.5 27 L27.5 27 L24 37.5 Z" fill={PAPER} />
    <path d="M17 43 h5 v-2 h-5 Z M26 43 h5 v-2 h-5 Z" fill={t.deep} />
    {/* Ears. */}
    <path d="M11.5 5 L20 13.5 L13 17 Z" fill={t.dark} />
    <path d="M13.2 8.6 L18 13.3 L14.3 15.2 Z" fill={PAPER} />
    <path d="M36.5 5 L28 13.5 L35 17 Z" fill={t.base} />
    <path d="M34.8 8.6 L30 13.3 L33.7 15.2 Z" fill={PAPER} />
    {/* Head: two folded halves with a white muzzle. */}
    <path d="M11.5 14 L24 14 L24 31 Z" fill={t.light} />
    <path d="M24 14 L36.5 14 L24 31 Z" fill={t.base} />
    <path d="M18 22.5 L24 22.5 L24 31 Z" fill={PAPER} />
    <path d="M24 22.5 L30 22.5 L24 31 Z" fill={blendHex(PAPER, INK, 0.08)} />
    <circle cx="24" cy="29.6" r="1.7" fill={INK} />
    <circle cx="19" cy="18.6" r="1.7" fill={INK} />
    <circle cx="29" cy="18.6" r="1.7" fill={INK} />
  </>
);

const Echo: Draw = (t) => (
  <>
    <path d="M7 44.5 Q11 38.5 20 40 L19 45 Z" fill={t.dark} />
    <circle cx="16.5" cy="8" r="2.6" fill={t.dark} />
    <circle cx="31.5" cy="8" r="2.6" fill={t.dark} />
    {/* Body. */}
    <path d="M16 20 L24 20 L24 45.5 L18 45.5 L13 38 Z" fill={t.light} />
    <path d="M24 20 L32 20 L35 38 L30 45.5 L24 45.5 Z" fill={t.base} />
    <path d="M19 24 L29 24 L31 37 L24 42.5 L17 37 Z" fill={blendHex(PAPER, t.base, 0.08)} />
    {/* Head. */}
    <path d="M15 12.5 L19 6 L24 6 L24 20 L17 20 Z" fill={t.light} />
    <path d="M24 6 L29 6 L33 12.5 L31 20 L24 20 Z" fill={t.base} />
    <ellipse cx="24" cy="15.4" rx="5.4" ry="3.6" fill={PAPER} />
    <ellipse cx="24" cy="13.8" rx="1.9" ry="1.3" fill={INK} />
    <circle cx="19.5" cy="11.2" r="1.5" fill={INK} />
    <circle cx="28.5" cy="11.2" r="1.5" fill={INK} />
    <path d="M18.5 15.5 L13.5 14.8 M18.5 16.6 L13.8 17.8 M29.5 15.5 L34.5 14.8 M29.5 16.6 L34.2 17.8" stroke={INK} strokeWidth="0.7" strokeLinecap="round" />
    {/* Paws holding a pebble. */}
    <ellipse cx="24" cy="28.4" rx="3.7" ry="3" fill="#c9d3e6" />
    <circle cx="20.3" cy="28.8" r="2.3" fill={t.dark} />
    <circle cx="27.7" cy="28.8" r="2.3" fill={t.dark} />
    <ellipse cx="19" cy="45.5" rx="3.6" ry="1.5" fill={t.dark} />
    <ellipse cx="29" cy="45.5" rx="3.6" ry="1.5" fill={t.dark} />
  </>
);

const Beacon: Draw = (t) => (
  <>
    <circle cx="24" cy="33" r="13" fill={t.base} opacity="0.2" />
    {/* Wings. */}
    <path d="M22 18 L6.5 8.5 L10 22 Z" fill="#eef6ff" />
    <path d="M22 18 L10 22 L8.5 15 Z" fill="#d6e8fb" />
    <path d="M26 18 L41.5 8.5 L38 22 Z" fill="#d6e8fb" />
    <path d="M26 18 L38 22 L39.5 15 Z" fill="#eef6ff" />
    <path d="M22 21 L9.5 25.5 L17 28 Z" fill="#d6e8fb" />
    <path d="M26 21 L38.5 25.5 L31 28 Z" fill="#eef6ff" />
    {/* Pleated lantern abdomen with caps and tassel. */}
    <path d="M17.5 25.5 L22 25.5 L22 41 L17.5 41 L14.5 33 Z" fill={t.lighter} />
    <path d="M22 25.5 L26 25.5 L26 41 L22 41 Z" fill={t.light} />
    <path d="M26 25.5 L30.5 25.5 L33.5 33 L30.5 41 L26 41 Z" fill={t.base} />
    <rect x="18" y="23" width="12" height="3" rx="1" fill={t.deep} />
    <rect x="18" y="40" width="12" height="3" rx="1" fill={t.deep} />
    <path d="M24 43 V46" stroke={t.deep} strokeWidth="1.4" strokeLinecap="round" />
    {/* Head with big eyes and glowing antennae. */}
    <ellipse cx="24" cy="20.5" rx="4.5" ry="3" fill={t.deep} />
    <circle cx="24" cy="14" r="5.2" fill={blendHex(t.base, INK, 0.6)} />
    <circle cx="21.8" cy="13.6" r="1.8" fill={PAPER} />
    <circle cx="26.2" cy="13.6" r="1.8" fill={PAPER} />
    <circle cx="22.1" cy="14" r="0.95" fill={INK} />
    <circle cx="26.5" cy="14" r="0.95" fill={INK} />
    <path d="M22 9.5 Q19.5 5.5 16.5 4.5 M26 9.5 Q28.5 5.5 31.5 4.5" stroke={INK} strokeWidth="1" fill="none" strokeLinecap="round" />
    <circle cx="16.5" cy="4.5" r="1.7" fill={t.lighter} />
    <circle cx="31.5" cy="4.5" r="1.7" fill={t.lighter} />
  </>
);

const Shieldfin: Draw = (t) => (
  <>
    <path d="M24 39.5 Q25.5 44 22 47" stroke={t.deep} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    <path d="M18 10 L15.5 4.5 L20.5 9 Z" fill={t.dark} />
    <path d="M30 10 L32.5 4.5 L27.5 9 Z" fill={t.dark} />
    {/* Wings spread into a shield: inner and outer folds on each side, a ridge down the middle. */}
    <path d="M18 10 L4.5 18.5 L14 26.5 Z" fill={t.lighter} />
    <path d="M24 10 L18 10 L14 26.5 L24 40 Z" fill={t.light} />
    <path d="M30 10 L43.5 18.5 L34 26.5 Z" fill={t.base} />
    <path d="M24 10 L30 10 L34 26.5 L24 40 Z" fill={t.dark} />
    <path d="M24 10 L25.6 15 L24 36 L22.4 15 Z" fill={t.deep} opacity="0.55" />
    <circle cx="20" cy="14.5" r="1.6" fill={INK} />
    <circle cx="28" cy="14.5" r="1.6" fill={INK} />
    <circle cx="20.5" cy="14" r="0.5" fill="#ffffff" />
    <circle cx="28.5" cy="14" r="0.5" fill="#ffffff" />
  </>
);

const Cluepaw: Draw = (t) => (
  <>
    {/* Ink paw prints leading off to the left. */}
    <g fill={INK}>
      <ellipse cx="6.5" cy="43" rx="2" ry="1.6" />
      <circle cx="4.6" cy="40.7" r="0.8" />
      <circle cx="6.5" cy="40" r="0.8" />
      <circle cx="8.4" cy="40.7" r="0.8" />
      <ellipse cx="9" cy="35" rx="2" ry="1.6" />
      <circle cx="7.1" cy="32.7" r="0.8" />
      <circle cx="9" cy="32" r="0.8" />
      <circle cx="10.9" cy="32.7" r="0.8" />
    </g>
    {/* Tail curling round, ink tip. */}
    <path d="M29 43 C 41 44, 44 36, 38 31" stroke={t.dark} strokeWidth="3.6" fill="none" strokeLinecap="round" />
    <path d="M39.4 33.2 C 39.2 32.2, 38.7 31.5, 38 31" stroke={INK} strokeWidth="3.6" fill="none" strokeLinecap="round" />
    {/* Body. */}
    <path d="M14 43.5 L24 43.5 L24 26 L17.5 26 Z" fill={t.light} />
    <path d="M24 43.5 L33 43.5 L30 26 L24 26 Z" fill={t.base} />
    <path d="M20.5 28 L27 28 L23.8 37 Z" fill={PAPER} />
    <ellipse cx="19.5" cy="43.3" rx="2.7" ry="1.4" fill={INK} />
    <ellipse cx="27.5" cy="43.3" rx="2.7" ry="1.4" fill={INK} />
    {/* Ears and round head. */}
    <path d="M13.5 15 L14.5 4 L21.5 10.5 Z" fill={t.dark} />
    <path d="M15.2 11.6 L15.8 6.8 L19.4 10.4 Z" fill={PINK} />
    <path d="M34 15 L33 4 L26 10.5 Z" fill={t.base} />
    <path d="M32.3 11.6 L31.7 6.8 L28.1 10.4 Z" fill={PINK} />
    <path d="M12.5 18.5 L16 11 L23.8 9 L23.8 27.5 L16 25.5 Z" fill={t.light} />
    <path d="M23.8 9 L31.5 11 L35 18.5 L31.5 25.5 L23.8 27.5 Z" fill={t.base} />
    <circle cx="22.3" cy="22.6" r="1.8" fill={PAPER} />
    <circle cx="25.3" cy="22.6" r="1.8" fill={PAPER} />
    <path d="M22.6 20.4 L25 20.4 L23.8 21.8 Z" fill="#f58ea0" />
    <ellipse cx="19.6" cy="17.4" rx="1.4" ry="2.2" fill={INK} />
    <ellipse cx="28" cy="17.4" rx="1.4" ry="2.2" fill={INK} />
    <path d="M20.5 22.2 L14.5 21.4 M20.5 23.4 L15 24.8 M27 22.2 L33 21.4 M27 23.4 L32.5 24.8" stroke={INK} strokeWidth="0.7" strokeLinecap="round" />
  </>
);

const ByteBuddy: Draw = (t) => (
  <>
    <path d="M24 8.5 V3.8" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="24" cy="3.5" r="2" fill="#fff3c4" />
    <circle cx="10.8" cy="18" r="2.1" fill={t.deep} />
    <circle cx="37.2" cy="18" r="2.1" fill={t.deep} />
    {/* Head: a puffed paper cube face (four creased triangles). */}
    <path d="M12 8.5 L36 8.5 L24 18 Z" fill={t.lighter} />
    <path d="M36 8.5 L36 27.5 L24 18 Z" fill={t.base} />
    <path d="M36 27.5 L12 27.5 L24 18 Z" fill={t.dark} />
    <path d="M12 27.5 L12 8.5 L24 18 Z" fill={t.light} />
    {/* Fold-out screen face on its hinge. */}
    <rect x="14" y="10.5" width="20" height="15.5" rx="2" fill="#273152" />
    <path d="M14.5 10.3 H33.5" stroke={t.deep} strokeWidth="1.4" strokeLinecap="round" />
    <rect x="16" y="12.5" width="16" height="11.5" rx="1" fill={SCREEN} />
    <rect x="19" y="15" width="2.6" height="3.6" rx="0.6" fill={INK} />
    <rect x="26.4" y="15" width="2.6" height="3.6" rx="0.6" fill={INK} />
    <path d="M21 20.5 Q24 22.8 27 20.5" stroke={INK} strokeWidth="1.2" fill="none" strokeLinecap="round" />
    <rect x="17.3" y="19.8" width="2" height="1.2" rx="0.5" fill="#ff9db0" />
    <rect x="28.7" y="19.8" width="2" height="1.2" rx="0.5" fill="#ff9db0" />
    {/* Neck, body cube, arms and legs. */}
    <rect x="21" y="27.5" width="6" height="2" fill={t.deep} />
    <path d="M15 32 L9.5 38" stroke={t.base} strokeWidth="3.2" strokeLinecap="round" />
    <path d="M33 32 L38.5 38" stroke={t.dark} strokeWidth="3.2" strokeLinecap="round" />
    <circle cx="9.5" cy="38.5" r="2.1" fill={t.lighter} />
    <circle cx="38.5" cy="38.5" r="2.1" fill={t.lighter} />
    <path d="M15 29.5 L33 29.5 L24 35.5 Z" fill={t.lighter} />
    <path d="M33 29.5 L33 41.5 L24 35.5 Z" fill={t.base} />
    <path d="M33 41.5 L15 41.5 L24 35.5 Z" fill={t.dark} />
    <path d="M15 41.5 L15 29.5 L24 35.5 Z" fill={t.light} />
    <rect x="17" y="41.5" width="5" height="4" rx="0.8" fill={t.deep} />
    <rect x="26" y="41.5" width="5" height="4" rx="0.8" fill={t.deep} />
  </>
);

const DRAW: Record<GuardianId, Draw> = {
  verifox: VeriFox,
  echo: Echo,
  beacon: Beacon,
  shieldfin: Shieldfin,
  cluepaw: Cluepaw,
  bytebuddy: ByteBuddy,
};

/** Small folded paper star (bond-mark accent). */
function Star({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    return `${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`;
  });
  return (
    <g>
      <polygon points={pts.join(' ')} fill={color} stroke={PAPER} strokeWidth="0.9" strokeLinejoin="round" />
      <polygon points={`${cx},${cy - r} ${cx},${cy} ${pts[9]}`} fill={blendHex(color, '#ffffff', 0.35)} />
    </g>
  );
}

/** Level 0: a paper square, one corner folded over (showing the Guardian's colour), with a "?" crease. */
function FoldedSheet({ color }: { color: string }) {
  const crease = blendHex(PAPER, INK, 0.35);
  return (
    <>
      <path d="M8 8 L30 8 L40 18 L40 40 L8 40 Z" fill={PAPER} stroke={blendHex(PAPER, INK, 0.25)} strokeWidth="1" strokeLinejoin="round" />
      <path d="M8 40 L24 24 M8 8 L18 18" stroke={blendHex(PAPER, INK, 0.12)} strokeWidth="0.8" strokeDasharray="1.6 1.6" />
      <path d="M30 8 L40 18 L30 18 Z" fill={color} stroke={blendHex(color, INK, 0.3)} strokeWidth="0.8" strokeLinejoin="round" />
      <path
        d="M19 19.5 Q19 13.5 24 13.5 Q29 13.5 29 18.5 Q29 22.5 24.5 24.2 L24 28"
        stroke={crease}
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="33.2" r="1.7" fill={crease} />
    </>
  );
}

/** Flat origami Guardian. Keep the export name and props: screens and the 2D world import it. */
export const GuardianIcon = memo(function GuardianIcon({ guardian, level = 1, size = 48 }: GuardianIconProps) {
  const g = guardianById(guardian);
  const lv = Math.max(0, Math.min(3, Math.round(level)));
  const label = lv === 0 ? `${g.name} (not yet earned)` : `${g.name}, level ${lv}`;
  const accent = GUARDIAN_ACCENT[guardian];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={label}
      focusable="false"
      style={{ display: 'block', flex: 'none', overflow: 'visible' }}
    >
      {lv === 0 ? <FoldedSheet color={g.color} /> : DRAW[guardian](flatTones(g.color))}
      {lv >= 2 && <Star cx={40.5} cy={40.5} r={5} color={accent} />}
      {lv >= 3 && <Star cx={45} cy={32} r={3.1} color={accent} />}
    </svg>
  );
});
