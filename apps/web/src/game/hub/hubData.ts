// Pure helpers for the city hub. No React, no storage: everything is derived from progress + content,
// so the hub, the Bond Book and the tests all agree on what "new", "played" and "in motion" mean.
import {
  DISTRICTS,
  MISSIONS,
  districtById,
  type BandId,
  type DistrictId,
  type Mission,
  type PendingAftershock,
  type Progress,
  type Safety,
} from '@shieldquest/shared';
import type { MissionMarker } from '../../world/contracts';
import type { Status } from '../../ui/StatusBadge';

/** The tutorial ("The Free Bubble Tea Poster") is suggested first whenever it exists in the registry. */
export const TUTORIAL_ID = 'first-hold';

export const LAUNCH_DISTRICTS = DISTRICTS.filter((d) => !d.comingSoon);

/** Max lanterns a district can show (district trust is clamped to -3..+3 by the engine). */
export const TRUST_MAX = 3;

export type MissionPlayState = MissionMarker['state'];

export function bandMissions(band: BandId | null, missions: readonly Mission[] = MISSIONS): Mission[] {
  return missions.filter((m) => !band || m.bands.includes(band));
}

export function pendingFor(progress: Progress, missionId: string): PendingAftershock[] {
  return progress.pending.filter((p) => p.missionId === missionId);
}

/** A pending Aftershock is the most useful thing to show, so it outranks "played". */
export function missionState(progress: Progress, missionId: string): MissionPlayState {
  if (progress.pending.some((p) => p.missionId === missionId)) return 'aftershock';
  return progress.runs[missionId] ? 'done' : 'new';
}

export function buildMarkers(missions: readonly Mission[], progress: Progress): MissionMarker[] {
  return missions
    .filter((m) => !districtById(m.district)?.comingSoon)
    .map((m) => ({ missionId: m.id, district: m.district, state: missionState(progress, m.id) }));
}

const SCAFFOLD_RANK: Record<Mission['scaffold'], number> = { guided: 0, light: 1, wildcard: 2 };

export const SCAFFOLD_LABEL: Record<Mission['scaffold'], string> = {
  guided: 'Guided',
  light: 'Light prompts',
  wildcard: 'Wildcard',
};

export const SCAFFOLD_HINT: Record<Mission['scaffold'], string> = {
  guided: 'Prompts walk you through every step.',
  light: 'Prompts appear only when you tap a letter.',
  wildcard: 'No prompts. Something new, with the same tricks underneath.',
};

export const TIME_LABEL: Record<Mission['timeOfDay'], string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
};

/**
 * The "Continue" suggestion: the tutorial first, then unplayed missions for the band in scaffold order
 * (Guided before Light before Wildcard, so prompts fade across a Lumen day). Registry order breaks ties.
 */
export function nextMission(band: BandId | null, progress: Progress, missions: readonly Mission[] = MISSIONS): Mission | null {
  const tutorial = missions.find((m) => m.id === TUTORIAL_ID);
  if (tutorial && !progress.runs[tutorial.id] && (!band || tutorial.bands.includes(band))) return tutorial;
  const pool = bandMissions(band, missions)
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => !progress.runs[m.id] && !districtById(m.district)?.comingSoon)
    .sort((a, b) => SCAFFOLD_RANK[a.m.scaffold] - SCAFFOLD_RANK[b.m.scaffold] || a.i - b.i);
  return pool[0]?.m ?? null;
}

export interface DistrictSummary {
  district: DistrictId;
  comingSoon: boolean;
  /** Missions shown for this district (band missions, or every band's when the band has none here). */
  missions: Mission[];
  /** True when the band has no missions here, so the list falls back to all bands. */
  otherBands: boolean;
  fresh: number;
  played: number;
  inMotion: number;
}

export function districtSummary(
  district: DistrictId,
  band: BandId | null,
  progress: Progress,
  missions: readonly Mission[] = MISSIONS,
): DistrictSummary {
  const comingSoon = Boolean(districtById(district)?.comingSoon);
  const here = missions.filter((m) => m.district === district);
  const forBand = bandMissions(band, here);
  const otherBands = Boolean(band) && forBand.length === 0 && here.length > 0;
  const list = comingSoon ? [] : otherBands ? here : forBand;
  const states = list.map((m) => missionState(progress, m.id));
  return {
    district,
    comingSoon,
    missions: list,
    otherBands,
    fresh: states.filter((s) => s === 'new').length,
    played: states.filter((s) => s !== 'new').length,
    inMotion: states.filter((s) => s === 'aftershock').length,
  };
}

/** Best result so far, as shape + word. Wording describes the path taken, never the player. */
export const SAFETY_STATUS: Record<Safety, { status: Status; label: string }> = {
  safe: { status: 'safe', label: 'Played: safer path' },
  unsure: { status: 'attention', label: 'Played: partly safe path' },
  risky: { status: 'risk', label: 'Played: risky path' },
};

export function lanternSummary(trust: Record<string, number>): { lit: number; max: number; dimmed: number } {
  let lit = 0;
  let dimmed = 0;
  for (const d of LAUNCH_DISTRICTS) {
    const t = trust[d.id] ?? 0;
    if (t > 0) lit += t;
    if (t < 0) dimmed += 1;
  }
  return { lit, max: LAUNCH_DISTRICTS.length * TRUST_MAX, dimmed };
}

export function trustWord(t: number): string {
  if (t >= 3) return 'Shining';
  if (t >= 1) return 'Glowing';
  if (t === 0) return 'Steady';
  return 'Dimmed, can be relit';
}

export function formatWallet(n: number): string {
  const abs = Math.abs(Math.round(n)).toLocaleString('en-SG');
  return n < 0 ? `−S$${abs}` : `S$${abs}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
