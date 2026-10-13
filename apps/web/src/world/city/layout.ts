// The city's layout (GAME_DESIGN.md §4.1): one source of truth for the 3D city and its SVG twin.
// Pure data and maths (no three.js), so the 2D map can import it without pulling the 3D chunk.
// Units are metres; y = 0 is the top of the district plates; +z faces the default camera.
import { DISTRICTS, missionById, type DistrictId } from '@shieldquest/shared';
import type { CitySceneProps, MissionMarker } from '../contracts';

export type V3 = [number, number, number];

export const CITY = {
  /** Distance from the Stillpoint to each district plate centre. */
  ring: 46,
  /** District plate circumradius (hexagon, corners on local ±x). */
  plate: 21,
  /** Stillpoint plaza circumradius. */
  hub: 14,
  /** Radius of the rim viaduct the train runs on. */
  rim: 72,
  /** Sea level below the floating plates. */
  sea: -13,
  plateDepth: 5,
  hubDepth: 6,
  /** Height of the Stillpoint clock tower's finial. */
  tower: 41,
  /** Digi Sky layer: floor and roof heights above the Digi-District. */
  skyBase: 27,
  skyTop: 43,
  /** Height the mission markers float at above a district's plaza. */
  markerHeight: 16,
  /** Seconds for one lap of the MRT round the rim (§4.1). */
  trainPeriod: 40,
  /** Radius of the ring of squad towers round the Stillpoint (projector lanterns). */
  squadRing: 10.5,
  squadTowerHeight: 9,
} as const;

/** Inradius of a hexagon from its circumradius. */
export const inradius = (r: number) => (r * Math.sqrt(3)) / 2;

/** Angle (degrees, measured from +x towards +z) of each plate round the Stillpoint. Launch districts face the
 * default camera; the fogged expansion plates sit on the flanks; the Digi-District (and its sky layer) at the
 * back so the sky never covers the rest of the city. */
const DISTRICT_ANGLE: Record<DistrictId, number> = {
  'school-street': 126,
  'retail-district': 54,
  'digi-district': 270,
  'void-deck-commons': 198,
  interchange: 342,
};

export interface DistrictSpot {
  id: DistrictId;
  name: string;
  color: string;
  fogged: boolean;
  /** Radians, from +x towards +z. */
  angle: number;
  x: number;
  z: number;
  /** Yaw that turns the plate's local +z outwards (away from the Stillpoint). */
  rotY: number;
}

export const DISTRICT_SPOTS: readonly DistrictSpot[] = DISTRICTS.map((d) => {
  const angle = (DISTRICT_ANGLE[d.id] * Math.PI) / 180;
  return {
    id: d.id,
    name: d.name,
    color: d.color,
    fogged: Boolean(d.comingSoon),
    angle,
    x: Math.cos(angle) * CITY.ring,
    z: Math.sin(angle) * CITY.ring,
    rotY: Math.PI / 2 - angle,
  };
});

export const spotById = (id: DistrictId): DistrictSpot => DISTRICT_SPOTS.find((s) => s.id === id) ?? DISTRICT_SPOTS[0]!;

/** Plate-local point -> world point (local +z points outwards from the Stillpoint). */
export function toWorld(spot: Pick<DistrictSpot, 'x' | 'z' | 'rotY'>, local: V3): V3 {
  const c = Math.cos(spot.rotY);
  const s = Math.sin(spot.rotY);
  return [spot.x + local[0] * c + local[2] * s, local[1], spot.z - local[0] * s + local[2] * c];
}

/**
 * Where a district's mission markers float (world). The Digi-District's float over its sky layer, where its
 * apps live (and where, seen from the home angle, they never sit on the Stillpoint behind them).
 */
export const markerAnchor = (spot: DistrictSpot): V3 =>
  spot.id === 'digi-district' ? toWorld(spot, [0, CITY.skyTop + 4, -2]) : toWorld(spot, [0, CITY.markerHeight, 2]);

/** Distance from a hexagon's centre to its outline along `angle` (radians, world), corners at `cornerAngle`. */
export function hexEdgeDistance(radius: number, angle: number, cornerAngle = 0): number {
  const sector = Math.PI / 3;
  let a = (angle - cornerAngle) % sector;
  if (a < 0) a += sector;
  return inradius(radius) / Math.cos(a - sector / 2);
}

// --- Trust: lit windows, lanterns, frost ----------------------------------------------------------------

export const TRUST_MIN = -3;
export const TRUST_MAX = 3;

export function trustOf(trust: Record<string, number> | undefined, id: DistrictId): number {
  const t = Math.round(trust?.[id] ?? 0);
  return Number.isFinite(t) ? Math.max(TRUST_MIN, Math.min(TRUST_MAX, t)) : 0;
}

/** Lit windows out of WINDOW_SLOTS on the 2D map (and the share of lit windows in 3D). */
export const WINDOW_SLOTS = 12;
const LIT_WINDOWS = [0, 1, 2, 4, 6, 8, 11] as const;
export const litWindowCount = (t: number) => LIT_WINDOWS[Math.max(0, Math.min(6, t + 3))]!;
/** Share of a district's windows that glow warm in 3D. */
export const litWindowFraction = (t: number) => Math.max(0.03, (litWindowCount(t) / WINDOW_SLOTS) * 0.8);
/** Paper lanterns floating over a district: two per point of positive trust. */
export const districtLanternCount = (t: number) => (t > 0 ? t * 2 : 0);
/** How far a dimmed district's blocks frost over (0 = not at all). */
export const frostAmount = (t: number) => (t < 0 ? 0.2 + 0.13 * -t : 0);

/** Same words as the hub's district list, so the map and the panels agree. */
export function trustWord(t: number): string {
  if (t >= 3) return 'Shining';
  if (t >= 1) return 'Glowing';
  if (t === 0) return 'Steady';
  return 'Dimmed, can be relit';
}

// --- Mission markers --------------------------------------------------------------------------------------

export type MarkerState = MissionMarker['state'];

export const MARKER_WORD: Record<MarkerState, string> = {
  new: 'new mission',
  done: 'completed',
  aftershock: 'Aftershock, needs a return visit',
};

/** Most urgent first: aftershocks, then new missions, then completed ones. */
const MARKER_RANK: Record<MarkerState, number> = { aftershock: 0, new: 1, done: 2 };

export function sortMarkers(markers: readonly MissionMarker[]): MissionMarker[] {
  return [...markers].sort((a, b) => MARKER_RANK[a.state] - MARKER_RANK[b.state] || a.missionId.localeCompare(b.missionId));
}

export function markersFor(markers: readonly MissionMarker[], id: DistrictId): MissionMarker[] {
  return sortMarkers(markers.filter((m) => m.district === id));
}

/** The state a district's ripple shows: the most urgent of its markers, or null when it has none. */
export function districtRipple(markers: readonly MissionMarker[], id: DistrictId): MarkerState | null {
  return markersFor(markers, id)[0]?.state ?? null;
}

export function missionTitle(missionId: string): string {
  return missionById(missionId)?.title ?? 'Mission';
}

export const markerLabel = (m: MissionMarker) => `${missionTitle(m.missionId)}: ${MARKER_WORD[m.state]}`;

/** Pin icon sizes and spacing in CSS pixels. Hit areas are at least 48 px whatever the icon size. */
export const PIN = { overview: 42, focus: 50, spacing: 58, cols: 3 } as const;

/** A mission pin floating over its district: the lead (most urgent) one in the overview, all of them in focus. */
export interface Pin {
  marker: MissionMarker;
  /** Screen-space offset from the district's marker anchor (pixels, x right, y up). */
  offset: [number, number];
  /** Icon size in pixels. */
  size: number;
  /** Other missions in the district that this (lead) pin stands for. */
  more: number;
}

/**
 * Pins shown for `markers`: the focused district lists every mission in a centred grid; every other district
 * shows its most urgent mission (tapping it opens that mission in its district).
 */
export function pinLayout(markers: readonly MissionMarker[], focus: DistrictId | null): Pin[] {
  const out: Pin[] = [];
  for (const spot of DISTRICT_SPOTS) {
    const ms = markersFor(markers, spot.id);
    if (ms.length === 0) continue;
    if (focus === spot.id) {
      const grid = markerGrid(ms.length, PIN.spacing, PIN.cols);
      ms.forEach((m, i) => out.push({ marker: m, offset: grid[i]!, size: PIN.focus, more: 0 }));
    } else {
      out.push({ marker: ms[0]!, offset: [0, 0], size: PIN.overview, more: ms.length - 1 });
    }
  }
  return out;
}

/** Rows of pins above the focused district (for framing). */
export const pinRows = (markers: readonly MissionMarker[], focus: DistrictId | null) =>
  focus ? Math.ceil(markersFor(markers, focus).length / PIN.cols) : 1;

export function pinLabel(pin: Pin): string {
  const base = markerLabel(pin.marker);
  if (pin.more <= 0) return base;
  return `${base}. ${pin.more} more ${pin.more === 1 ? 'mission' : 'missions'} in ${spotById(pin.marker.district).name}`;
}

/** Where paper lantern k floats over a district (two per point of positive trust). */
export function districtLanternSpot(spot: DistrictSpot, k: number): V3 {
  const a = k * 2.39996 + 0.6;
  const r = 9.5 + (k % 3) * 2.4;
  return toWorld(spot, [Math.cos(a) * r, 20 + (k % 4) * 1.7 + Math.floor(k / 2) * 0.5, Math.sin(a) * r]);
}

/**
 * Screen-space grid for a district's markers: columns and rows of icon slots centred on the anchor, stacking
 * upwards. Returns pixel offsets (x right, y up) per marker in the given order.
 */
export function markerGrid(count: number, spacing: number, maxCols: number): [number, number][] {
  const cols = Math.max(1, Math.min(count, maxCols));
  const out: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, count - row * cols);
    const col = i - row * cols;
    out.push([(col - (inRow - 1) / 2) * spacing, row * spacing * 0.92]);
  }
  return out;
}

// --- Squad towers and lanterns (projector) -----------------------------------------------------------------

/** Lanterns drawn per squad; the DOM shows exact counts. */
export const MAX_SQUAD_LANTERNS = 18;

export function squadTowerSpot(index: number, total: number): V3 {
  const a = Math.PI / 2 + (index / Math.max(1, total)) * Math.PI * 2 + (total > 1 ? Math.PI / total : 0);
  return [Math.cos(a) * CITY.squadRing, 0, Math.sin(a) * CITY.squadRing];
}

/** Lantern k rises in a loose, widening spiral above its squad tower. */
export function squadLanternSpot(tower: V3, k: number): V3 {
  const a = k * 2.39996;
  const r = 1.8 + 0.55 * Math.sqrt(k);
  return [tower[0] + Math.cos(a) * r, CITY.squadTowerHeight + 3.4 + k * 2.2, tower[2] + Math.sin(a) * r];
}

/** Height of the highest squad lantern for the given counts (the projector camera keeps it in frame). */
export function squadLanternCeiling(counts: readonly number[]): number {
  const most = Math.min(MAX_SQUAD_LANTERNS, Math.max(0, ...counts.map((c) => Math.floor(c))));
  return most > 0 ? squadLanternSpot([0, 0, 0], most - 1)[1] + 2.5 : 0;
}

// --- Words -------------------------------------------------------------------------------------------------

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One-paragraph description of the city for the canvas's accessible name (and the 2D map's summary). */
/** "3 missions (1 new, 2 completed)" or "no missions yet". */
export function missionsPhrase(markers: readonly MissionMarker[], id: DistrictId): string {
  const ms = markersFor(markers, id);
  if (ms.length === 0) return 'no missions yet';
  const counts = (['new', 'aftershock', 'done'] as const)
    .map((state) => [state, ms.filter((m) => m.state === state).length] as const)
    .filter(([, n]) => n > 0)
    .map(([state, n]) => (state === 'new' ? `${n} new` : state === 'done' ? `${n} completed` : plural(n, 'Aftershock')));
  return `${plural(ms.length, 'mission')} (${counts.join(', ')})`;
}

/** Accessible name of a district on the 2D map (and anywhere a district is described in one line). */
export function districtLabel(id: DistrictId, trust: Record<string, number>, markers: readonly MissionMarker[]): string {
  const s = spotById(id);
  if (s.fogged) return `${s.name}: coming soon`;
  const t = trustOf(trust, id);
  return `${s.name}: ${trustWord(t)}, ${litWindowCount(t)} of ${WINDOW_SLOTS} windows lit. ${missionsPhrase(markers, id)}.`;
}

export function describeCity(props: Pick<CitySceneProps, 'focus' | 'districtTrust' | 'markers' | 'freezeAmount' | 'lanterns'>): string {
  const parts: string[] = ['ShieldQuest City at blue hour. The Stillpoint clock tower at the centre reads 11:59.'];
  const launch = DISTRICT_SPOTS.filter((s) => !s.fogged);
  for (const s of launch) {
    const t = trustOf(props.districtTrust, s.id);
    parts.push(`${s.name}: ${trustWord(t).toLowerCase()}, ${missionsPhrase(props.markers, s.id)}.`);
  }
  parts.push('The Digi-District floats a glowing sky layer above it.');
  const fogged = DISTRICT_SPOTS.filter((s) => s.fogged).map((s) => s.name);
  if (fogged.length > 0) parts.push(`${fogged.join(' and ')}: in fog, coming soon.`);
  if (props.focus) parts.push(`Zoomed in on ${spotById(props.focus).name}.`);
  if (props.freezeAmount !== undefined) {
    const f = props.freezeAmount;
    parts.push(f >= 0.999 ? 'Every raindrop hangs frozen in mid-air.' : f > 0.01 ? 'The rain is freezing drop by drop.' : 'Rain is falling over the city.');
  }
  const lanterns = (props.lanterns ?? []).filter((l) => l.count > 0);
  if (lanterns.length > 0) {
    const total = lanterns.reduce((n, l) => n + l.count, 0);
    parts.push(`${plural(total, 'paper lantern')} rise from ${plural(lanterns.length, 'squad tower')}.`);
  }
  return parts.join(' ');
}
