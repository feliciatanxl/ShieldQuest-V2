import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Mission } from '@shieldquest/shared';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { StatusBadge } from '../../../ui/StatusBadge';
import { castName, initials, seededShuffle } from '../runLogic';
import { PhaseHeading } from './PhaseHeading';
import './phases.css';

export interface TracePhaseProps {
  mission: Mission;
  pulled: boolean;
  /** Answers so far (the first counts for the I letter; a second try is practice). */
  answers: readonly string[];
  onPull: () => void;
  onAnswer: (optionId: string) => void;
  onContinue: () => void;
  /** Run seed: option order is shuffled per run. */
  seed: number;
  reduced?: boolean;
}

const PULL_AT = 0.78;

/** Identify the Influence: Pull the String from the pusher to the edge, read the Gain Tag, then answer. */
export function TracePhase({ mission, pulled, answers, onPull, onAnswer, onContinue, seed, reduced }: TracePhaseProps) {
  const { influence } = mission;
  const pusher = castName(mission, influence.from);
  const trackRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  // The latest pull, readable in pointerup even when no render happened since the last move (fast flicks).
  const pullRef = useRef(0);
  const drag = useRef<{ x: number; width: number; moved: boolean; id: number } | null>(null);
  const dragged = useRef(false);
  const qId = useId();

  const options = useMemo(() => seededShuffle(influence.options, seed, `${mission.id}:trace`), [influence.options, seed, mission.id]);
  const firstCorrect = options.some((o) => o.id === answers[0] && o.correct);
  const anyCorrect = options.some((o) => answers.includes(o.id) && o.correct);
  const finished = firstCorrect || anyCorrect || answers.length >= 2;
  const correct = options.find((o) => o.correct);

  useEffect(() => {
    if (pulled) tagRef.current?.focus();
  }, [pulled]);

  const level = pulled ? 1 : pull;

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (pulled || e.button !== 0) return;
    const width = trackRef.current?.getBoundingClientRect().width ?? 300;
    drag.current = { x: e.clientX, width, moved: false, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 6) return;
    d.moved = true;
    pullRef.current = Math.max(0, Math.min(1, dx / (d.width * 0.8)));
    setPull(pullRef.current);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    dragged.current = true;
    if (pullRef.current >= PULL_AT) onPull();
    else {
      pullRef.current = 0;
      setPull(0);
    }
  };

  return (
    <div className="msn-phase msn-trace">
      <PhaseHeading kicker="I · Identify the Influence" title="Pull the thread">
        <p className="msn-phase__sub">
          {pulled ? 'The thread pulled tight. Here is who really gains.' : `Drag the thread from ${pusher} to the edge, or tap "Pull the thread".`}
        </p>
      </PhaseHeading>

      <div ref={trackRef} className="msn-thread" data-pulled={pulled ? '' : undefined} style={{ ['--msn-pull' as string]: String(level) }}>
        <span className="msn-thread__from">
          <span className="msn-avatar">{initials(pusher)}</span>
          <span className="msn-thread__name">{pusher}</span>
        </span>
        <svg className="msn-thread__svg" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <path
            d={`M0 20 Q ${50} ${20 + (1 - level) * 16} ${Math.max(2, level * 100)} 20`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="msn-thread__edge" aria-hidden="true">
          {pulled ? <Icon name="lock" /> : '?'}
        </span>
        {!pulled && (
          <button
            type="button"
            className="msn-thread__handle"
            // Starts just past the pusher's column and ends on the centre of the edge box.
            style={{ left: `calc(7rem + ${level} * (100% - 9.05rem))` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              drag.current = null;
              pullRef.current = 0;
              setPull(0);
            }}
            onClick={() => {
              if (dragged.current) {
                dragged.current = false;
                return;
              }
              onPull();
            }}
            aria-label={`Pull the thread from ${pusher}`}
          >
            <Icon name="thread" />
          </button>
        )}
      </div>

      {!pulled && (
        <Button variant="secondary" block icon="thread" onClick={onPull}>
          Pull the thread
        </Button>
      )}

      {pulled && (
        <>
          <div ref={tagRef} tabIndex={-1} className="msn-gaintag" data-reduced={reduced ? '' : undefined}>
            <p className="msn-gaintag__kicker">Gain Tag</p>
            <p className="msn-gaintag__label">{influence.hidden.label}</p>
            <p className="msn-gaintag__desc">{influence.hidden.description}</p>
          </div>

          <fieldset className="msn-question">
            <legend id={qId} className="msn-question__q">
              {influence.question}
            </legend>
            <ul className="msn-options">
              {options.map((o) => {
                const picked = answers.includes(o.id);
                const locked = finished || picked;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      className="msn-option"
                      aria-pressed={picked}
                      data-result={picked ? (o.correct ? 'right' : 'wrong') : undefined}
                      disabled={locked}
                      onClick={() => onAnswer(o.id)}
                    >
                      {o.text}
                    </button>
                    {picked && (
                      <p className="msn-option__explain" role="status">
                        <StatusBadge status={o.correct ? 'safe' : 'attention'} label={o.correct ? 'Got it' : 'Not quite'} /> {o.explain}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            {!finished && answers.length === 1 && <p className="msn-question__retry">Have another go. A second try is practice, not a penalty.</p>}
            {finished && !anyCorrect && correct && (
              <p className="msn-option__explain msn-option__explain--reveal">
                <StatusBadge status="safe" label="The answer" /> {correct.text} {correct.explain}
              </p>
            )}
          </fieldset>

          {finished && (
            <Button size="lg" block iconRight="arrowRight" onClick={onContinue}>
              Look ahead
            </Button>
          )}
        </>
      )}
    </div>
  );
}
