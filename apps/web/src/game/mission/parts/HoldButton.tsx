import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { TacticId } from '@shieldquest/shared';
import './parts.css';

export interface RingTactic {
  id: TacticId;
  /** TACTICS ringLabel, e.g. "URGENCY". */
  label: string;
  lit: boolean;
}

export interface HoldButtonProps {
  /** Fires once the hold completes (after holdMs of pressing, or a single tap with tapToHold / keyboard). */
  onHold: () => void;
  /** Pressure Ring segments: one per tactic in the moment, lit as its beat lands. */
  tactics: readonly RingTactic[];
  /** Settings "Tap once to Hold": a single tap completes the hold. */
  tapToHold?: boolean;
  /** Press-and-hold duration (default 600 ms). */
  holdMs?: number;
  /** Listen for Space or H anywhere on the page (ignored while typing or while a dialog is open). */
  keyboard?: boolean;
  /** ready: live. held: time is held (button rests). surge: pulses to invite a re-hold that dismisses a surge. */
  status?: 'ready' | 'held' | 'surge';
  disabled?: boolean;
  /** Called when charging starts (play 'holdCharge'). */
  onChargeStart?: () => void;
}

const R_RING = 55;
const R_CHARGE = 46;
const C_RING = 2 * Math.PI * R_RING;
const C_CHARGE = 2 * Math.PI * R_CHARGE;

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** The 76 px HOLD button wrapped in the Pressure Ring. Space or H also holds (keyboard = tap, for motor access). */
export function HoldButton({
  onHold,
  tactics,
  tapToHold = false,
  holdMs = 600,
  keyboard = true,
  status = 'ready',
  disabled = false,
  onChargeStart,
}: HoldButtonProps) {
  const [charging, setCharging] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const hintId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const live = !disabled && status !== 'held';

  const complete = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    setCharging(false);
    onHold();
  }, [onHold]);

  const startCharge = useCallback(() => {
    if (!live || timer.current !== undefined) return;
    setCharging(true);
    onChargeStart?.();
    timer.current = window.setTimeout(complete, holdMs);
  }, [live, complete, holdMs, onChargeStart]);

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    setCharging(false);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!live) cancel();
  }, [live, cancel]);

  useEffect(() => {
    if (!keyboard || !live) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const isH = e.key === 'h' || e.key === 'H';
      const isSpace = e.key === ' ' || e.code === 'Space';
      if (!isH && !isSpace) return;
      if (isTypingTarget(e.target) || document.querySelector('dialog[open]')) return;
      // Space keeps its normal meaning on other buttons (e.g. reply chips); H works everywhere.
      if (isSpace && e.target instanceof HTMLElement && e.target !== btnRef.current && e.target.closest('button, a, [role="tab"]'))
        return;
      e.preventDefault();
      startCharge();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboard, live, startCharge]);

  const segLen = tactics.length > 0 ? C_RING / tactics.length : C_RING;
  const gap = tactics.length > 1 ? 7 : 0;
  const lit = tactics.filter((t) => t.lit);
  const newest = lit[lit.length - 1];

  return (
    <div className="msn-hold" data-status={status} data-charging={charging ? '' : undefined}>
      {newest && status === 'ready' && (
        <span key={newest.id} className="msn-hold__pop" aria-hidden="true">
          {newest.label}
        </span>
      )}
      <svg className="msn-hold__ring" viewBox="0 0 120 120" aria-hidden="true">
        <g transform="rotate(-90 60 60)">
          {tactics.length === 0 ? (
            <circle cx="60" cy="60" r={R_RING} className="msn-hold__seg" />
          ) : (
            tactics.map((t, i) => (
              <circle
                key={t.id}
                cx="60"
                cy="60"
                r={R_RING}
                className="msn-hold__seg"
                data-lit={t.lit ? '' : undefined}
                strokeDasharray={`${Math.max(2, segLen - gap)} ${C_RING}`}
                strokeDashoffset={-i * segLen}
              />
            ))
          )}
          <circle
            cx="60"
            cy="60"
            r={R_CHARGE}
            className="msn-hold__charge"
            strokeDasharray={C_CHARGE}
            strokeDashoffset={charging || status === 'held' ? 0 : C_CHARGE}
            style={{ transitionDuration: charging ? `${holdMs}ms` : '160ms' }}
          />
        </g>
      </svg>
      <button
        ref={btnRef}
        type="button"
        className="msn-hold__btn"
        disabled={!live}
        aria-describedby={hintId}
        aria-label={status === 'held' ? 'Time is held' : status === 'surge' ? 'Hold again to clear the pressure' : 'Hold time'}
        onPointerDown={(e) => {
          if (tapToHold || e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          startCharge();
        }}
        onPointerUp={() => {
          if (!tapToHold) cancel();
        }}
        onPointerCancel={() => {
          if (!tapToHold) cancel();
        }}
        onLostPointerCapture={() => {
          if (!tapToHold && timer.current !== undefined) cancel();
        }}
        onClick={(e) => {
          if (tapToHold) complete();
          // Keyboard activation (Enter) reports detail 0: treat it as a tap.
          else if (e.detail === 0 && timer.current === undefined) startCharge();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="msn-hold__word">{status === 'held' ? 'HELD' : 'HOLD'}</span>
      </button>
      <span id={hintId} className="sr-only">
        {tapToHold ? 'Tap once' : 'Press and hold for a moment'}, or press Space or H.{' '}
        {lit.length > 0 ? `Pressure so far: ${lit.map((t) => t.label).join(', ')}.` : ''}
      </span>
    </div>
  );
}
