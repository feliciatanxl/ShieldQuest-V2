// CityMap2D: the SVG twin of the 3D city (GAME_DESIGN.md §4.8 Flat View). Same layout, same camera angle and the
// same framing maths as CityScene, drawn as a light SVG diorama: hex plates round the Stillpoint (11:59), glowing
// bridges, the rim with its train, the Digi Sky as a dashed outline above its district, fogged "Coming soon"
// plates, trust as lit windows + a word, mission pins as real focusable buttons, Room Freeze rain and squad
// lanterns. It is the battery saver, the no-WebGL path and the keyboard/screen-reader path, so every district
// and pin is operable with Tab + Enter/Space. Three.js-free (it ships in the main chunk).
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import type { DistrictId } from '@shieldquest/shared';
import type { CitySceneProps, MissionMarker } from '../contracts';
import { clamp, easeOutCubic, lerp, seededRandom } from '../kit/math';
import { useReducedMotion } from '../kit/motion';
import {
  FOCUS_MS,
  HOME_AZIMUTH,
  HOME_ELEVATION,
  basis,
  districtPoints,
  fitView,
  mapPoints,
  regionWithPins,
  viewRegion,
  viewUV,
  type FrameMode,
} from '../city/camera';
import {
  CITY,
  DISTRICT_SPOTS,
  MAX_SQUAD_LANTERNS,
  PIN,
  WINDOW_SLOTS,
  describeCity,
  districtLabel,
  districtLanternCount,
  districtLanternSpot,
  districtRipple,
  frostAmount,
  hexEdgeDistance,
  inradius,
  litWindowCount,
  markerAnchor,
  pinLabel,
  pinLayout,
  pinRows,
  squadLanternSpot,
  squadTowerSpot,
  toWorld,
  trustOf,
  trustWord,
  type DistrictSpot,
  type MarkerState,
  type Pin,
  type V3,
} from '../city/layout';
import { MARKER_ART, MARKER_BOX, MARKER_COLORS } from '../city/markerArt';
import '../city/map2d.css';

type XY = [number, number];

interface View {
  zoom: number;
  shiftU: number;
  shiftV: number;
}

const B = basis(HOME_AZIMUTH, HOME_ELEVATION);
const MAP_POINTS = mapPoints();
/** Light comes from the upper left of the default view: faces turned that way are brighter. */
const LIGHT: V3 = [-0.62, 0, 0.78];

// ---------------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------------

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(lerp((pa >> shift) & 255, (pb >> shift) & 255, clamp(t)));
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

const pts = (list: readonly XY[]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const pathOf = (list: readonly XY[], close = true) =>
  list.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join('') + (close ? 'Z' : '');

/** Hexagon corners (plate-local corners on ±x) in world space. */
function hexCorners(spot: Pick<DistrictSpot, 'x' | 'z' | 'rotY'>, radius: number, y: number): V3[] {
  return Array.from({ length: 6 }, (_, k) => {
    const a = (k * Math.PI) / 3;
    return toWorld(spot, [Math.cos(a) * radius, y, Math.sin(a) * radius]);
  });
}

const HUB_SPOT = { x: 0, z: 0, rotY: 0 };

/** One-word trust state for the map label (the full phrase is in the button's accessible name). */
const SHORT_WORD = (t: number) => (t < 0 ? 'Dimmed' : trustWord(t));

function useSize(ref: RefObject<HTMLDivElement | null>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 360, h: 640 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const w = Math.max(1, Math.round(el.clientWidth));
      const h = Math.max(1, Math.round(el.clientHeight));
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    read();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** Eases the framing over 900 ms when the focus changes (a cut under reduced motion); resizes snap. */
function useViewTween(goal: View, focusKey: string, animate: boolean): View {
  const [view, setView] = useState(goal);
  const cur = useRef(goal);
  const lastKey = useRef(focusKey);
  useEffect(() => {
    const from = cur.current;
    const changed = lastKey.current !== focusKey;
    lastKey.current = focusKey;
    if (!animate || !changed || typeof requestAnimationFrame === 'undefined') {
      cur.current = goal;
      setView(goal);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = clamp((now - start) / FOCUS_MS);
      const e = easeOutCubic(p);
      const v = {
        zoom: from.zoom * Math.pow(goal.zoom / from.zoom, e),
        shiftU: lerp(from.shiftU, goal.shiftU, e),
        shiftV: lerp(from.shiftV, goal.shiftV, e),
      };
      cur.current = v;
      setView(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal.zoom, goal.shiftU, goal.shiftV, focusKey, animate]);
  return view;
}

// ---------------------------------------------------------------------------------------------------------
// District dioramas: a few boxes per plate (plate-local), the first one carries the 12 trust windows
// ---------------------------------------------------------------------------------------------------------

interface Block {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  h: number;
  color: string;
  roof?: string;
}

const BLOCKS: Record<DistrictId, readonly Block[]> = {
  'school-street': [
    { x0: -11, x1: 11, z0: -14.5, z1: -8.5, h: 10.4, color: '#f1ead9', roof: '#2bb3a3' },
    { x0: -16.5, x1: -10.5, z0: -6.5, z1: 2.5, h: 6.5, color: '#e9e2d0', roof: '#239a8c' },
    { x0: -4.3, x1: 4.3, z0: 5, z1: 6, h: 4.7, color: '#2bb3a3' },
  ],
  'retail-district': [
    { x0: 10.7, x1: 15.7, z0: -8.5, z1: 3.5, h: 21.6, color: '#efe1d7', roof: '#f26b5b' },
    { x0: -9, x1: 9, z0: -15.25, z1: -5.75, h: 11, color: '#f3e6dc', roof: '#cbbfc6' },
    { x0: -16.4, x1: -8.8, z0: -7.5, z1: 7.5, h: 7.2, color: '#f6c9b5', roof: '#3f8f74' },
    { x0: 5, x1: 14, z0: 4.5, z1: 11.5, h: 3.4, color: '#aeb7c9', roof: '#aeb7c9' },
  ],
  'digi-district': [
    { x0: -15.25, x1: -9.75, z0: -9, z1: 7, h: 24, color: '#ddd7ef', roof: '#8a6cf0' },
    { x0: 9.75, x1: 15.25, z0: -9, z1: 5, h: 19.2, color: '#e4def3', roof: '#5cc4f2' },
    { x0: -6, x1: 6, z0: -15.5, z1: -10.5, h: 5, color: '#3a3470', roof: '#7fd6ff' },
    { x0: 2, x1: 4.4, z0: 3.75, z1: 4.25, h: 4.6, color: '#9f8cff', roof: '#9f8cff' },
  ],
  'void-deck-commons': [
    { x0: -9, x1: 9, z0: -12.75, z1: -7.25, h: 21.6, color: '#d6dbe4' },
    { x0: -2.5, x1: 2.5, z0: 6.5, z1: 11.5, h: 2.8, color: '#c98b5a' },
  ],
  interchange: [
    { x0: -11, x1: 11, z0: -9.5, z1: -2.5, h: 8.6, color: '#c9c3d6' },
    { x0: -7.5, x1: 7.5, z0: 4, z1: 12, h: 5, color: '#8f95ad', roof: '#f2c14e' },
  ],
};

const GROUND: Record<DistrictId, string> = {
  'school-street': '#cdd8d1',
  'retail-district': '#ddd1d1',
  'digi-district': '#bfb7da',
  'void-deck-commons': '#9aa3bd',
  interchange: '#a3a6bf',
};

interface Face {
  points: XY[];
  fill: string;
  /** Plate-local frame of the face (for the window grid): origin, along-width and up vectors. */
  frame?: { o: V3; u: V3; v: V3 };
  facing: number;
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Visible faces of a plate-local box (sides facing the camera, then the roof). */
function boxFaces(spot: Pick<DistrictSpot, 'x' | 'z' | 'rotY'>, b: Block, P: (p: V3) => XY, tint: (c: string) => string): Face[] {
  const c = Math.cos(spot.rotY);
  const s = Math.sin(spot.rotY);
  const worldN = (nx: number, nz: number): V3 => [nx * c + nz * s, 0, -nx * s + nz * c];
  const W = (x: number, y: number, z: number) => P(toWorld(spot, [x, y, z]));
  const sides: { n: V3; corners: [number, number][]; o: V3; u: V3 }[] = [
    { n: worldN(0, 1), corners: [[b.x0, b.z1], [b.x1, b.z1]], o: [b.x0, 0, b.z1], u: [b.x1 - b.x0, 0, 0] },
    { n: worldN(0, -1), corners: [[b.x1, b.z0], [b.x0, b.z0]], o: [b.x1, 0, b.z0], u: [b.x0 - b.x1, 0, 0] },
    { n: worldN(1, 0), corners: [[b.x1, b.z1], [b.x1, b.z0]], o: [b.x1, 0, b.z1], u: [0, 0, b.z0 - b.z1] },
    { n: worldN(-1, 0), corners: [[b.x0, b.z0], [b.x0, b.z1]], o: [b.x0, 0, b.z0], u: [0, 0, b.z1 - b.z0] },
  ];
  const faces: Face[] = [];
  for (const side of sides) {
    const facing = dot(side.n, B.dir);
    if (facing <= 0.02) continue;
    const [[ax, az], [bx, bz]] = side.corners as [[number, number], [number, number]];
    const shade = 0.74 + 0.2 * dot(side.n, LIGHT);
    faces.push({
      points: [W(ax, 0, az), W(bx, 0, bz), W(bx, b.h, bz), W(ax, b.h, az)],
      fill: tint(mix('#1d2440', b.color, shade)),
      frame: { o: side.o, u: side.u, v: [0, b.h, 0] },
      facing,
    });
  }
  faces.push({
    points: [W(b.x0, b.h, b.z0), W(b.x1, b.h, b.z0), W(b.x1, b.h, b.z1), W(b.x0, b.h, b.z1)],
    fill: tint(b.roof ?? mix(b.color, '#ffffff', 0.2)),
    facing: 1,
  });
  return faces;
}

/** Stable order in which a district's 12 windows light up as trust rises. */
function windowOrder(id: DistrictId): number[] {
  const rand = seededRandom(`map-windows-${id}`);
  const order = Array.from({ length: WINDOW_SLOTS }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

// ---------------------------------------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------------------------------------

function MarkerIcon({ state, size }: { state: MarkerState; size: number }) {
  const k = size / MARKER_BOX;
  return (
    <g transform={`translate(${-size / 2} ${-size / 2}) scale(${k})`}>
      {MARKER_ART[state].map((op, i) => (
        <path
          key={i}
          d={op.d}
          fill={op.fill ?? 'none'}
          stroke={op.stroke}
          strokeWidth={op.width}
          strokeDasharray={op.dash?.join(' ')}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}

/** Ripple outline round a plate, by state: circle (new), hexagon (done), jagged ring (Aftershock). */
function rippleOutline(spot: DistrictSpot, state: MarkerState, r: number): V3[] {
  const n = state === 'done' ? 6 : state === 'aftershock' ? 22 : 48;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = state === 'aftershock' && i % 2 === 1 ? 0.87 : 1;
    return toWorld(spot, [Math.cos(a) * r * k, 0.4, Math.sin(a) * r * k]);
  });
}

const RIPPLE_STYLE: Record<MarkerState, { stroke: string; cls: string }> = {
  new: { stroke: MARKER_COLORS.gold, cls: 'w-map__ripple--new' },
  done: { stroke: MARKER_COLORS.safe, cls: 'w-map__ripple--done' },
  aftershock: { stroke: '#bcd6f5', cls: 'w-map__ripple--aftershock' },
};

// ---------------------------------------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------------------------------------

/** SVG twin of CityScene. Fills its parent. Districts and pins are buttons when handlers are given. */
export function CityMap2D(props: Omit<CitySceneProps, 'quality'>) {
  const { focus, districtTrust, markers, onSelectDistrict, onSelectMission, freezeAmount, lanterns } = props;
  const ref = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(ref);
  const reduced = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const interactive = Boolean(onSelectDistrict || onSelectMission);
  const mode: FrameMode = focus ? 'focus' : interactive ? 'overview' : 'decorative';
  const pins = useMemo(() => pinLayout(markers, focus), [markers, focus]);
  const rows = useMemo(() => pinRows(markers, focus), [markers, focus]);
  const [hovered, setHovered] = useState<DistrictId | null>(null);
  // Label widths are estimated from the root font size (the Text size setting scales it).
  const remPx = typeof document === 'undefined' ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

  const goal = useMemo<View>(() => {
    let region = viewRegion(w / h, mode);
    if (focus) region = regionWithPins(region, rows, h, PIN.spacing);
    return fitView(focus ? districtPoints(focus) : MAP_POINTS, [0, 0, 0], B, w, h, region);
  }, [w, h, mode, focus, rows]);
  const view = useViewTween(goal, focus ?? '', !reduced);

  const P = (p: V3): XY => {
    const [u, v] = viewUV(p, B);
    return [w / 2 + (u - view.shiftU) * view.zoom, h / 2 - (v - view.shiftV) * view.zoom];
  };
  const z = view.zoom;
  const depth = (x: number, zz: number) => x * B.dir[0] + zz * B.dir[2];

  const summary = useMemo(
    () => describeCity({ focus, districtTrust, markers, freezeAmount, lanterns }),
    [focus, districtTrust, markers, freezeAmount, lanterns],
  );

  const select = (id: DistrictId) => onSelectDistrict?.(id);
  /** Pin centre in pixels: above the tallest block (the 3D anchor sits among scenery the map does not draw). */
  const pinXY = (pin: Pin): XY => {
    const spot = DISTRICT_SPOTS.find((d) => d.id === pin.marker.district)!;
    const [ax, ay] = P(spot.id === 'digi-district' ? markerAnchor(spot) : toWorld(spot, [0, 24, 2]));
    return [clamp(ax + pin.offset[0], pin.size / 2 + 2, w - pin.size / 2 - 2), clamp(ay - pin.offset[1], pin.size / 2 + 2, h - pin.size / 2 - 2)];
  };
  const selectPin = (m: MissionMarker) => {
    if (onSelectMission) onSelectMission(m.missionId);
    else onSelectDistrict?.(m.district);
  };
  const keyActivate = (fn: () => void) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      fn();
    }
  };

  // --- Rim viaduct and train ---
  const rimPath = (r: number, y: number) =>
    pathOf(Array.from({ length: 72 }, (_, i) => P([Math.cos((i / 72) * Math.PI * 2) * r, y, Math.sin((i / 72) * Math.PI * 2) * r])));
  const trainArc = (a0: number, a1: number) =>
    pathOf(
      Array.from({ length: 9 }, (_, i) => {
        const a = lerp(a0, a1, i / 8);
        return P([Math.cos(a) * CITY.rim, 2.6, Math.sin(a) * CITY.rim]);
      }),
      false,
    );
  const trainAt = 1.75;

  // --- Bridges ---
  const bridges = useMemo(() => {
    const out: { a: V3; b: V3; glow: string; width: number }[] = [];
    const plateIn = inradius(CITY.plate);
    for (const s of DISTRICT_SPOTS) {
      const r0 = hexEdgeDistance(CITY.hub, s.angle) - 0.6;
      const r1 = CITY.ring - plateIn + 0.6;
      out.push({
        a: [Math.cos(s.angle) * r0, 0, Math.sin(s.angle) * r0],
        b: [Math.cos(s.angle) * r1, 0, Math.sin(s.angle) * r1],
        glow: s.fogged ? '#9aa6c4' : '#a8e1ff',
        width: 4.2,
      });
    }
    const sorted = [...DISTRICT_SPOTS].sort((p, q) => p.angle - q.angle);
    sorted.forEach((p, i) => {
      const q = sorted[(i + 1) % sorted.length]!;
      const dir = Math.atan2(q.z - p.z, q.x - p.x);
      const dp = hexEdgeDistance(CITY.plate, dir, -p.rotY) - 0.6;
      const dq = hexEdgeDistance(CITY.plate, dir + Math.PI, -q.rotY) - 0.6;
      out.push({
        a: [p.x + Math.cos(dir) * dp, 0, p.z + Math.sin(dir) * dp],
        b: [q.x + Math.cos(dir + Math.PI) * dq, 0, q.z + Math.sin(dir + Math.PI) * dq],
        glow: p.fogged || q.fogged ? '#9aa6c4' : '#f5d58a',
        width: 3.2,
      });
    });
    return out;
  }, []);

  // --- Plates, painted back to front (the hub sits among them by depth) ---
  type Item = { kind: 'hub' } | { kind: 'district'; spot: DistrictSpot };
  const order: Item[] = [{ kind: 'hub' as const }, ...DISTRICT_SPOTS.map((spot) => ({ kind: 'district' as const, spot }))].sort(
    (a, b) => (a.kind === 'hub' ? 0 : depth(a.spot.x, a.spot.z)) - (b.kind === 'hub' ? 0 : depth(b.spot.x, b.spot.z)),
  );

  const plateBody = (corners: (y: number) => V3[], top: string, side: string, rim: string, depthM: number) => {
    const topPts = corners(0).map(P);
    const lowPts = corners(-depthM).map(P);
    return (
      <>
        <polygon points={pts(lowPts)} fill={side} />
        {topPts.map((p, i) => {
          const q = topPts[(i + 1) % 6]!;
          const lq = lowPts[(i + 1) % 6]!;
          const lp = lowPts[i]!;
          return <polygon key={i} points={pts([p, q, lq, lp])} fill={side} />;
        })}
        <polygon points={pts(topPts)} fill={top} stroke={rim} strokeWidth={Math.max(1.5, 0.5 * z)} strokeLinejoin="round" />
      </>
    );
  };

  const districtScene = (spot: DistrictSpot) => {
    const t = trustOf(districtTrust, spot.id);
    const fogged = spot.fogged;
    const frost = frostAmount(t);
    const tint = (c: string) => (fogged ? mix(c, '#8b95b6', 0.55) : frost > 0 ? mix(c, '#cfdcef', frost) : c);
    const ripple = fogged ? null : districtRipple(markers, spot.id);
    const blocks = BLOCKS[spot.id]
      .map((b, i) => {
        const c = toWorld(spot, [(b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2]);
        const faces = boxFaces(spot, b, P, tint);
        // The main block shows the trust windows on its side turned most towards the camera.
        const best = Math.max(...faces.filter((f) => f.frame).map((f) => f.facing));
        return { faces, i, best, d: depth(c[0], c[2]) };
      })
      .sort((a, b) => a.d - b.d);
    const lit = litWindowCount(t);
    const order = windowOrder(spot.id);
    const litSet = new Set(order.slice(0, lit));
    // Pointer picking happens on the painted shapes (front plates win); keyboard access is on the buttons below.
    const pointer = interactive
      ? {
          onClick: () => select(spot.id),
          onPointerEnter: () => setHovered(spot.id),
          onPointerLeave: () => setHovered((h) => (h === spot.id ? null : h)),
        }
      : {};
    return (
      <g
        key={spot.id}
        className={`w-map__plate${fogged ? ' w-map__plate--fogged' : ''}${interactive ? ' w-map__plate--hit' : ''}`}
        {...pointer}
      >
        {plateBody(
          (y) => hexCorners(spot, CITY.plate, y),
          fogged ? `url(#${uid}-hatch)` : tint(GROUND[spot.id]),
          tint(fogged ? '#4b5072' : '#4b5385'),
          fogged ? '#8b95b6' : spot.color,
          CITY.plateDepth,
        )}
        {ripple && (
          <path
            className={`w-map__ripple ${RIPPLE_STYLE[ripple].cls}`}
            d={pathOf(rippleOutline(spot, ripple, ripple === 'done' ? 24 : 25).map(P))}
            stroke={RIPPLE_STYLE[ripple].stroke}
            strokeWidth={ripple === 'done' ? 2.5 : 3}
            fill="none"
          />
        )}
        {blocks.map(({ faces, i, best }) =>
          faces.map((f, k) => {
            const windows = i === 0 && !fogged && f.frame !== undefined && f.facing === best;
            return (
              <g key={`${i}-${k}`}>
                <polygon points={pts(f.points)} fill={f.fill} stroke="rgba(20,32,51,0.35)" strokeWidth={0.6} strokeLinejoin="round" />
                {windows &&
                  f.frame &&
                  Array.from({ length: WINDOW_SLOTS }, (_, n) => {
                    const col = n % 4;
                    const row = Math.floor(n / 4);
                    const { o, u, v } = f.frame!;
                    const at = (fu: number, fv: number): XY =>
                      P(toWorld(spot, [o[0] + u[0] * fu + v[0] * fv, o[1] + u[1] * fu + v[1] * fv, o[2] + u[2] * fu + v[2] * fv]));
                    const u0 = 0.08 + col * 0.225;
                    const v0 = 0.12 + row * 0.27;
                    const on = litSet.has(n);
                    return (
                      <polygon
                        key={n}
                        className={on ? 'w-map__window w-map__window--lit' : 'w-map__window'}
                        points={pts([at(u0, v0), at(u0 + 0.16, v0), at(u0 + 0.16, v0 + 0.18), at(u0, v0 + 0.18)])}
                        fill={on ? '#ffd58a' : frost > 0 ? '#3a4a78' : '#2b3557'}
                      />
                    );
                  })}
              </g>
            );
          }),
        )}
        {fogged && (
          <g className="w-map__clouds">
            {[
              [-8, 6, 9],
              [7, 9, 8],
              [0, 2, 11],
              [-4, 12, 7],
              [10, 1, 6],
            ].map(([x, y, r], i) => {
              const [cx, cy] = P(toWorld(spot, [x!, y!, (i % 2 ? 4 : -3) as number]));
              return <ellipse key={i} cx={cx} cy={cy} rx={r! * z} ry={r! * z * 0.42} />;
            })}
          </g>
        )}
        {!fogged &&
          Array.from({ length: districtLanternCount(t) }, (_, k) => {
            const [cx, cy] = P(districtLanternSpot(spot, k));
            return (
              <g key={`l${k}`} className="w-map__lantern">
                <circle cx={cx} cy={cy} r={Math.max(5, 2.4 * z)} className="w-map__lantern-halo" />
                <rect x={cx - 2.5} y={cy - 3.5} width={5} height={7} rx={2} fill="#ffd27a" />
              </g>
            );
          })}
        {spot.id === 'digi-district' && digiSky(spot)}
      </g>
    );
  };

  const digiSky = (spot: DistrictSpot) => {
    const base = CITY.skyBase;
    const L = (a: V3, b: V3, key: string, stroke: string) => {
      const [x1, y1] = P(toWorld(spot, a));
      const [x2, y2] = P(toWorld(spot, b));
      return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} />;
    };
    const box = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, stroke: string, key: string) => {
      const out = [];
      for (const y of [y0, y1]) {
        out.push(L([x0, y, z0], [x1, y, z0], `${key}a${y}`, stroke), L([x1, y, z0], [x1, y, z1], `${key}b${y}`, stroke));
        out.push(L([x1, y, z1], [x0, y, z1], `${key}c${y}`, stroke), L([x0, y, z1], [x0, y, z0], `${key}d${y}`, stroke));
      }
      for (const [x, zz] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] as const) out.push(L([x, y0, zz], [x, y1, zz], `${key}v${x}${zz}`, stroke));
      return out;
    };
    const bubble = (x: number, y: number, zz: number, fill: string, key: string) => {
      const [cx, cy] = P(toWorld(spot, [x, y, zz]));
      const bw = Math.max(14, 3.4 * z);
      const bh = Math.max(9, 2 * z);
      return (
        <g key={key} transform={`translate(${cx} ${cy})`}>
          <rect x={-bw / 2} y={-bh / 2} width={bw} height={bh} rx={bh / 2.4} fill={fill} />
          <path d={`M${-bw / 2 + 3} ${bh / 2 - 1}l-2 ${bh / 2.2}l${bh / 2} ${-bh / 2.2}Z`} fill={fill} />
        </g>
      );
    };
    return (
      <g className="w-map__sky">
        <path
          d={pathOf(hexCorners(spot, CITY.plate * 0.82, base).map(P))}
          className="w-map__sky-floor"
          strokeWidth={Math.max(1.2, 0.3 * z)}
        />
        <g className="w-map__sky-lines" strokeWidth={Math.max(1, 0.22 * z)}>
          {box(-15.25, -9.75, -9, 7, base, base + 11, '#a48cf5', 'a')}
          {box(9.75, 15.25, -9, 5, base, base + 9, '#7fd6ff', 'b')}
          {box(4, 8, -13, -9, base, CITY.skyTop - 1, '#ff7ad9', 'c')}
        </g>
        {bubble(-2.5, base + 5, -1, '#f4efe6', 'b1')}
        {bubble(2.4, base + 7.4, 0.5, '#b8a6ff', 'b2')}
        {bubble(-0.5, base + 9.8, -2.5, '#7ee0d4', 'b3')}
      </g>
    );
  };

  const hubScene = () => {
    const shaft = (y0: number, y1: number, r: number, fill: string, key: string) =>
      boxFaces(HUB_SPOT, { x0: -r, x1: r, z0: -r, z1: r, h: y1 - y0, color: fill }, (p) => P([p[0], p[1] + y0, p[2]]), (c) => c).map((f, i) => (
        <polygon key={`${key}${i}`} points={pts(f.points)} fill={f.fill} stroke="rgba(20,32,51,0.3)" strokeWidth={0.6} />
      ));
    const apex = P([0, 40.4, 0]);
    const roofBase = [[-4.1, -4.1], [4.1, -4.1], [4.1, 4.1], [-4.1, 4.1]].map(([x, zz]) => P([x!, 35.2, zz!]));
    // Clock face on the side turned most towards the camera (+z at the default angle), reading 11:59.
    const [cx, cy] = P([0, 28.3, 3.6]);
    const r = Math.max(4, 2.6 * z);
    const hand = (deg: number, len: number) => {
      const a = ((deg - 90) * Math.PI) / 180;
      return `M${cx} ${cy}L${cx + Math.cos(a) * len} ${cy + Math.sin(a) * len}`;
    };
    const n = lanterns?.length ?? 0;
    return (
      <g key="hub" className="w-map__hub">
        {plateBody((y) => hexCorners(HUB_SPOT, CITY.hub, y), '#d9d0df', '#4d5486', '#f2c14e', CITY.hubDepth)}
        {shaft(0, 2.8, 4.2, '#ddd2c0', 'base')}
        {shaft(2.8, 24.8, 3, '#efe6d6', 'shaft')}
        {shaft(24.8, 32, 3.5, '#f4efe6', 'stage')}
        {shaft(32, 35.2, 2.6, '#efe6d6', 'bell')}
        {roofBase.map((p, i) => (
          <polygon key={`roof${i}`} points={pts([p, roofBase[(i + 1) % 4]!, apex])} fill={i % 2 ? '#34407e' : '#4a5aa0'} />
        ))}
        <circle cx={apex[0]} cy={apex[1] - 2} r={Math.max(2, 0.7 * z)} fill="#f2c14e" />
        <g className="w-map__clock">
          <circle cx={cx} cy={cy} r={r} fill="#fff4dc" stroke="#f2c14e" strokeWidth={Math.max(1, r * 0.12)} />
          <path d={hand(-0.5, r * 0.55)} stroke="#1d2440" strokeWidth={Math.max(1.2, r * 0.13)} strokeLinecap="round" />
          <path d={hand(-6, r * 0.85)} stroke="#1d2440" strokeWidth={Math.max(0.8, r * 0.08)} strokeLinecap="round" />
        </g>
        {lanterns?.map((l, i) => {
          const tower = squadTowerSpot(i, n);
          const [tx, ty] = P(tower);
          const [, topY] = P([tower[0], CITY.squadTowerHeight, tower[2]]);
          const tw = Math.max(5, 1.2 * z);
          const shown = Math.max(0, Math.min(MAX_SQUAD_LANTERNS, Math.floor(l.count)));
          return (
            <g key={l.squadId} className="w-map__tower">
              <rect x={tx - tw} y={topY} width={tw * 2} height={Math.max(4, ty - topY)} rx={tw * 0.4} fill={l.color} stroke="#f4efe6" strokeWidth={1} />
              {Array.from({ length: shown }, (_, k) => {
                const [lx, ly] = P(squadLanternSpot(tower, k));
                return <rect key={k} x={lx - 3} y={ly - 4} width={6} height={8} rx={2.4} fill={l.color} className="w-map__squad-lantern" />;
              })}
            </g>
          );
        })}
      </g>
    );
  };

  // --- Labels and hit areas (DISTRICTS order = Tab order) ---
  const pinTop = (id: DistrictId) => {
    const ys = pins.filter((p) => p.marker.district === id).map((p) => pinXY(p)[1] - p.size / 2);
    return ys.length > 0 ? Math.min(...ys) : null;
  };

  const districtHit = (spot: DistrictSpot) => {
    const ring = hexCorners(spot, CITY.plate + 2.2, 0.4).map(P);
    const lowest = Math.max(...hexCorners(spot, CITY.plate, -CITY.plateDepth).map((p) => P(p)[1]));
    const t = trustOf(districtTrust, spot.id);
    const current = focus === spot.id;
    const name = spot.name;
    const state = spot.fogged ? 'Coming soon' : `${SHORT_WORD(t)} · ${litWindowCount(t)}/${WINDOW_SLOTS} lit`;
    // Place the label on the plate's outer side: below the front plates, on the outer edge of the flank
    // plates, above the Digi-District's pins (its outer side is the back of the city).
    const [cx, cy] = P([spot.x, 0, spot.z]);
    const [ox, oy] = P(toWorld(spot, [0, 0, CITY.plate * 0.95]));
    const dy = oy - cy;
    const dist = Math.hypot(ox - cx, dy) || 1;
    const lineH = remPx * 0.8125 * 1.25;
    let lx = ox;
    let ly: number;
    if (spot.id === 'digi-district') {
      const top = pinTop(spot.id) ?? P(markerAnchor(spot))[1];
      ly = top - 8 - lineH;
    } else if (dy / dist > 0.35) {
      lx = cx + (ox - cx) * 0.35;
      ly = lowest + lineH;
    } else {
      ly = oy + lineH * 0.2;
    }
    const half = (Math.max(name.length * 0.6 * 0.8125, state.length * 0.52 * 0.75) * remPx) / 2;
    lx = clamp(lx, half + 6, Math.max(half + 6, w - half - 6));
    ly = clamp(ly, lineH + 4, h - lineH - 4);
    const label = districtLabel(spot.id, districtTrust, markers);
    const content = (
      <>
        <polygon points={pts(ring)} className="w-map__ring" />
        <text className="w-map__label" x={lx} y={ly} textAnchor="middle">
          <tspan className="w-map__label-name" x={lx}>
            {name}
          </tspan>
          <tspan className="w-map__label-state" x={lx} dy="1.25em">
            {state}
          </tspan>
        </text>
      </>
    );
    if (!interactive) {
      return (
        <g key={spot.id} className="w-map__district" aria-hidden="true">
          {content}
        </g>
      );
    }
    return (
      <g
        key={spot.id}
        className={`w-map__district w-map__district--button${current ? ' is-current' : ''}${spot.fogged ? ' is-fogged' : ''}${hovered === spot.id ? ' is-hover' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-current={current ? 'true' : undefined}
        aria-disabled={spot.fogged ? 'true' : undefined}
        onClick={() => select(spot.id)}
        onKeyDown={keyActivate(() => select(spot.id))}
      >
        {content}
      </g>
    );
  };

  const pinNode = (pin: Pin) => {
    const [x, y] = pinXY(pin);
    const r = Math.max(24, pin.size / 2) + 3;
    return (
      <g
        key={pin.marker.missionId}
        className={`w-map__pin w-map__pin--${pin.marker.state}`}
        transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? pinLabel(pin) : undefined}
        aria-hidden={interactive ? undefined : true}
        onClick={interactive ? () => selectPin(pin.marker) : undefined}
        onKeyDown={interactive ? keyActivate(() => selectPin(pin.marker)) : undefined}
      >
        <circle r={r} className="w-map__pin-hit" />
        <circle r={r + 3} className="w-map__pin-ring" />
        <g className="w-map__pin-icon">
          <MarkerIcon state={pin.marker.state} size={pin.size} />
        </g>
      </g>
    );
  };

  // --- Room Freeze rain (projector twin): drops freeze one by one into beads ---
  const rain = useMemo(() => {
    const rand = seededRandom('map-rain');
    return Array.from({ length: 70 }, () => ({ x: rand(), y: rand(), t: rand(), len: 10 + rand() * 8 }));
  }, []);
  const freeze = freezeAmount === undefined ? null : clamp(freezeAmount);

  const rimOuter = Math.max(4, 4.8 * z);
  return (
    <div
      ref={ref}
      className={`w-map${interactive ? ' w-map--interactive' : ''}${reduced ? ' w-map--still' : ''}`}
      data-focus={focus ?? undefined}
    >
      <svg
        className="w-map__svg"
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
        preserveAspectRatio="xMidYMid meet"
        role={interactive ? 'group' : 'img'}
        aria-label={interactive ? 'Map of ShieldQuest City. Choose a district or a mission.' : summary}
        aria-describedby={interactive ? `${uid}-summary` : undefined}
        focusable="false"
      >
        <defs>
          <pattern id={`${uid}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="#7d86a6" />
            <rect width="2.2" height="7" fill="#6a7393" />
          </pattern>
          <radialGradient id={`${uid}-glow`}>
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g aria-hidden="true">
          {/* Reflections of each district in the bay. */}
          {DISTRICT_SPOTS.map((s) => {
            const [cx, cy] = P([s.x, CITY.sea, s.z]);
            return (
              <ellipse
                key={`refl-${s.id}`}
                cx={cx}
                cy={cy}
                rx={30 * z}
                ry={30 * z * Math.sin(HOME_ELEVATION)}
                fill={s.fogged ? '#8b95b6' : s.color}
                opacity={s.fogged ? 0.08 : 0.2}
                className="w-map__reflection"
              />
            );
          })}
          <path d={rimPath(CITY.rim, 1)} className="w-map__rim" strokeWidth={rimOuter} />
          <path d={rimPath(CITY.rim, 1.6)} className="w-map__rim-glow" strokeWidth={Math.max(1.2, 0.35 * z)} />
          <path d={trainArc(trainAt, trainAt + 0.55)} className="w-map__train" strokeWidth={Math.max(4, 2.9 * z)} />
          <path d={trainArc(trainAt, trainAt + 0.55)} className="w-map__train-stripe" strokeWidth={Math.max(1, 0.5 * z)} />
          {bridges.map((b, i) => {
            const [x1, y1] = P(b.a);
            const [x2, y2] = P(b.b);
            return (
              <g key={`br${i}`}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} className="w-map__bridge" strokeWidth={Math.max(3, b.width * z)} />
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={b.glow} strokeWidth={Math.max(1, 0.35 * z)} className="w-map__bridge-glow" />
              </g>
            );
          })}
          {order.map((item) => (item.kind === 'hub' ? hubScene() : districtScene(item.spot)))}
          {freeze !== null && (
            <g className="w-map__rain">
              <rect width={w} height={h} fill="#9fb3c8" opacity={0.22 * freeze} />
              {rain.map((d, i) => {
                const x = d.x * w;
                const y = d.y * h;
                return d.t < freeze ? (
                  <g key={i}>
                    <circle cx={x} cy={y} r={6} fill={`url(#${uid}-glow)`} />
                    <circle cx={x} cy={y} r={2.2} className="w-map__bead" />
                  </g>
                ) : (
                  <line key={i} x1={x} y1={y} x2={x - d.len * 0.18} y2={y + d.len} className="w-map__drop" />
                );
              })}
            </g>
          )}
        </g>

        {DISTRICT_SPOTS.map(districtHit)}
        {pins.map(pinNode)}
      </svg>
      <p id={`${uid}-summary`} className="w-map__sr">
        {summary}
      </p>
    </div>
  );
}

export default CityMap2D;
