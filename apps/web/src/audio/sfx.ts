// Synthesized sound + haptics (Web Audio API: no audio files, no licences).
// This file is the audio contract. Every export is safe to call at any time: before the first gesture, with sound
// off, on iOS, in old browsers, in tests. Anything that cannot play simply stays silent; nothing here ever throws.
import { useEffect, useMemo } from 'react';
import type { DistrictId } from '@shieldquest/shared';
import { useSettings } from '../state/settings';
import {
  engine,
  installAudioListeners,
  liveGraph,
  pageVisible,
  reconcile,
  report,
  setCalm,
  setFrozen,
  setProfile,
  soundOn,
  touch,
  unlock,
  type AudioProfile,
  type Graph,
} from './engine';
import {
  addAmbientRequest,
  currentAmbient,
  nextAmbientOrder,
  removeAmbientRequest,
  setManualAmbient,
  setMood,
  wantedAmbient,
  type AmbientMood,
  type AmbientPlace,
} from './ambient';
import { clamp01, liveVoices } from './synth';
import { setTensionLevel, tensionHeard, tensionLevel } from './tension';
import { MOTIF_GAP, RECIPES, chargeHold, motif, motifLetter, stopCharge } from './voices';

export type Sfx =
  | 'tap'
  | 'holdCharge'
  | 'freeze'
  | 'release'
  | 'tick'
  | 'message'
  | 'clue'
  | 'clueOk'
  | 'seal'
  | 'reveal'
  | 'aftershock'
  | 'afterglow'
  | 'unfold'
  | 'surge'
  | 'success'
  | 'soft-fail'
  | 'pageTurn';

export type { AudioProfile, AmbientMood, AmbientPlace };

/**
 * Caption text for every meaningful sound (GDD 10.1: captions on by default). Quiet UI cues (tap, holdCharge,
 * pageTurn) have none on purpose. Callers may override with something more specific to the moment.
 */
export const SFX_CAPTIONS: Partial<Record<Sfx, string>> = {
  freeze: '[time stops]',
  release: '[time starts again]',
  tick: '[clock ticking]',
  message: '[message arrives]',
  clue: '[soft pluck: clue found]',
  clueOk: '[calm chime: seems fine]',
  seal: '[envelope folds shut]',
  reveal: '[soft bell]',
  aftershock: '[low, serious tone]',
  afterglow: '[warm chord]',
  unfold: '[paper unfolds, sparkles]',
  surge: '[pressure buzz]',
  success: '[bright chime]',
  'soft-fail': '[two soft notes fall]',
};

/** Caption for the S.H.I.E.L.D. motif, e.g. "[S.H.I.E.L.D. motif: 4 of 6 notes ring]". */
export function motifCaption(lit: readonly boolean[]): string {
  const n = lit.slice(0, 6).filter((x) => x === true).length;
  if (n === 6) return '[S.H.I.E.L.D. motif: all six notes ring]';
  if (n === 0) return '[S.H.I.E.L.D. motif: six quiet ticks]';
  return `[S.H.I.E.L.D. motif: ${n} of 6 notes ring]`;
}

/** Caption for the live clock at a given tension, or null when it is not heard on this device. */
export function tensionCaption(level = tensionLevel()): string | null {
  if (level <= 0 || !tensionHeard()) return null;
  return level >= 0.66 ? '[clock ticking fast]' : level >= 0.33 ? '[clock ticking faster]' : '[clock ticking]';
}

// ---------------------------------------------------------------------------------------------------------------
// Device policy

type Policy = 'full' | 'quiet' | 'off';

/**
 * Classroom phones (GDD 4.6, 7.2-7.3): only quiet UI cues. The projector carries the drama, so 30 phones never
 * clash, and outcome sounds stay off so neighbours can't hear whose choice went wrong. Haptics and captions remain.
 */
const PHONE_POLICY: Record<Sfx, Policy> = {
  tap: 'full',
  holdCharge: 'full',
  pageTurn: 'full',
  clue: 'full',
  clueOk: 'full',
  seal: 'full',
  message: 'quiet',
  reveal: 'quiet',
  unfold: 'quiet',
  success: 'quiet',
  freeze: 'off',
  release: 'off',
  tick: 'off',
  surge: 'off',
  aftershock: 'off',
  afterglow: 'off',
  'soft-fail': 'off',
};

/** Calm Mode mutes pressure audio (GDD 7.3). */
const PRESSURE: ReadonlySet<Sfx> = new Set<Sfx>(['tick', 'surge']);

function policyFor(name: Sfx): Policy {
  if (engine.calm && PRESSURE.has(name)) return 'off';
  return engine.profile === 'squad-phone' ? PHONE_POLICY[name] : 'full';
}

const QUIET_LEVEL = 0.45;
const quietBuses = new WeakMap<AudioContext, GainNode>();

function quietBus(g: Graph): GainNode {
  let bus = quietBuses.get(g.ctx);
  if (!bus) {
    bus = g.ctx.createGain();
    bus.gain.value = QUIET_LEVEL;
    bus.connect(g.sfx);
    quietBuses.set(g.ctx, bus);
  }
  return bus;
}

/** The graph if sound may play now, creating/resuming the context when a gesture has already happened. */
function readyGraph(): Graph | null {
  installAudioListeners();
  if (!soundOn() || !pageVisible()) return null;
  const g = liveGraph();
  if (g) return g;
  unlock();
  return liveGraph();
}

// Identical cues fired in the same instant (double handlers, re-renders) collapse into one.
const MIN_GAP_MS: Partial<Record<Sfx, number>> = { tap: 35, tick: 50, message: 70, pageTurn: 60, clue: 45 };
const DEFAULT_GAP_MS = 40;
// Slow phones: past this many live voices, new one-shots are dropped rather than glitching everything.
const MAX_VOICES = 40;
// A few ms of lead lets the node graph settle before the attack (no clicks on slower devices).
const LEAD = 0.006;

const lastPlayed = new Map<Sfx | 'motif', number>();
const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function throttled(name: Sfx | 'motif'): boolean {
  const now = nowMs();
  const last = lastPlayed.get(name);
  if (last !== undefined && now - last < (name === 'motif' ? 400 : (MIN_GAP_MS[name] ?? DEFAULT_GAP_MS))) return true;
  lastPlayed.set(name, now);
  return false;
}

// ---------------------------------------------------------------------------------------------------------------
// Public API (the contract)

/** Call from the first user gesture (browsers block audio until then). Also wired to gestures automatically. */
export function unlockAudio(): void {
  try {
    installAudioListeners();
    unlock();
  } catch (err) {
    report('unlock', err);
  }
}

/** Plays a short synthesized cue. `step` selects a note for sequences (e.g. clue plucks, motif letters 0-5). */
export function playSfx(name: Sfx, opts?: { intensity?: number; step?: number }): void {
  try {
    // Freeze and Release also change the world's state (city muffled, clock paused) whether or not this device
    // makes a sound, so the state change comes first.
    if (name === 'freeze') {
      stopCharge(0.06);
      setFrozen(true);
    } else if (name === 'release') {
      setFrozen(false);
    }

    const policy = policyFor(name);
    if (policy === 'off') return;
    const g = readyGraph();
    if (!g) return;

    if (name === 'holdCharge') {
      // Called repeatedly while the ring fills; the voice follows `intensity` and stops itself.
      touch(chargeHold(g, opts?.intensity === undefined ? undefined : clamp01(opts.intensity)) + 0.5);
      return;
    }
    if (throttled(name)) return;
    if (liveVoices() >= MAX_VOICES && name !== 'freeze' && name !== 'release') return;

    const out = policy === 'quiet' ? quietBus(g) : g.sfx;
    const t = g.ctx.currentTime + LEAD;
    const end = RECIPES[name](g.ctx, out, t, { intensity: opts?.intensity, step: opts?.step });
    touch(Math.max(0, end - g.ctx.currentTime) + 0.25);
  } catch (err) {
    report(`sfx:${name}`, err);
  }
}

/** Plays the six-note S.H.I.E.L.D. motif; `lit` marks which letters (0-5) are lit for this player. */
export function playMotif(lit: boolean[]): void {
  try {
    const g = readyGraph();
    if (!g) return;
    if (throttled('motif')) return;
    const t = g.ctx.currentTime + 0.03;
    let end = t;
    if (engine.profile === 'squad-phone') {
      // Classroom phones: a short, quiet rendition (no ringing tails, no chord bloom).
      const bus = quietBus(g);
      for (let i = 0; i < 6; i++) end = Math.max(end, motifLetter(g.ctx, bus, t + i * MOTIF_GAP, i, lit[i] === true));
    } else {
      end = motif(g.ctx, g.sfx, t, lit);
    }
    touch(Math.max(0, end - g.ctx.currentTime) + 0.25);
  } catch (err) {
    report('motif', err);
  }
}

/** Generative ambient pad for the city hub or a district. Phones in a squad session should not call this. */
export function startAmbient(where: DistrictId | 'city'): void {
  try {
    installAudioListeners();
    // Moving somewhere new always starts with time running (a demo or mission left without a Release).
    if (engine.frozen && wantedAmbient() !== where) setFrozen(false);
    setManualAmbient(where);
    if (!engine.graph) unlock();
    reconcile();
  } catch (err) {
    report('startAmbient', err);
  }
}

/** Fades the ambient pad out (1.5 s). */
export function stopAmbient(): void {
  try {
    setManualAmbient(null);
    if (engine.frozen) setFrozen(false);
    reconcile();
  } catch (err) {
    report('stopAmbient', err);
  }
}

/** Live-phase tension: 0 = calm, 1 = maximum (accelerating tick). */
export function setTension(level: number): void {
  try {
    installAudioListeners();
    const l = clamp01(level);
    // A rising live clock means time is running again (e.g. a replay that never played Release).
    if (l > 0 && engine.frozen) setFrozen(false);
    setTensionLevel(l);
  } catch (err) {
    report('setTension', err);
  }
}

// Longer vibrations are refused or feel like an alarm; keep every pattern short and gentle.
const MAX_PULSE_MS = 400;
const MAX_STEPS = 12;

/** Vibration on supporting devices (Android). No-op on iOS. Respects the Vibration setting. */
export function haptic(pattern: number | number[]): void {
  try {
    if (!useSettings.getState().haptics || !pageVisible()) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    // Chrome blocks (and logs) vibrate() before the first tap, so don't ask until then.
    const ua = (navigator as Navigator & { userActivation?: UserActivation }).userActivation;
    if (ua && !ua.hasBeenActive) return;
    const steps = (Array.isArray(pattern) ? pattern : [pattern])
      .slice(0, MAX_STEPS)
      .map((ms) => (Number.isFinite(ms) ? Math.round(Math.min(MAX_PULSE_MS, Math.max(0, ms))) : 0));
    if (!steps.some((ms, i) => i % 2 === 0 && ms > 0)) return;
    navigator.vibrate(steps.length === 1 ? (steps[0] ?? 0) : steps);
  } catch {
    // Unsupported or blocked: haptics are a bonus.
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Optional extras

/** Named haptic patterns so feedback feels consistent across screens. */
export const HAPTICS = {
  tap: 8,
  clue: 14,
  hold: 22,
  freeze: 60,
  release: [18, 50, 18],
  surge: [26, 40, 26],
  seal: [12, 30, 20],
  success: [16, 60, 32],
} as const satisfies Record<string, number | readonly number[]>;

/** Plays a named pattern from HAPTICS. */
export function hapticCue(name: keyof typeof HAPTICS): void {
  const p: number | readonly number[] = HAPTICS[name];
  haptic(typeof p === 'number' ? p : [...p]);
}

/**
 * Where this device sits in the room. `squad-phone` = quiet UI cues only (no ambience, tension clock or drama);
 * `big-screen` = the projector carries music and ambience; `solo` = everything. Reset to `solo` when leaving.
 */
export function setAudioProfile(profile: AudioProfile): void {
  try {
    setProfile(profile === 'squad-phone' || profile === 'big-screen' ? profile : 'solo');
  } catch (err) {
    report('profile', err);
  }
}

/** Calm Mode (GDD 7.3): mutes pressure audio (clock, surges) and settles the ambient bed. */
export function setCalmMode(on: boolean): void {
  try {
    setCalm(on === true);
  } catch (err) {
    report('calm', err);
  }
}

/** Colours the ambient bed: `sober` after a risky choice's shine fades, `glow` when protective choices light up. */
export function setAmbientMood(mood: AmbientMood): void {
  try {
    setMood(mood === 'sober' || mood === 'glow' ? mood : 'normal');
    reconcile();
  } catch (err) {
    report('mood', err);
  }
}

/**
 * Keeps an ambient pad playing while the calling component is mounted (fades in/out 1.5 s). The newest request
 * wins, and a nested screen outranks its parent. `null` asks for quiet while mounted.
 */
export function useAmbient(where: AmbientPlace | null): void {
  // Reserved during render: parents render before children, so the deepest screen's request is newest.
  const order = useMemo(() => nextAmbientOrder(), [where]);
  useEffect(() => {
    let id = 0;
    try {
      installAudioListeners();
      id = addAmbientRequest(where, order);
      if (where && !engine.graph) unlock();
      reconcile();
    } catch (err) {
      report('useAmbient', err);
    }
    return () => {
      try {
        removeAmbientRequest(id);
        reconcile();
      } catch (err) {
        report('useAmbient', err);
      }
    };
  }, [where, order]);
}

/** What the audio engine is doing right now (for a settings readout or debugging; contains no personal data). */
export function audioStatus(): {
  supported: boolean;
  state: AudioContextState | 'none';
  ambient: AmbientPlace | null;
  tension: number;
  profile: AudioProfile;
  calm: boolean;
  frozen: boolean;
} {
  let state: AudioContextState | 'none' = 'none';
  try {
    state = engine.graph ? engine.graph.ctx.state : 'none';
  } catch {
    // Closed or torn down.
  }
  return {
    supported: !engine.unsupported,
    state,
    ambient: currentAmbient(),
    tension: tensionLevel(),
    profile: engine.profile,
    calm: engine.calm,
    frozen: engine.frozen,
  };
}

installAudioListeners();
