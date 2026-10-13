// Flat View drawing helpers (GAME_DESIGN.md §4.8): the 2D twin of each set is drawn with the same oblique
// "diorama" projection its anchors are computed with, so the SVG snapshot, the cast glyphs and the hotspot
// buttons always line up with the 3D layout. Pure SVG + maths: no three.js (this ships in the app shell).
import { useId } from 'react';
import type { Mission } from '@shieldquest/shared';
import type { AnchorSpot } from '../sets/types';
import type { FlatStaging, Oblique, SetStaging, Vec3 } from './staging';

const r1 = (n: number) => Math.round(n * 10) / 10;

export function project(o: Oblique, p: Readonly<Vec3>): [number, number] {
  return [o.ox + p[0] * o.s + p[2] * o.sx, o.oy + p[2] * o.sz - p[1] * o.s];
}

export function flatPoint(o: Oblique, p: Readonly<Vec3>): { x: number; y: number } {
  const [x, y] = project(o, p);
  return { x: r1(x), y: r1(y) };
}

/** SVG `points` for a list of world points. */
export function pts(o: Oblique, ...ps: Readonly<Vec3>[]): string {
  return ps.map((p) => project(o, p).map(r1).join(',')).join(' ');
}

const DEFAULT_HOTSPOT: Vec3 = [0, 1.6, 0];

/** Flat anchors (feet points) projected from the 3D anchors. */
export function flatAnchorsOf(o: Oblique, anchors: Record<string, AnchorSpot>): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const [key, a] of Object.entries(anchors)) out[key] = flatPoint(o, a.position);
  return out;
}

/** Flat View staging derived from the 3D staging (hotspots, seats, rain box and the influence window). */
export function flatStagingOf(
  o: Oblique,
  anchors: Record<string, AnchorSpot>,
  staging: SetStaging,
  overrides: Partial<FlatStaging> = {},
): FlatStaging {
  const hotspots: Record<string, { x: number; y: number }> = {};
  for (const [key, a] of Object.entries(anchors)) {
    const off = a.hotspotOffset ?? DEFAULT_HOTSPOT;
    // A little higher than in 3D: flat glyphs have no depth to separate a marker from the head beneath it.
    hotspots[key] = flatPoint(o, [a.position[0] + off[0], a.position[1] + off[1] + 0.25, a.position[2] + off[2]]);
  }
  const seats: Record<string, { x: number; y: number }> = {};
  for (const [key, p] of Object.entries(staging.seats ?? {})) seats[key] = flatPoint(o, p);
  let rain: FlatStaging['rain'];
  if (staging.rain === false) rain = false;
  else if (staging.rain) {
    const { position: c, area } = staging.rain;
    const corners: Vec3[] = [
      [c[0] - area[0] / 2, c[1], c[2] - area[2] / 2],
      [c[0] + area[0] / 2, c[1] + area[1], c[2] + area[2] / 2],
      [c[0] - area[0] / 2, c[1] + area[1], c[2] - area[2] / 2],
      [c[0] + area[0] / 2, c[1], c[2] + area[2] / 2],
    ];
    const xy = corners.map((p) => project(o, p));
    const xs = xy.map((p) => p[0]);
    const ys = xy.map((p) => p[1]);
    rain = { x: r1(Math.min(...xs)), y: r1(Math.min(...ys)), w: r1(Math.max(...xs) - Math.min(...xs)), h: r1(Math.max(...ys) - Math.min(...ys)) };
  }
  const inf = staging.influence;
  return {
    oblique: o,
    beanHeight: r1(1.5 * o.s),
    hotspots,
    seats,
    ...(rain !== undefined ? { rain } : {}),
    // The window's sill sits 0.86 m above the figure's feet (kit facelessWindow).
    ...(inf ? { influence: flatPoint(o, [inf.position[0], inf.position[1] + 0.86, inf.position[2]]) } : {}),
    ...overrides,
  };
}

export interface FBoxProps {
  o: Oblique;
  min: Readonly<Vec3>;
  max: Readonly<Vec3>;
  front: string;
  top?: string;
  /** The +x side (visible when the projection shifts deeper points to the right). */
  side?: string;
  stroke?: string;
  opacity?: number;
}

/** A box seen from the front-right: right side, top, then the front face on top. */
export function FBox({ o, min, max, front, top, side, stroke, opacity }: FBoxProps) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const common = stroke ? { stroke, strokeWidth: 0.6, strokeLinejoin: 'round' as const } : {};
  return (
    <g opacity={opacity}>
      {side && <polygon points={pts(o, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1])} fill={side} {...common} />}
      {top && <polygon points={pts(o, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0])} fill={top} {...common} />}
      <polygon points={pts(o, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1])} fill={front} {...common} />
    </g>
  );
}

/** A flat quad (or any polygon) through world points. */
export function FPoly({ o, p, fill, stroke, opacity }: { o: Oblique; p: Readonly<Vec3>[]; fill: string; stroke?: string; opacity?: number }) {
  return <polygon points={pts(o, ...p)} fill={fill} stroke={stroke} strokeWidth={stroke ? 0.8 : undefined} opacity={opacity} />;
}

/** Two-stop sky per time of day (top, horizon). */
export const FLAT_SKY: Record<Mission['timeOfDay'], [string, string]> = {
  morning: ['#9cc7ea', '#f6dcb4'],
  afternoon: ['#7fb3e0', '#cfe6f6'],
  evening: ['#2a2f6b', '#c97a8e'],
  night: ['#0d1626', '#2a2f6b'],
};

export const isNight = (timeOfDay: Mission['timeOfDay']) => timeOfDay === 'evening' || timeOfDay === 'night';

/** Sky gradient filling the drawing (unique gradient id per instance). */
export function FlatSky({ width, height, timeOfDay }: { width: number; height: number; timeOfDay: Mission['timeOfDay'] }) {
  const id = `w-sky-${useId().replace(/:/g, '')}`;
  const [top, bottom] = FLAT_SKY[timeOfDay];
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill={`url(#${id})`} />
    </>
  );
}

/** A deterministic window-light pattern (same on every device): true = lit. */
export function litPattern(count: number, fraction: number, seed: number): boolean[] {
  let a = seed >>> 0;
  const out: boolean[] = [];
  for (let i = 0; i < count; i++) {
    a = (a * 1664525 + 1013904223) >>> 0;
    out.push(a / 4294967296 < fraction);
  }
  return out;
}
