// Live-phase tension: a clock that ticks faster as the manipulator's pressure builds.
// A lookahead scheduler on the audio clock keeps ticks steady even when the main thread is busy rendering 3D.
import { engine, keepAwakeWhile, liveGraph, onReconcile, pageVisible, report, soundOn, touch } from './engine';
import { clamp01 } from './synth';
import { tickAt } from './voices';

const SLOWEST = 1.2;
const FASTEST = 0.35;
const LOOKAHEAD = 0.15;

let level = 0;
let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let nextAt = 0;
let lastAt = -Infinity;
let count = 0;

/** Seconds between ticks: exponential, so each step up in tension feels like the same amount of hurry. */
export function tensionPeriod(l: number): number {
  return SLOWEST * Math.pow(FASTEST / SLOWEST, clamp01(l));
}

export function tensionLevel(): number {
  return level;
}

/** The clock is muted while time is frozen, in Calm Mode, on classroom phones, and whenever sound can't play. */
function audible(): boolean {
  return (
    level > 0 &&
    engine.graph !== null &&
    !engine.frozen &&
    !engine.calm &&
    engine.profile !== 'squad-phone' &&
    soundOn() &&
    pageVisible()
  );
}

/** Whether the ticking would be heard on this device (used for captions). */
export function tensionHeard(): boolean {
  return level > 0 && !engine.frozen && !engine.calm && engine.profile !== 'squad-phone' && soundOn();
}

function pump(): void {
  timer = undefined;
  if (!running) return;
  try {
    // liveGraph() also wakes an idle-suspended context.
    const g = liveGraph();
    if (!g || g.ctx.state !== 'running') {
      // Waiting for a gesture or a resume: poll gently rather than spin.
      timer = setTimeout(pump, 250);
      return;
    }
    const now = g.ctx.currentTime;
    if (nextAt < now + 0.01) nextAt = now + 0.03;
    while (nextAt < now + LOOKAHEAD) {
      tickAt(g.ctx, g.tension, nextAt, level, count++ % 2 === 1);
      lastAt = nextAt;
      nextAt += tensionPeriod(level);
    }
    touch(1);
    timer = setTimeout(pump, Math.max(25, (nextAt - now - LOOKAHEAD + 0.03) * 1000));
  } catch (err) {
    report('tension', err);
    running = false;
  }
}

function reconcileTension(): void {
  const should = audible();
  if (should && !running) {
    running = true;
    nextAt = 0;
    count = 0;
    pump();
  } else if (!should && running) {
    running = false;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
}

export function setTensionLevel(l: number): void {
  const next = clamp01(l);
  if (next === level) return;
  level = next;
  if (running && level > 0) {
    // Pull the next tick in if the clock just sped up, then re-plan right away.
    nextAt = Math.min(nextAt, lastAt + tensionPeriod(level));
    if (timer !== undefined) clearTimeout(timer);
    pump();
  }
  reconcileTension();
}

keepAwakeWhile(() => running);
onReconcile(reconcileTension);
