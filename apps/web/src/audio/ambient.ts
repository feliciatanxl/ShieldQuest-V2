// Generative ambient pads: one per district plus the city hub. Detuned oscillator pairs drift through a slow chord
// cycle under a breathing low-pass, over a soft pink-noise "rain" bed, with the odd pentatonic glint.
// About ten native nodes and two timers per pad: effectively free on the CPU.
import type { DistrictId } from '@shieldquest/shared';
import { engine, keepAwakeWhile, liveGraph, onReconcile, report, soundOn, type Graph } from './engine';
import { noiseBuffer } from './engine';
import { Voice, mtof, pick, pluck } from './synth';

export type AmbientPlace = DistrictId | 'city';

/**
 * - `normal`: the default bed.
 * - `sober`: the music thins out after a risky choice's 3 shiny seconds (GDD tone rule 2).
 * - `glow`: brighter and more sparkly when the city lights up with protective choices (tone rule 3).
 */
export type AmbientMood = 'normal' | 'sober' | 'glow';

type Chord = readonly [number, number, number, number];

interface Preset {
  wave: OscillatorType;
  /** [bass, tone, tone, tone] as MIDI notes, voice-led so glides stay small. */
  chords: readonly Chord[];
  chordSec: number;
  cutoff: number;
  swing: number;
  /** Cents between the two oscillators of each pad voice. */
  detune: number;
  pad: number;
  bass: number;
  rain: number;
  rainHz: number;
  sparkle: readonly number[];
  sparkleWave: OscillatorType;
  sparkleEvery: readonly [number, number];
  sparkleGain: number;
  /** Notes per glint (Digi-District chirps in little data bursts). */
  sparkleBurst: number;
}

const PRESETS: Record<AmbientPlace, Preset> = {
  // The city at blue hour: D Lydian warmth, I-vi-IV-V with open voicings.
  city: {
    wave: 'sawtooth',
    chords: [
      [38, 57, 61, 64],
      [35, 57, 62, 66],
      [43, 59, 62, 66],
      [45, 57, 61, 64],
    ],
    chordSec: 11,
    cutoff: 900,
    swing: 350,
    detune: 7,
    pad: 0.026,
    bass: 0.07,
    rain: 0.03,
    rainHz: 3800,
    sparkle: [74, 76, 78, 81, 83, 86],
    sparkleWave: 'sine',
    sparkleEvery: [6, 13],
    sparkleGain: 0.03,
    sparkleBurst: 1,
  },
  // Close to Home: bright, friendly C major on soft triangles; light drizzle.
  'school-street': {
    wave: 'triangle',
    chords: [
      [36, 55, 59, 64],
      [45, 55, 60, 64],
      [41, 57, 60, 64],
      [43, 55, 59, 62],
    ],
    chordSec: 10,
    cutoff: 1400,
    swing: 500,
    detune: 6,
    pad: 0.04,
    bass: 0.06,
    rain: 0.018,
    rainHz: 3200,
    sparkle: [72, 74, 76, 79, 81, 84],
    sparkleWave: 'triangle',
    sparkleEvery: [4, 9],
    sparkleGain: 0.03,
    sparkleBurst: 1,
  },
  // The arcade: warmer F major with a little neon shimmer and brighter street hiss.
  'retail-district': {
    wave: 'sawtooth',
    chords: [
      [41, 57, 60, 64],
      [38, 57, 60, 64],
      [46, 57, 62, 65],
      [36, 55, 60, 62],
    ],
    chordSec: 9,
    cutoff: 1100,
    swing: 420,
    detune: 9,
    pad: 0.024,
    bass: 0.065,
    rain: 0.026,
    rainHz: 5200,
    sparkle: [77, 79, 81, 84, 86, 89],
    sparkleWave: 'sine',
    sparkleEvery: [5, 11],
    sparkleGain: 0.028,
    sparkleBurst: 1,
  },
  // Digi-District: hollow filtered squares in A minor/Lydian colours; glassy, curious, never menacing.
  'digi-district': {
    wave: 'square',
    chords: [
      [45, 57, 59, 64],
      [41, 57, 59, 64],
      [36, 55, 59, 64],
      [43, 55, 59, 62],
    ],
    chordSec: 12,
    cutoff: 750,
    swing: 380,
    detune: 5,
    pad: 0.02,
    bass: 0.065,
    rain: 0.014,
    rainHz: 6500,
    sparkle: [81, 84, 86, 88, 91, 93],
    sparkleWave: 'square',
    sparkleEvery: [5, 10],
    sparkleGain: 0.012,
    sparkleBurst: 3,
  },
  // Void deck: open, airy G major.
  'void-deck-commons': {
    wave: 'triangle',
    chords: [
      [43, 57, 62, 66],
      [40, 55, 59, 62],
      [36, 55, 59, 64],
      [38, 57, 59, 62],
    ],
    chordSec: 12,
    cutoff: 1300,
    swing: 450,
    detune: 5,
    pad: 0.04,
    bass: 0.06,
    rain: 0.022,
    rainHz: 3000,
    sparkle: [74, 76, 79, 81, 83, 86],
    sparkleWave: 'sine',
    sparkleEvery: [5, 12],
    sparkleGain: 0.03,
    sparkleBurst: 1,
  },
  // Interchange: steady E major, a transit-hall hum.
  interchange: {
    wave: 'sawtooth',
    chords: [
      [40, 56, 59, 63],
      [37, 56, 59, 64],
      [45, 56, 61, 64],
      [35, 54, 59, 63],
    ],
    chordSec: 10,
    cutoff: 950,
    swing: 380,
    detune: 8,
    pad: 0.024,
    bass: 0.065,
    rain: 0.024,
    rainHz: 4400,
    sparkle: [76, 78, 80, 83, 85, 88],
    sparkleWave: 'triangle',
    sparkleEvery: [6, 12],
    sparkleGain: 0.026,
    sparkleBurst: 1,
  },
};

const FADE = 1.5;

interface Pad {
  where: AmbientPlace;
  preset: Preset;
  ctx: AudioContext;
  out: GainNode;
  filter: BiquadFilterNode;
  swingDepth: GainNode;
  padGain: GainNode;
  rainGain: GainNode;
  bass: OscillatorNode;
  pairs: OscillatorNode[][];
  sources: AudioScheduledSourceNode[];
  chordIndex: number;
  chordTimer: ReturnType<typeof setTimeout> | undefined;
  sparkleTimer: ReturnType<typeof setTimeout> | undefined;
  stopTimer: ReturnType<typeof setTimeout> | undefined;
  leaving: boolean;
  /** Last applied colour key, so reconcile doesn't stack automation. */
  colour: string;
}

let current: Pad | null = null;
const leaving = new Set<Pad>();
let mood: AmbientMood = 'normal';

// ---------------------------------------------------------------------------------------------------------------
// Requests: the newest request wins (hooks and direct calls alike); `null` is an explicit request for silence.

interface Request {
  where: AmbientPlace | null;
  order: number;
}
let order = 0;
let ids = 0;
const hookRequests = new Map<number, Request>();
let manual: Request | null = null;

/** The place the newest request asks for (null = silence). */
export function wantedAmbient(): AmbientPlace | null {
  let best: Request | null = manual;
  for (const r of hookRequests.values()) if (!best || r.order > best.order) best = r;
  return best ? best.where : null;
}

/**
 * Reserves a place in the queue. Hooks reserve theirs during render (parents render before children), so a nested
 * screen's request outranks its parent's even though the child's effect runs first.
 */
export function nextAmbientOrder(): number {
  return ++order;
}

export function setManualAmbient(where: AmbientPlace | null): void {
  manual = { where, order: nextAmbientOrder() };
}

export function addAmbientRequest(where: AmbientPlace | null, at = nextAmbientOrder()): number {
  const id = ++ids;
  hookRequests.set(id, { where, order: at });
  return id;
}

export function removeAmbientRequest(id: number): void {
  hookRequests.delete(id);
}

export function currentAmbient(): AmbientPlace | null {
  return current && !current.leaving ? current.where : null;
}

export function setMood(next: AmbientMood): void {
  mood = next;
}

// ---------------------------------------------------------------------------------------------------------------
// Pad lifecycle

function colourFactors(): { cutoff: number; rain: number; pad: number; sparkle: number } {
  const calm = engine.calm;
  const m =
    mood === 'sober'
      ? { cutoff: 0.55, rain: 1.15, pad: 0.6 }
      : mood === 'glow'
        ? { cutoff: 1.45, rain: 0.8, pad: 1.1 }
        : { cutoff: 1, rain: 1, pad: 1 };
  return {
    cutoff: m.cutoff * (calm ? 0.6 : 1),
    rain: m.rain * (calm ? 0.5 : 1),
    pad: m.pad,
    // Calm Mode and sober moments drop the glints; glow doubles their rate.
    sparkle: calm || mood === 'sober' ? 0 : mood === 'glow' ? 2 : 1,
  };
}

function applyColour(pad: Pad): void {
  const key = `${engine.calm ? 'c' : '-'}${mood}`;
  if (pad.colour === key) return;
  pad.colour = key;
  const f = colourFactors();
  const t = pad.ctx.currentTime;
  const p = pad.preset;
  pad.filter.frequency.setTargetAtTime(p.cutoff * f.cutoff, t, 1.2);
  pad.swingDepth.gain.setTargetAtTime(p.swing * f.cutoff * 0.9, t, 1.2);
  pad.rainGain.gain.setTargetAtTime(p.rain * f.rain, t, 1.2);
  pad.padGain.gain.setTargetAtTime(p.pad * f.pad, t, 0.8);
}

function lfo(
  ctx: AudioContext,
  hz: number,
  depth: number,
  target: AudioParam,
  t: number,
  sources: AudioScheduledSourceNode[],
): GainNode {
  const o = ctx.createOscillator();
  o.frequency.value = hz;
  const g = ctx.createGain();
  g.gain.value = depth;
  o.connect(g);
  g.connect(target);
  o.start(t);
  sources.push(o);
  return g;
}

function createPad(g: Graph, where: AmbientPlace): Pad {
  const { ctx } = g;
  // Unknown places (content added before a preset exists) fall back to the city bed.
  const p = PRESETS[where] ?? PRESETS.city;
  const t = ctx.currentTime + 0.02;
  const sources: AudioScheduledSourceNode[] = [];
  const f = colourFactors();

  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(1, t + FADE);
  out.connect(g.ambient);

  const breath = ctx.createGain();
  breath.gain.value = 0.85;
  breath.connect(out);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.6;
  filter.frequency.value = p.cutoff * f.cutoff;
  filter.connect(breath);

  const padGain = ctx.createGain();
  padGain.gain.value = p.pad * f.pad;
  padGain.connect(filter);

  const chord = pick(p.chords, 0, [38, 57, 61, 64] as const);
  const pairs: OscillatorNode[][] = [];
  for (let i = 1; i <= 3; i++) {
    const freq = mtof(chord[i] ?? 60);
    const pair: OscillatorNode[] = [];
    for (const sign of [-1, 1]) {
      const o = ctx.createOscillator();
      o.type = p.wave;
      o.frequency.value = freq;
      o.detune.value = sign * p.detune;
      o.connect(padGain);
      // Staggered starts give the pair random relative phase.
      o.start(t + Math.random() * 0.05);
      sources.push(o);
      pair.push(o);
    }
    pairs.push(pair);
  }

  const bassGain = ctx.createGain();
  bassGain.gain.value = p.bass;
  bassGain.connect(breath);
  const bass = ctx.createOscillator();
  bass.type = 'sine';
  bass.frequency.value = mtof(chord[0]);
  bass.connect(bassGain);
  bass.start(t);
  sources.push(bass);

  // Rain: looping pink noise, band-limited, gently swelling.
  const rainGain = ctx.createGain();
  rainGain.gain.value = p.rain * f.rain;
  rainGain.connect(out);
  const rainLp = ctx.createBiquadFilter();
  rainLp.type = 'lowpass';
  rainLp.frequency.value = Math.min(p.rainHz, ctx.sampleRate * 0.45);
  rainLp.connect(rainGain);
  const rainHp = ctx.createBiquadFilter();
  rainHp.type = 'highpass';
  rainHp.frequency.value = 700;
  rainHp.connect(rainLp);
  const rain = ctx.createBufferSource();
  rain.buffer = noiseBuffer(ctx, 'pink');
  rain.loop = true;
  rain.playbackRate.value = 0.93;
  rain.connect(rainHp);
  rain.start(t, Math.random() * 1.5);
  sources.push(rain);

  // Slow modulation, all native: the filter breathes, the pad swells, the rain comes and goes.
  const swingDepth = lfo(ctx, 0.045, p.swing * f.cutoff * 0.9, filter.frequency, t, sources);
  lfo(ctx, 0.09, 0.12, breath.gain, t, sources);
  lfo(ctx, 0.13, p.rain * 0.35, rainGain.gain, t, sources);

  const pad: Pad = {
    where,
    preset: p,
    ctx,
    out,
    filter,
    swingDepth,
    padGain,
    rainGain,
    bass,
    pairs,
    sources,
    chordIndex: 0,
    chordTimer: undefined,
    sparkleTimer: undefined,
    stopTimer: undefined,
    leaving: false,
    colour: `${engine.calm ? 'c' : '-'}${mood}`,
  };
  scheduleChord(pad);
  scheduleSparkle(pad);
  return pad;
}

function scheduleChord(pad: Pad): void {
  const secs = pad.preset.chordSec * (0.8 + Math.random() * 0.45) * (engine.calm ? 1.5 : 1);
  pad.chordTimer = setTimeout(() => {
    try {
      nextChord(pad);
    } catch (err) {
      report('ambient chord', err);
    }
    scheduleChord(pad);
  }, secs * 1000);
}

function nextChord(pad: Pad): void {
  const n = pad.preset.chords.length;
  // Mostly step forward; now and then skip one so the cycle never feels like a loop.
  pad.chordIndex = (pad.chordIndex + (n > 3 && Math.random() < 0.25 ? 2 : 1)) % n;
  const chord = pick(pad.preset.chords, pad.chordIndex, pad.preset.chords[0] ?? [38, 57, 61, 64]);
  const t = pad.ctx.currentTime;
  pad.bass.frequency.setTargetAtTime(mtof(chord[0]), t, 0.9);
  pad.pairs.forEach((pair, i) => {
    const f = mtof(chord[i + 1] ?? 60);
    for (const o of pair) o.frequency.setTargetAtTime(f, t, 0.6);
  });
}

function scheduleSparkle(pad: Pad): void {
  const [a, b] = pad.preset.sparkleEvery;
  const rate = colourFactors().sparkle || 1;
  const secs = (a + Math.random() * (b - a)) / rate;
  pad.sparkleTimer = setTimeout(() => {
    try {
      if (colourFactors().sparkle > 0 && !engine.frozen && pad.ctx.state === 'running') sparkle(pad);
    } catch (err) {
      report('ambient sparkle', err);
    }
    scheduleSparkle(pad);
  }, secs * 1000);
}

function sparkle(pad: Pad): void {
  const p = pad.preset;
  const v = new Voice(pad.ctx, pad.out);
  const dest = v.pan(Math.random() * 1.2 - 0.6);
  const t = pad.ctx.currentTime + 0.02;
  let i = Math.floor(Math.random() * p.sparkle.length);
  for (let k = 0; k < p.sparkleBurst; k++) {
    const m = pick(p.sparkle, Math.min(i, p.sparkle.length - 1), 81);
    pluck(v, mtof(m), t + k * 0.11, { gain: p.sparkleGain, decay: 1.2, wave: p.sparkleWave, bright: 3, dest });
    i = (i + 1 + Math.floor(Math.random() * 2)) % p.sparkle.length;
  }
}

function clearTimers(pad: Pad): void {
  if (pad.chordTimer !== undefined) clearTimeout(pad.chordTimer);
  if (pad.sparkleTimer !== undefined) clearTimeout(pad.sparkleTimer);
  if (pad.stopTimer !== undefined) clearTimeout(pad.stopTimer);
  pad.chordTimer = pad.sparkleTimer = pad.stopTimer = undefined;
}

function fadeOut(pad: Pad): void {
  if (pad.leaving) return;
  pad.leaving = true;
  leaving.add(pad);
  clearTimers(pad);
  const t = pad.ctx.currentTime;
  const p = pad.out.gain;
  p.cancelScheduledValues(t);
  p.setValueAtTime(p.value, t);
  p.linearRampToValueAtTime(0, t + FADE);
  pad.stopTimer = setTimeout(() => destroy(pad), FADE * 1000 + 150);
}

function revive(pad: Pad): void {
  clearTimers(pad);
  leaving.delete(pad);
  pad.leaving = false;
  const t = pad.ctx.currentTime;
  const p = pad.out.gain;
  p.cancelScheduledValues(t);
  p.setValueAtTime(p.value, t);
  p.linearRampToValueAtTime(1, t + 1);
  scheduleChord(pad);
  scheduleSparkle(pad);
}

function destroy(pad: Pad): void {
  clearTimers(pad);
  leaving.delete(pad);
  const t = pad.ctx.currentTime + 0.05;
  for (const s of pad.sources) {
    try {
      s.stop(t);
    } catch {
      // already stopped
    }
  }
  setTimeout(() => {
    try {
      pad.out.disconnect();
    } catch {
      // already gone
    }
  }, 200);
}

function reconcileAmbient(): void {
  const g = engine.graph;
  const want = g && soundOn() && engine.profile !== 'squad-phone' ? wantedAmbient() : null;

  if (current && current.where === want) {
    if (current.leaving) revive(current);
    applyColour(current);
    return;
  }
  // Quick back-and-forth (route change, React StrictMode remount) revives the pad that is still fading out.
  const back = want ? [...leaving].find((p) => p.where === want) : undefined;
  if (current) fadeOut(current);
  current = null;
  if (back) {
    revive(back);
    applyColour(back);
    current = back;
  } else if (want && g) {
    current = createPad(g, want);
  }
  // A new pad on an idle-suspended context needs the clock running.
  if (current) liveGraph();
}

keepAwakeWhile(() => current !== null || leaving.size > 0);
onReconcile(reconcileAmbient);
