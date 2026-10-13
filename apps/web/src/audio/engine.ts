// Audio engine core: one lazily created AudioContext, a tiny mixing graph, and the rules for when it may run.
// Everything here must fail silently: iOS quirks, old browsers and locked-down school devices just stay quiet.
import { useSettings } from '../state/settings';

/**
 * Where this device sits in the room (GDD 4.6, 7.2-7.3).
 * - `solo`: one player, full sound.
 * - `squad-phone`: one of ~30 phones in a classroom. Only quiet UI cues; no ambience, tension loop or motif,
 *   because the projector carries those (and which motif letters light is private to the device).
 * - `big-screen`: the projector. Full sound, ambience a little louder.
 */
export type AudioProfile = 'solo' | 'squad-phone' | 'big-screen';

export interface Graph {
  ctx: AudioContext;
  master: GainNode;
  /** One-shot cues. */
  sfx: GainNode;
  /** Ambient pads feed this; it runs through `muffle` so Freeze can close the city's sound down. */
  ambient: GainNode;
  muffle: BiquadFilterNode;
  /** The live-phase clock. */
  tension: GainNode;
}

interface EngineState {
  graph: Graph | null;
  profile: AudioProfile;
  calm: boolean;
  frozen: boolean;
  unsupported: boolean;
  /** True once the context has reached `running` (i.e. a gesture unlocked it). */
  everRan: boolean;
  lastError: string | null;
}

export const engine: EngineState = {
  graph: null,
  profile: 'solo',
  calm: false,
  frozen: false,
  unsupported: false,
  everRan: false,
  lastError: null,
};

export const FLOOR = 0.0001;
const MASTER_LEVEL: Record<AudioProfile, number> = { solo: 0.8, 'squad-phone': 0.4, 'big-screen': 1 };
const AMBIENT_LEVEL: Record<AudioProfile, number> = { solo: 0.55, 'squad-phone': 0, 'big-screen': 0.8 };
const FROZEN_AMBIENT = 0.6;
const MUFFLE_HZ = 340;
// Battery: an idle running AudioContext keeps the audio thread awake. Suspend after this much silence.
const IDLE_SUSPEND_MS = 10_000;

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const warned = new Set<string>();
export function report(where: string, err: unknown): void {
  engine.lastError = `${where}: ${err instanceof Error ? err.message : String(err)}`;
  if (import.meta.env.DEV && !warned.has(where)) {
    warned.add(where);
    console.warn(`[audio] ${engine.lastError}`);
  }
}

/** Swallows a promise rejection (resume/suspend can reject; older WebKit may not return a promise at all). */
function settle(p: unknown, where: string): void {
  if (p && typeof (p as Promise<void>).catch === 'function') {
    (p as Promise<void>).catch((e: unknown) => report(where, e));
  }
}

export function soundOn(): boolean {
  try {
    return useSettings.getState().sound;
  } catch {
    return false;
  }
}

export function pageVisible(): boolean {
  return !isBrowser || document.visibilityState !== 'hidden';
}

/** Browsers only let audio start after a user gesture; creating a context earlier just logs warnings. */
function hasActivation(): boolean {
  if (typeof navigator === 'undefined') return true;
  const ua = (navigator as Navigator & { userActivation?: UserActivation }).userActivation;
  return ua ? ua.hasBeenActive : true;
}

export function nyquist(ctx: BaseAudioContext): number {
  return ctx.sampleRate * 0.45;
}

// ---------------------------------------------------------------------------------------------------------------
// Subsystem hooks: ambient, tension and the hold-charge voice register here so the engine can re-apply them
// whenever a condition changes (sound toggled, page hidden, profile, calm, freeze, context resumed).

const reconcilers: Array<() => void> = [];
const keepAlives: Array<() => boolean> = [];

export function onReconcile(fn: () => void): void {
  reconcilers.push(fn);
}

/** Registers a "something is still sounding" predicate that keeps the context out of idle suspension. */
export function keepAwakeWhile(fn: () => boolean): void {
  keepAlives.push(fn);
}

function wantsRunning(): boolean {
  return keepAlives.some((fn) => {
    try {
      return fn();
    } catch {
      return false;
    }
  });
}

export function reconcile(): void {
  for (const fn of reconcilers) {
    try {
      fn();
    } catch (err) {
      report('reconcile', err);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Context + graph

function contextCtor(): typeof AudioContext | null {
  const g = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/** iOS 16.4+: mix with other audio and obey the ring/silent switch (polite in a classroom). */
function preferAmbientSession(): void {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'ambient';
  } catch {
    // Not supported: fine.
  }
}

function createGraph(): Graph | null {
  if (engine.graph || engine.unsupported) return engine.graph;
  const Ctor = contextCtor();
  if (!Ctor) {
    engine.unsupported = true;
    return null;
  }
  preferAmbientSession();
  let ctx: AudioContext;
  try {
    ctx = new Ctor({ latencyHint: 'interactive' });
  } catch {
    try {
      ctx = new Ctor();
    } catch (err) {
      engine.unsupported = true;
      report('create', err);
      return null;
    }
  }

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 3;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  comp.connect(ctx.destination);

  const master = ctx.createGain();
  master.gain.value = soundOn() ? MASTER_LEVEL[engine.profile] : FLOOR;
  master.connect(comp);

  const sfx = ctx.createGain();
  sfx.gain.value = 0.9;
  sfx.connect(master);

  const muffle = ctx.createBiquadFilter();
  muffle.type = 'lowpass';
  muffle.Q.value = 0.5;
  muffle.frequency.value = engine.frozen ? MUFFLE_HZ : nyquist(ctx);
  muffle.connect(master);

  const ambient = ctx.createGain();
  ambient.gain.value = AMBIENT_LEVEL[engine.profile] * (engine.frozen ? FROZEN_AMBIENT : 1);
  ambient.connect(muffle);

  const tension = ctx.createGain();
  tension.gain.value = 0.85;
  tension.connect(master);

  const onState = (): void => {
    if (ctx.state === 'running' && !engine.everRan) {
      engine.everRan = true;
      reconcile();
    }
    if (ctx.state === 'running') touch();
  };
  if (typeof ctx.addEventListener === 'function') ctx.addEventListener('statechange', onState);
  else ctx.onstatechange = onState;

  engine.graph = { ctx, master, sfx, ambient, muffle, tension };
  return engine.graph;
}

let primed = false;
/** Old iOS only unlocked Web Audio once a source had been started inside a gesture: play one silent sample. */
function prime(ctx: AudioContext): void {
  if (primed) return;
  primed = true;
  const src = ctx.createBufferSource();
  src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  src.connect(ctx.destination);
  src.start(0);
}

function resume(ctx: AudioContext): void {
  const s: string = ctx.state;
  if (s === 'suspended' || s === 'interrupted') settle(ctx.resume(), 'resume');
}

function suspend(ctx: AudioContext): void {
  if (ctx.state === 'running') settle(ctx.suspend(), 'suspend');
}

/** Creates (first gesture) or resumes the context. Idempotent and cheap. */
export function unlock(): void {
  if (!soundOn() || !hasActivation()) return;
  const g = engine.graph ?? createGraph();
  if (!g) return;
  if (pageVisible()) resume(g.ctx);
  prime(g.ctx);
  touch();
}

/** The graph, ready to schedule into, or null when sound should not play right now. Resumes an idle context. */
export function liveGraph(): Graph | null {
  const g = engine.graph;
  if (!g || !soundOn() || !pageVisible()) return null;
  if (g.ctx.state !== 'running') {
    if (!hasActivation()) return null;
    resume(g.ctx);
  }
  return g;
}

/** Smoothly moves a param to `value` from wherever it is now. */
export function glide(p: AudioParam, value: number, t: number, timeConstant: number): void {
  p.cancelScheduledValues(t);
  p.setValueAtTime(p.value, t);
  p.setTargetAtTime(value, t, timeConstant);
}

// ---------------------------------------------------------------------------------------------------------------
// Idle suspension

let idleTimer: ReturnType<typeof setTimeout> | undefined;
let awakeUntil = 0;

/** Marks activity; keeps the context running for at least `seconds` more, then idle-suspends it. */
export function touch(seconds = 0): void {
  awakeUntil = Math.max(awakeUntil, nowMs() + seconds * 1000);
  if (idleTimer === undefined) idleTimer = setTimeout(checkIdle, IDLE_SUSPEND_MS);
}

function checkIdle(): void {
  idleTimer = undefined;
  const g = engine.graph;
  if (!g) return;
  const quietFor = nowMs() - awakeUntil;
  if (wantsRunning() || quietFor < IDLE_SUSPEND_MS) {
    idleTimer = setTimeout(checkIdle, Math.max(500, IDLE_SUSPEND_MS - Math.max(0, quietFor)));
    return;
  }
  suspend(g.ctx);
}

// ---------------------------------------------------------------------------------------------------------------
// Global switches

function applySound(on: boolean): void {
  if (on && !engine.graph && hasActivation()) createGraph();
  const g = engine.graph;
  if (g) {
    const t = g.ctx.currentTime;
    glide(g.master.gain, on ? MASTER_LEVEL[engine.profile] : FLOOR, t, 0.04);
    if (on) {
      if (pageVisible()) resume(g.ctx);
      touch(1);
    } else {
      // Let the fade land before freezing the clock.
      setTimeout(() => {
        if (!soundOn() && engine.graph) suspend(engine.graph.ctx);
      }, 160);
    }
  }
  reconcile();
}

export function setProfile(profile: AudioProfile): void {
  if (engine.profile === profile) return;
  engine.profile = profile;
  const g = engine.graph;
  if (g) {
    const t = g.ctx.currentTime;
    if (soundOn()) glide(g.master.gain, MASTER_LEVEL[profile], t, 0.1);
    glide(g.ambient.gain, AMBIENT_LEVEL[profile] * (engine.frozen ? FROZEN_AMBIENT : 1), t, 0.3);
  }
  reconcile();
}

export function setCalm(on: boolean): void {
  if (engine.calm === on) return;
  engine.calm = on;
  reconcile();
}

/** Freeze closes a low-pass over the city's ambience ("the world goes muffled"); Release opens it again. */
export function setFrozen(on: boolean): void {
  if (engine.frozen === on) return;
  engine.frozen = on;
  const g = engine.graph;
  if (g) {
    const t = g.ctx.currentTime;
    const f = g.muffle.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.max(40, Math.min(nyquist(g.ctx), f.value)), t);
    f.exponentialRampToValueAtTime(on ? MUFFLE_HZ : nyquist(g.ctx), t + (on ? 0.42 : 0.3));
    glide(g.ambient.gain, AMBIENT_LEVEL[engine.profile] * (on ? FROZEN_AMBIENT : 1), t, on ? 0.12 : 0.1);
  }
  reconcile();
}

// ---------------------------------------------------------------------------------------------------------------
// Shared noise buffers (generated once; no files)

const buffers = new WeakMap<BaseAudioContext, { white: AudioBuffer; pink: AudioBuffer }>();

export function noiseBuffer(ctx: BaseAudioContext, kind: 'white' | 'pink'): AudioBuffer {
  let b = buffers.get(ctx);
  if (!b) {
    const len = Math.floor(ctx.sampleRate * 2);
    const white = ctx.createBuffer(1, len, ctx.sampleRate);
    const pink = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = white.getChannelData(0);
    const p = pink.getChannelData(0);
    // Paul Kellet's economy pink filter: a soft, rain-like spectrum without a filter chain at runtime.
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const x = Math.random() * 2 - 1;
      w[i] = x;
      b0 = 0.99765 * b0 + x * 0.099046;
      b1 = 0.963 * b1 + x * 0.2965164;
      b2 = 0.57 * b2 + x * 1.0526913;
      p[i] = (b0 + b1 + b2 + x * 0.1848) * 0.2;
    }
    b = { white, pink };
    buffers.set(ctx, b);
  }
  return b[kind];
}

// ---------------------------------------------------------------------------------------------------------------
// Listeners (installed once, browser only)

const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;

function onGesture(): void {
  try {
    const g = engine.graph;
    if (g && engine.everRan) {
      const s: string = g.ctx.state;
      // An idle-suspended context is resumed by the next sound; only wake it here if something is sounding,
      // or iOS interrupted it (call, Siri) and needs a gesture to come back.
      if (s === 'running' || (s === 'suspended' && !wantsRunning())) return;
    }
    unlock();
  } catch (err) {
    report('gesture', err);
  }
}

function onVisibility(): void {
  try {
    const g = engine.graph;
    if (g) {
      if (!pageVisible()) suspend(g.ctx);
      else if (soundOn() && wantsRunning()) resume(g.ctx);
    }
    reconcile();
  } catch (err) {
    report('visibility', err);
  }
}

let installed = false;
export function installAudioListeners(): void {
  if (installed || !isBrowser) return;
  installed = true;
  try {
    for (const type of GESTURES) window.addEventListener(type, onGesture, { capture: true, passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onVisibility);
    window.addEventListener('pageshow', onVisibility);
    useSettings.subscribe((s, prev) => {
      if (s.sound !== prev.sound) applySound(s.sound);
    });
  } catch (err) {
    report('install', err);
  }
}

/** Test seam: forget the context so a fresh one is created (vitest only). */
export function __resetEngineForTests(): void {
  engine.graph = null;
  engine.profile = 'solo';
  engine.calm = false;
  engine.frozen = false;
  engine.unsupported = false;
  engine.everRan = false;
  engine.lastError = null;
  primed = false;
  if (idleTimer !== undefined) clearTimeout(idleTimer);
  idleTimer = undefined;
  awakeUntil = 0;
}
