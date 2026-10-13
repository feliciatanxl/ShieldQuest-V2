// The audio module runs against a strict fake Web Audio implementation: it throws wherever a real browser would
// (non-finite values, exponential ramps to zero, double start, cross-context connects), so every recipe is checked
// for the mistakes that make real devices go silent.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettings } from '../state/settings';
import { __resetEngineForTests, engine } from './engine';
import {
  HAPTICS,
  SFX_CAPTIONS,
  audioStatus,
  haptic,
  motifCaption,
  playMotif,
  playSfx,
  setAmbientMood,
  setAudioProfile,
  setCalmMode,
  setTension,
  startAmbient,
  stopAmbient,
  unlockAudio,
  type Sfx,
} from './sfx';
import { liveVoices } from './synth';
import { tensionPeriod } from './tension';
import { MOTIF_NOTES, clueNote, motifNote } from './voices';

// ---------------------------------------------------------------------------------------------------------------
// Strict fake Web Audio

function finite(v: number, what: string): void {
  if (!Number.isFinite(v)) throw new TypeError(`${what}: non-finite ${v}`);
}

class FakeParam {
  readonly events: string[] = [];
  constructor(
    readonly ctx: FakeContext,
    public value: number,
  ) {}
  private time(t: number, what: string): void {
    finite(t, what);
    if (t < 0) throw new RangeError(`${what}: negative time ${t}`);
  }
  setValueAtTime(v: number, t: number): this {
    finite(v, 'setValueAtTime');
    this.time(t, 'setValueAtTime');
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number, t: number): this {
    finite(v, 'linearRamp');
    this.time(t, 'linearRamp');
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number): this {
    finite(v, 'expRamp');
    if (v === 0) throw new RangeError('expRamp: value must be non-zero');
    this.time(t, 'expRamp');
    this.value = v;
    return this;
  }
  setTargetAtTime(v: number, t: number, tc: number): this {
    finite(v, 'setTarget');
    finite(tc, 'setTarget tc');
    if (tc < 0) throw new RangeError('setTarget: negative time constant');
    this.time(t, 'setTarget');
    this.value = v;
    return this;
  }
  cancelScheduledValues(t: number): this {
    this.time(t, 'cancel');
    return this;
  }
}

class FakeNode {
  readonly outs = new Set<FakeNode | FakeParam>();
  constructor(readonly ctx: FakeContext) {
    ctx.nodes.push(this);
  }
  connect<T extends FakeNode | FakeParam>(dest: T): T {
    if (dest.ctx !== this.ctx) throw new Error('connect: different context');
    this.outs.add(dest);
    return dest;
  }
  disconnect(): void {
    this.outs.clear();
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam(this.ctx, 1);
}

class FakeFilter extends FakeNode {
  type: BiquadFilterType = 'lowpass';
  readonly frequency = new FakeParam(this.ctx, 350);
  readonly Q = new FakeParam(this.ctx, 1);
}

class FakePanner extends FakeNode {
  readonly pan = new FakeParam(this.ctx, 0);
}

class FakeCompressor extends FakeNode {
  readonly threshold = new FakeParam(this.ctx, -24);
  readonly knee = new FakeParam(this.ctx, 30);
  readonly ratio = new FakeParam(this.ctx, 12);
  readonly attack = new FakeParam(this.ctx, 0.003);
  readonly release = new FakeParam(this.ctx, 0.25);
}

class FakeSource extends FakeNode {
  startAt: number | null = null;
  stopAt: number | null = null;
  ended = false;
  onended: (() => void) | null = null;
  constructor(ctx: FakeContext) {
    super(ctx);
    ctx.sources.push(this);
  }
  start(when = 0, offset = 0): void {
    finite(when, 'start');
    finite(offset, 'start offset');
    if (when < 0 || offset < 0) throw new RangeError('start: negative');
    if (this.startAt !== null) throw new Error('InvalidStateError: start called twice');
    this.startAt = when;
  }
  stop(when = 0): void {
    finite(when, 'stop');
    if (when < 0) throw new RangeError('stop: negative');
    if (this.startAt === null) throw new Error('InvalidStateError: stop before start');
    this.stopAt = this.stopAt === null ? when : Math.min(this.stopAt, when);
  }
  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.onended?.();
  }
}

class FakeOsc extends FakeSource {
  type: OscillatorType = 'sine';
  readonly frequency = new FakeParam(this.ctx, 440);
  readonly detune = new FakeParam(this.ctx, 0);
}

class FakeBufferSource extends FakeSource {
  buffer: unknown = null;
  loop = false;
  readonly playbackRate = new FakeParam(this.ctx, 1);
}

class FakeContext {
  static instances: FakeContext[] = [];
  readonly sampleRate = 48000;
  currentTime = 0;
  state: AudioContextState = 'suspended';
  readonly nodes: FakeNode[] = [];
  readonly sources: FakeSource[] = [];
  readonly destination: FakeNode;
  private listeners: Array<() => void> = [];
  onstatechange: (() => void) | null = null;

  constructor() {
    this.destination = new FakeNode(this);
    FakeContext.instances.push(this);
  }
  addEventListener(_type: string, fn: () => void): void {
    this.listeners.push(fn);
  }
  private setState(s: AudioContextState): void {
    this.state = s;
    for (const fn of this.listeners) fn();
  }
  resume(): Promise<void> {
    this.setState('running');
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.setState('suspended');
    return Promise.resolve();
  }
  createGain(): FakeGain {
    return new FakeGain(this);
  }
  createBiquadFilter(): FakeFilter {
    return new FakeFilter(this);
  }
  createStereoPanner(): FakePanner {
    return new FakePanner(this);
  }
  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor(this);
  }
  createOscillator(): FakeOsc {
    return new FakeOsc(this);
  }
  createBufferSource(): FakeBufferSource {
    return new FakeBufferSource(this);
  }
  createBuffer(_channels: number, length: number, sampleRate: number) {
    finite(length, 'createBuffer');
    const data = new Float32Array(length);
    return { length, sampleRate, duration: length / sampleRate, getChannelData: () => data };
  }
  /** Moves the audio clock and fires `onended` for every source whose stop time has passed. */
  advance(seconds: number): void {
    this.currentTime += seconds;
    for (const s of this.sources) if (s.stopAt !== null && s.stopAt <= this.currentTime) s.end();
  }
}

const ALL_SFX: Sfx[] = [
  'tap',
  'holdCharge',
  'freeze',
  'release',
  'tick',
  'message',
  'clue',
  'clueOk',
  'seal',
  'reveal',
  'aftershock',
  'afterglow',
  'unfold',
  'surge',
  'success',
  'soft-fail',
  'pageTurn',
];

const ctx = (): FakeContext => {
  const c = FakeContext.instances.at(-1);
  if (!c) throw new Error('no context created');
  return c;
};

/** Runs `fn` and returns the sources it created. */
function created(fn: () => void): FakeSource[] {
  const c = FakeContext.instances.at(-1);
  const before = c ? c.sources.length : 0;
  fn();
  return (FakeContext.instances.at(-1)?.sources ?? []).slice(before);
}

// ---------------------------------------------------------------------------------------------------------------

describe('audio without Web Audio support', () => {
  it('stays silent and never throws', () => {
    vi.stubGlobal('AudioContext', undefined);
    __resetEngineForTests();
    expect(() => {
      unlockAudio();
      for (const name of ALL_SFX) playSfx(name, { intensity: 0.5, step: 3 });
      playMotif([true, false, true, false, true, false]);
      startAmbient('city');
      setTension(0.7);
      setTension(0);
      stopAmbient();
      haptic([10, 20, 10]);
    }).not.toThrow();
    expect(audioStatus().supported).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('audio engine on a strict fake', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'] });
  });
  afterAll(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    vi.stubGlobal('AudioContext', FakeContext);
    __resetEngineForTests();
    stopAmbient();
    setTension(0);
    setAudioProfile('solo');
    setCalmMode(false);
    setAmbientMood('normal');
    useSettings.setState({ sound: true, haptics: true });
    unlockAudio();
    engine.lastError = null;
    vi.advanceTimersByTime(1000);
  });
  afterEach(() => {
    stopAmbient();
    setTension(0);
    vi.advanceTimersByTime(5000);
    // Let every scheduled voice finish so the next test starts with an empty voice count.
    ctx().advance(60);
  });

  it('unlocks into a running context with a compressor on the output', () => {
    const c = ctx();
    expect(c.state).toBe('running');
    expect(c.nodes.some((n) => n instanceof FakeCompressor && n.outs.has(c.destination))).toBe(true);
  });

  it('suspends after a quiet spell to save battery, and wakes for the next cue', () => {
    const c = ctx();
    vi.advanceTimersByTime(25_000);
    expect(c.state).toBe('suspended');
    playSfx('clue');
    expect(c.state).toBe('running');
    startAmbient('city');
    vi.advanceTimersByTime(60_000);
    expect(c.state, 'ambience keeps it awake').toBe('running');
  });

  it('plays every cue without a single Web Audio error, and every one-shot ends itself', () => {
    for (const name of ALL_SFX) {
      if (name === 'holdCharge') continue;
      for (const intensity of [undefined, 0, 0.5, 1, 7, Number.NaN]) {
        const sources = created(() => playSfx(name, { intensity, step: 4 }));
        expect(engine.lastError, name).toBeNull();
        expect(sources.length, `${name} makes sound`).toBeGreaterThan(0);
        for (const s of sources) {
          expect(s.startAt, name).not.toBeNull();
          expect(s.stopAt, `${name} stops`).not.toBeNull();
          expect((s.stopAt ?? 0) - (s.startAt ?? 0), `${name} is short`).toBeLessThan(3.5);
        }
        vi.advanceTimersByTime(200);
        ctx().advance(4);
      }
      playSfx('release');
      vi.advanceTimersByTime(200);
    }
    ctx().advance(10);
    expect(liveVoices()).toBe(0);
  });

  it('treats odd steps (negative, huge, fractional, NaN) as valid notes', () => {
    for (const step of [-3, 0, 2.7, 9, 40, 1e9, Number.NaN, Number.POSITIVE_INFINITY]) {
      playSfx('clue', { step });
      playSfx('reveal', { step });
      vi.advanceTimersByTime(100);
    }
    expect(engine.lastError).toBeNull();
  });

  it('collapses identical cues fired in the same instant', () => {
    const sources = created(() => {
      playSfx('tap');
      playSfx('tap');
      playSfx('tap');
    });
    const single = created(() => {
      vi.advanceTimersByTime(100);
      playSfx('tap');
    });
    expect(sources.length).toBe(single.length);
  });

  it('follows the HOLD ring with one voice, then glints once when full', () => {
    const first = created(() => playSfx('holdCharge', { intensity: 0 }));
    expect(first.length).toBeGreaterThan(0);
    for (let i = 1; i < 10; i++) {
      const more = created(() => playSfx('holdCharge', { intensity: i / 10 }));
      expect(more.length, 'reuses the charge voice').toBe(0);
      vi.advanceTimersByTime(50);
    }
    const glint = created(() => playSfx('holdCharge', { intensity: 1 }));
    expect(glint.length).toBeGreaterThan(0);
    for (const s of first) expect(s.stopAt).not.toBeNull();
    expect(engine.lastError).toBeNull();
  });

  it('auto-rises and stops itself when the caller gives no intensity', () => {
    const sources = created(() => playSfx('holdCharge'));
    expect(sources.length).toBeGreaterThan(0);
    vi.advanceTimersByTime(2000);
    for (const s of sources) expect(s.stopAt).not.toBeNull();
    expect(engine.lastError).toBeNull();
  });

  it('plays the motif for any lit pattern', () => {
    const patterns: boolean[][] = [
      [],
      [true],
      [true, true, true, true, true, true],
      [false, true, false, true, false, true],
    ];
    for (const lit of patterns) {
      expect(created(() => playMotif(lit)).length).toBeGreaterThan(0);
      vi.advanceTimersByTime(500);
    }
    expect(engine.lastError).toBeNull();
  });

  it('freeze muffles the world and stops the clock; release or a new live clock thaws it', () => {
    playSfx('freeze');
    expect(audioStatus().frozen).toBe(true);
    playSfx('release');
    expect(audioStatus().frozen).toBe(false);
    playSfx('freeze');
    setTension(0.4);
    expect(audioStatus().frozen).toBe(false);
  });

  it('ticks faster as tension rises, and stops at zero', () => {
    const c = ctx();
    const ticksIn = (level: number, ms: number): number =>
      created(() => {
        setTension(level);
        for (let t = 0; t < ms; t += 50) {
          c.advance(0.05);
          vi.advanceTimersByTime(50);
        }
      }).length;
    const slow = ticksIn(0.05, 6000);
    const fast = ticksIn(1, 6000);
    expect(slow).toBeGreaterThan(0);
    expect(fast).toBeGreaterThan(slow * 2);
    setTension(0);
    expect(ticksIn(0, 3000)).toBe(0);
    expect(engine.lastError).toBeNull();
  });

  it('keeps one ambient pad at a time, cycles chords, and fades out', () => {
    const c = ctx();
    const places = ['city', 'school-street', 'retail-district', 'digi-district', 'void-deck-commons', 'interchange'] as const;
    for (const where of places) {
      startAmbient(where);
      expect(audioStatus().ambient).toBe(where);
      vi.advanceTimersByTime(30_000);
      c.advance(30);
    }
    setAmbientMood('sober');
    setAmbientMood('glow');
    setCalmMode(true);
    vi.advanceTimersByTime(20_000);
    stopAmbient();
    expect(audioStatus().ambient).toBeNull();
    vi.advanceTimersByTime(3000);
    c.advance(3);
    // (A one-sample, non-looping unlock blip ends on its own.)
    const looping = c.sources.filter(
      (s) => s.startAt !== null && s.stopAt === null && !(s instanceof FakeBufferSource && !s.loop),
    );
    expect(looping.length, 'no pad left running').toBe(0);
    expect(engine.lastError).toBeNull();
  });

  it('classroom phones get only quiet UI cues and no ambience or clock', () => {
    setAudioProfile('squad-phone');
    expect(created(() => playSfx('aftershock')).length).toBe(0);
    expect(created(() => playSfx('soft-fail')).length).toBe(0);
    expect(created(() => playSfx('tap')).length).toBeGreaterThan(0);
    startAmbient('city');
    expect(audioStatus().ambient).toBeNull();
    expect(created(() => {
      setTension(1);
      vi.advanceTimersByTime(2000);
    }).length).toBe(0);
    setAudioProfile('solo');
  });

  it('Calm Mode mutes pressure sounds', () => {
    setCalmMode(true);
    expect(created(() => playSfx('surge')).length).toBe(0);
    expect(created(() => playSfx('tick')).length).toBe(0);
    expect(created(() => playSfx('message')).length).toBeGreaterThan(0);
    setCalmMode(false);
  });

  it('is silent when sound is off', () => {
    useSettings.setState({ sound: false });
    expect(created(() => playSfx('success')).length).toBe(0);
    expect(created(() => playMotif([true, true, true, true, true, true])).length).toBe(0);
    useSettings.setState({ sound: true });
  });
});

describe('haptics', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('vibrates short, clamped patterns only when the setting is on', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate, userActivation: { hasBeenActive: true, isActive: true } });
    useSettings.setState({ haptics: true });
    haptic(60);
    haptic([20, 5000, Number.NaN, -4]);
    haptic(0);
    expect(vibrate).toHaveBeenNthCalledWith(1, 60);
    expect(vibrate).toHaveBeenNthCalledWith(2, [20, 400, 0, 0]);
    expect(vibrate).toHaveBeenCalledTimes(2);
    useSettings.setState({ haptics: false });
    haptic(HAPTICS.freeze);
    expect(vibrate).toHaveBeenCalledTimes(2);
    useSettings.setState({ haptics: true });
  });

  it('waits for the first tap and survives browsers without vibrate', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate, userActivation: { hasBeenActive: false, isActive: false } });
    haptic(30);
    expect(vibrate).not.toHaveBeenCalled();
    vi.stubGlobal('navigator', {});
    expect(() => haptic([10, 10, 10])).not.toThrow();
  });
});

describe('musical rules', () => {
  const D_PENTATONIC = new Set([2, 4, 6, 9, 11]);

  it('clue plucks climb a D major pentatonic ladder', () => {
    const notes = Array.from({ length: 10 }, (_, i) => clueNote(i));
    for (let i = 1; i < notes.length; i++) expect(notes[i]).toBeGreaterThan(notes[i - 1] ?? 0);
    for (const n of notes) expect(D_PENTATONIC.has(n % 12)).toBe(true);
    for (const n of [clueNote(25), clueNote(-1), clueNote(Number.NaN)]) expect(D_PENTATONIC.has(n % 12)).toBe(true);
  });

  it('the S.H.I.E.L.D. motif is six pentatonic notes, one per letter', () => {
    expect(MOTIF_NOTES).toHaveLength(6);
    for (let i = 0; i < 6; i++) expect(D_PENTATONIC.has(motifNote(i) % 12)).toBe(true);
    expect(motifNote(6)).toBe(motifNote(0));
  });

  it('the live clock runs from ~1.2 s down to ~0.35 s between ticks', () => {
    expect(tensionPeriod(0)).toBeCloseTo(1.2);
    expect(tensionPeriod(1)).toBeCloseTo(0.35);
    expect(tensionPeriod(0.5)).toBeLessThan(tensionPeriod(0.25));
    expect(tensionPeriod(5)).toBeCloseTo(0.35);
  });
});

describe('captions', () => {
  it('every meaningful sound has a bracketed caption; quiet UI cues have none', () => {
    const quiet: Sfx[] = ['tap', 'holdCharge', 'pageTurn'];
    for (const name of ALL_SFX) {
      const text = SFX_CAPTIONS[name];
      if (quiet.includes(name)) expect(text).toBeUndefined();
      else expect(text).toMatch(/^\[.+\]$/);
    }
  });

  it('describes the motif by how many notes ring', () => {
    expect(motifCaption([true, true, false, false, false, false])).toContain('2 of 6');
    expect(motifCaption([true, true, true, true, true, true])).toContain('all six');
    expect(motifCaption([])).toContain('quiet');
  });
});
