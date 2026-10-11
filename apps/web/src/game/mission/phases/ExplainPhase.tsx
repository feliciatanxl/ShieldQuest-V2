import { useEffect, useMemo, useRef, useState } from 'react';
import type { BandId, Clue, Mission } from '@shieldquest/shared';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { StatusBadge } from '../../../ui/StatusBadge';
import { ExitPatternSwatch } from '../parts/ExitCard';
import { ExitGroup } from '../parts/ExitGroup';
import { SealEnvelope } from '../parts/SealEnvelope';
import {
  ECHO_COUNCIL_LABEL,
  GUARDIAN_COLOR_VARS,
  MAX_REASONS,
  REASON_CHIPS,
  councilMood,
  counterView,
  exitFor,
  type ExitView,
} from '../runLogic';
import { PhaseHeading } from './PhaseHeading';
import './phases.css';

export interface ExplainPhaseProps {
  mission: Mission;
  exits: readonly ExitView[];
  firstVote: string;
  reasons: readonly string[];
  onReason: (chip: string) => void;
  finalChoice: string | null;
  /** Keep or change the Exit (no confidence this time). */
  onReseal: (choiceId: string) => void;
  onContinue: () => void;
  /** Echo's Second Opinion: adds a counter-view card (once per mission, if unfolded). */
  echo?: { unfolded: boolean; used: boolean; onUse: () => void } | null;
  /** Red flags the player pinned, for "Change a mind" (answer a perspective with your evidence). */
  pinned?: readonly Clue[];
  band: BandId | null;
  hideContinue?: boolean;
}

type Answer = { clue: Clue; good: boolean };

/** Explain: the Echo Council's perspectives, Echo's counter-view, reason chips, then a private re-seal. */
export function ExplainPhase({
  mission,
  exits,
  firstVote,
  reasons,
  onReason,
  finalChoice,
  onReseal,
  onContinue,
  echo,
  pinned = [],
  band,
  hideContinue,
}: ExplainPhaseProps) {
  const [picked, setPicked] = useState<string>(finalChoice ?? firstVote);
  const [evidence, setEvidence] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const afterRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLElement>(null);
  const resealed = finalChoice !== null;
  const junior = band === 'junior';

  const dots = useMemo(() => {
    const d: Record<string, number> = {};
    for (const p of mission.perspectives) d[p.leaning] = (d[p.leaning] ?? 0) + 1;
    return d;
  }, [mission.perspectives]);
  const mood = councilMood(mission.perspectives);
  const counter = useMemo(() => counterView(mission, firstVote), [mission, firstVote]);
  const showCounter = Boolean(echo?.used && counter);
  const evidenceClue = pinned.find((c) => c.id === evidence) ?? null;
  const finalExit = exitFor(exits, finalChoice);
  const firstExit = exitFor(exits, firstVote);

  useEffect(() => {
    if (resealed) afterRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [resealed]);
  useEffect(() => {
    if (showCounter) counterRef.current?.focus();
  }, [showCounter]);

  return (
    <div className="msn-phase msn-explain" style={GUARDIAN_COLOR_VARS}>
      <PhaseHeading kicker="L · Lead the Right Choice" title="Explain">
        <p className="msn-phase__sub">
          You sealed Exit {firstExit?.letter}. Here is how others might see it. You can keep your choice or change it.
        </p>
      </PhaseHeading>

      <section className="msn-council" aria-labelledby="msn-council-title">
        <h3 id="msn-council-title" className="msn-council__title">
          The Echo Council
        </h3>
        <p className="msn-council__label">
          <Icon name="info" /> {ECHO_COUNCIL_LABEL}
        </p>
        {junior ? (
          <p className="msn-council__mood">
            <strong>Mood:</strong> {mood}.{mood === 'Split' ? ' Split decisions are normal. Think it through.' : ''}
          </p>
        ) : (
          mood !== 'United' && <p className="msn-council__mood">Split decisions are normal. Talk it out, even with yourself.</p>
        )}

        {pinned.length > 0 && !resealed && (
          <div className="msn-evidence" role="group" aria-label="Change a mind: pick one of your pins, then answer a perspective with it">
            <p className="msn-evidence__hint">
              <strong>Change a mind:</strong> pick one of your pins, then answer someone with it.
            </p>
            <ul className="msn-evidence__chips">
              {pinned.map((c) => (
                <li key={c.id}>
                  <button type="button" className="msn-chip" aria-pressed={evidence === c.id} onClick={() => setEvidence((e) => (e === c.id ? null : c.id))}>
                    <Icon name="pin" /> {c.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ul className="msn-council__cards">
          {mission.perspectives.map((p) => {
            const lean = exitFor(exits, p.leaning);
            const leanChoice = mission.choices.find((c) => c.id === p.leaning);
            const challengeable = leanChoice?.safety !== 'safe';
            const answer = answers[p.id];
            return (
              <li key={p.id} className="msn-perspective" data-answered={answer ? (answer.good ? 'good' : 'weak') : undefined}>
                <p className="msn-perspective__role">
                  <Icon name="user" /> {p.role}
                  <span className="msn-perspective__tag">character</span>
                </p>
                <p className="msn-perspective__text">"{p.text}"</p>
                {lean && (
                  <p className="msn-perspective__lean">
                    <ExitPatternSwatch pattern={lean.pattern} size={22} /> Leans towards Exit {lean.letter}
                  </p>
                )}
                {answer && (
                  <p className="msn-perspective__reply" role="status">
                    {answer.good
                      ? `"Hm. ${answer.clue.label}... I hadn't thought about that. Maybe I'd reconsider."`
                      : '"Hmm, that doesn\'t answer my point."'}
                  </p>
                )}
                {evidenceClue && challengeable && !answer && !resealed && (
                  <button
                    type="button"
                    className="ui-btn ui-btn--secondary ui-btn--sm"
                    onClick={() => {
                      setAnswers((a) => ({ ...a, [p.id]: { clue: evidenceClue, good: evidenceClue.redFlag } }));
                      setEvidence(null);
                    }}
                  >
                    <Icon name="pin" />
                    <span>Answer with this pin</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {echo?.unfolded && !echo.used && counter && !resealed && (
          <button type="button" className="msn-guardians__btn" data-guardian="echo" onClick={echo.onUse}>
            <Icon name="users" />
            <span>
              <strong>Echo: Second Opinion</strong>
              <small>Hear the best case for a different exit</small>
            </span>
          </button>
        )}
        {showCounter && counter && (
          <article ref={counterRef} tabIndex={-1} className="msn-perspective msn-perspective--counter">
            <p className="msn-perspective__role">
              <Icon name="users" /> Echo's counter-view
              <span className="msn-perspective__tag">steelman</span>
            </p>
            <p className="msn-perspective__lean">
              {(() => {
                const ex = exitFor(exits, counter.choice.id);
                return ex ? (
                  <>
                    <ExitPatternSwatch pattern={ex.pattern} size={22} /> The best case for Exit {ex.letter}: {counter.choice.label}
                  </>
                ) : null;
              })()}
            </p>
            <p className="msn-perspective__text">"{counter.argument}"</p>
            <p className="msn-perspective__prompt">{counter.prompt}</p>
          </article>
        )}
      </section>

      <section className="msn-reasons" aria-labelledby="msn-reasons-title">
        <h3 id="msn-reasons-title" className="msn-section-title">
          What matters most here? <small>Pick up to {MAX_REASONS}</small>
        </h3>
        <ul className="msn-reasons__chips">
          {REASON_CHIPS.map((chip) => {
            const on = reasons.includes(chip);
            return (
              <li key={chip}>
                <button
                  type="button"
                  className="msn-chip"
                  aria-pressed={on}
                  disabled={resealed || (!on && reasons.length >= MAX_REASONS)}
                  onClick={() => onReason(chip)}
                >
                  {on && <Icon name="check" />} {chip}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="msn-reseal" aria-labelledby="msn-reseal-title">
        <h3 id="msn-reseal-title" className="msn-section-title">
          Re-seal: keep or change
        </h3>
        <SealEnvelope
          sealed={resealed}
          sealedLabel={
            finalExit
              ? `Final seal: Exit ${finalExit.letter}. ${
                  finalChoice !== firstVote ? 'You changed your mind: that is thinking, not weakness.' : 'You kept your choice.'
                }`
              : 'Sealed.'
          }
        >
          <ExitGroup
            exits={exits}
            value={picked}
            onChange={setPicked}
            label="Your final exit"
            dots={junior ? null : dots}
            tags={{ [firstVote]: 'Your first seal' }}
            disabled={resealed}
          />
          <Button size="lg" block icon="envelope" className="msn-reseal__btn" onClick={() => onReseal(picked)}>
            {picked === firstVote ? 'Keep it and re-seal' : 'Change and re-seal'}
          </Button>
        </SealEnvelope>
      </section>

      {resealed && !hideContinue && (
        <div ref={afterRef} className="msn-explain__after">
          {answers && Object.values(answers).some((a) => a.good) && (
            <p className="msn-phase__sub">
              <StatusBadge status="safe" label="Nice" /> Your evidence made someone think again.
            </p>
          )}
          <Button size="lg" block icon="play" onClick={onContinue}>
            Release time
          </Button>
        </div>
      )}
    </div>
  );
}
