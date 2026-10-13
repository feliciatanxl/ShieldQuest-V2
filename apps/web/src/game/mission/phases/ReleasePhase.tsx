import { useMemo } from 'react';
import type { Choice, Clue, Mission } from '@shieldquest/shared';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { EffectDials } from '../parts/EffectDials';
import { ExitPatternSwatch } from '../parts/ExitCard';
import { FeedbackCard } from '../parts/FeedbackCard';
import { TimelineRibbon } from '../parts/TimelineRibbon';
import { formatMoney, hypercorrectionClue, isConfidentRisk, residentName, withStop, type ExitView } from '../runLogic';
import { PhaseHeading } from './PhaseHeading';
import './phases.css';

export const REMEMBER_LINE = 'The city will remember this.';
export const SEED_LINE = 'Something is still in motion.';

const MOOD_TAG: Record<Choice['outcome']['mood'], string> = {
  shiny: 'Right now, it feels like a win',
  warm: 'A protective choice',
  sober: 'An honest cost',
  mixed: 'Some good, some cost',
};

export interface ReleasePhaseProps {
  mission: Mission;
  /** The final (re-sealed) choice. */
  choice: Choice;
  exit?: ExitView;
  firstVote: string | null;
  confidence: 1 | 2 | 3 | null;
  /** Ordinary details the player pinned as red flags (explained gently). */
  pinnedDecoys: readonly Clue[];
  onContinue: () => void;
  continueLabel?: string;
  reduced?: boolean;
  /** Squad: the decided Exit is the squad's, so the private correction note uses this device's own seal. */
  hideContinue?: boolean;
}

function Coins({ amount }: { amount: number }) {
  const n = Math.min(7, Math.max(3, Math.round(Math.abs(amount) / 40)));
  return (
    <div className="msn-coins" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="msn-coins__coin" style={{ ['--i' as string]: String(i), left: `${10 + ((i * 37) % 80)}%` }} />
      ))}
    </div>
  );
}

/** Release: time resumes, the outcome lands with its dials, the Feedback Card, decoy notes and any Seed. */
export function ReleasePhase({
  mission,
  choice,
  exit,
  firstVote,
  confidence,
  pinnedDecoys,
  onContinue,
  continueLabel = 'Continue',
  reduced,
  hideContinue,
}: ReleasePhaseProps) {
  const who = residentName(mission);
  const { outcome } = choice;
  const confidentRisk = isConfidentRisk(mission, firstVote, confidence);
  const flip = useMemo(() => (confidentRisk ? hypercorrectionClue(mission, firstVote) : null), [confidentRisk, mission, firstVote]);
  const wallet = outcome.effects.wallet ?? 0;

  return (
    <div className="msn-phase msn-release">
      <PhaseHeading kicker="E · Evaluate the Consequences" title="Time starts again" />

      <article className="msn-outcome" data-mood={outcome.mood}>
        {outcome.mood === 'shiny' && wallet > 0 && !reduced && <Coins amount={wallet} />}
        <p className="msn-outcome__tag">{MOOD_TAG[outcome.mood]}</p>
        {exit && (
          <p className="msn-outcome__exit">
            <ExitPatternSwatch pattern={exit.pattern} size={24} /> Exit {exit.letter}: {choice.label}
          </p>
        )}
        <h3 className="msn-outcome__title">{outcome.title}</h3>
        <p className="msn-outcome__text">{outcome.text}</p>
        {outcome.mood === 'shiny' && wallet > 0 && (
          <p className="msn-outcome__honest">
            <Icon name="info" /> {formatMoney(wallet)} of in-game money, for now.
          </p>
        )}
        <EffectDials effects={outcome.effects} animate={!reduced} who={who} />
        <p className="msn-outcome__remember">{REMEMBER_LINE}</p>
      </article>

      <FeedbackCard feedback={choice.feedback} />

      {pinnedDecoys.length > 0 && (
        <section className="msn-decoys msn-paper" aria-labelledby="msn-decoys-title">
          <h3 id="msn-decoys-title" className="msn-decoys__title">
            About the details you pinned
          </h3>
          <p className="msn-decoys__intro">Not every detail is a warning sign. Telling them apart is a skill, and it grows with practice.</p>
          <ul>
            {pinnedDecoys.map((c) => (
              <li key={c.id}>
                <strong>{withStop(c.label)}</strong> {c.explain}
              </li>
            ))}
          </ul>
        </section>
      )}

      {flip && (
        <section className="msn-flip" aria-labelledby="msn-flip-title">
          <h3 id="msn-flip-title" className="msn-flip__title">
            <Icon name="lock" /> A private note
          </h3>
          <p>You were sure. Here's the one detail that flips it…</p>
          <p className="msn-flip__clue">
            <strong>{withStop(flip.label)}</strong> {flip.explain}
          </p>
          <p className="msn-flip__fine">Being sure and still learning is how good judgement grows. Only you see this note.</p>
        </section>
      )}

      {choice.aftershock && (
        <div className="msn-release__seed">
          <TimelineRibbon tone="seed" label={SEED_LINE} caption="It may surface after your next moment." play={!reduced} />
        </div>
      )}

      {!hideContinue && (
        <Button size="lg" block iconRight="arrowRight" onClick={onContinue}>
          {continueLabel}
        </Button>
      )}
    </div>
  );
}
