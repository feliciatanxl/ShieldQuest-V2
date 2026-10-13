// Small synthesis toolkit: a disposable Voice (a bundle of nodes that cleans itself up) and envelope helpers.
import { FLOOR, noiseBuffer, nyquist } from './engine';

export const mtof = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

export const clamp01 = (x: number | undefined): number =>
  Number.isFinite(x) ? Math.min(1, Math.max(0, x as number)) : 0;

/** Safe array pick under noUncheckedIndexedAccess. */
export function pick<T>(list: readonly T[], i: number, fallback: T): T {
  return list[i] ?? fallback;
}

let voices = 0;
/** Voices still sounding (used to cap polyphony on slow phones). */
export const liveVoices = (): number => voices;

/**
 * A one-shot sound: every node hangs off `out`, and the whole chain disconnects itself when its last source ends.
 * Builders take a `dest` and return the new node, so chains read source → ... → out.
 */
export class Voice {
  readonly out: GainNode;
  private pending = 0;
  private disposed = false;

  constructor(
    readonly ctx: AudioContext,
    dest: AudioNode,
    level = 1,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = level;
    this.out.connect(dest);
    voices++;
  }

  hz(f: number): number {
    return Math.min(nyquist(this.ctx), Math.max(10, f));
  }

  gain(value: number, dest: AudioNode = this.out): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = value;
    g.connect(dest);
    return g;
  }

  filter(type: BiquadFilterType, freq: number, q = 0.7, dest: AudioNode = this.out): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = this.hz(freq);
    f.Q.value = q;
    f.connect(dest);
    return f;
  }

  /** Stereo position -1..1 (falls back to centre where StereoPanner is missing). */
  pan(value: number, dest: AudioNode = this.out): AudioNode {
    if (typeof this.ctx.createStereoPanner !== 'function') return this.gain(1, dest);
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, value));
    p.connect(dest);
    return p;
  }

  osc(type: OscillatorType, freq: number, start: number, stop: number, dest: AudioNode = this.out, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(this.hz(freq), start);
    if (detune) o.detune.value = detune;
    o.connect(dest);
    o.start(start);
    o.stop(Math.max(start + 0.01, stop));
    this.track(o);
    return o;
  }

  /** Looped noise from a shared buffer, started at a random offset so repeats never sound identical. */
  noise(start: number, stop: number, dest: AudioNode = this.out, rate = 1, kind: 'white' | 'pink' = 'white') {
    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuffer(this.ctx, kind);
    src.loop = true;
    src.playbackRate.setValueAtTime(rate, start);
    src.connect(dest);
    src.start(start, Math.random() * 1.5);
    src.stop(Math.max(start + 0.01, stop));
    this.track(src);
    return src;
  }

  private track(src: AudioScheduledSourceNode): void {
    this.pending++;
    src.onended = () => {
      try {
        src.disconnect();
      } catch {
        // already gone
      }
      if (--this.pending <= 0) this.dispose();
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    voices = Math.max(0, voices - 1);
    try {
      this.out.disconnect();
    } catch {
      // already gone
    }
  }
}

/** Linear attack to `peak`, exponential decay to silence. Returns the end time. */
export function ad(p: AudioParam, t: number, attack: number, peak: number, decay: number): number {
  const top = Math.max(peak, FLOOR * 2);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(top, t + attack);
  p.exponentialRampToValueAtTime(FLOOR, t + attack + decay);
  return t + attack + decay;
}

/** Attack, hold, release: for swells and chords. Returns the end time. */
export function ahr(p: AudioParam, t: number, attack: number, peak: number, hold: number, release: number): number {
  const top = Math.max(peak, FLOOR * 2);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(top, t + attack);
  p.setValueAtTime(top, t + attack + hold);
  p.exponentialRampToValueAtTime(FLOOR, t + attack + hold + release);
  return t + attack + hold + release;
}

/** A reversed envelope: grows exponentially to `peak` at `t + rise`, then cuts off. Returns the end time. */
export function swell(p: AudioParam, t: number, rise: number, peak: number, cut = 0.03): number {
  p.setValueAtTime(FLOOR, t);
  p.exponentialRampToValueAtTime(Math.max(peak, FLOOR * 2), t + rise);
  p.linearRampToValueAtTime(0, t + rise + cut);
  return t + rise + cut;
}

export interface PluckOpts {
  gain?: number;
  decay?: number;
  wave?: OscillatorType;
  /** Filter opening as a multiple of the pitch. */
  bright?: number;
  dest?: AudioNode;
}

/** A soft plucked note: triangle + octave sine through a closing low-pass. Returns the end time. */
export function pluck(v: Voice, freq: number, t: number, o: PluckOpts = {}): number {
  const { gain = 0.1, decay = 0.6, wave = 'triangle', bright = 6, dest = v.out } = o;
  const amp = v.gain(0, dest);
  const lp = v.filter('lowpass', freq * bright, 0.8, amp);
  lp.frequency.setValueAtTime(v.hz(freq * bright), t);
  lp.frequency.exponentialRampToValueAtTime(v.hz(freq * 1.5), t + decay * 0.6);
  const end = ad(amp.gain, t, 0.004, gain, decay);
  v.osc(wave, freq, t, end + 0.02, lp);
  v.osc('sine', freq * 2, t, end + 0.02, v.gain(0.25, lp));
  return end;
}

// Partials of a soft, slightly inharmonic bell: [ratio, level, decay factor].
const BELL: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 1],
  [2, 0.42, 0.62],
  [2.76, 0.26, 0.42],
  [4.07, 0.14, 0.28],
  [5.4, 0.06, 0.18],
];

/** Additive bell. Returns the end time. */
export function bell(v: Voice, freq: number, t: number, o: { gain?: number; decay?: number; dest?: AudioNode } = {}) {
  const { gain = 0.12, decay = 1.6, dest = v.out } = o;
  let end = t;
  for (const [ratio, level, df] of BELL) {
    const f = freq * ratio;
    if (f > nyquist(v.ctx) * 0.9) continue;
    const amp = v.gain(0, dest);
    const e = ad(amp.gain, t, 0.006, gain * level, decay * df);
    v.osc('sine', f, t, e + 0.02, amp);
    end = Math.max(end, e);
  }
  return end;
}

export interface NoiseHitOpts {
  type?: BiquadFilterType;
  freq?: number;
  /** Sweeps the filter to this frequency over the hit. */
  to?: number;
  q?: number;
  gain?: number;
  attack?: number;
  rate?: number;
  dest?: AudioNode;
}

/** A filtered noise burst (clicks, swishes, paper). Returns the end time. */
export function noiseHit(v: Voice, t: number, dur: number, o: NoiseHitOpts = {}): number {
  const { type = 'bandpass', freq = 2000, to, q = 1, gain = 0.05, attack = 0.004, rate = 1, dest = v.out } = o;
  const amp = v.gain(0, dest);
  const f = v.filter(type, freq, q, amp);
  if (to !== undefined) {
    f.frequency.setValueAtTime(v.hz(freq), t);
    f.frequency.exponentialRampToValueAtTime(v.hz(to), t + dur);
  }
  const end = ad(amp.gain, t, Math.min(attack, dur * 0.5), gain, Math.max(0.005, dur - attack));
  v.noise(t, end + 0.02, f, rate);
  return end;
}
