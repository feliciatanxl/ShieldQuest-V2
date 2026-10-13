// Pure helpers for Squad Dash on the phone, the Conductor console and the Big Screen. No DOM, no store.
// Everything here is squad- or room-level: no line ever names or singles out a player.

import {
  chanceById,
  dashSquadPick,
  type ChanceQuestion,
  type ChoiceCount,
  type DashBase,
  type DashResult,
  type SessionPublic,
} from '@shieldquest/shared';
import { hashString } from '../../game/mission/runLogic';
import type { NextAction } from '../logic';

/** A, B, C, D: the same letters on every phone and on the projector. */
export const optionLetter = (i: number): string => String.fromCharCode(65 + Math.max(0, Math.min(25, i)));

export const dashQuestionOf = (d: Pick<DashBase, 'questionId'> | null | undefined): ChanceQuestion | null =>
  d?.questionId ? (chanceById(d.questionId) ?? null) : null;

export function optionText(q: ChanceQuestion, optionId: string | null | undefined): string {
  const i = q.options.findIndex((o) => o.id === optionId);
  const o = q.options[i];
  return o ? `${optionLetter(i)} · ${o.text}` : '';
}

/** "Question 2 of 6", "The answer", "Squad totals". */
export function dashStageLabel(d: Pick<DashBase, 'stage' | 'index' | 'length'>): string {
  if (d.stage === 'results') return 'Squad totals';
  const n = `Question ${d.index + 1} of ${d.length}`;
  return d.stage === 'reveal' ? `${n} · The answer` : n;
}

/** Why the Conductor can or cannot start a Squad Dash right now (mirrors the server rule). */
export function dashCanStart(
  session: Pick<SessionPublic, 'phase' | 'missionComplete'>,
  running: boolean,
): { ok: boolean; reason: string } {
  if (running) return { ok: false, reason: 'A Squad Dash is already running.' };
  switch (session.phase) {
    case 'lobby':
      return { ok: true, reason: 'A warm-up before the first mission.' };
    case 'mission':
      return session.missionComplete
        ? { ok: true, reason: 'A quick round between missions.' }
        : { ok: false, reason: 'Squad Dash runs between missions. Finish or skip this one first.' };
    case 'room-freeze':
      return { ok: false, reason: 'End the Room Freeze first.' };
    default:
      return { ok: false, reason: 'Squad Dash runs before the debrief.' };
  }
}

/** What the Conductor's big Next button does while a Dash is open (mirrors the server's dashNext). */
export function dashNextAction(d: Pick<DashBase, 'stage' | 'index' | 'length'>, phase: SessionPublic['phase']): NextAction {
  switch (d.stage) {
    case 'question':
      return { label: 'Reveal the answer', hint: 'Locks in each squad’s pick and shows the answer.' };
    case 'reveal':
      return d.index + 1 < d.length
        ? { label: `Next question (${d.index + 2} of ${d.length})`, hint: 'Phones show the next question.' }
        : { label: 'Show squad totals', hint: 'The last question is done.' };
    default:
      return { label: 'Close Squad Dash', hint: phase === 'lobby' ? 'Back to the lobby.' : 'Back to Look Up.' };
  }
}

/** The squad's pick so far, for the live tally on the phones ("Tied: talk it over"). */
export function livePickLine(counts: readonly ChoiceCount[], q: ChanceQuestion): string {
  const answered = counts.reduce((s, c) => s + c.n, 0);
  if (answered === 0) return 'No taps yet. Talk it over with your squad.';
  const pick = dashSquadPick(counts);
  if (!pick) return 'Tied right now. Talk it over: a tie is a split and does not score.';
  return `Your squad’s pick right now: ${optionText(q, pick)}`;
}

/** One kind sentence about the squad's result (never blaming, never about one person). */
export function dashResultLine(result: DashResult | null, q: ChanceQuestion): string {
  if (!result) return 'Your squad sat this one out.';
  if (result.correct) return `Your squad picked ${optionText(q, result.pick)}. That’s right!`;
  if (result.split) return 'Your squad was split, so there was no squad pick this time.';
  if (result.pick === null) return 'No taps from your squad this time.';
  return `Your squad picked ${optionText(q, result.pick)}. Now you know the sign to look for.`;
}

/** "3 of 4 squads got it right". */
export function dashRoomLine(room: { correct: number; squads: number } | null): string {
  if (!room || room.squads === 0) return '';
  return `${room.correct} of ${room.squads} ${room.squads === 1 ? 'squad' : 'squads'} got it right`;
}

export function scoreLine(score: { correct: number; played: number }): string {
  return `${score.correct} of ${score.played} right`;
}

export const DASH_TIPS: readonly string[] = [
  'Feeling rushed is a red flag. Hold, check, then tell someone you trust.',
  'Check it yourself: open the official app, or call a number you looked up.',
  'Never share an OTP or a password, not even with a friend.',
  'If it sounds too good to be true, pause. A real offer will still be there later.',
  'If something already went wrong, tell a trusted adult. It is never your fault.',
];

/** The closing tip for a Dash round: the same on every screen for the same round. */
export const dashTip = (dashId: string): string => DASH_TIPS[hashString(dashId) % DASH_TIPS.length] ?? DASH_TIPS[0]!;

/** Seconds left on the soft clock, or null when there is no clock to show (Calm/Gentle, paused, revealed). */
export function dashClockSec(d: Pick<DashBase, 'stage' | 'endsAt' | 'quiet'>, now: number, paused: boolean): number | null {
  if (d.stage !== 'question' || d.endsAt === null || d.quiet || paused) return null;
  return Math.max(0, Math.ceil((d.endsAt - now) / 1000));
}
