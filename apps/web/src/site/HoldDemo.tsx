import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { m } from 'motion/react';
import { Link } from 'wouter';
import { tacticById, type TacticId } from '@shieldquest/shared';
import { haptic, playSfx, setTension, unlockAudio, type Sfx } from '../audio/sfx';
import { useSettings } from '../state/settings';
import { Icon } from '../ui/Icon';
import { arc } from './art/geometry';
import './holddemo.css';

// A 16-second taste of a live moment. Ren (fictional, 19) is being recruited as a money mule by a
// chat handle; the visitor presses and holds HOLD to freeze time and see each tactic named.
// Manipulators are never embodied: the sender is a handle with an initial avatar only.

interface DemoBeat {
  at: number;
  text: string;
  tactic?: TacticId;
  attachment?: string;
}

const SENDER = 'Kel_QuickCash';
const BEATS: readonly DemoBeat[] = [
  { at: 0.8, text: "Hi Ren! Darren says you're looking for part-time work." },
  { at: 2.8, text: 'Easy job: you keep S$200 for 10 minutes. No experience needed.', tactic: 'too-good' },
  { at: 5.0, text: 'Lots of students do this. Darren did it last week.', tactic: 'everyone-does-it' },
  { at: 7.2, text: "We're a licensed company. See our cert.", tactic: 'fake-proof', attachment: 'company_licence.png' },
  { at: 9.4, text: 'Need your answer now or I give the slot to someone else.', tactic: 'urgency' },
  { at: 11.6, text: "Don't tell your parents ok, they won't understand.", tactic: 'secrecy' },
  { at: 13.8, text: 'Last 2 slots. Reply OK to start.', tactic: 'urgency' },
];
const DECISION_AT = 16;
const HOLD_MS = 600;
const RING_SEGMENTS = BEATS.filter((b) => b.tactic).length;

type Phase = 'idle' | 'live' | 'held' | 'late';

const fmt = (sec: number) => `0:${String(Math.max(0, Math.ceil(sec))).padStart(2, '0')}`;

export function HoldDemo() {
  const tapToHold = useSettings((s) => s.tapToHold);
  const sound = useSettings((s) => s.sound);
  const [phase, setPhase] = useState<Phase>('idle');
  const [t, setT] = useState(0);
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState('');
  const [status, setStatus] = useState('');
  const [caption, setCaption] = useState('');
  const tRef = useRef(0);
  const pressStart = useRef<number | null>(null);
  const raf = useRef(0);
  const logRef = useRef<HTMLOListElement>(null);
  const holdBtn = useRef<HTMLButtonElement>(null);
  const againBtn = useRef<HTMLButtonElement>(null);

  const sfx = useCallback((name: Sfx) => {
    if (sound) playSfx(name);
  }, [sound]);

  const visible = BEATS.filter((b) => b.at <= t);
  const arrivedTactics = visible.filter((b) => b.tactic).length;
  const latest = [...visible].reverse().find((b) => b.tactic);
  const hanging = phase === 'held' ? BEATS.find((b) => b.at > t) : undefined;
  const frozen = phase === 'held' || phase === 'late';

  // Mission clock. Runs only while live; holding or the decision second stops it on that frame.
  useEffect(() => {
    if (phase !== 'live') return;
    const start = performance.now() - tRef.current * 1000;
    const id = window.setInterval(() => {
      const now = (performance.now() - start) / 1000;
      if (now >= DECISION_AT) {
        tRef.current = DECISION_AT;
        setT(DECISION_AT);
        setPhase('late');
        setTension(0);
        setStatus('Time ran out, so the city froze for you. You can always pause. Scams count on you forgetting that.');
        setCaption('[the ticking stops]');
      } else {
        tRef.current = now;
        setT(now);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase]);

  // Each new message: a buzz, a caption, and a little more tension.
  const count = visible.length;
  useEffect(() => {
    if (phase !== 'live' || count === 0) return;
    sfx('message');
    setTension(Math.min(1, count / BEATS.length));
    setCaption(count >= 5 ? '[phone buzzes] [ticking speeds up]' : '[phone buzzes]');
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [count, phase, sfx]);

  // Move focus to "Play again" when the moment freezes, so keyboard users land on the next action.
  useEffect(() => {
    if (frozen) againBtn.current?.focus({ preventScroll: true });
  }, [frozen]);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      setTension(0);
    },
    [],
  );

  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(''), 3500);
    return () => window.clearTimeout(id);
  }, [hint]);

  const start = () => {
    unlockAudio();
    tRef.current = 0;
    setT(0);
    setProgress(0);
    setHint('');
    setCaption('');
    setPhase('live');
    setStatus(`The moment is playing. ${SENDER} is messaging Ren. Press and hold the HOLD button whenever you feel the hurry.`);
    requestAnimationFrame(() => holdBtn.current?.focus({ preventScroll: true }));
  };

  const doHold = () => {
    cancelAnimationFrame(raf.current);
    pressStart.current = null;
    setProgress(1);
    setPhase('held');
    setTension(0);
    sfx('freeze');
    haptic(60);
    setCaption('[tape-stop sound: time freezes]');
    setStatus('Time is held. Nothing is rushing you now.');
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (phase !== 'live' || tapToHold || e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-released pointers cannot be captured; the press still works.
    }
    pressStart.current = performance.now();
    sfx('holdCharge');
    const step = () => {
      if (pressStart.current === null) return;
      const p = Math.min(1, (performance.now() - pressStart.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) doHold();
      else raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  const endPress = () => {
    if (pressStart.current === null) return;
    const short = performance.now() - pressStart.current < HOLD_MS;
    pressStart.current = null;
    cancelAnimationFrame(raf.current);
    setProgress(0);
    if (short) setHint('Keep pressing until the ring fills. (Or turn on “Tap once to Hold” in Comfort settings.)');
  };

  // Keyboard and assistive-tech activation (detail 0) and the tap-to-hold setting hold at once.
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (phase !== 'live') return;
    if (tapToHold || e.detail === 0) doHold();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (phase === 'live' && (e.key === 'h' || e.key === 'H')) doHold();
  };

  const tactics: { id: TacticId; early: boolean }[] = [];
  for (const b of visible) if (b.tactic && !tactics.some((x) => x.id === b.tactic)) tactics.push({ id: b.tactic, early: false });
  if (hanging?.tactic && !tactics.some((x) => x.id === hanging.tactic)) tactics.push({ id: hanging.tactic, early: true });

  return (
    <div className={`site-demo is-${phase}`}>
      <div className="site-demo__phone">
        <div className="site-demo__screen">
          <header className="site-demo__chathead">
            <span className="site-demo__avatar" aria-hidden="true">
              K
            </span>
            <span className="site-demo__who">
              <b>{SENDER}</b>
              <small>ChatLah · not in your contacts</small>
            </span>
            {phase === 'live' && (
              <span className="site-demo__countdown" aria-hidden="true">
                <Icon name="clock" /> Offer ends {fmt(DECISION_AT - t)}
              </span>
            )}
            {frozen && (
              <span className="site-demo__heldpill" aria-hidden="true">
                <Icon name="pause" /> {phase === 'held' ? 'Held' : 'Frozen'}
              </span>
            )}
          </header>

          {phase === 'held' && <p className="site-demo__banner">Time is held. Nothing is rushing you now.</p>}

          <ol className="site-demo__log" ref={logRef} role="log" aria-label={`ChatLah messages from ${SENDER} to Ren`}>
            {visible.map((b) => (
              <m.li
                key={b.at}
                className="site-demo__msg"
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.28 }}
              >
                <span className="sr-only">{SENDER}: </span>
                {b.text}
                {b.attachment && (
                  <span className="site-demo__attach">
                    <Icon name="lock" /> {b.attachment}
                  </span>
                )}
                {b.tactic && <span className="sr-only"> (Pressure Ring: {tacticById(b.tactic).ringLabel})</span>}
              </m.li>
            ))}
            {hanging && (
              <li className="site-demo__msg site-demo__msg--hanging">
                <span className="site-demo__hanging-tag">Not sent yet: you held early enough to read it</span>
                {hanging.text}
              </li>
            )}
          </ol>

          {phase === 'idle' && (
            <div className="site-demo__intro">
              <p>
                <b>Ren, 19,</b> is on the bus home when a stranger starts messaging about a “job”.
              </p>
              <p>Press play. When you feel the hurry, press and hold HOLD.</p>
              <button type="button" className="ui-btn ui-btn--primary ui-btn--lg" onClick={start}>
                <Icon name="play" />
                <span>Play the moment</span>
              </button>
            </div>
          )}

          {phase === 'late' && (
            <div className="site-demo__late">
              <p className="site-demo__late-scene">Ren’s thumb is over “OK”.</p>
              <p>You can always pause. Scams count on you forgetting that.</p>
            </div>
          )}

          <p className="site-demo__caption" aria-hidden="true">
            {caption || ' '}
          </p>

          <div className="site-demo__dock">
            <div className="site-demo__ringwrap">
              <svg viewBox="0 0 120 120" className="site-demo__ring" aria-hidden="true">
                {Array.from({ length: RING_SEGMENTS }, (_, i) => {
                  const span = 360 / RING_SEGMENTS;
                  return (
                    <path
                      key={i}
                      d={arc(60, 60, 54, i * span + 5, (i + 1) * span - 5)}
                      className={i < arrivedTactics ? 'is-lit' : undefined}
                      fill="none"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                  );
                })}
                <circle cx="60" cy="60" r="43" className="site-demo__charge-track" fill="none" strokeWidth="5" />
                <circle
                  cx="60"
                  cy="60"
                  r="43"
                  className="site-demo__charge"
                  fill="none"
                  strokeWidth="5"
                  pathLength={1}
                  strokeDasharray="1"
                  strokeDashoffset={1 - progress}
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <button
                ref={holdBtn}
                type="button"
                className="site-demo__hold"
                disabled={phase !== 'live'}
                onPointerDown={onPointerDown}
                onPointerUp={endPress}
                onPointerCancel={endPress}
                onLostPointerCapture={endPress}
                onClick={onClick}
                onKeyDown={onKeyDown}
                onContextMenu={(e) => e.preventDefault()}
                aria-describedby="site-demo-holdhelp"
              >
                {frozen ? <Icon name="pause" size="1.6em" /> : 'HOLD'}
              </button>
            </div>
            <div className="site-demo__ringlabel" aria-hidden="true">
              {latest?.tactic && phase !== 'idle' ? (
                <span key={latest.at} className="site-demo__tactic">
                  {tacticById(latest.tactic).ringLabel}
                </span>
              ) : (
                <span className="site-demo__tactic site-demo__tactic--empty">Pressure Ring</span>
              )}
              <small>
                {arrivedTactics} of {RING_SEGMENTS} tactics named
              </small>
            </div>
          </div>
          <p id="site-demo-holdhelp" className="sr-only">
            {tapToHold ? 'Press once to hold.' : 'Press and hold with a finger or mouse, or press Enter, Space or H.'}
          </p>
        </div>
      </div>

      <div className="site-demo__live" aria-live="polite">
        <p className="sr-only">{status}</p>
        {hint && <p className="site-demo__hint">{hint}</p>}
      </div>

      {frozen && (
        <section className="site-demo__result" aria-labelledby="site-demo-result-title">
          <h3 id="site-demo-result-title">
            {phase === 'held' ? `You held with ${fmt(DECISION_AT - t)} left on the clock.` : 'The city froze for you at the decision second.'}
          </h3>
          <p className="site-demo__counts">
            <span>
              Seen live: <b>{visible.length}</b>
            </span>
            <span>
              Read while holding: <b>{hanging ? 1 : 0}</b>
            </span>
          </p>
          {tactics.length > 0 ? (
            <>
              <p>The Pressure Ring named these tactics. None of them is Ren’s fault: each one is a tool.</p>
              <ul className="site-demo__tactics">
                {tactics.map(({ id, early }) => {
                  const tac = tacticById(id);
                  return (
                    <li key={id}>
                      <span className="site-demo__tactic">{tac.ringLabel}</span>
                      {early && <span className="site-demo__early">Read early</span>}
                      <b>{tac.name}</b>
                      <span>Designed to {tac.designedTo}.</span>
                      <span className="site-demo__counter">
                        <Icon name="shield" /> {tac.counter}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p>You held before the pressure even started. In a mission, that buys your squad the most time to investigate.</p>
          )}
          <p>
            In a full mission your squad would now inspect the frozen scene, pull the string to see who really gains, and
            decide together what Ren does. <Link href="/how-it-works">See how a mission plays</Link>.
          </p>
          <button ref={againBtn} type="button" className="ui-btn ui-btn--secondary" onClick={start}>
            <Icon name="rewind" />
            <span>Play it again</span>
          </button>
        </section>
      )}
    </div>
  );
}
