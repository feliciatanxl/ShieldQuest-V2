// Orchestrates one solo run: the pure runReducer plus the clock, sounds, surges, nudges and the final save.
// The squad client drives the same phase components from server events instead of this hook.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type Dispatch } from 'react';
import {
  isGuardianUnfolded,
  type BandId,
  type GuardianId,
  type Mission,
  type RunSummary,
} from '@shieldquest/shared';
import { useProgress } from '../../state/progress';
import { safeHaptic, safeTension, type Cues } from './parts/cues';
import { buildRunInput, createRunState, runReducer, type RunAction, type RunState } from './runReducer';
import {
  AUTO_FREEZE_LINE,
  HOLD_HEADER,
  SURGE_AFTER_SEC,
  castName,
  exitOrder,
  liveHeldCounts,
  newRunSeed,
  sortedBeats,
  surgeEnabled,
  surgeLine,
  type ExitView,
} from './runLogic';

/** Time eases from 1 to 0 over this long after HOLD (instant under reduced motion). */
export const HOLD_EASE_MS = 400;
/** Distance the clock still travels while easing: the integral of (1 - k)^2 over 0.4 s. */
const HOLD_EASE_DIST = HOLD_EASE_MS / 1000 / 3;
/** Published clock rate: the Canvas never re-renders more than 10 times a second. */
const TICK_MS = 100;
/** Time keeps flowing in the released scene for ambient motion, then rests. */
const RELEASE_RUN_SEC = 45;

export interface RunCompletion {
  summary: RunSummary;
  guardianLevelUps: { guardian: GuardianId; level: number }[];
}

export interface UseMissionRunOptions {
  mission: Mission;
  band: BandId | null;
  reduced: boolean;
  cues: Cues;
  announce: (text: string) => void;
  /** Fixed seed for tests or replays; a fresh random seed otherwise. */
  seed?: number;
}

export interface MissionRunApi {
  state: RunState;
  dispatch: Dispatch<RunAction>;
  /** Mission time in seconds, published at most 10 times a second. */
  t: number;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  /** HOLD: freezes the live moment, or (during a Pressure Surge) holds again to clear it. */
  hold: () => void;
  /** True for the 400 ms while time eases to a stop. */
  easing: boolean;
  /** Seconds spent in the freeze (stops while paused). */
  freezeElapsed: number;
  /** Cluepaw nudge for guided missions, or null. */
  nudge: string | null;
  exits: ExitView[];
  /** Guardians unfolded on this device (abilities are available once per mission). */
  unfolded: Record<GuardianId, boolean>;
  /** Set once the run is saved on reaching Bond. */
  completion: RunCompletion | null;
}

const PHASE_ANNOUNCE: Partial<Record<RunState['phase'], string>> = {
  live: 'The moment is live. Messages are arriving. Press HOLD, Space or H whenever you want time to stop.',
  trace: 'Identify the Influence. Pull the thread to see who really gains.',
  forecast: 'Evaluate the Consequences. Seal a forecast.',
  think: 'Think. Choose an exit, then seal it with how sure you are.',
  explain: 'Explain. Hear other perspectives, then keep or change your choice.',
  release: 'Time starts again.',
  shield: 'Peer Shield. Help a friend facing the same pressure.',
  saved: 'Moment saved. Your S.H.I.E.L.D. letters are lighting up.',
};

function cluepawNudgeAfter(mission: Mission, band: BandId | null): number | null {
  if (mission.scaffold !== 'guided') return null;
  if (band === 'junior') return 45;
  if (band === 'young-adult') return null; // only when the Guardian is called
  return 90;
}

export function useMissionRun({ mission, band, reduced, cues, announce, seed }: UseMissionRunOptions): MissionRunApi {
  const [state, dispatch] = useReducer(runReducer, undefined, () => createRunState(mission, seed ?? newRunSeed(), band));
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(false);
  const [easing, setEasing] = useState(false);
  const [freezeElapsed, setFreezeElapsed] = useState(0);
  const [completion, setCompletion] = useState<RunCompletion | null>(null);

  const tRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const tensionRef = useRef(0);
  const tickCaptionShown = useRef(false);
  const completedRef = useRef(false);
  const easeRaf = useRef(0);

  const { cue, showCaption } = cues;
  const beats = useMemo(() => sortedBeats(mission), [mission]);
  const duration = mission.live.durationSec;
  const progress = useProgress((s) => s.progress);

  const unfolded = useMemo(() => {
    const ids: GuardianId[] = ['cluepaw', 'echo', 'verifox', 'bytebuddy', 'beacon', 'shieldfin'];
    return Object.fromEntries(ids.map((g) => [g, isGuardianUnfolded(progress, g)])) as Record<GuardianId, boolean>;
  }, [progress]);

  // ---- Phase announcements and entry sounds ------------------------------------------------
  useEffect(() => {
    const text = PHASE_ANNOUNCE[state.phase];
    if (text) announce(text);
    if (state.phase === 'release') {
      cue('release');
      safeTension(0);
    }
  }, [state.phase, announce, cue]);

  // ---- The live clock --------------------------------------------------------------------------
  const autoFreeze = useCallback(() => {
    if (stateRef.current.phase !== 'live') return;
    tRef.current = duration;
    setT(duration);
    dispatch({ type: 'freeze', heldAtSec: null, t: duration });
    safeTension(0);
    cue('freeze');
    announce(`Time froze by itself. ${AUTO_FREEZE_LINE}`);
  }, [duration, cue, announce]);

  useEffect(() => {
    const running = (state.phase === 'live' || state.phase === 'release') && !paused && !easing;
    if (!running) return;
    const phase = state.phase;
    const limit = phase === 'live' ? duration : state.frozenAt + RELEASE_RUN_SEC;
    if (phase === 'release' && tRef.current < state.frozenAt) tRef.current = state.frozenAt;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      // Cap the step so a throttled background tab cannot skip whole beats.
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const prev = tRef.current;
      const next = Math.min(limit, prev + dt);
      tRef.current = next;
      setT(next);
      if (phase !== 'live') return;

      for (const b of beats) {
        if (b.at > prev && b.at <= next) {
          if (b.channel === 'scene' || b.from === 'narrator') continue;
          const who = castName(mission, b.from);
          cue('message', {
            caption: b.channel === 'speech' ? `[${who} speaks]` : b.channel === 'notification' ? '[phone buzzes]' : '[message arrives]',
          });
          if (b.channel === 'notification') safeHaptic(40);
        }
      }
      const lit = new Set(beats.filter((b) => b.at <= next && b.tactic).map((b) => b.tactic)).size;
      const tension = Math.min(1, (next / duration) * 0.8 + lit * 0.04);
      if (Math.abs(tension - tensionRef.current) >= 0.05) {
        tensionRef.current = tension;
        safeTension(tension);
      }
      if (!tickCaptionShown.current && next / duration >= 0.5) {
        tickCaptionShown.current = true;
        showCaption('[clock ticking faster]');
      }
      if (next >= duration) autoFreeze();
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [state.phase, state.frozenAt, paused, easing, duration, beats, mission, cue, showCaption, autoFreeze]);

  // Leaving the tab mid-moment opens the calm pause screen instead of letting time run in the background.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden' && stateRef.current.phase === 'live') setPaused(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Silence the tick if the player leaves mid-moment.
  useEffect(() => () => safeTension(0), []);
  useEffect(() => () => cancelAnimationFrame(easeRaf.current), []);

  // ---- HOLD ------------------------------------------------------------------------------------
  const hold = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === 'freeze' && s.surge === 'showing') {
      dispatch({ type: 'surge', to: 'held' });
      cue('freeze', { caption: '[the buzzing stops]' });
      safeHaptic(40);
      announce('You held again. The pressure pop-up is gone. That is Hold Before Acting, practised.');
      return;
    }
    if (s.phase !== 'live' || paused) return;
    const tPress = tRef.current;
    const frozenAt = reduced ? tPress : Math.min(duration, tPress + HOLD_EASE_DIST);
    dispatch({ type: 'freeze', heldAtSec: Math.round(tPress * 10) / 10, t: frozenAt });
    safeTension(0);
    cue('freeze');
    safeHaptic(60);
    announce(HOLD_HEADER);
    if (reduced) return;
    // Ease the published clock to a stop so the scene slows instead of snapping.
    setEasing(true);
    const start = performance.now();
    let lastPublish = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / HOLD_EASE_MS);
      const value = tPress + (frozenAt - tPress) * (1 - Math.pow(1 - k, 3));
      tRef.current = value;
      if (now - lastPublish >= TICK_MS || k >= 1) {
        lastPublish = now;
        setT(value);
      }
      if (k < 1) easeRaf.current = requestAnimationFrame(step);
      else setEasing(false);
    };
    easeRaf.current = requestAnimationFrame(step);
  }, [paused, reduced, duration, cue, announce]);

  // ---- Freeze timers: Pressure Surge and the Cluepaw nudge --------------------------------------
  const freezeRunning = state.phase === 'freeze' && !state.freezeDone && !paused;
  useEffect(() => {
    if (!freezeRunning) return;
    const id = window.setInterval(() => setFreezeElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [freezeRunning]);

  const surge = useMemo(() => surgeLine(mission), [mission]);
  useEffect(() => {
    if (state.phase !== 'freeze' || state.surge !== 'idle' || state.freezeDone) return;
    if (!surgeEnabled(band) || !surge) {
      dispatch({ type: 'surge', to: 'off' });
      return;
    }
    if (freezeElapsed >= SURGE_AFTER_SEC) {
      dispatch({ type: 'surge', to: 'showing' });
      cue('surge', { caption: `[phone buzzes hard: ${surge.name}]` });
      safeHaptic([80, 60, 80]);
      announce(`${surge.name} is pushing: ${surge.text} Press HOLD again to clear it. Nothing is timed.`);
    }
  }, [state.phase, state.surge, state.freezeDone, freezeElapsed, band, surge, cue, announce]);

  const nudge = useMemo(() => {
    if (state.phase !== 'freeze' || state.freezeDone) return null;
    const after = cluepawNudgeAfter(mission, band);
    if (after === null || freezeElapsed < after) return null;
    const { live, held, total } = liveHeldCounts(mission, state.looks, state.calls);
    if (live + held >= total) return null;
    if (unfolded.cluepaw && !state.guardiansUsed.includes('cluepaw'))
      return "Cluepaw's ears twitch. Stuck? Try Sniff Out to find a sign you have not pinned yet.";
    const quiet = mission.clues.some((c) => c.redFlag && c.target.kind === 'anchor' && state.calls[c.id] !== 'flag');
    return quiet
      ? 'A little nudge: not every warning sign is in the chat. Check "Look around" in the Scene list.'
      : 'A little nudge: read each message again, including the ones still frozen in mid-air.';
  }, [state.phase, state.freezeDone, state.looks, state.calls, state.guardiansUsed, freezeElapsed, mission, band, unfolded.cluepaw]);

  // ---- Bond: save the run once ----------------------------------------------------------------
  useEffect(() => {
    if (state.phase !== 'saved' || completedRef.current) return;
    completedRef.current = true;
    const result = useProgress.getState().completeMission(mission, buildRunInput(state));
    setCompletion(result);
  }, [state, mission]);

  const exits = useMemo(() => exitOrder(mission, state.seed), [mission, state.seed]);

  const publishedT = state.phase === 'live' || state.phase === 'release' || easing ? t : state.phase === 'intro' ? 0 : state.frozenAt;

  return {
    state,
    dispatch,
    t: publishedT,
    paused,
    setPaused,
    hold,
    easing,
    freezeElapsed,
    nudge,
    exits,
    unfolded,
    completion,
  };
}
