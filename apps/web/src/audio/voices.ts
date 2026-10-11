// Sound recipes. Each one schedules a short, self-cleaning Voice at time `t` and returns its end time.
// House style: soft attacks, pentatonic pitches in D, nothing harsh, nothing that grates on the 30th repeat.
import { FLOOR, keepAwakeWhile, onReconcile, pageVisible, soundOn, type Graph } from './engine';
import { Voice, ad, ahr, bell, clamp01, mtof, noiseHit, pick, pluck, swell } from './synth';
import type { Sfx } from './sfx';

export interface SfxOpts {
  intensity?: number;
  step?: number;
}

export type Recipe = (ctx: AudioContext, out: AudioNode, t: number, o: SfxOpts) => number;

const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** D major pentatonic, A4 → F#6: successive clue finds climb this ladder. */
const CLUE_SCALE: readonly number[] = [69, 71, 74, 76, 78, 81, 83, 86, 88, 90];

/** The S.H.I.E.L.D. motif, one note per letter: rise, settle, then soar to the octave. */
export const MOTIF_NOTES: readonly number[] = [74, 78, 81, 76, 83, 86];
export const MOTIF_GAP = 0.18;

const TRIAD: ReadonlyArray<readonly [number, number]> = [
  [62, -6],
  [66, 5],
  [69, 0],
];

export function clueNote(step: number): number {
  const n = CLUE_SCALE.length;
  const s = Math.max(0, Math.floor(Number.isFinite(step) ? step : 0));
  // Past the top, keep cycling the highest five notes so it still sounds like progress.
  const i = s < n ? s : n - 5 + ((s - n) % 5);
  return pick(CLUE_SCALE, i, 74);
}

export function motifNote(letter: number): number {
  const i = ((Math.floor(Number.isFinite(letter) ? letter : 0) % 6) + 6) % 6;
  return pick(MOTIF_NOTES, i, 74);
}

// ---------------------------------------------------------------------------------------------------------------
// One-shots

const tap: Recipe = (ctx, out, t) => {
  const v = new Voice(ctx, out);
  // A hair of random pitch so rapid taps never sound machine-gunned.
  const f = 1350 * Math.pow(2, (Math.random() - 0.5) * 0.07);
  const amp = v.gain(0);
  const end = ad(amp.gain, t, 0.002, 0.07, 0.045);
  const o = v.osc('sine', f, t, end + 0.01, amp);
  o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.04);
  noiseHit(v, t, 0.012, { type: 'highpass', freq: 3800, gain: 0.02, attack: 0.001 });
  return end;
};

/** One clock tick (or tock). Brighter and louder as `intensity` (tension) rises. */
export function tickAt(ctx: AudioContext, out: AudioNode, t: number, intensity: number, tock: boolean): number {
  const i = clamp01(intensity);
  const v = new Voice(ctx, out);
  const body = (tock ? 1480 : 1960) * (1 + 0.15 * i);
  const g = 0.05 + 0.12 * i;
  noiseHit(v, t, 0.016, { type: 'bandpass', freq: body * 1.7, q: 4, gain: g, attack: 0.0008 });
  const amp = v.gain(0);
  const end = ad(amp.gain, t, 0.001, g * 0.45, 0.035 - 0.012 * i);
  v.osc('sine', body, t, end + 0.01, amp);
  return Math.max(end, t + 0.02);
}

const tick: Recipe = (ctx, out, t, o) => tickAt(ctx, out, t, o.intensity ?? 0.3, (o.step ?? 0) % 2 === 1);

/** Time stops: a chord whose tape slows to a halt (~400 ms) while a low-pass closes over it. */
const freeze: Recipe = (ctx, out, t) => {
  const v = new Voice(ctx, out);
  const D = 0.42;
  const amp = v.gain(0);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(0.13, t + 0.012);
  amp.gain.setValueAtTime(0.13, t + 0.2);
  amp.gain.exponentialRampToValueAtTime(FLOOR, t + D + 0.08);
  const lp = v.filter('lowpass', 3200, 0.9, amp);
  lp.frequency.setValueAtTime(3200, t);
  lp.frequency.exponentialRampToValueAtTime(180, t + D);
  for (const [m, det] of TRIAD) {
    // Linear speed loss = the characteristic tape "dive" at the end.
    const o = v.osc('sawtooth', mtof(m), t, t + D + 0.1, lp, det);
    o.frequency.linearRampToValueAtTime(mtof(m) * 0.06, t + D);
  }
  const hiss = v.gain(0);
  ad(hiss.gain, t, 0.01, 0.045, D);
  const n = v.noise(t, t + D + 0.05, v.filter('bandpass', 2200, 0.8, hiss));
  n.playbackRate.linearRampToValueAtTime(0.05, t + D);
  const thud = v.gain(0);
  const end = ad(thud.gain, t + 0.05, 0.02, 0.1, 0.4);
  const s = v.osc('sine', 120, t + 0.05, end + 0.01, thud);
  s.frequency.exponentialRampToValueAtTime(42, t + 0.45);
  return Math.max(end, t + D + 0.1);
};

/** Time resumes: a reverse swell (~300 ms) as the tape spins back up, landing on a soft note. */
const release: Recipe = (ctx, out, t) => {
  const v = new Voice(ctx, out);
  const R = 0.3;
  const amp = v.gain(0);
  const top = swell(amp.gain, t, R, 0.12, 0.04);
  const lp = v.filter('lowpass', 300, 0.9, amp);
  lp.frequency.setValueAtTime(300, t);
  lp.frequency.exponentialRampToValueAtTime(4200, t + R);
  for (const [m, det] of TRIAD) {
    const o = v.osc('sawtooth', mtof(m) * 0.5, t, top + 0.02, lp, det);
    o.frequency.exponentialRampToValueAtTime(mtof(m), t + R);
  }
  const air = v.gain(0);
  swell(air.gain, t, R, 0.05, 0.03);
  v.noise(t, top + 0.02, v.filter('highpass', 700, 0.7, air));
  const land = v.gain(0);
  const end = ad(land.gain, t + R - 0.005, 0.004, 0.06, 0.5);
  v.osc('sine', mtof(74), t + R - 0.005, end + 0.02, land);
  return end;
};

const message: Recipe = (ctx, out, t) => {
  const v = new Voice(ctx, out);
  let end = t;
  const notes: ReadonlyArray<readonly [number, number]> = [
    [83, 0],
    [88, 0.085],
  ];
  for (const [m, dt] of notes) {
    const amp = v.gain(0);
    const e = ad(amp.gain, t + dt, 0.004, 0.1, 0.13);
    v.osc('sine', mtof(m), t + dt, e + 0.01, amp);
    v.osc('triangle', mtof(m) * 2, t + dt, e + 0.01, v.gain(0.08, amp));
    end = Math.max(end, e);
  }
  return end;
};

// Without an explicit step, successive finds still climb; the ladder resets after a quiet spell.
let autoStep = 0;
let lastClueAt = -Infinity;
const clue: Recipe = (ctx, out, t, o) => {
  let step = o.step;
  if (step === undefined) {
    if (nowMs() - lastClueAt > 30_000) autoStep = 0;
    step = autoStep++;
  }
  lastClueAt = nowMs();
  const v = new Voice(ctx, out);
  const f = mtof(clueNote(step));
  const end = pluck(v, f, t, { gain: 0.12, decay: 0.7 });
  pluck(v, f * 2, t + 0.06, { gain: 0.025, decay: 0.4, wave: 'sine' });
  return end;
};

/** "Seems fine": a settled open fifth. Deliberately neutral, neither reward nor warning. */
const clueOk: Recipe = (ctx, out, t) => {
  const v = new Voice(ctx, out);
  const a = pluck(v, mtof(79), t, { gain: 0.07, decay: 0.8, wave: 'sine', bright: 3 });
  const b = pluck(v, mtof(86), t + 0.06, { gain: 0.04, decay: 0.6, wave: 'sine', bright: 3 });
  return Math.max(a, b);
};

/** A paper envelope folding shut: swish, crease, press. */
const seal: Recipe = (ctx, out, t) => {
  const v = new Voice(ctx, out);
  noiseHit(v, t, 0.09, { type: 'bandpass', freq: 900, to: 2600, q: 1.4, gain: 0.07, attack: 0.02 });
  noiseHit(v, t + 0.1, 0.014, { type: 'highpass', freq: 2800, gain: 0.04, attack: 0.001 });
  noiseHit(v, t + 0.13, 0.1, { type: 'lowpass', freq: 600, gain: 0.07, attack: 0.003 });
  const amp = v.gain(0);
  const end = ad(amp.gain, t + 0.13, 0.004, 0.11, 0.14);
  const s = v.osc('sine', 150, t + 0.13, end + 0.01, amp);
  s.frequency.exponentialRampToValueAtTime(70, t + 0.25);
  return end;
};

/** A soft bell. With `step`, it rings that motif letter's note (0-5). */
const reveal: Recipe = (ctx, out, t, o) => {
  const v = new Voice(ctx, out);
  const m = o.step === undefined ? 74 : motifNote(o.step);
  const end = bell(v, mtof(m), t, { gain: 0.13, decay: 1.8 });
  // A warm body underneath so it isn't thin on phone speakers.
  const amp = v.gain(0);
  const e = ahr(amp.gain, t, 0.05, 0.035, 0.1, 0.9);
  v.osc('triangle', mtof(m - 12), t, e + 0.02, v.filter('lowpass', 900, 0.7, amp));
  return Math.max(end, e);
};

/** A consequence lands: a low, sober swell in open fifths. Weighty, never a horror sting. */
const aftershock: Recipe = (ctx, out, t, o) => {
  const v = new Voice(ctx, out);
  const w = 0.75 + 0.25 * clamp01(o.intensity ?? 0.6);
  const amp = v.gain(0);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(0.2 * w, t + 0.7);
  amp.gain.exponentialRampToValueAtTime(FLOOR, t + 2.6);
  const lp = v.filter('lowpass', 650, 0.7, amp);
  lp.frequency.setValueAtTime(650, t);
  lp.frequency.exponentialRampToValueAtTime(320, t + 2.4);
  const parts: ReadonlyArray<readonly [number, OscillatorType, number, number]> = [
    [38, 'sine', 0.7, 0],
    [45, 'sine', 0.55, 0],
    [50, 'triangle', 1, 4],
    [57, 'triangle', 0.45, -4],
  ];
  for (const [m, wave, level, det] of parts) v.osc(wave, mtof(m), t, t + 2.65, v.gain(level, lp), det);
  noiseHit(v, t, 1.6, { type: 'lowpass', freq: 500, to: 220, gain: 0.03 * w, attack: 0.6, rate: 0.6 });
  return t + 2.65;
};

/** A protective choice ripples out: a warm, strummed major-ninth chord. */
const afterglow: Recipe = (ctx, out, t) => {
  const v = new Voice(ctx, out);
  const lp = v.filter('lowpass', 900, 0.6);
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(2200, t + 0.5);
  let end = t;
  [62, 66, 69, 73, 76].forEach((m, i) => {
    const at = t + i * 0.035;
    const amp = v.gain(0, lp);
    const e = ahr(amp.gain, at, 0.14, 0.032, 0.5, 1.8);
    v.osc('sawtooth', mtof(m), at, e + 0.02, amp, -5);
    v.osc('triangle', mtof(m), at, e + 0.02, amp, 5);
    end = Math.max(end, e);
  });
  const bass = v.gain(0);
  const b = ahr(bass.gain, t, 0.12, 0.07, 0.5, 1.6);
  v.osc('sine', mtof(50), t, b + 0.02, bass);
  end = Math.max(end, b, pluck(v, mtof(86), t + 0.2, { gain: 0.03, decay: 0.9, wave: 'sine' }));
  return end;
};

/** A Guardian unfolds: paper rustle, then a sparkle arpeggio that drifts across the stereo field. */
const unfold: Recipe = (ctx, out, t) => {
  const v = new Voice(ctx, out);
  let end = t;
  for (let i = 0; i < 4; i++) {
    const at = t + i * 0.055 + Math.random() * 0.02;
    const freq = 2200 + Math.random() * 2600;
    end = Math.max(end, noiseHit(v, at, 0.04 + Math.random() * 0.03, { freq, q: 1.8, gain: 0.045, attack: 0.003 }));
  }
  [86, 88, 90, 93, 95].forEach((m, i) => {
    const dest = v.pan(-0.4 + i * 0.2);
    end = Math.max(end, pluck(v, mtof(m), t + 0.18 + i * 0.055, { gain: 0.045, decay: 0.45, wave: 'sine', dest }));
  });
  return end;
};

/** A Pressure Surge pop-up: a short buzzy squeeze (two saws a semitone apart). Pressure, not panic. */
const surge: Recipe = (ctx, out, t, o) => {
  const v = new Voice(ctx, out);
  const s = 0.7 + 0.3 * clamp01(o.intensity ?? 0.5);
  const amp = v.gain(0);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(0.1 * s, t + 0.03);
  amp.gain.setValueAtTime(0.1 * s, t + 0.18);
  amp.gain.exponentialRampToValueAtTime(FLOOR, t + 0.48);
  const lp = v.filter('lowpass', 260, 3.5, amp);
  lp.frequency.setValueAtTime(260, t);
  lp.frequency.exponentialRampToValueAtTime(1500, t + 0.08);
  lp.frequency.exponentialRampToValueAtTime(380, t + 0.45);
  for (const [m, det] of [
    [46, 0],
    [47, 8],
  ] as const) {
    const osc = v.osc('sawtooth', mtof(m), t, t + 0.5, lp, det);
    osc.frequency.linearRampToValueAtTime(mtof(m) * 1.04, t + 0.45);
  }
  return t + 0.5;
};

const success: Recipe = (ctx, out, t) => {
  const v = new Voice(ctx, out);
  let end = t;
  [74, 78, 81, 86].forEach((m, i) => {
    const last = i === 3;
    const e = pluck(v, mtof(m), t + i * 0.075, { gain: last ? 0.11 : 0.09, decay: last ? 1.1 : 0.45, bright: 8 });
    end = Math.max(end, e);
  });
  return Math.max(end, bell(v, mtof(90), t + 0.3, { gain: 0.025, decay: 1 }));
};

/** Two gentle falling notes. Soft attack, rounded tone, never a buzzer. */
const softFail: Recipe = (ctx, out, t) => {
  const v = new Voice(ctx, out);
  const lp = v.filter('lowpass', 1800, 0.6);
  let end = t;
  const notes: ReadonlyArray<readonly [number, number]> = [
    [69, 0],
    [66, 0.17],
  ];
  for (const [m, dt] of notes) {
    const amp = v.gain(0, lp);
    const e = ad(amp.gain, t + dt, 0.018, 0.09, 0.5);
    v.osc('triangle', mtof(m), t + dt, e + 0.02, amp);
    v.osc('sine', mtof(m), t + dt, e + 0.02, v.gain(0.6, amp));
    end = Math.max(end, e);
  }
  return end;
};

const pageTurn: Recipe = (ctx, out, t) => {
  const v = new Voice(ctx, out);
  const a = noiseHit(v, t, 0.13, { freq: 1400, to: 5200, q: 1.2, gain: 0.055, attack: 0.025 });
  const b = noiseHit(v, t + 0.06, 0.07, { type: 'highpass', freq: 3000, gain: 0.02, attack: 0.01 });
  return Math.max(a, b);
};

export const RECIPES: Record<Exclude<Sfx, 'holdCharge'>, Recipe> = {
  tap,
  freeze,
  release,
  tick,
  message,
  clue,
  clueOk,
  seal,
  reveal,
  aftershock,
  afterglow,
  unfold,
  surge,
  success,
  'soft-fail': softFail,
  pageTurn,
};

// ---------------------------------------------------------------------------------------------------------------
// S.H.I.E.L.D. motif

/** One motif letter: a ringing note when lit, a damped muted tick when not (the note is there, not yet earned). */
export function motifLetter(ctx: AudioContext, out: AudioNode, t: number, letter: number, lit: boolean, ring = false) {
  const v = new Voice(ctx, out);
  const f = mtof(motifNote(letter));
  if (lit) {
    const a = pluck(v, f, t, { gain: 0.11, decay: ring ? 1.5 : 0.8, bright: 7 });
    const b = bell(v, f, t, { gain: 0.045, decay: ring ? 1.4 : 0.7 });
    return Math.max(a, b);
  }
  const a = noiseHit(v, t, 0.02, { freq: 1300, q: 3, gain: 0.03, attack: 0.001 });
  const amp = v.gain(0);
  const e = ad(amp.gain, t, 0.002, 0.03, 0.05);
  v.osc('triangle', f / 2, t, e + 0.01, v.filter('lowpass', 700, 0.7, amp));
  return Math.max(a, e);
}

export function motif(ctx: AudioContext, out: AudioNode, t: number, lit: readonly boolean[]): number {
  let lastLit = -1;
  for (let i = 0; i < 6; i++) if (lit[i] === true) lastLit = i;
  let end = t;
  for (let i = 0; i < 6; i++) {
    end = Math.max(end, motifLetter(ctx, out, t + i * MOTIF_GAP, i, lit[i] === true, i === lastLit));
  }
  if (lastLit === 5 && lit.slice(0, 6).every((x) => x === true)) {
    // All six earned: a quiet D-major bloom under the last note.
    const v = new Voice(ctx, out);
    const at = t + 5 * MOTIF_GAP + 0.05;
    for (const m of [62, 66, 69, 74]) {
      const amp = v.gain(0);
      end = Math.max(end, ahr(amp.gain, at, 0.25, 0.03, 0.4, 1.4));
      v.osc('triangle', mtof(m), at, end + 0.02, v.filter('lowpass', 1600, 0.6, amp));
    }
  }
  return end;
}

// ---------------------------------------------------------------------------------------------------------------
// Hold charge: one persistent voice that follows the HOLD ring's fill.

interface Charge {
  v: Voice;
  amp: GainNode;
  lp: BiquadFilterNode;
  depth: GainNode;
  a: OscillatorNode;
  b: OscillatorNode;
  lfo: OscillatorNode;
  level: number;
  lastAt: number;
  /** Safety stop time (context seconds). */
  until: number;
  timer: ReturnType<typeof setTimeout> | undefined;
}

let charge: Charge | null = null;
let completedAt = -Infinity;
const CHARGE_MAX = 20;

const chargeFreq = (i: number): number => mtof(57 + 12 * i);
const chargeGain = (i: number): number => 0.045 + 0.075 * i;
const chargeCut = (i: number): number => 500 + 2200 * i;

function startCharge(g: Graph, i: number, t: number): Charge {
  const { ctx } = g;
  const v = new Voice(ctx, g.sfx);
  const amp = v.gain(0);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(chargeGain(i), t + 0.06);
  const trem = v.gain(1, amp);
  const lp = v.filter('lowpass', chargeCut(i), 1.2, trem);
  const until = t + CHARGE_MAX;
  const a = v.osc('triangle', chargeFreq(i), t, until, lp);
  const b = v.osc('sine', chargeFreq(i) * 1.5, t, until, v.gain(0.35, lp), 4);
  // A tremolo that quickens as the ring fills: "charging", without getting louder than a whisper.
  const depth = ctx.createGain();
  depth.gain.value = 0.25 * i;
  depth.connect(trem.gain);
  const lfo = v.osc('sine', 3 + 6 * i, t, until, depth);
  return { v, amp, lp, depth, a, b, lfo, level: i, lastAt: nowMs(), until, timer: undefined };
}

function steerCharge(c: Charge, i: number, t: number, tc: number): void {
  c.a.frequency.setTargetAtTime(chargeFreq(i), t, tc);
  c.b.frequency.setTargetAtTime(chargeFreq(i) * 1.5, t, tc);
  c.lp.frequency.setTargetAtTime(chargeCut(i), t, tc);
  c.amp.gain.setTargetAtTime(chargeGain(i), t, tc);
  c.depth.gain.setTargetAtTime(0.25 * i, t, tc * 2);
  c.lfo.frequency.setTargetAtTime(3 + 6 * i, t, tc * 2);
  c.level = i;
  c.lastAt = nowMs();
}

export function stopCharge(fade = 0.12): void {
  const c = charge;
  if (!c) return;
  charge = null;
  if (c.timer !== undefined) clearTimeout(c.timer);
  try {
    const t = c.v.ctx.currentTime;
    const p = c.amp.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(0, t + fade);
    for (const o of [c.a, c.b, c.lfo]) {
      try {
        o.stop(t + fade + 0.03);
      } catch {
        // Older WebKit throws on a second stop(); the safety stop still ends it.
      }
    }
  } catch {
    c.v.dispose();
  }
}

/**
 * Called as the HOLD ring fills. With `intensity` (0..1) the tone tracks it (call as often as you like; it stops
 * ~0.4 s after the last call). Without it, one call plays a self-rising tone of about a second.
 */
export function chargeHold(g: Graph, intensity: number | undefined): number {
  const t = g.ctx.currentTime + 0.005;
  const auto = intensity === undefined;
  const i = clamp01(intensity);
  if (i >= 1) {
    // The ring is full: a tiny "lock" glint, once.
    if (!charge && nowMs() - completedAt < 800) return 0;
    completedAt = nowMs();
    stopCharge(0.1);
    const v = new Voice(g.ctx, g.sfx);
    pluck(v, mtof(81), t, { gain: 0.05, decay: 0.3, wave: 'sine' });
    return pluck(v, mtof(88), t + 0.04, { gain: 0.035, decay: 0.35, wave: 'sine' }) - t;
  }
  if (charge && t > charge.until - 1) stopCharge(0.05);
  if (!charge) {
    charge = startCharge(g, i, t);
    if (auto) steerCharge(charge, 0.95, t + 0.06, 0.4);
  } else if (!auto && (Math.abs(i - charge.level) >= 0.01 || nowMs() - charge.lastAt > 40)) {
    steerCharge(charge, i, t, 0.05);
  }
  const c = charge;
  if (c.timer !== undefined) clearTimeout(c.timer);
  c.timer = setTimeout(() => {
    if (charge === c) stopCharge(0.15);
  }, auto ? 1500 : 400);
  return 0.5;
}

keepAwakeWhile(() => charge !== null);
onReconcile(() => {
  if (charge && (!soundOn() || !pageVisible())) stopCharge(0.05);
});
