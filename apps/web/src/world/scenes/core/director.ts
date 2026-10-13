// The live "director" (GAME_DESIGN.md §4.5) and the rest of the per-frame staging maths that both the 3D scene
// and the Flat View need: who the camera leans towards, where everyone looks, where hotspots float, where the
// influence string runs, and how many unarrived messages hang as paper cards while time is held. Pure functions.
import type { Mission } from '@shieldquest/shared';
import type { Hotspot, MissionSceneProps, SceneMode } from '../../contracts';
import type { AnchorSpot } from '../sets/types';
import { chestHeight, type CastPlacement } from './cast';
import type { SetStaging, Vec3 } from './staging';

const DEFAULT_HOTSPOT: Vec3 = [0, 1.6, 0];
/** Faceless figure chest (kit FACELESS_CHEST), duplicated here so this file stays free of three.js. */
const FACELESS_CHEST: Vec3 = [0, 1.18, 0.16];

const forward = (facing: number): Vec3 => [Math.sin(facing), 0, Math.cos(facing)];

export function chestOf(p: CastPlacement): Vec3 {
  if (p.kind === 'faceless') {
    const f = forward(p.facing);
    return [p.position[0] + f[0] * FACELESS_CHEST[2], p.position[1] + FACELESS_CHEST[1], p.position[2] + f[2] * FACELESS_CHEST[2]];
  }
  return [p.position[0], p.position[1] + chestHeight(p), p.position[2]];
}

export function headOf(p: CastPlacement): Vec3 {
  const h = p.kind === 'faceless' ? 1.55 : p.seated ? 1.0 : 1.28;
  return [p.position[0], p.position[1] + h, p.position[2]];
}

/** Where a bean holds its phone (in front of the chest). */
export function phoneOf(p: CastPlacement): Vec3 {
  const f = forward(p.facing);
  const c = chestOf(p);
  return [c[0] + f[0] * 0.3, c[1] - 0.08, c[2] + f[2] * 0.3];
}

export interface DirectorFocus {
  /** World point the camera leans towards. */
  point: Vec3;
  /** A cut (fast move) rather than a slow dolly: someone else in the scene started speaking. */
  cut: boolean;
  /** Cast id of the person framed (the resident for remote messages). */
  who: string | null;
}

/**
 * The live director's focus: a dolly towards the resident's phone when a message lands (remote senders and the
 * narrator have no body), a cut to a friend in the scene when they speak.
 */
export function directorFocus(mission: Mission, placements: readonly CastPlacement[], focusCast: string | null | undefined): DirectorFocus | null {
  if (!focusCast) return null;
  const resident = placements.find((p) => p.isResident) ?? null;
  const speaker = placements.find((p) => p.member.id === focusCast) ?? null;
  if (speaker && !speaker.isResident) return { point: headOf(speaker), cut: true, who: speaker.member.id };
  if (!resident) return null;
  return { point: resident.pose === 'phone' ? phoneOf(resident) : headOf(resident), cut: false, who: mission.resident };
}

/**
 * Where each bean looks: everyone turns towards a speaker who is in the scene; otherwise the others look at the
 * resident, and the resident keeps their eyes on the phone (or looks at whoever is beside them).
 */
export function gazeTargets(placements: readonly CastPlacement[], speaker: string | null | undefined, mode: SceneMode): Map<string, Vec3 | null> {
  const out = new Map<string, Vec3 | null>();
  const resident = placements.find((p) => p.isResident) ?? null;
  const talking = speaker ? placements.find((p) => p.member.id === speaker && p.kind === 'bean') ?? null : null;
  for (const p of placements) {
    if (p.kind !== 'bean') continue;
    let target: Vec3 | null = null;
    if (mode !== 'intro' && talking && talking !== p) target = headOf(talking);
    else if (!p.isResident && resident && p.member.role !== 'bystander') target = headOf(resident);
    else if (p.isResident && p.pose !== 'phone' && !talking) {
      const near = placements.filter((q) => q !== p && q.kind === 'bean').sort((a, b) => dist(a.position, p.position) - dist(b.position, p.position))[0];
      target = near ? headOf(near) : null;
    }
    out.set(p.member.id, target);
  }
  return out;
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export interface PlacedHotspot {
  clueId: string;
  anchor: string;
  /** Accessible name: the anchor label (numbered when two clues share an anchor). */
  label: string;
  state: Hotspot['state'];
  position: Vec3;
}

/**
 * Hotspot markers at anchor + hotspotOffset (default 1.6 m up). Hidden ones and unknown anchors are skipped;
 * clues that share an anchor are spread sideways so both stay tappable.
 */
export function placeHotspots(hotspots: readonly Hotspot[], anchors: Record<string, AnchorSpot>): PlacedHotspot[] {
  const visible = hotspots.filter((h) => h.state !== 'hidden' && anchors[h.anchor]);
  const total = new Map<string, number>();
  for (const h of visible) total.set(h.anchor, (total.get(h.anchor) ?? 0) + 1);
  const seen = new Map<string, number>();
  return visible.map((h) => {
    const spot = anchors[h.anchor]!;
    const n = total.get(h.anchor) ?? 1;
    const i = seen.get(h.anchor) ?? 0;
    seen.set(h.anchor, i + 1);
    const off = spot.hotspotOffset ?? DEFAULT_HOTSPOT;
    const spread = n > 1 ? (i - (n - 1) / 2) * 0.62 : 0;
    // Spread along the anchor's right-hand side (perpendicular to its facing).
    const f = spot.facing ?? 0;
    const right: Vec3 = [Math.cos(f), 0, -Math.sin(f)];
    return {
      clueId: h.clueId,
      anchor: h.anchor,
      label: n > 1 ? `${spot.label} (${i + 1} of ${n})` : spot.label,
      state: h.state,
      position: [
        spot.position[0] + off[0] + right[0] * spread,
        spot.position[1] + off[1],
        spot.position[2] + off[2] + right[2] * spread,
      ],
    };
  });
}

/** Where the faceless figure in the lit window stands (the set's staging, or behind the set's orbit target). */
export function influenceSpot(staging: SetStaging, orbitTarget: Vec3): { position: Vec3; facing: number } {
  if (staging.influence) return { position: staging.influence.position, facing: staging.influence.facing ?? 0 };
  return { position: [orbitTarget[0] + 3, 2.6, orbitTarget[2] - 6], facing: 0 };
}

/** Chest point of the faceless figure standing at `spot` (where the string ends). */
export function influenceChest(spot: { position: Vec3; facing: number }): Vec3 {
  const f = forward(spot.facing);
  return [spot.position[0] + f[0] * FACELESS_CHEST[2], spot.position[1] + FACELESS_CHEST[1], spot.position[2] + f[2] * FACELESS_CHEST[2]];
}

export interface ThreadEnds {
  from: Vec3;
  to: Vec3;
  /** The placement the string starts at (null when it starts at the resident's phone for a remote sender). */
  fromId: string | null;
}

/**
 * The influence string runs from the named cast member's chest (or, for someone not in the scene, from the
 * resident's phone) to the faceless figure in the lit window.
 */
export function threadEnds(
  thread: MissionSceneProps['thread'],
  placements: readonly CastPlacement[],
  spot: { position: Vec3; facing: number },
): ThreadEnds | null {
  if (!thread) return null;
  const who = placements.find((p) => p.member.id === thread.from);
  const resident = placements.find((p) => p.isResident);
  const start = who ? chestOf(who) : resident ? phoneOf(resident) : null;
  if (!start) return null;
  return { from: start, to: influenceChest(spot), fromId: who ? who.member.id : null };
}

/** Chat and notification beats that have not landed yet: they hang as blank paper cards while time is held. */
export function pendingCards(mission: Mission, t: number, mode: SceneMode, max = 4): number {
  if (mode !== 'frozen') return 0;
  let n = 0;
  for (const b of mission.live.beats) if (b.at > t && (b.channel === 'chat' || b.channel === 'notification')) n++;
  return Math.min(max, n);
}

/** Rain is a downpour at dusk and night, a drizzle in daylight. */
export const rainIntensity = (timeOfDay: Mission['timeOfDay']) => (timeOfDay === 'evening' || timeOfDay === 'night' ? 1 : 0.55);
