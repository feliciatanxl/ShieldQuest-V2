// Display helpers for reward numbers shown outside the City Board (the hub chips), without changing state.
import { DAILY_ROLLS, dayKey, daysBetween, type RewardsState } from '@shieldquest/shared';

/** The streak as it stands today: a streak whose last day was before yesterday has ended. */
export function liveStreak(r: RewardsState, now: number = Date.now()): number {
  if (!r.lastPlayDay) return 0;
  return daysBetween(r.lastPlayDay, dayKey(now)) <= 1 ? r.streak : 0;
}

/** Rolls ready to use, counting today's free top-up that opening the board will add. */
export function rollsReady(r: RewardsState, now: number = Date.now()): number {
  return r.rollsDay === dayKey(now) ? r.rolls : Math.max(r.rolls, DAILY_ROLLS);
}
