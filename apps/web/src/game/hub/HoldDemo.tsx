// A tiny, harmless rehearsal of the HOLD gesture: a pushy "free drink" message, a pressure label,
// and a ring that fills while you press. Same input rules as the mission player (press-and-hold,
// or tap-to-hold from Comfort settings; Space/Enter on a keyboard).
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { m } from 'motion/react';
import { tacticById, type BandId } from '@shieldquest/shared';
import { useSettings } from '../../state/settings';
import { haptic } from '../../audio/sfx';
import { Icon } from '../../ui/Icon';
import { useSfx, useSoundCaption } from './kit';

const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;
const COUNT_FROM = 10;

type Phase = 'live' | 'charging' | 'held';

export function HoldDemo({ band }: { band: BandId | null }) {
  const tapToHold = useSettings((s) => s.tapToHold);
  // Same press length as the mission player (Comfort settings, 0.3-2.0 s; GDD §10.1).
  const holdMs = useSettings((s) => s.holdMs);
  const sound = useSettings((s) => s.sound);
  const set = useSettings((s) => s.set);
  const sfx = useSfx();
  const [caption, showCaption] = useSoundCaption();
  const [phase, setPhase] = useState<Phase>('live');
  const [count, setCount] = useState(COUNT_FROM);
  const [holds, setHolds] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const hintId = useId();
  const statusId = useId();
  const urgency = tacticById('urgency');
  // Juniors get pressure through characters, not countdown digits (GDD §5.4).
  const gentle = useSettings((s) => s.gentle);
  const showCountdown = band !== 'junior' && !gentle;

  // The fake deadline loops forever: the point is the feeling of hurry, not a real limit.
  useEffect(() => {
    if (phase === 'held') return;
    const id = window.setInterval(() => setCount((c) => (c <= 1 ? COUNT_FROM : c - 1)), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const complete = useCallback(() => {
    window.clearTimeout(timer.current);
    setPhase('held');
    setHolds((h) => h + 1);
    sfx('freeze');
    haptic(60);
    if (sound) showCaption('[tape-stop sound: time winds down to stillness]');
  }, [sfx, sound, showCaption]);

  const start = useCallback(() => {
    if (phase !== 'live') return;
    setPhase('charging');
    sfx('holdCharge');
    timer.current = window.setTimeout(complete, holdMs);
  }, [phase, sfx, complete, holdMs]);

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    setPhase((p) => (p === 'charging' ? 'live' : p));
  }, []);

  const release = () => {
    setPhase('live');
    setCount(COUNT_FROM);
    sfx('release');
    if (sound) showCaption('[reverse swell: time runs again]');
  };

  const isHoldKey = (e: KeyboardEvent) => e.key === ' ' || e.key === 'Enter';

  const held = phase === 'held';
  const offset = phase === 'live' ? RING_C : 0;

  return (
    <div className={`hub-demo hub-demo--${phase}`}>
      <div className="hub-demo__scene">
        <div className="hub-demo__rain" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${-(i * 0.23) % 1.4}s` }} />
          ))}
        </div>

        <p className="hub-demo__header" id={statusId} aria-live="polite">
          {held ? (
            <>
              <Icon name="pause" /> Time is held. Nothing is rushing you now.
            </>
          ) : (
            <span className="sr-only">The moment is live.</span>
          )}
        </p>

        <div className="hub-demo__chat">
          <p className="hub-demo__from">
            <span className="hub-demo__avatar" aria-hidden="true">
              B
            </span>
            BobaBoleh_Deals <span className="hub-demo__app">on ChatLah</span>
          </p>
          <p className="hub-demo__msg">
            FREE drink for you!! Share this to 10 friends <strong>right now</strong> or the deal is gone.
          </p>
          <p className="hub-demo__pressure">
            <span className="hub-demo__tactic">{urgency.ringLabel}</span>
            {showCountdown ? (
              <span className="hub-demo__count" aria-hidden={!held}>
                {held ? 'Clock stopped' : `Deal ends in 0:${String(count).padStart(2, '0')}`}
              </span>
            ) : (
              <span className="hub-demo__count">{held ? 'No more hurry' : 'Hurry, hurry!'}</span>
            )}
          </p>
        </div>

        <div className="hub-demo__controls">
          <button
            type="button"
            className="hub-hold"
            aria-describedby={hintId}
            aria-disabled={held || undefined}
            onPointerDown={(e) => {
              if (tapToHold || held || e.button !== 0) return;
              e.currentTarget.setPointerCapture?.(e.pointerId);
              start();
            }}
            onPointerUp={() => !tapToHold && cancel()}
            onPointerCancel={cancel}
            onLostPointerCapture={() => !tapToHold && cancel()}
            onBlur={cancel}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (tapToHold || !isHoldKey(e)) return;
              e.preventDefault();
              if (!e.repeat) start();
            }}
            onKeyUp={(e) => {
              if (tapToHold || !isHoldKey(e)) return;
              e.preventDefault();
              cancel();
            }}
            onClick={() => {
              if (tapToHold && phase === 'live') complete();
            }}
          >
            <svg className="hub-hold__ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
              <circle cx="50" cy="50" r={RING_R} className="hub-hold__track" />
              <circle
                cx="50"
                cy="50"
                r={RING_R}
                className="hub-hold__fill"
                strokeDasharray={RING_C}
                strokeDashoffset={offset}
                style={{ transitionDuration: phase === 'charging' ? `${holdMs}ms` : '180ms' }}
              />
            </svg>
            <span className="hub-hold__label">{held ? <Icon name="check" size="1.6em" /> : 'HOLD'}</span>
          </button>

          {held && (
            <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="hub-demo__after">
              <p>
                <strong>You held.</strong> Now you could look around, check the clues and decide calmly.
              </p>
              <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={release}>
                <Icon name="play" /> <span>Let time run again</span>
              </button>
            </m.div>
          )}
        </div>
        {caption && (
          <p className="hub-caption hub-demo__caption" aria-hidden="true">
            {caption}
          </p>
        )}
      </div>

      <p id={hintId} className="hub-demo__hint">
        {tapToHold
          ? 'Tap HOLD once to freeze time.'
          : 'Press and keep holding HOLD until the ring fills (about half a second). With a keyboard, hold Space.'}
        {holds > 1 && ' You can practise as often as you like.'}
      </p>

      <label className="ui-toggle hub-demo__toggle">
        <input type="checkbox" checked={tapToHold} onChange={(e) => set({ tapToHold: e.target.checked })} />
        <span>Tap once to Hold (instead of press and hold)</span>
      </label>
    </div>
  );
}
