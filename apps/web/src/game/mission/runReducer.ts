// Pure state machine for one solo run of a mission. No clocks, stores or DOM: the useMissionRun hook feeds it
// timestamps and side effects, which keeps every rule testable in plain Node.

import {
  MISSION_PHASES,
  evaluateShield,
  type BandId,
  type GuardianId,
  type Mission,
  type MissionPhase,
  type RunInput,
  type ShieldResult,
  type ShieldSlot,
} from '@shieldquest/shared';
import { MAX_REASONS, foundIds, shieldSlotsFor, type Call } from './runLogic';

export type SurgeState = 'idle' | 'showing' | 'held' | 'shieldfin' | 'off';

export interface RunState {
  mission: Mission;
  seed: number;
  band: BandId | null;
  phase: MissionPhase;
  /** Seconds into Live when the player pressed HOLD (null = the late auto-freeze). */
  heldAtSec: number | null;
  autoFrozen: boolean;
  /** Mission time the scene froze on (it keeps that frame until Release). */
  frozenAt: number;
  /** Clue ids tapped while the moment was live ("first look" pins). */
  looks: string[];
  replyTried: boolean;
  /** The player's call on each clue during the freeze. */
  calls: Record<string, Call>;
  sniffed: string | null;
  scanned: boolean;
  crossChecked: string | null;
  surge: SurgeState;
  /** Freeze finished: the LIVE vs HELD counter card is showing. */
  freezeDone: boolean;
  guardiansUsed: GuardianId[];
  threadPulled: boolean;
  /** Trace answers in order; the first one is what counts for the I letter, the second is practice. */
  traceAnswers: string[];
  forecastOptionId: string | null;
  forecastSealed: boolean;
  firstVote: string | null;
  confidence: 1 | 2 | 3 | null;
  reasons: string[];
  finalChoice: string | null;
  shieldSlots: ShieldSlot[];
  shieldPicks: Partial<Record<ShieldSlot, string>>;
  shieldTries: number;
  shieldResult: ShieldResult | null;
}

export type RunAction =
  | { type: 'start' }
  | { type: 'look'; clueId: string }
  | { type: 'reply' }
  | { type: 'freeze'; heldAtSec: number | null; t: number }
  | { type: 'call'; clueId: string; call: Call }
  | { type: 'guardian'; guardian: GuardianId; target?: string }
  | { type: 'surge'; to: Exclude<SurgeState, 'idle'> }
  | { type: 'freezeDone' }
  | { type: 'pullThread' }
  | { type: 'trace'; optionId: string }
  | { type: 'forecast'; optionId: string }
  | { type: 'sealForecast' }
  | { type: 'seal'; choiceId: string; confidence: 1 | 2 | 3 }
  | { type: 'reason'; chip: string }
  | { type: 'reseal'; choiceId: string }
  | { type: 'shieldPick'; slot: ShieldSlot; tileId: string }
  | { type: 'shieldSend' }
  | { type: 'shieldRetry' }
  | { type: 'next' }
  | { type: 'replay'; seed: number };

/** Peer Shield allows one retry after a partial or failed message (practice, not penalty). */
export const SHIELD_MAX_TRIES = 2;

export function createRunState(mission: Mission, seed: number, band: BandId | null): RunState {
  return {
    mission,
    seed,
    band,
    phase: 'intro',
    heldAtSec: null,
    autoFrozen: false,
    frozenAt: 0,
    looks: [],
    replyTried: false,
    calls: {},
    sniffed: null,
    scanned: false,
    crossChecked: null,
    surge: 'idle',
    freezeDone: false,
    guardiansUsed: [],
    threadPulled: false,
    traceAnswers: [],
    forecastOptionId: null,
    forecastSealed: false,
    firstVote: null,
    confidence: null,
    reasons: [],
    finalChoice: null,
    shieldSlots: mission.peerShield ? shieldSlotsFor(mission.peerShield, band) : [],
    shieldPicks: {},
    shieldTries: 0,
    shieldResult: null,
  };
}

/** The phase after this one; Peer Shield is skipped for missions without one. */
export function phaseAfter(mission: Mission, phase: MissionPhase): MissionPhase {
  const i = MISSION_PHASES.indexOf(phase);
  const next = MISSION_PHASES[Math.min(i + 1, MISSION_PHASES.length - 1)]!;
  if (next === 'shield' && !mission.peerShield) return 'saved';
  return next;
}

/** Whether the player has done what the current phase needs before moving on. */
export function canAdvance(s: RunState): boolean {
  switch (s.phase) {
    case 'intro':
    case 'live':
      return false; // Start and Hold/auto-freeze move these on.
    case 'freeze':
      return s.freezeDone;
    case 'trace':
      return s.threadPulled && s.traceAnswers.length > 0;
    case 'forecast':
      return s.forecastSealed;
    case 'think':
      return s.firstVote !== null && s.confidence !== null;
    case 'explain':
      return s.finalChoice !== null;
    case 'release':
      return true;
    case 'shield':
      return s.shieldResult !== null;
    case 'saved':
      return false;
  }
}

const withGuardian = (s: RunState, g: GuardianId): GuardianId[] => (s.guardiansUsed.includes(g) ? s.guardiansUsed : [...s.guardiansUsed, g]);

export function runReducer(s: RunState, a: RunAction): RunState {
  switch (a.type) {
    case 'start':
      return s.phase === 'intro' ? { ...s, phase: 'live' } : s;

    case 'look':
      if (s.phase !== 'live' || s.looks.includes(a.clueId)) return s;
      if (!s.mission.clues.some((c) => c.id === a.clueId)) return s;
      return { ...s, looks: [...s.looks, a.clueId] };

    case 'reply':
      return s.phase === 'live' ? { ...s, replyTried: true } : s;

    case 'freeze':
      if (s.phase !== 'live') return s;
      return {
        ...s,
        phase: 'freeze',
        heldAtSec: a.heldAtSec,
        autoFrozen: a.heldAtSec === null,
        frozenAt: a.t,
        surge: s.band === 'junior' ? 'off' : s.surge,
      };

    case 'call':
      if (s.phase !== 'freeze' || s.freezeDone) return s;
      if (!s.mission.clues.some((c) => c.id === a.clueId)) return s;
      return { ...s, calls: { ...s.calls, [a.clueId]: a.call } };

    case 'guardian': {
      if (s.guardiansUsed.includes(a.guardian)) return s; // once per mission
      const used = withGuardian(s, a.guardian);
      switch (a.guardian) {
        case 'cluepaw':
          return s.phase === 'freeze' && a.target ? { ...s, guardiansUsed: used, sniffed: a.target } : s;
        case 'bytebuddy':
          return s.phase === 'freeze' ? { ...s, guardiansUsed: used, scanned: true } : s;
        case 'verifox':
          return s.phase === 'freeze' && a.target ? { ...s, guardiansUsed: used, crossChecked: a.target } : s;
        case 'shieldfin':
          return s.surge === 'showing' ? { ...s, guardiansUsed: used, surge: 'shieldfin' } : s;
        case 'echo':
          return s.phase === 'explain' ? { ...s, guardiansUsed: used } : s;
        case 'beacon':
          return s.phase === 'shield' ? { ...s, guardiansUsed: used } : s;
      }
      return s;
    }

    case 'surge':
      if (a.to === 'showing') return s.phase === 'freeze' && s.surge === 'idle' && !s.freezeDone ? { ...s, surge: 'showing' } : s;
      if (a.to === 'off') return s.surge === 'idle' ? { ...s, surge: 'off' } : s;
      return s.surge === 'showing' ? { ...s, surge: a.to } : s;

    case 'freezeDone':
      if (s.phase !== 'freeze') return s;
      // A surge still on screen simply closes; it never costs anything.
      return { ...s, freezeDone: true, surge: s.surge === 'showing' || s.surge === 'idle' ? 'off' : s.surge };

    case 'pullThread':
      return s.phase === 'trace' ? { ...s, threadPulled: true } : s;

    case 'trace': {
      if (s.phase !== 'trace' || !s.threadPulled || s.traceAnswers.length >= 2) return s;
      if (s.traceAnswers.includes(a.optionId)) return s;
      const firstCorrect = s.mission.influence.options.some((o) => o.id === s.traceAnswers[0] && o.correct);
      if (firstCorrect) return s;
      return { ...s, traceAnswers: [...s.traceAnswers, a.optionId] };
    }

    case 'forecast':
      if (s.phase !== 'forecast' || s.forecastSealed) return s;
      return { ...s, forecastOptionId: a.optionId };

    case 'sealForecast':
      return s.phase === 'forecast' && s.forecastOptionId ? { ...s, forecastSealed: true } : s;

    case 'seal':
      if (s.phase !== 'think' || s.firstVote !== null) return s;
      if (!s.mission.choices.some((c) => c.id === a.choiceId)) return s;
      return { ...s, firstVote: a.choiceId, confidence: a.confidence };

    case 'reason': {
      if (s.phase !== 'explain') return s;
      if (s.reasons.includes(a.chip)) return { ...s, reasons: s.reasons.filter((r) => r !== a.chip) };
      if (s.reasons.length >= MAX_REASONS) return s;
      return { ...s, reasons: [...s.reasons, a.chip] };
    }

    case 'reseal':
      if (s.phase !== 'explain') return s;
      if (!s.mission.choices.some((c) => c.id === a.choiceId)) return s;
      return { ...s, finalChoice: a.choiceId };

    case 'shieldPick':
      if (s.phase !== 'shield' || s.shieldResult) return s;
      if (!s.shieldSlots.includes(a.slot)) return s;
      if (!s.mission.peerShield?.slots[a.slot].some((t) => t.id === a.tileId)) return s;
      return { ...s, shieldPicks: { ...s.shieldPicks, [a.slot]: a.tileId } };

    case 'shieldSend': {
      const shield = s.mission.peerShield;
      if (s.phase !== 'shield' || !shield || s.shieldResult) return s;
      if (!s.shieldSlots.every((slot) => s.shieldPicks[slot])) return s;
      return { ...s, shieldResult: evaluateShield(shield, s.shieldPicks), shieldTries: s.shieldTries + 1 };
    }

    case 'shieldRetry':
      if (s.phase !== 'shield' || !s.shieldResult || s.shieldResult.outcome === 'success') return s;
      if (s.shieldTries >= SHIELD_MAX_TRIES) return s;
      return { ...s, shieldResult: null };

    case 'next':
      if (!canAdvance(s)) return s;
      return { ...s, phase: phaseAfter(s.mission, s.phase) };

    case 'replay':
      return createRunState(s.mission, a.seed, s.band);
  }
}

/** Builds the engine's RunInput from a finished run (call when the run reaches Bond). */
export function buildRunInput(s: RunState): RunInput {
  const { liveFound, frozenFound } = foundIds(s.mission, s.looks, s.calls);
  const firstVote = s.firstVote ?? s.mission.choices[0]!.id;
  const shieldPicks = s.mission.peerShield && s.shieldResult ? { ...s.shieldPicks } : undefined;
  return {
    missionId: s.mission.id,
    heldAtSec: s.heldAtSec,
    liveFound,
    frozenFound,
    traceOptionId: s.traceAnswers[0] ?? null,
    forecastOptionId: s.forecastOptionId,
    firstVote,
    confidence: s.confidence ?? 1,
    finalChoice: s.finalChoice ?? firstVote,
    ...(shieldPicks ? { shieldPicks } : {}),
    guardiansUsed: [...s.guardiansUsed],
  };
}
