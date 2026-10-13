// Analytics that outlive a session: counts only (GDD §6.5, §11.8). Nothing here may carry a seat id,
// pseudonym, squad name, room code or a time finer than an hour.

import {
  emptyMissionAggregate,
  type BandId,
  type DebriefView,
  type MissionAggregate,
  type SessionAggregate,
  type ShieldLine,
} from '@shieldquest/shared';
import { newId } from './words';

/** ISO time rounded down to the hour. */
export function hourIso(ms: number): string {
  const d = new Date(ms);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

export function newSessionAggregate(band: BandId, missionIds: string[], now: number): SessionAggregate {
  return {
    id: newId(),
    createdAt: hourIso(now),
    band,
    missionIds: [...missionIds],
    seatsTotal: 0,
    squadsTotal: 0,
    missionsCompleted: 0,
    perMission: [],
    lateHold: { good: 0, total: 0 },
    aftershocksDelivered: 0,
    roomFreezePeak: 0,
    lanterns: 0,
    complete: false,
  };
}

export function openMissionAggregate(agg: SessionAggregate, missionId: string): MissionAggregate {
  const m = emptyMissionAggregate(missionId);
  agg.perMission.push(m);
  return m;
}

export function addCount<K extends string>(rec: Partial<Record<K, number>>, key: K, n = 1): void {
  rec[key] = (rec[key] ?? 0) + n;
}

const lineKey = (tiles: ShieldLine['tiles']): string =>
  (['opener', 'reason', 'offer', 'channel'] as const).map((s) => tiles[s] ?? '-').join('|');

/** Shield Lines Wall: the same message with the same reaction is counted once per squad that built it. */
export function addShieldLine(agg: MissionAggregate, tiles: ShieldLine['tiles'], outcome: ShieldLine['outcome']): void {
  const key = lineKey(tiles);
  const found = agg.shieldLines.find((l) => l.outcome === outcome && lineKey(l.tiles) === key);
  if (found) found.squads += 1;
  else agg.shieldLines.push({ tiles: { ...tiles }, outcome, squads: 1 });
}

/** Room-level debrief numbers: positive trends and totals only. */
export function debriefFrom(agg: SessionAggregate, lanterns: number, roomFreezePeak: number): DebriefView {
  return {
    missions: agg.perMission.map((m) => ({
      missionId: m.missionId,
      squads: m.squads,
      holdsMade: m.holdBuckets['0-5'] + m.holdBuckets['5-15'] + m.holdBuckets['15-30'] + m.holdBuckets['30+'],
      liveFlags: m.liveFlags,
      heldFlags: m.heldFlags,
      mindsChangedSafer: m.shiftedSafer,
      forecastLikely: m.forecastLikely,
      forecastTotal: m.forecastTotal,
      clueFinds: { ...m.clueFinds },
      shieldLines: [...m.shieldLines].sort((a, b) => b.squads - a.squads).slice(0, 6),
    })),
    lanterns,
    roomFreezePeak,
  };
}

/** A deep copy safe to hand to the store (the live object keeps changing). */
export const cloneAggregate = (agg: SessionAggregate): SessionAggregate => JSON.parse(JSON.stringify(agg)) as SessionAggregate;
