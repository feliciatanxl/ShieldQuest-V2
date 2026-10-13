// Explore mode map (free-roam ShieldQuest City): where you can walk, what blocks you, and what there is to find.
// Pure data and maths (no three.js), shared by the 3D walk-around, the 2D explore map and the tests.
// Units are metres on the same city layout as the hub (world/city/layout.ts); y = 0 is the top of the plates.
import type { DistrictId, MiniGameId } from '@shieldquest/shared';
import type { BeanLook } from '../kit/beanGeometry';
import { CITY, DISTRICT_SPOTS, hexEdgeDistance, inradius, spotById, toWorld, type DistrictSpot } from '../city/layout';

// ---------------------------------------------------------------------------------------------------------
// Frames, areas and obstacles
// ---------------------------------------------------------------------------------------------------------

/** A local frame: plate-local coordinates (local +z points away from the Stillpoint). */
export interface Frame {
  x: number;
  z: number;
  rotY: number;
}

export const WORLD_FRAME: Frame = { x: 0, z: 0, rotY: 0 };

/** World point -> frame-local point (inverse of layout.toWorld). */
export function toLocal(f: Frame, x: number, z: number): [number, number] {
  const c = Math.cos(f.rotY);
  const s = Math.sin(f.rotY);
  const dx = x - f.x;
  const dz = z - f.z;
  return [c * dx - s * dz, s * dx + c * dz];
}

/** Frame-local point -> world point. */
export function fromLocal(f: Frame, lx: number, lz: number): [number, number] {
  const w = toWorld(f, [lx, 0, lz]);
  return [w[0], w[2]];
}

/** Axis-aligned box in a frame (a building footprint), with its height for the camera. */
export interface BoxObstacle {
  kind: 'box';
  frame: Frame;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  h: number;
  /** A roof you can walk under (pavilions, covered walkways): blocks only the camera's view, from y0 up to h. */
  roof?: { y0: number };
}

/** Vertical cylinder in world coordinates (tree trunks, posts, people). */
export interface CircleObstacle {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
  h: number;
  /** A tree's canopy: blocks the camera's view (not the player) between y0 and h within radius r. */
  canopy?: { r: number; y0: number };
}

export type Obstacle = BoxObstacle | CircleObstacle;

/** Hexagonal plate (corners at `corner` radians, world). */
export interface HexArea {
  kind: 'hex';
  id: AreaId;
  x: number;
  z: number;
  radius: number;
  corner: number;
}

/** Straight walkway (bridge deck) from a to b; `half` is the walkable half-width inside the parapets. */
export interface StripArea {
  kind: 'strip';
  id: AreaId;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  half: number;
}

export type WalkArea = HexArea | StripArea;

/** Where you are: the Stillpoint plaza, a district plate, or a bridge. */
export type AreaId = 'hub' | DistrictId | 'bridge';

export interface ExploreWorld {
  areas: readonly WalkArea[];
  obstacles: readonly Obstacle[];
}

/** Player body radius (m). */
export const PLAYER_RADIUS = 0.45;

const spotFrame = (s: Pick<DistrictSpot, 'x' | 'z' | 'rotY'>): Frame => ({ x: s.x, z: s.z, rotY: s.rotY });

/** A box centred at (cx, cz) in `frame`, `w` along local x and `d` along local z. */
function box(frame: Frame, cx: number, cz: number, w: number, d: number, h: number): BoxObstacle {
  return { kind: 'box', frame, x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, h };
}

/** A walk-under roof (blocks the camera's view only). */
function roof(frame: Frame, cx: number, cz: number, w: number, d: number, y0: number, h: number): BoxObstacle {
  return { ...box(frame, cx, cz, w, d, h), roof: { y0 } };
}

function circleAt(frame: Frame, lx: number, lz: number, r: number, h: number): CircleObstacle {
  const [x, z] = fromLocal(frame, lx, lz);
  return { kind: 'circle', x, z, r, h };
}

/** Launch districts you can walk on (the fogged expansion plates stay closed). */
export const OPEN_DISTRICTS: readonly DistrictSpot[] = DISTRICT_SPOTS.filter((s) => !s.fogged);

// --- Building footprints, matching world/city/builders.ts (plate-local) -----------------------------------

type Footprint = (f: Frame) => Obstacle[];

const FOOTPRINTS: Partial<Record<DistrictId, Footprint>> = {
  'school-street': (f) => [
    box(f, 0, -11.5, 22, 6, 13.4), // school block
    box(f, -13.5, -2, 6.6, 9.6, 8.2), // sports hall
    box(f, -3.6, 5.5, 1.2, 1.2, 4.7), // gate pillars
    box(f, 3.6, 5.5, 1.2, 1.2, 4.7),
    box(f, -8.6, 5.5, 8.2, 0.5, 1.4), // fences
    box(f, 8.6, 5.5, 8.2, 0.5, 1.4),
    circleAt(f, -12, 9.2, 1.1, 0.8), // canteen tables
    circleAt(f, -9, 9.2, 1.1, 0.8),
    box(f, 4.5, 15.4, 9.1, 2.6, 3.1), // bus
    circleAt(f, 13.6, 11.6, 0.4, 2.2), // timetable board
    roof(f, -10.5, 9.2, 7.8, 5.8, 2.9, 4.9), // canteen roof
    roof(f, 0, -1.6, 3.1, 12, 2.7, 3.3), // covered walkway
    roof(f, 10.5, 11, 5, 2.3, 2.5, 3.1), // bus stop
  ],
  'retail-district': (f) => [
    box(f, 0, -10.5, 18, 9.5, 15.5), // mall
    box(f, 13.2, -2.5, 5, 12, 24.4), // HDB block
    box(f, -12.6, 0, 7.5, 15, 9.6), // shophouse row
    box(f, 7.6, 3, 3, 1.6, 3.1), // Boba Boleh kiosk
    box(f, -3, 9, 2.6, 1.6, 3.1), // kiosk
    circleAt(f, 7.5, 7, 1.1, 0.8), // food court tables
    circleAt(f, 11.5, 7, 1.1, 0.8),
    circleAt(f, 7.5, 9.6, 1.1, 0.8),
    circleAt(f, 11.5, 9.6, 1.1, 0.8),
    roof(f, 9.5, 8, 9.8, 7.8, 3.3, 5.3), // food court roof
    roof(f, 0, -4.5, 6.4, 2.5, 3.1, 3.7), // mall entrance canopy
  ],
  'digi-district': (f) => [
    box(f, -12.5, -1, 5.5, 16, 26.8), // neon void-deck block
    box(f, 12.5, -2, 5.5, 14, 22), // second block
    box(f, -1.5, 5, 3, 1.6, 3.1), // phone kiosk
    circleAt(f, 3.2, 4, 1.25, 4.7), // giant phone
    box(f, 0, -13, 12, 5, 5), // data hub
    circleAt(f, -5.5, 11, 0.5, 3.6), // neon boards
    circleAt(f, 5.5, 11, 0.5, 3.6),
  ],
};

function hubObstacles(): Obstacle[] {
  const out: Obstacle[] = [box(WORLD_FRAME, 0, 0, 9.2, 9.2, CITY.tower)];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    out.push(box(WORLD_FRAME, Math.cos(a) * 7.6, Math.sin(a) * 7.6, 2.2, 2.2, 0.7));
  }
  return out;
}

// --- Walkable areas: the Stillpoint plaza, open plates and the bridges between them -----------------------

const plateIn = inradius(CITY.plate);

function strip(id: AreaId, a: [number, number], b: [number, number], half: number, extend: number): StripArea {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  return { kind: 'strip', id, ax: a[0] - ux * extend, az: a[1] - uz * extend, bx: b[0] + ux * extend, bz: b[1] + uz * extend, half };
}

/** Radial bridge from the Stillpoint plaza to a plate (same maths as builders.bridges). */
export function radialBridge(s: DistrictSpot): StripArea {
  const r0 = hexEdgeDistance(CITY.hub, s.angle) - 0.6;
  const r1 = CITY.ring - plateIn + 0.6;
  // Deck 4.2 m wide with 0.25 m parapets.
  return strip('bridge', [Math.cos(s.angle) * r0, Math.sin(s.angle) * r0], [Math.cos(s.angle) * r1, Math.sin(s.angle) * r1], 1.85, 1.2);
}

/** Ring bridges between neighbouring plates that are both open. */
function ringBridges(): StripArea[] {
  const out: StripArea[] = [];
  const sorted = [...DISTRICT_SPOTS].sort((p, q) => p.angle - q.angle);
  sorted.forEach((p, i) => {
    const q = sorted[(i + 1) % sorted.length]!;
    if (p.fogged || q.fogged) return;
    const dirPQ = Math.atan2(q.z - p.z, q.x - p.x);
    const dirQP = dirPQ + Math.PI;
    const dp = hexEdgeDistance(CITY.plate, dirPQ, -p.rotY) - 0.6;
    const dq = hexEdgeDistance(CITY.plate, dirQP, -q.rotY) - 0.6;
    const a: [number, number] = [p.x + Math.cos(dirPQ) * dp, p.z + Math.sin(dirPQ) * dp];
    const c: [number, number] = [q.x + Math.cos(dirQP) * dq, q.z + Math.sin(dirQP) * dq];
    // Deck 3.2 m wide with 0.25 m parapets.
    out.push(strip('bridge', a, c, 1.35, 1.2));
  });
  return out;
}

function buildAreas(): WalkArea[] {
  const areas: WalkArea[] = [{ kind: 'hex', id: 'hub', x: 0, z: 0, radius: CITY.hub, corner: 0 }];
  for (const s of OPEN_DISTRICTS) areas.push({ kind: 'hex', id: s.id, x: s.x, z: s.z, radius: CITY.plate, corner: -s.rotY });
  for (const s of OPEN_DISTRICTS) areas.push(radialBridge(s));
  areas.push(...ringBridges());
  return areas;
}

// ---------------------------------------------------------------------------------------------------------
// Places: arcade kiosks, mission beacons, Shield Shards and townies
// ---------------------------------------------------------------------------------------------------------

export type PlaceKind = 'kiosk' | 'beacon' | 'shard' | 'townie';

interface PlaceBase {
  id: string;
  kind: PlaceKind;
  /** World position (ground). */
  x: number;
  z: number;
  /** Where you stand to use it (teleport target for the Nearby list and the 2D map). */
  standX: number;
  standZ: number;
  area: AreaId;
  /** Short, readable "where" for lists and the 2D map. */
  where: string;
}

export interface KioskPlace extends PlaceBase {
  kind: 'kiosk';
  district: DistrictId;
  game: MiniGameId;
  /** Yaw the cabinet faces (world). */
  facing: number;
}

export interface BeaconPlace extends PlaceBase {
  kind: 'beacon';
  district: DistrictId;
}

export interface ShardPlace extends PlaceBase {
  kind: 'shard';
}

export interface TowniePlace extends PlaceBase {
  kind: 'townie';
  name: string;
  /** One-line safety tip (fictional speaker, accurate advice). */
  tip: string;
  look: BeanLook;
  facing: number;
}

export type Place = KioskPlace | BeaconPlace | ShardPlace | TowniePlace;

/** Which mini-game each launch district's arcade kiosk runs. */
export const KIOSK_GAME: Record<string, MiniGameId> = {
  'school-street': 'wordsearch',
  'retail-district': 'real-or-fake',
  'digi-district': 'money-trail',
};

/** Plate-local spots for each launch district's kiosk, beacon and townie. */
const DISTRICT_SPOTS_LOCAL: Record<string, { kiosk: [number, number]; beacon: [number, number]; townie: [number, number] }> = {
  'school-street': { kiosk: [6, 1], beacon: [-6, 0], townie: [-3, 9.5] },
  'retail-district': { kiosk: [-5, 3], beacon: [1, 0.5], townie: [3, 7.5] },
  'digi-district': { kiosk: [-4.5, -2], beacon: [3, -1.5], townie: [1.5, 8.5] },
};

/** Arcade cabinet footprint (local, facing +z). */
export const CABINET = { w: 1.7, d: 1.2, h: 3 } as const;
export const BEACON_RADIUS = 0.9;
export const TOWNIE_RADIUS = 0.42;

function kioskFor(s: DistrictSpot): KioskPlace {
  const f = spotFrame(s);
  const [lx, lz] = DISTRICT_SPOTS_LOCAL[s.id]!.kiosk;
  const [x, z] = fromLocal(f, lx, lz);
  const [standX, standZ] = fromLocal(f, lx, lz + 2.2);
  return {
    id: `kiosk-${s.id}`,
    kind: 'kiosk',
    district: s.id,
    game: KIOSK_GAME[s.id]!,
    x,
    z,
    standX,
    standZ,
    facing: s.rotY,
    area: s.id,
    where: `${s.name} arcade`,
  };
}

function beaconFor(s: DistrictSpot): BeaconPlace {
  const f = spotFrame(s);
  const [lx, lz] = DISTRICT_SPOTS_LOCAL[s.id]!.beacon;
  const [x, z] = fromLocal(f, lx, lz);
  const [standX, standZ] = fromLocal(f, lx, lz + 2.2);
  return { id: `beacon-${s.id}`, kind: 'beacon', district: s.id, x, z, standX, standZ, area: s.id, where: `${s.name} mission beacon` };
}

interface TownieDef {
  id: string;
  name: string;
  tip: string;
  look: BeanLook;
  /** District plate, or null for the Stillpoint plaza (world coordinates). */
  district: DistrictId | null;
  at: [number, number];
}

// Fictional townies. Tips follow standard Singapore scam-prevention advice (ScamShield: Add, Check, Tell).
const TOWNIES: readonly TownieDef[] = [
  {
    id: 'townie-plaza',
    name: 'Auntie May',
    tip: 'If a message rushes you to act now, slow down. Rushing you is a scammer’s favourite trick.',
    look: { body: '#f2c14e', accent: '#7a4e8c', hair: 'bun', outfit: 'casual' },
    district: null,
    at: [-1.6, 8.9],
  },
  {
    id: 'townie-school-street',
    name: 'Coach Ravi',
    tip: 'Never share a one-time password (OTP), not even with “the bank”. Real banks never ask for it.',
    look: { body: '#2bb3a3', accent: '#1d2440', hair: 'cap', outfit: 'casual' },
    district: 'school-street',
    at: DISTRICT_SPOTS_LOCAL['school-street']!.townie,
  },
  {
    id: 'townie-retail-district',
    name: 'Shopkeeper Lin',
    tip: 'A deal that is way cheaper than anywhere else? Check the seller first, and pay only on the official platform.',
    look: { body: '#f26b5b', accent: '#3f8f74', hair: 'ponytail', outfit: 'work' },
    district: 'retail-district',
    at: DISTRICT_SPOTS_LOCAL['retail-district']!.townie,
  },
  {
    id: 'townie-digi-district',
    name: 'Dev Aisyah',
    tip: 'Paid just to let money pass through your bank account? That is money mule work, and it is a crime.',
    look: { body: '#8a6cf0', accent: '#5cc4f2', hair: 'hijab', outfit: 'casual', glasses: true },
    district: 'digi-district',
    at: DISTRICT_SPOTS_LOCAL['digi-district']!.townie,
  },
];

function townieFor(t: TownieDef): TowniePlace {
  const spot = t.district ? spotById(t.district) : null;
  const f = spot ? spotFrame(spot) : WORLD_FRAME;
  const [x, z] = fromLocal(f, t.at[0], t.at[1]);
  // Face outwards (towards the default camera side of the plate); you stand in front of them.
  const facing = f.rotY;
  const [standX, standZ] = fromLocal(f, t.at[0], t.at[1] + 1.8);
  return {
    id: t.id,
    kind: 'townie',
    name: t.name,
    tip: t.tip,
    look: t.look,
    x,
    z,
    standX,
    standZ,
    facing,
    area: t.district ?? 'hub',
    where: spot ? spot.name : 'Stillpoint Plaza',
  };
}

interface ShardDef {
  id: string;
  district: DistrictId | null;
  at: [number, number];
  where: string;
  area?: AreaId;
}

/** Ten Shield Shards with stable ids (collected once per day each). Some hide behind buildings. */
const SHARD_DEFS: readonly ShardDef[] = [
  { id: 'shard-plaza-1', district: null, at: [0, -7.5], where: 'Behind the clock tower' },
  { id: 'shard-bridge-1', district: null, at: [0, -20], where: 'On the bridge to Digi-District', area: 'hub' },
  { id: 'shard-school-1', district: 'school-street', at: [-18, -2], where: 'Behind the sports hall' },
  { id: 'shard-school-2', district: 'school-street', at: [-4, -16.4], where: 'Behind the school block' },
  { id: 'shard-school-3', district: 'school-street', at: [13, 3], where: 'In the football goal' },
  { id: 'shard-retail-1', district: 'retail-district', at: [7.6, 1], where: 'Behind the bubble tea kiosk' },
  { id: 'shard-retail-2', district: 'retail-district', at: [12, -12], where: 'Behind the mall' },
  { id: 'shard-retail-3', district: 'retail-district', at: [9.5, 8.3], where: 'Under the food court roof' },
  { id: 'shard-digi-1', district: 'digi-district', at: [-9.5, -14.5], where: 'Behind the data hub' },
  { id: 'shard-digi-2', district: 'digi-district', at: [17, -4], where: 'Behind the tall block' },
];

function shardFor(d: ShardDef): ShardPlace {
  const f = d.district ? spotFrame(spotById(d.district)) : WORLD_FRAME;
  const [x, z] = fromLocal(f, d.at[0], d.at[1]);
  return { id: d.id, kind: 'shard', x, z, standX: x, standZ: z, area: d.area ?? d.district ?? 'hub', where: d.where };
}

export const KIOSKS: readonly KioskPlace[] = OPEN_DISTRICTS.filter((s) => s.id in KIOSK_GAME).map(kioskFor);
export const BEACONS: readonly BeaconPlace[] = OPEN_DISTRICTS.filter((s) => s.id in DISTRICT_SPOTS_LOCAL).map(beaconFor);
export const TOWNIE_PLACES: readonly TowniePlace[] = TOWNIES.map(townieFor);
export const SHARDS: readonly ShardPlace[] = SHARD_DEFS.map(shardFor);
export const SHARD_IDS: readonly string[] = SHARDS.map((s) => s.id);
export const SHARD_TOTAL = SHARDS.length;

/** Every place in Explore mode. */
export const PLACES: readonly Place[] = [...KIOSKS, ...BEACONS, ...TOWNIE_PLACES, ...SHARDS];

export const placeById = (id: string): Place | undefined => PLACES.find((p) => p.id === id);

/** Obstacles added by Explore's own props (cabinets, beacons, townies). */
function placeObstacles(): Obstacle[] {
  const out: Obstacle[] = [];
  for (const k of KIOSKS) {
    const s = spotById(k.district);
    const [lx, lz] = toLocal(spotFrame(s), k.x, k.z);
    out.push(box(spotFrame(s), lx, lz, CABINET.w, CABINET.d, CABINET.h));
  }
  for (const b of BEACONS) out.push({ kind: 'circle', x: b.x, z: b.z, r: BEACON_RADIUS, h: 8 });
  for (const t of TOWNIE_PLACES) out.push({ kind: 'circle', x: t.x, z: t.z, r: TOWNIE_RADIUS, h: 1.9 });
  return out;
}

function buildObstacles(): Obstacle[] {
  const out = hubObstacles();
  for (const s of OPEN_DISTRICTS) out.push(...(FOOTPRINTS[s.id]?.(spotFrame(s)) ?? []));
  out.push(...placeObstacles());
  return out;
}

/** The walkable city with every building, kiosk and townie (trees and lamps are added per tier by the 3D view). */
export const EXPLORE_WORLD: ExploreWorld = { areas: buildAreas(), obstacles: buildObstacles() };

/** A world with extra obstacles (e.g. tree trunks and lamp posts drawn at the current quality tier). */
export function withObstacles(world: ExploreWorld, extra: readonly Obstacle[]): ExploreWorld {
  return { areas: world.areas, obstacles: [...world.obstacles, ...extra] };
}

// ---------------------------------------------------------------------------------------------------------
// Spawn and area names
// ---------------------------------------------------------------------------------------------------------

const SCHOOL = spotById('school-street');

/** Start on the bridge from the Stillpoint plaza, facing School Street (the camera clears the clock tower). */
export const SPAWN = {
  x: Math.cos(SCHOOL.angle) * 16,
  z: Math.sin(SCHOOL.angle) * 16,
  /** Player yaw (0 faces +z): towards School Street. */
  heading: Math.atan2(Math.cos(SCHOOL.angle), Math.sin(SCHOOL.angle)),
  /** Camera yaw: behind the player (camera offset direction is (sin yaw, cos yaw)). */
  yaw: Math.atan2(-Math.cos(SCHOOL.angle), -Math.sin(SCHOOL.angle)),
} as const;

export function areaName(id: AreaId): string {
  if (id === 'hub') return 'Stillpoint Plaza';
  if (id === 'bridge') return 'a sky bridge';
  return spotById(id).name;
}
