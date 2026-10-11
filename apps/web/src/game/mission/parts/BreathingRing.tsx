import { useEffect, useRef, useState } from 'react';
import './parts.css';

export interface BreathingRingProps {
  /** Lock length in seconds (the seal stays locked until it ends). */
  seconds?: number;
  /** Stops the countdown (Pause screen). */
  paused?: boolean;
  onDone: () => void;
}

const PHASE_SEC = 2.5;

/** 10-second calm lock before sealing: a slow ring with "Breathe in… breathe out" and a visible countdown. */
export function BreathingRing({ seconds = 10, paused, onDone }: BreathingRingProps) {
  const [elapsed, setElapsed] = useState(0);
  const done = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (paused || done.current) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      setElapsed((e) => Math.min(seconds, e + dt));
    }, 200);
    return () => window.clearInterval(id);
  }, [paused, seconds]);

  useEffect(() => {
    if (elapsed >= seconds && !done.current) {
      done.current = true;
      onDoneRef.current();
    }
  }, [elapsed, seconds]);

  const left = Math.max(0, Math.ceil(seconds - elapsed));
  const breathingIn = Math.floor(elapsed / PHASE_SEC) % 2 === 0;
  const finished = elapsed >= seconds;

  return (
    <div className="msn-breathe" data-in={breathingIn ? '' : undefined} data-done={finished ? '' : undefined}>
      <div className="msn-breathe__ring" aria-hidden="true">
        <span className="msn-breathe__count">{finished ? '✓' : left}</span>
      </div>
      <p className="msn-breathe__words" aria-hidden="true">
        {finished ? 'Ready when you are.' : breathingIn ? 'Breathe in…' : '…breathe out'}
      </p>
      <p className="sr-only" role="timer" aria-live="off">
        {finished ? 'The seal is unlocked.' : `The seal unlocks in ${left} seconds.`}
      </p>
    </div>
  );
}
