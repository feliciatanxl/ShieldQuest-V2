import { useEffect, useRef, useState } from 'react';
import type { Mission } from '@shieldquest/shared';
import { Button } from '../../../ui/Button';
import { BreathingRing } from '../parts/BreathingRing';
import { CONFIDENCE_LABEL, ConfidenceShields, type Confidence } from '../parts/ConfidenceShields';
import { ExitGroup } from '../parts/ExitGroup';
import { ExitPatternSwatch } from '../parts/ExitCard';
import { SealEnvelope } from '../parts/SealEnvelope';
import { exitFor, type ExitView } from '../runLogic';
import { PhaseHeading } from './PhaseHeading';
import './phases.css';

export interface ThinkPhaseProps {
  mission: Mission;
  /** Exits in this run's shuffled order (exitOrder(mission, seed)). */
  exits: readonly ExitView[];
  firstVote: string | null;
  confidence: Confidence | null;
  /** Tapping a confidence shield seals the vote. */
  onSeal: (choiceId: string, confidence: Confidence) => void;
  onContinue: () => void;
  /** The seal stays locked while the breathing ring runs (default 10 s). */
  lockSeconds?: number;
  /** Pause stops the breathing countdown. */
  paused?: boolean;
  /** Squad: hide Continue (the server moves everyone on). */
  hideContinue?: boolean;
}

/** Think: a calm 10 s lock, then choose an Exit (letters + neutral patterns) and seal it with a shield count. */
export function ThinkPhase({ mission, exits, firstVote, confidence, onSeal, onContinue, lockSeconds = 10, paused, hideContinue }: ThinkPhaseProps) {
  const [picked, setPicked] = useState<string | null>(firstVote);
  const [unlocked, setUnlocked] = useState(false);
  const afterRef = useRef<HTMLDivElement>(null);
  const sealed = firstVote !== null && confidence !== null;
  const sealedExit = exitFor(exits, firstVote);

  useEffect(() => {
    if (sealed) afterRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [sealed]);

  const note = !unlocked ? 'The seal unlocks when the breathing ring finishes.' : !picked ? 'Pick an exit first.' : 'Tap how sure you are. That tap seals your vote.';

  return (
    <div className="msn-phase msn-think">
      <PhaseHeading kicker="L · Lead the Right Choice" title="Think, then seal">
        <p className="msn-think__prompt">{mission.live.decisionPrompt}</p>
      </PhaseHeading>

      {!sealed && <BreathingRing seconds={lockSeconds} paused={paused} onDone={() => setUnlocked(true)} />}

      <SealEnvelope
        sealed={sealed}
        sealedLabel={
          sealedExit && confidence
            ? `Sealed: Exit ${sealedExit.letter} · ${CONFIDENCE_LABEL[confidence]}. Nobody else can see it.`
            : 'Sealed.'
        }
      >
        <ExitGroup exits={exits} value={picked} onChange={setPicked} label="Exits: choose what the resident should do" disabled={sealed} />
      </SealEnvelope>

      {sealed && sealedExit && (
        <p className="msn-think__sealed">
          <ExitPatternSwatch pattern={sealedExit.pattern} size={28} />
          <span>
            <strong>Exit {sealedExit.letter}:</strong> {sealedExit.choice.label}
          </span>
        </p>
      )}

      {!sealed && (
        <ConfidenceShields
          value={confidence}
          disabled={!unlocked || !picked}
          note={note}
          onSeal={(c) => {
            if (picked && unlocked) onSeal(picked, c);
          }}
        />
      )}

      {sealed && !hideContinue && (
        <div ref={afterRef}>
          <Button size="lg" block iconRight="arrowRight" onClick={onContinue}>
            Hear other views
          </Button>
        </div>
      )}
    </div>
  );
}
