import { useEffect, useMemo, useRef, useState } from 'react';
import {
  districtById,
  helpById,
  type AftershockSpec,
  type BandId,
  type Choice,
  type Mission,
  type PendingAftershock,
} from '@shieldquest/shared';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { StatusBadge } from '../../../ui/StatusBadge';
import { EffectDials } from '../parts/EffectDials';
import { TimelineRibbon } from '../parts/TimelineRibbon';
import { residentName, seededShuffle, sentenceCase, withStop } from '../runLogic';
import { PhaseHeading } from './PhaseHeading';
import './phases.css';

type Step = 'ribbon' | 'trace' | 'scene' | 'forecast' | 'late' | 'shadow';

export interface AftershockInterludeProps {
  pending: PendingAftershock;
  found: { mission: Mission; choice: Choice; spec: AftershockSpec };
  band: BandId | null;
  seed: number;
  reduced?: boolean;
  /** Lands the Aftershock (call once; Afterglows pass 'afterglow'). */
  onResolve: (optionId: string) => void;
  /** Move on to the next Aftershock or the mission. */
  onDone: () => void;
  /** Plays the arrival sound ('aftershock' or 'afterglow'). */
  onArrive?: (polarity: AftershockSpec['polarity']) => void;
  /** e.g. "1 of 2". */
  position?: string;
}

/** The risky branch's delayed cost, shown after an Afterglow ("Meanwhile, in another Lumen…"). */
function shadowOf(mission: Mission, chosen: Choice): { choice: Choice; spec: AftershockSpec } | null {
  for (const c of mission.choices) {
    if (c.id !== chosen.id && c.aftershock?.polarity === 'risk') return { choice: c, spec: c.aftershock };
  }
  return null;
}

/**
 * The Aftershock slot (Delayed Consequence Engine, GAME_DESIGN.md 6.3): Timeline Ribbon fast-forward, Ripple Trace,
 * the consequence, the forecast check and a Late Hold recovery. Afterglows are short, warm and celebratory.
 */
export function AftershockInterlude({ pending, found, band, seed, reduced, onResolve, onDone, onArrive, position }: AftershockInterludeProps) {
  const { mission, choice, spec } = found;
  const risk = spec.polarity === 'risk';
  const shadow = useMemo(() => (risk ? null : shadowOf(mission, choice)), [risk, mission, choice]);
  const [step, setStep] = useState<Step>('ribbon');
  const [tracePick, setTracePick] = useState<string | null>(null);
  const [lateIds, setLateIds] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const arrived = useRef(false);
  const who = residentName(mission);
  const district = districtById(mission.district);
  const showFact = Boolean(spec.fact) && (band !== 'junior' || mission.bands.includes('junior'));

  const traceOptions = useMemo(() => seededShuffle(mission.choices, seed, `${pending.key}:ripple`), [mission.choices, seed, pending.key]);
  const lastLate = spec.recovery?.options.find((o) => o.id === lateIds[lateIds.length - 1]) ?? null;

  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;
    onArrive?.(spec.polarity);
  }, [onArrive, spec.polarity]);

  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>('[data-msn-focus]')?.focus();
  }, [step]);

  const finish = (optionId: string) => {
    onResolve(optionId);
    onDone();
  };

  const kicker = `${risk ? 'Aftershock' : 'Afterglow'}${position ? ` · ${position}` : ''} · ${district.name}`;

  return (
    <div ref={rootRef} className="msn-phase msn-shock" data-polarity={spec.polarity}>
      {step === 'ribbon' && (
        <>
          <PhaseHeading kicker={kicker} title={risk ? 'Something from before is back' : 'Something good from before'}>
            {risk ? (
              // The earlier choice stays hidden here: naming it is the Ripple Trace question that comes next.
              <p className="msn-phase__sub">
                A ripple from "{mission.title}" reaches {who}: <strong>{spec.title}</strong>.
              </p>
            ) : (
              <p className="msn-phase__sub">
                Earlier, in "{mission.title}", {who} chose: <strong>{withStop(choice.label)}</strong>
              </p>
            )}
          </PhaseHeading>
          <TimelineRibbon
            label={spec.timeLabel}
            tone={risk ? 'risk' : 'protective'}
            play={!reduced}
            caption={risk ? 'Fast-forward…' : 'A little later…'}
          />
          <Button size="lg" block iconRight="arrowRight" onClick={() => setStep(risk ? 'trace' : 'scene')}>
            See what happened
          </Button>
        </>
      )}

      {step === 'trace' && (
        <>
          <PhaseHeading kicker={`${kicker} · Ripple Trace`} title="Which earlier choice led to this?">
            <p className="msn-phase__sub">Think back to "{mission.title}". Your answer stays private.</p>
          </PhaseHeading>
          <ul className="msn-options">
            {traceOptions.map((c) => {
              const picked = tracePick === c.id;
              const right = c.id === pending.choiceId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className="msn-option"
                    aria-pressed={picked}
                    data-result={tracePick ? (right ? 'right' : picked ? 'wrong' : undefined) : undefined}
                    disabled={tracePick !== null}
                    onClick={() => setTracePick(c.id)}
                  >
                    {c.label}
                  </button>
                </li>
              );
            })}
          </ul>
          {tracePick && (
            <p className="msn-option__explain" role="status">
              {tracePick === pending.choiceId ? (
                <>
                  <StatusBadge status="safe" label="Got it" /> You traced it back. Consequences often arrive long after the choice.
                </>
              ) : (
                <>
                  <StatusBadge status="attention" label="It was this one" /> {withStop(choice.label)} Delayed results are easy to lose track of.
                  That is exactly why they work.
                </>
              )}
            </p>
          )}
          <Button size="lg" block iconRight="arrowRight" disabled={!tracePick} onClick={() => setStep('scene')}>
            Continue
          </Button>
        </>
      )}

      {step === 'scene' && (
        <>
          <PhaseHeading kicker={`${kicker} · ${spec.timeLabel}`} title={spec.title} />
          <article className="msn-outcome" data-mood={risk ? 'sober' : 'warm'}>
            <p className="msn-outcome__text">{spec.text}</p>
            <EffectDials effects={spec.effects} animate={!reduced} who={who} />
            {showFact && spec.fact && (
              <p className="msn-shock__fact">
                <Icon name="book" /> {spec.fact.text}
                <small>
                  Source: {spec.fact.source} (as of {spec.fact.asOf})
                </small>
              </p>
            )}
          </article>
          {risk ? (
            <Button size="lg" block iconRight="arrowRight" onClick={() => setStep('forecast')}>
              Open your sealed forecast
            </Button>
          ) : shadow ? (
            <Button size="lg" block iconRight="arrowRight" onClick={() => setStep('shadow')}>
              Meanwhile…
            </Button>
          ) : (
            <Button size="lg" block icon="spark" onClick={() => finish('afterglow')}>
              Lovely. Carry on
            </Button>
          )}
        </>
      )}

      {step === 'forecast' && (
        <>
          <PhaseHeading kicker={`${kicker} · Forecast check`} title={pending.forecastLikely ? 'You saw it coming' : 'Now you know what to look for'}>
            <p className="msn-phase__sub">
              {pending.forecastLikely
                ? 'Your sealed forecast matched what was most likely. Looking ahead like that is Evaluate the Consequences.'
                : 'Your forecast was different, and that is fine. Delayed costs are hard to picture. Now you have seen one.'}
            </p>
          </PhaseHeading>
          <p className="msn-shock__likely">
            <Icon name="envelope" /> Most likely: {mission.forecast.options.find((o) => o.likely)?.text ?? mission.forecast.explain}
          </p>
          <Button size="lg" block iconRight="arrowRight" onClick={() => (spec.recovery ? setStep('late') : finish('none'))}>
            {spec.recovery ? 'What now?' : 'Continue'}
          </Button>
        </>
      )}

      {step === 'late' && spec.recovery && (
        <>
          <PhaseHeading kicker={`${kicker} · Late Hold`} title={spec.recovery.prompt}>
            <p className="msn-phase__sub">It is never too late to Hold. Coming forward is the right move, even late.</p>
          </PhaseHeading>
          <ul className="msn-options">
            {spec.recovery.options.map((o) => {
              const picked = lateIds.includes(o.id);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    className="msn-option"
                    aria-pressed={picked}
                    data-result={picked ? (o.good ? 'right' : 'wrong') : undefined}
                    disabled={Boolean(lastLate?.good) || picked}
                    onClick={() => setLateIds((ids) => [...ids, o.id])}
                  >
                    {o.text}
                  </button>
                </li>
              );
            })}
          </ul>
          {lastLate && (
            <div className="msn-shock__response" role="status">
              <p>
                <StatusBadge status={lastLate.good ? 'safe' : 'attention'} label={lastLate.good ? 'Strong move' : 'Try another way'} />{' '}
                {lastLate.response}
              </p>
              {lastLate.help && lastLate.help.length > 0 && (
                <ul className="msn-shock__help">
                  {lastLate.help
                    .map(helpById)
                    .filter((h) => band !== 'junior' || h.junior)
                    .map((h) => (
                      <li key={h.id}>
                        <strong>{h.name}</strong> <span>{h.contact}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
          {lastLate?.good && (
            <Button size="lg" block iconRight="arrowRight" onClick={() => finish(lastLate.id)}>
              Continue
            </Button>
          )}
          {lastLate && !lastLate.good && lateIds.length >= spec.recovery.options.length - 1 && (
            <Button variant="secondary" block onClick={() => finish(lastLate.id)}>
              Continue for now
            </Button>
          )}
        </>
      )}

      {step === 'shadow' && shadow && (
        <>
          <PhaseHeading kicker={`${kicker} · Meanwhile, in another Lumen…`} title={shadow.spec.title}>
            <p className="msn-phase__sub">
              In another Lumen, {who} chose: <strong>{withStop(shadow.choice.label)}</strong> {sentenceCase(shadow.spec.timeLabel)}:
            </p>
          </PhaseHeading>
          <article className="msn-outcome" data-mood="sober">
            <p className="msn-outcome__text">{shadow.spec.text}</p>
          </article>
          <p className="msn-shock__check">
            <StatusBadge status={pending.forecastLikely ? 'safe' : 'unknown'} label={pending.forecastLikely ? 'You saw it coming' : 'Now you know'} />{' '}
            {pending.forecastLikely
              ? 'Your sealed forecast matched this.'
              : 'Your sealed forecast was different. This is the kind of cost that arrives later.'}
          </p>
          <Button size="lg" block icon="spark" onClick={() => finish('afterglow')}>
            Glad {who} chose well
          </Button>
        </>
      )}
    </div>
  );
}
