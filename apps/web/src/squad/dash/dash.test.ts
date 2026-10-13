import { describe, expect, it } from 'vitest';
import { chanceById, type DashBase, type HostSnapshot } from '@shieldquest/shared';
import { nextAction } from '../logic';
import {
  DASH_TIPS,
  dashCanStart,
  dashClockSec,
  dashNextAction,
  dashResultLine,
  dashRoomLine,
  dashStageLabel,
  dashTip,
  livePickLine,
  optionLetter,
  optionText,
} from './dashLogic';

const T0 = 1_700_000_000_000;
const q = chanceById('otp-friend')!;

const base = (over: Partial<DashBase> = {}): DashBase => ({
  id: 'dash-1',
  length: 6,
  index: 0,
  stage: 'question',
  questionId: q.id,
  stageStartedAt: T0,
  endsAt: T0 + 20_000,
  quiet: false,
  room: null,
  totals: { correct: 0, played: 0 },
  ...over,
});

describe('Squad Dash logic', () => {
  it('letters options and labels the stage', () => {
    expect([0, 1, 2, 3].map(optionLetter)).toEqual(['A', 'B', 'C', 'D']);
    expect(optionText(q, 'scam')).toBe('A · Scam or risky');
    expect(optionText(q, 'nope')).toBe('');
    expect(dashStageLabel(base())).toBe('Question 1 of 6');
    expect(dashStageLabel(base({ stage: 'reveal', index: 2 }))).toBe('Question 3 of 6 · The answer');
    expect(dashStageLabel(base({ stage: 'results' }))).toBe('Squad totals');
  });

  it('only lets the Conductor start between missions (mirrors the server rule)', () => {
    expect(dashCanStart({ phase: 'lobby', missionComplete: false }, false).ok).toBe(true);
    expect(dashCanStart({ phase: 'mission', missionComplete: true }, false).ok).toBe(true);
    expect(dashCanStart({ phase: 'mission', missionComplete: false }, false).ok).toBe(false);
    expect(dashCanStart({ phase: 'room-freeze', missionComplete: false }, false).ok).toBe(false);
    expect(dashCanStart({ phase: 'debrief', missionComplete: true }, false).ok).toBe(false);
    expect(dashCanStart({ phase: 'lobby', missionComplete: false }, true).ok).toBe(false);
  });

  it('drives the big Next button while a Dash is open', () => {
    expect(dashNextAction(base(), 'lobby').label).toBe('Reveal the answer');
    expect(dashNextAction(base({ stage: 'reveal', index: 1 }), 'lobby').label).toBe('Next question (3 of 6)');
    expect(dashNextAction(base({ stage: 'reveal', index: 5 }), 'lobby').label).toBe('Show squad totals');
    expect(dashNextAction(base({ stage: 'results' }), 'mission').hint).toBe('Back to Look Up.');
    const host = { session: { phase: 'lobby', missionIds: [], missionIndex: null, roomFreeze: { done: false } }, squads: [], dash: base() };
    expect(nextAction(host as unknown as HostSnapshot).label).toBe('Reveal the answer');
    expect(nextAction({ ...host, dash: null } as unknown as HostSnapshot).label).toBe('Start the Room Freeze');
  });

  it('explains the squad pick without naming anyone', () => {
    const counts = (scam: number, safe: number) => [
      { choiceId: 'scam', n: scam },
      { choiceId: 'safe', n: safe },
    ];
    expect(livePickLine(counts(0, 0), q)).toMatch(/No taps yet/);
    expect(livePickLine(counts(2, 2), q)).toMatch(/^Tied/);
    expect(livePickLine(counts(3, 1), q)).toBe('Your squad’s pick right now: A · Scam or risky');
    expect(dashResultLine({ pick: 'scam', correct: true, split: false, answered: 3 }, q)).toMatch(/That’s right!$/);
    expect(dashResultLine({ pick: null, correct: false, split: true, answered: 2 }, q)).toMatch(/split/);
    expect(dashResultLine({ pick: null, correct: false, split: false, answered: 0 }, q)).toMatch(/No taps/);
    expect(dashResultLine({ pick: 'safe', correct: false, split: false, answered: 3 }, q)).toMatch(/^Your squad picked B/);
    expect(dashResultLine(null, q)).toMatch(/sat this one out/);
    expect(dashRoomLine({ correct: 3, squads: 4 })).toBe('3 of 4 squads got it right');
    expect(dashRoomLine({ correct: 1, squads: 1 })).toBe('1 of 1 squad got it right');
    expect(dashRoomLine(null)).toBe('');
  });

  it('shows a soft clock only when there is one to show (no clock in Calm/Gentle or while paused)', () => {
    expect(dashClockSec(base(), T0 + 5_000, false)).toBe(15);
    expect(dashClockSec(base(), T0 + 50_000, false)).toBe(0);
    expect(dashClockSec(base({ quiet: true }), T0, false)).toBeNull();
    expect(dashClockSec(base({ endsAt: null }), T0, false)).toBeNull();
    expect(dashClockSec(base(), T0, true)).toBeNull();
    expect(dashClockSec(base({ stage: 'reveal' }), T0, false)).toBeNull();
  });

  it('picks one closing tip per round, the same on every screen', () => {
    expect(DASH_TIPS).toContain(dashTip('abc'));
    expect(dashTip('abc')).toBe(dashTip('abc'));
  });
});
