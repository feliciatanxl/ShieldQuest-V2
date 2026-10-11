// Small hand-drawn inline SVG illustrations for the public site. All decorative (aria-hidden):
// every idea they show is also written out in the surrounding text.
import type { ReactNode } from 'react';

function Art({ children, className, viewBox = '0 0 72 72' }: { children: ReactNode; className?: string; viewBox?: string }) {
  return (
    <svg className={className} viewBox={viewBox} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const INK = '#1d2440';
const PAPER = '#f4efe6';
const GOLD = '#f2c14e';
const FROST = '#cfe8ff';
const TEAL = '#2bb3a3';
const CORAL = '#f26b5b';
const VIOLET = '#8a6cf0';
const PINK = '#ff4d8d';

/** Explore: a district plate with a mission pin. */
function ExploreArt() {
  return (
    <>
      <path d="M8 44 L22 34 H50 L64 44 L50 54 H22 Z" fill={TEAL} />
      <path d="M8 44 V49 L22 59 H50 L64 49 V44 L50 54 H22 Z" fill="#17766d" />
      <rect x="22" y="30" width="9" height="16" rx="1.5" fill={PAPER} />
      <rect x="34" y="24" width="10" height="22" rx="1.5" fill="#e9e1d2" />
      <rect x="47" y="34" width="7" height="11" rx="1.5" fill={PAPER} />
      <rect x="36.5" y="28" width="2" height="3" fill={GOLD} />
      <rect x="40" y="33" width="2" height="3" fill={GOLD} />
      <path d="M54 8 a8 8 0 0 1 8 8 c0 6 -8 13 -8 13 s-8 -7 -8 -13 a8 8 0 0 1 8 -8 z" fill={GOLD} />
      <circle cx="54" cy="16" r="3" fill={INK} />
    </>
  );
}

/** Investigate: a phone frozen mid-message, with the HOLD ring. */
function InvestigateArt() {
  return (
    <>
      <rect x="16" y="6" width="34" height="58" rx="7" fill={INK} />
      <rect x="19" y="11" width="28" height="44" rx="3" fill={FROST} />
      <rect x="22" y="15" width="18" height="7" rx="3.5" fill={PAPER} />
      <rect x="26" y="25" width="18" height="7" rx="3.5" fill={VIOLET} />
      <rect x="22" y="35" width="14" height="7" rx="3.5" fill={PAPER} stroke={PINK} strokeDasharray="2 1.5" />
      <circle cx="33" cy="58" r="3" fill={GOLD} />
      <circle cx="52" cy="46" r="12" fill="none" stroke={GOLD} strokeWidth="3" />
      <path d="M48 41 v10 M56 41 v10" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
      <path d="M60 55 l6 6" stroke={GOLD} strokeWidth="4" strokeLinecap="round" />
    </>
  );
}

/** Discuss: three bubbles, one thought each. */
function DiscussArt() {
  return (
    <>
      <path d="M6 14 a6 6 0 0 1 6 -6 h22 a6 6 0 0 1 6 6 v10 a6 6 0 0 1 -6 6 h-16 l-7 6 v-6 a6 6 0 0 1 -5 -6 z" fill={TEAL} />
      <path d="M32 30 a6 6 0 0 1 6 -6 h22 a6 6 0 0 1 6 6 v10 a6 6 0 0 1 -6 6 h-5 v6 l-7 -6 h-10 a6 6 0 0 1 -6 -6 z" fill={GOLD} />
      <path d="M10 50 a6 6 0 0 1 6 -6 h18 a6 6 0 0 1 6 6 v8 a6 6 0 0 1 -6 6 h-14 l-6 5 v-5 a6 6 0 0 1 -4 -6 z" fill={PAPER} />
      {[16, 23, 30].map((x) => (
        <circle key={x} cx={x} cy="19" r="2.2" fill={INK} />
      ))}
      <path d="M41 35 h16" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M17 54 h16" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

/** Decide: three exits, each a letter with its own neutral pattern (never a colour code). */
function DecideArt() {
  return (
    <>
      <defs>
        <pattern id="site-art-dots" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="1" fill={INK} opacity="0.35" />
        </pattern>
        <pattern id="site-art-stripes" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="1.6" height="5" fill={INK} opacity="0.3" />
        </pattern>
        <pattern id="site-art-grid" width="5" height="5" patternUnits="userSpaceOnUse">
          <path d="M5 0 H0 V5" fill="none" stroke={INK} strokeOpacity="0.3" strokeWidth="1" />
        </pattern>
      </defs>
      {[
        { x: 5, p: 'dots', l: 'A' },
        { x: 27, p: 'stripes', l: 'B' },
        { x: 49, p: 'grid', l: 'C' },
      ].map((d) => (
        <g key={d.l}>
          <path d={`M${d.x} 62 V22 a9 9 0 0 1 18 0 V62 Z`} fill={PAPER} />
          <path d={`M${d.x} 62 V22 a9 9 0 0 1 18 0 V62 Z`} fill={`url(#site-art-${d.p})`} />
          <circle cx={d.x + 9} cy="22" r="6" fill={INK} />
          <text x={d.x + 9} y="25.5" textAnchor="middle" fontSize="9" fontWeight="700" fill={PAPER} fontFamily="system-ui">
            {d.l}
          </text>
        </g>
      ))}
      <path d="M2 64 H70" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

/** Experience: a timeline ribbon where a seed planted now surfaces later. */
function ExperienceArt() {
  return (
    <>
      <path d="M6 46 C20 30 34 58 48 40 S62 30 68 34" fill="none" stroke={PAPER} strokeWidth="4" strokeLinecap="round" />
      <circle cx="12" cy="40" r="6" fill={GOLD} />
      <circle cx="48" cy="40" r="10" fill="none" stroke={FROST} strokeWidth="2" opacity="0.7" />
      <circle cx="48" cy="40" r="16" fill="none" stroke={FROST} strokeWidth="1.5" opacity="0.4" />
      <circle cx="48" cy="40" r="5" fill={CORAL} />
      <rect x="34" y="8" width="30" height="16" rx="8" fill={PAPER} />
      <path d="M41 16 h16" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12 34 v-8 l4 -3" stroke={TEAL} strokeWidth="3" strokeLinecap="round" fill="none" />
    </>
  );
}

/** Protect: two friends under one shield. */
function ProtectArt() {
  return (
    <>
      <path d="M36 4 l26 10 v18 c0 16 -11 29 -26 34 c-15 -5 -26 -18 -26 -34 v-18 z" fill={TEAL} opacity="0.3" />
      <path d="M36 4 l26 10 v18 c0 16 -11 29 -26 34 c-15 -5 -26 -18 -26 -34 v-18 z" fill="none" stroke={TEAL} strokeWidth="3" />
      <circle cx="28" cy="28" r="6" fill={PAPER} />
      <rect x="20" y="36" width="16" height="18" rx="8" fill={PAPER} />
      <circle cx="45" cy="30" r="6" fill={GOLD} />
      <rect x="37" y="38" width="16" height="17" rx="8" fill={GOLD} />
      <path d="M33 44 q4 -4 8 0" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>
  );
}

const LOOP_ART = [ExploreArt, InvestigateArt, DiscussArt, DecideArt, ExperienceArt, ProtectArt] as const;

/** Illustration for stage `index` (0-5) of the six-stage learning loop. */
export function LoopArt({ index, className }: { index: number; className?: string }) {
  const Piece = LOOP_ART[index] ?? ExploreArt;
  return (
    <Art className={className}>
      <Piece />
    </Art>
  );
}

const TOTEM_SHAPES = {
  triangle: <path d="M0 -9 L9 7 H-9 Z" />,
  circle: <circle r="8" />,
  square: <rect x="-7.5" y="-7.5" width="15" height="15" rx="2" />,
  diamond: <path d="M0 -10 L10 0 L0 10 L-10 0 Z" />,
};

/** A projector Big Screen over four squad phones, lanterns rising. */
export function ClassroomArt({ className }: { className?: string }) {
  return (
    <Art className={className} viewBox="0 0 360 260">
      <rect x="40" y="14" width="280" height="150" rx="10" fill="#0f1529" stroke="#3a4380" strokeWidth="3" />
      <rect x="50" y="24" width="260" height="130" rx="5" fill="#222861" />
      {/* skyline on the Big Screen */}
      <path d="M50 154 V118 h22 v-16 h18 v26 h16 v-38 h20 v38 h14 v-20 h20 v20 h16 v-30 h22 v30 h18 v-16 h22 v16 h22 v-24 h22 v36 h28 V154 Z" fill="#1a2050" />
      <rect x="171" y="72" width="18" height="82" fill="#2c3270" />
      <circle cx="180" cy="66" r="12" fill={PAPER} stroke={GOLD} strokeWidth="3" />
      <path d="M180 66 L179 57 M180 66 L179.6 60" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      {/* QR code */}
      <g transform="translate(244 38)">
        <rect width="52" height="52" rx="4" fill={PAPER} />
        {[
          [5, 5, 14],
          [33, 5, 14],
          [5, 33, 14],
        ].map(([x = 0, y = 0, s = 0]) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width={s} height={s} fill={INK} />
            <rect x={x + 3} y={y + 3} width={s - 6} height={s - 6} fill={PAPER} />
            <rect x={x + 5} y={y + 5} width={s - 10} height={s - 10} fill={INK} />
          </g>
        ))}
        {[
          [23, 6],
          [24, 14],
          [22, 24],
          [30, 24],
          [38, 26],
          [44, 34],
          [24, 32],
          [32, 38],
          [40, 42],
          [24, 42],
          [44, 44],
        ].map(([x = 0, y = 0]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" fill={INK} />
        ))}
      </g>
      {/* lanterns */}
      {[
        [84, 70, 1],
        [120, 50, 0.8],
        [218, 46, 0.9],
      ].map(([x = 0, y = 0, s = 1]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
          <circle r="14" fill={GOLD} opacity="0.18" />
          <rect x="-6" y="-8" width="12" height="16" rx="5" fill={GOLD} />
        </g>
      ))}
      <rect x="168" y="164" width="24" height="10" fill="#3a4380" />
      {/* squad phones with totems */}
      {(
        [
          ['triangle', '#F26B5B', 46],
          ['circle', '#2BB3A3', 124],
          ['square', '#38bdf8', 202],
          ['diamond', '#8A6CF0', 280],
        ] as const
      ).map(([shape, color, x]) => (
        <g key={shape} transform={`translate(${x} 186)`}>
          <rect width="34" height="62" rx="7" fill={INK} stroke="#3a4380" strokeWidth="2" />
          <rect x="4" y="7" width="26" height="40" rx="3" fill="#24365a" />
          <g transform="translate(17 24)" fill={color}>
            {TOTEM_SHAPES[shape]}
          </g>
          <circle cx="17" cy="54" r="3.5" fill={GOLD} />
        </g>
      ))}
    </Art>
  );
}

/** A district plate still under fog: used for "coming soon" and the 404 page. */
export function FogPlateArt({ className }: { className?: string }) {
  return (
    <Art className={className} viewBox="0 0 320 240">
      <path d="M40 150 L100 112 H220 L280 150 L220 188 H100 Z" fill="#24365a" />
      <path d="M40 150 V164 L100 202 H220 L280 164 V150 L220 188 H100 Z" fill="#1a2a45" />
      <path d="M40 150 L100 112 H220 L280 150" fill="none" stroke="#3cc8b8" strokeOpacity="0.5" strokeWidth="2" />
      {/* signpost */}
      <rect x="156" y="70" width="8" height="96" rx="2" fill="#9fb3c8" />
      <path d="M164 78 H222 L234 90 L222 102 H164 Z" fill={PAPER} />
      <path d="M156 108 H100 L88 120 L100 132 H156 Z" fill="#e9e1d2" />
      <path d="M176 90 h40" stroke={INK} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      <path d="M108 120 h36" stroke={INK} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      {/* fog bands */}
      <g fill={FROST}>
        <rect x="30" y="140" width="150" height="14" rx="7" opacity="0.22" />
        <rect x="120" y="164" width="170" height="14" rx="7" opacity="0.18" />
        <rect x="60" y="182" width="120" height="12" rx="6" opacity="0.14" />
        <rect x="190" y="124" width="100" height="12" rx="6" opacity="0.16" />
      </g>
      <g transform="translate(250 48)">
        <circle r="16" fill={GOLD} opacity="0.18" />
        <rect x="-7" y="-10" width="14" height="20" rx="6" fill={GOLD} />
      </g>
      <text x="196" y="48" fontSize="34" fontWeight="700" fill={FROST} opacity="0.5" fontFamily="system-ui">
        ?
      </text>
    </Art>
  );
}

/** A phone in the frozen second: chat bubbles, a message hanging in mid-air, the HOLD ring. */
export function FrozenPhoneArt({ className }: { className?: string }) {
  return (
    <Art className={className} viewBox="0 0 260 340">
      <defs>
        <radialGradient id="site-art-frost" cx="0.5" cy="0.5" r="0.7">
          <stop offset="0.55" stopColor={FROST} stopOpacity="0" />
          <stop offset="1" stopColor={FROST} stopOpacity="0.55" />
        </radialGradient>
      </defs>
      <rect x="40" y="10" width="180" height="320" rx="26" fill={INK} stroke="#3a4380" strokeWidth="3" />
      <rect x="50" y="26" width="160" height="288" rx="16" fill="#24365a" />
      <rect x="50" y="26" width="160" height="34" rx="16" fill="#1c2b48" />
      <circle cx="70" cy="43" r="9" fill="#9fb3c8" />
      <rect x="86" y="38" width="60" height="9" rx="4.5" fill="#9fb3c8" opacity="0.6" />
      <rect x="62" y="74" width="104" height="26" rx="12" fill={PAPER} />
      <rect x="62" y="108" width="122" height="38" rx="12" fill={PAPER} />
      <rect x="96" y="154" width="100" height="26" rx="12" fill={VIOLET} />
      {/* the next message, hanging unsent */}
      <g transform="rotate(-4 120 210)">
        <rect x="58" y="194" width="124" height="34" rx="12" fill={PAPER} opacity="0.85" stroke={PINK} strokeWidth="2" strokeDasharray="5 4" />
      </g>
      <rect x="50" y="26" width="160" height="288" rx="16" fill="url(#site-art-frost)" />
      <circle cx="130" cy="276" r="26" fill={GOLD} />
      <circle cx="130" cy="276" r="34" fill="none" stroke={PINK} strokeWidth="5" strokeDasharray="30 6" opacity="0.9" />
      <path d="M122 266 v20 M138 266 v20" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      {[
        [30, 120],
        [232, 90],
        [226, 220],
        [24, 250],
      ].map(([x = 0, y = 0]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill={FROST} opacity="0.7" />
      ))}
    </Art>
  );
}
