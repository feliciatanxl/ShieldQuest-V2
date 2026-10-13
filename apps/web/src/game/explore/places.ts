// Explore mode game logic (pure): which Shield Shards are still out there today, what each place offers, and
// the words used for it in prompts, lists and announcements.
import {
  MISSIONS,
  dayKey,
  districtById,
  miniGameById,
  type BandId,
  type DistrictId,
  type MiniGameInfo,
  type Mission,
  type Progress,
  type RewardsState,
} from '@shieldquest/shared';
import { SHARDS, areaName, type AreaId, type Place, type ShardPlace } from '../../world/explore/exploreMap';
import { nextMission } from '../hub/hubData';

/** Shard ids already found today (the list resets each day, Singapore time). */
export function shardsFoundToday(rewards: Pick<RewardsState, 'shardsDay' | 'shardsFound'>, now: number): string[] {
  return rewards.shardsDay === dayKey(now) ? rewards.shardsFound : [];
}

/** Shards still to find today. */
export function availableShards(rewards: Pick<RewardsState, 'shardsDay' | 'shardsFound'>, now: number): ShardPlace[] {
  const found = new Set(shardsFoundToday(rewards, now));
  return SHARDS.filter((s) => !found.has(s.id));
}

/** Number of known shards found today (ignores ids that are no longer on the map). */
export function shardCountToday(rewards: Pick<RewardsState, 'shardsDay' | 'shardsFound'>, now: number): number {
  const ids = new Set(SHARDS.map((s) => s.id));
  return shardsFoundToday(rewards, now).filter((id) => ids.has(id)).length;
}

export const arcadeHref = (game: MiniGameInfo['id']) => `/play/arcade/${game}?from=explore`;

/** The mission a district's beacon suggests: the next unplayed one there for the player's band. */
export function beaconMission(district: DistrictId, band: BandId | null, progress: Progress, missions: readonly Mission[] = MISSIONS): Mission | null {
  return nextMission(band, progress, missions.filter((m) => m.district === district));
}

export function kioskGame(place: Extract<Place, { kind: 'kiosk' }>): MiniGameInfo {
  return miniGameById(place.game);
}

/** Short name of a place for lists and the prompt card. */
export function placeTitle(place: Place): string {
  switch (place.kind) {
    case 'kiosk':
      return `Arcade: ${kioskGame(place).name}`;
    case 'beacon':
      return `${districtById(place.district).name} missions`;
    case 'townie':
      return place.name;
    case 'shard':
      return 'Shield Shard';
  }
}

/** "School Street", "Stillpoint Plaza", ... for where a place is. */
export const areaLabel = (area: AreaId) => (area === 'bridge' ? 'Sky bridge' : areaName(area));

/** Rounded distance words for lists ("here", "12 m"). */
export function distanceWords(m: number): string {
  if (m < 3.5) return 'here';
  return `${Math.round(m)} m`;
}
