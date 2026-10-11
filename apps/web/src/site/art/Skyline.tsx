// Lumen at blue hour: HDB-style slab blocks, an MRT viaduct, hanging rain and the Stillpoint
// clock tower stuck at 11:59. Drawn in code (no images, no network) and fully decorative.
import { useId } from 'react';

/** Small deterministic RNG so the skyline is identical on every load (no layout or paint jitter). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Block {
  x: number;
  w: number;
  top: number;
  fill: string;
  /** Window grid bounds, snapped to the window pattern so no window is cut in half. */
  grid: { x: number; y: number; w: number; h: number } | null;
  lit: { x: number; y: number }[];
  pillars: boolean;
}

const BASE = 540;
const WIN_W = 6;
const WIN_H = 8;
const STEP_X = 13;
const STEP_Y = 16;
const OFF_X = 8;

function makeBlocks(
  seed: number,
  specs: [number, number, number][],
  fill: string,
  litChance: number,
  pillars: boolean,
  offY: number,
) {
  const rand = rng(seed);
  return specs.map(([x, w, h]): Block => {
    const top = BASE - h;
    const bottom = BASE - (pillars ? 38 : 14);
    const x0 = Math.ceil((x + 6 - OFF_X) / STEP_X) * STEP_X + OFF_X;
    const y0 = Math.ceil((top + 10 - offY) / STEP_Y) * STEP_Y + offY;
    const lit: { x: number; y: number }[] = [];
    let x1 = x0;
    let y1 = y0;
    for (let wy = y0; wy + WIN_H <= bottom; wy += STEP_Y) {
      y1 = wy;
      for (let wx = x0; wx + WIN_W <= x + w - 6; wx += STEP_X) {
        x1 = wx;
        if (rand() < litChance) lit.push({ x: wx, y: wy });
      }
    }
    const grid = x1 >= x0 && y1 >= y0 ? { x: x0, y: y0, w: x1 + WIN_W - x0, h: y1 + WIN_H - y0 } : null;
    return { x, w, top, fill, grid, lit, pillars };
  });
}

const FAR_OFF_Y = 6;
const NEAR_OFF_Y = 8;

const FAR = makeBlocks(
  7,
  [
    [0, 70, 250],
    [64, 58, 300],
    [150, 84, 230],
    [228, 52, 330],
    [470, 60, 320],
    [528, 88, 250],
    [612, 54, 290],
    [672, 80, 240],
    [744, 70, 310],
  ],
  '#262c62',
  0.12,
  false,
  FAR_OFF_Y,
);

const NEAR = makeBlocks(
  23,
  [
    [-10, 96, 190],
    [96, 74, 240],
    [196, 110, 170],
    [494, 112, 180],
    [618, 76, 230],
    [704, 110, 170],
  ],
  '#1d2350',
  0.22,
  true,
  NEAR_OFF_Y,
);

const sky = rng(91);
const STARS = Array.from({ length: 34 }, () => ({ x: sky() * 800, y: sky() * 230, s: 0.6 + sky() * 1.3, o: 0.25 + sky() * 0.6 }));
const RAIN = Array.from({ length: 46 }, () => ({ x: sky() * 800, y: 60 + sky() * 470, s: 1 + sky() * 1.4, o: 0.35 + sky() * 0.5 }));
const LANTERNS = [
  { x: 168, y: 196, s: 1 },
  { x: 610, y: 168, s: 0.85 },
  { x: 676, y: 236, s: 0.7 },
  { x: 118, y: 268, s: 0.65 },
];

/** Clock hand end point for an angle in degrees clockwise from 12. */
function hand(cx: number, cy: number, len: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + len * Math.sin(a), y: cy - len * Math.cos(a) };
}

export function StillpointClock({ cx, cy, rad }: { cx: number; cy: number; rad: number }) {
  // 11:59 — the minute hand one tick short of 12, the hour hand a hair before it.
  const minute = hand(cx, cy, rad * 0.78, 354);
  const hour = hand(cx, cy, rad * 0.52, 359.5);
  return (
    <g>
      <circle cx={cx} cy={cy} r={rad + 7} fill="#f2c14e" opacity="0.16" />
      <circle cx={cx} cy={cy} r={rad} fill="#f4efe6" stroke="#f2c14e" strokeWidth={rad * 0.14} />
      {Array.from({ length: 12 }, (_, i) => {
        const p1 = hand(cx, cy, rad * 0.86, i * 30);
        const p2 = hand(cx, cy, rad * (i % 3 === 0 ? 0.66 : 0.74), i * 30);
        return (
          <line
            key={i}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="#1d2440"
            strokeWidth={i % 3 === 0 ? rad * 0.08 : rad * 0.045}
            strokeLinecap="round"
          />
        );
      })}
      <line x1={cx} y1={cy} x2={hour.x} y2={hour.y} stroke="#1d2440" strokeWidth={rad * 0.12} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={minute.x} y2={minute.y} stroke="#ff4d8d" strokeWidth={rad * 0.07} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={rad * 0.09} fill="#1d2440" />
    </g>
  );
}

/** Indices of the void-deck pillars under a block of width `w`. */
function pillarSlots(w: number): number[] {
  return Array.from({ length: Math.max(2, Math.floor(w / 26)) }, (_, i) => i);
}

function Blocks({ blocks, windowFill, patternId }: { blocks: Block[]; windowFill: string; patternId: string }) {
  return (
    <g>
      {blocks.map((b) => (
        <g key={`${b.x}-${b.top}`}>
          <rect x={b.x} y={b.top} width={b.w} height={BASE - b.top} fill={b.fill} />
          {b.grid && <rect x={b.grid.x} y={b.grid.y} width={b.grid.w} height={b.grid.h} fill={`url(#${patternId})`} />}
          <rect x={b.x} y={b.top} width={b.w} height="4" fill="#ffffff" opacity="0.06" />
          {b.pillars && (
            <g fill="#121836">
              <rect x={b.x} y={BASE - 30} width={b.w} height="30" />
              {pillarSlots(b.w).map((i, _, arr) => (
                <rect
                  key={i}
                  x={b.x + 6 + (i * (b.w - 18)) / Math.max(1, arr.length - 1)}
                  y={BASE - 30}
                  width="6"
                  height="30"
                  fill={b.fill}
                />
              ))}
            </g>
          )}
          {b.lit.map((w) => (
            <rect key={`${w.x}-${w.y}`} x={w.x} y={w.y} width={WIN_W} height={WIN_H} rx="1" fill={windowFill} />
          ))}
        </g>
      ))}
    </g>
  );
}

/**
 * The hero poster. `className` sizes it; it scales with `slice` so the tower stays centred
 * at any frame aspect ratio.
 */
export function SkylinePoster({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={className} viewBox="0 0 800 640" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#10172f" />
          <stop offset="0.42" stopColor="#222861" />
          <stop offset="0.72" stopColor="#3a3779" />
          <stop offset="0.9" stopColor="#5d4b87" />
          <stop offset="1" stopColor="#7d5f8e" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f2c14e" stopOpacity="0.42" />
          <stop offset="1" stopColor="#f2c14e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-plate`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2448" />
          <stop offset="1" stopColor="#0f1529" />
        </linearGradient>
        <pattern id={`${id}-win-far`} width={STEP_X} height={STEP_Y} patternUnits="userSpaceOnUse" x={OFF_X} y={FAR_OFF_Y}>
          <rect width={WIN_W} height={WIN_H} rx="1" fill="#343c7c" />
        </pattern>
        <pattern id={`${id}-win-near`} width={STEP_X} height={STEP_Y} patternUnits="userSpaceOnUse" x={OFF_X} y={NEAR_OFF_Y}>
          <rect width={WIN_W} height={WIN_H} rx="1" fill="#2a3170" />
        </pattern>
      </defs>

      <rect width="800" height="640" fill={`url(#${id}-sky)`} />
      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#cfe8ff" opacity={s.o} />
      ))}
      {/* crescent moon */}
      <g transform="translate(676 92)">
        <circle r="26" fill="#f4efe6" opacity="0.92" />
        <circle cx="11" cy="-7" r="23" fill="#151d3c" />
      </g>
      <circle cx="400" cy="250" r="230" fill={`url(#${id}-glow)`} />

      <Blocks blocks={FAR} windowFill="#f2c14e" patternId={`${id}-win-far`} />

      {/* The Stillpoint */}
      <g>
        <path d="M372 540 L382 262 H418 L428 540 Z" fill="#2c3270" />
        <path d="M400 262 H418 L428 540 H400 Z" fill="#232860" />
        <rect x="356" y="168" width="88" height="98" rx="8" fill="#323a7e" />
        <rect x="400" y="168" width="44" height="98" rx="8" fill="#2a306e" />
        <path d="M350 172 L400 104 L450 172 Z" fill="#3c438d" />
        <path d="M400 104 L450 172 H400 Z" fill="#333a80" />
        <circle cx="400" cy="98" r="6" fill="#f2c14e" />
        <circle cx="400" cy="98" r="14" fill="#f2c14e" opacity="0.22" />
        <StillpointClock cx={400} cy={216} rad={32} />
        {[300, 340, 380, 420, 460, 500].map((y) => (
          <rect key={y} x="393" y={y} width="14" height="20" rx="2" fill="#f2c14e" opacity={y % 80 === 20 ? 0.75 : 0.28} />
        ))}
      </g>

      <Blocks blocks={NEAR} windowFill="#f2c14e" patternId={`${id}-win-near`} />

      {/* MRT viaduct and train */}
      <g>
        <rect x="0" y="470" width="800" height="12" fill="#2e3672" />
        <rect x="0" y="482" width="800" height="5" fill="#141a38" />
        {[40, 160, 280, 520, 640, 760].map((x) => (
          <rect key={x} x={x} y="487" width="12" height="53" fill="#1a2046" />
        ))}
        <g transform="translate(70 446)">
          <rect width="190" height="26" rx="12" fill="#e9e1d2" />
          <rect y="15" width="190" height="5" fill="#2bb3a3" />
          {[18, 48, 78, 108, 138, 164].map((x) => (
            <rect key={x} x={x} y="5" width="18" height="8" rx="2" fill="#1d2440" />
          ))}
        </g>
      </g>

      {/* diorama plate */}
      <path d="M-20 540 H820 V640 H-20 Z" fill={`url(#${id}-plate)`} />
      <path d="M-20 540 H820" stroke="#3cc8b8" strokeOpacity="0.55" strokeWidth="2" />
      {/* covered walkway, lamps, trees, kiosk */}
      <g>
        <rect x="120" y="556" width="250" height="6" rx="3" fill="#3cc8b8" opacity="0.5" />
        {[128, 188, 248, 308, 360].map((x) => (
          <rect key={x} x={x} y="562" width="4" height="26" fill="#2bb3a3" opacity="0.45" />
        ))}
        {[470, 760].map((x) => (
          <g key={x}>
            <rect x={x} y="548" width="4" height="46" fill="#9fb3c8" opacity="0.5" />
            <circle cx={x + 2} cy="548" r="5" fill="#f2c14e" />
            <circle cx={x + 2} cy="548" r="16" fill="#f2c14e" opacity="0.18" />
          </g>
        ))}
        {[40, 82, 430, 680, 724].map((x, i) => (
          <g key={x}>
            <path d={`M${x} 596 L${x + 16} 548 L${x + 32} 596 Z`} fill={i % 2 ? '#1f8f84' : '#17766d'} />
            <path d={`M${x + 16} 548 L${x + 32} 596 H${x + 16} Z`} fill="#125e57" />
          </g>
        ))}
        <g transform="translate(540 560)">
          <rect width="84" height="40" rx="6" fill="#f26b5b" />
          <rect y="-14" width="84" height="16" rx="5" fill="#f4efe6" />
          <rect x="10" y="10" width="64" height="16" rx="3" fill="#1d2440" opacity="0.5" />
        </g>
      </g>

      {/* paper lanterns (protective choices) */}
      {LANTERNS.map((l) => (
        <g key={`${l.x}-${l.y}`} transform={`translate(${l.x} ${l.y}) scale(${l.s})`}>
          <circle r="22" fill="#f2c14e" opacity="0.16" />
          <rect x="-8" y="-11" width="16" height="22" rx="6" fill="#f2c14e" />
          <rect x="-5" y="-14" width="10" height="4" rx="1.5" fill="#b8892a" />
        </g>
      ))}

      {/* rain held in mid-air */}
      {RAIN.map((d, i) => (
        <g key={i} opacity={d.o}>
          <line x1={d.x} y1={d.y - 7 * d.s} x2={d.x} y2={d.y - 2} stroke="#cfe8ff" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
          <circle cx={d.x} cy={d.y} r={d.s} fill="#cfe8ff" />
        </g>
      ))}
    </svg>
  );
}

/** A low silhouette strip for the footer and page heads. */
export function SkylineStrip({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={className} viewBox="0 0 1200 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f2756" />
          <stop offset="1" stopColor="#151c3a" />
        </linearGradient>
      </defs>
      <g fill={`url(#${id}-fade)`}>
        {[
          [0, 70, 70],
          [64, 58, 96],
          [130, 90, 62],
          [230, 54, 110],
          [292, 100, 78],
          [400, 60, 92],
          [470, 80, 66],
          [700, 90, 74],
          [800, 56, 104],
          [864, 110, 70],
          [980, 64, 98],
          [1050, 90, 64],
          [1144, 70, 88],
        ].map(([x = 0, w = 0, h = 0]) => (
          <rect key={x} x={x} y={140 - h} width={w} height={h} />
        ))}
        <path d="M584 140 L590 40 H610 L616 140 Z" />
        <rect x="574" y="12" width="52" height="34" rx="5" />
        <path d="M570 14 L600 -14 L630 14 Z" />
      </g>
      <circle cx="600" cy="29" r="11" fill="#f4efe6" stroke="#f2c14e" strokeWidth="2.5" />
      <path d="M600 29 L599 21 M600 29 L599.6 24" stroke="#1d2440" strokeWidth="1.8" strokeLinecap="round" />
      {[
        [90, 60],
        [250, 50],
        [320, 82],
        [420, 70],
        [740, 84],
        [820, 58],
        [900, 90],
        [1000, 64],
        [1070, 96],
      ].map(([x = 0, y = 0]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="6" height="8" rx="1" fill="#f2c14e" opacity="0.6" />
      ))}
    </svg>
  );
}
