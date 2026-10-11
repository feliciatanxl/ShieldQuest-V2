import { useCallback, useEffect, useMemo, useRef } from 'react';
import { HORIZON_LABEL, type Forecast } from '@shieldquest/shared';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { SealEnvelope } from '../parts/SealEnvelope';
import { useDragToTarget } from '../parts/useDragToTarget';
import { seededShuffle } from '../runLogic';
import { PhaseHeading } from './PhaseHeading';
import './phases.css';

export const FORECAST_SEALED_LINE = 'Sealed. Lumen will check it later.';

export interface ForecastPhaseProps {
  forecast: Forecast;
  /** Salt for the option order (mission id). */
  missionId: string;
  selected: string | null;
  sealed: boolean;
  onPick: (optionId: string) => void;
  onSeal: () => void;
  onContinue: () => void;
  seed: number;
}

/** Evaluate the Consequences: drag (or tap) one future onto the fog card, then seal it. No right or wrong yet. */
export function ForecastPhase({ forecast, missionId, selected, sealed, onPick, onSeal, onContinue, seed }: ForecastPhaseProps) {
  const fogRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLDivElement>(null);
  const options = useMemo(() => seededShuffle(forecast.options, seed, `${missionId}:forecast`), [forecast.options, seed, missionId]);
  const onDrop = useCallback((id: string) => onPick(id), [onPick]);
  const { drag, handlers, wasDrag } = useDragToTarget<string>(fogRef, onDrop);
  const picked = options.find((o) => o.id === selected) ?? null;

  useEffect(() => {
    if (sealed) continueRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [sealed]);

  return (
    <div className="msn-phase msn-forecast">
      <PhaseHeading kicker="E · Evaluate the Consequences" title="Seal a forecast">
        <p className="msn-forecast__horizon">
          <Icon name="clock" /> Looking ahead: <strong>{HORIZON_LABEL[forecast.horizon]}</strong>
        </p>
      </PhaseHeading>
      <p className="msn-forecast__q">{forecast.question}</p>

      <SealEnvelope sealed={sealed} sealedLabel={FORECAST_SEALED_LINE}>
        <div
          ref={fogRef}
          className="msn-fog"
          data-over={drag?.over ? '' : undefined}
          data-filled={picked ? '' : undefined}
          aria-live="polite"
        >
          <Icon name="fog" />
          {picked ? (
            <p className="msn-fog__text">
              <span className="sr-only">Your forecast: </span>
              {picked.text}
            </p>
          ) : (
            <p className="msn-fog__hint">Drag a future here, or tap one below.</p>
          )}
        </div>
      </SealEnvelope>

      {!sealed && (
        <>
          <ul className="msn-tokens" aria-label="Possible futures">
            {options.map((o) => {
              const isDragging = drag?.id === o.id;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    className="msn-token"
                    aria-pressed={selected === o.id}
                    data-dragging={isDragging ? '' : undefined}
                    style={isDragging ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined}
                    onClick={() => {
                      if (wasDrag()) return;
                      onPick(o.id);
                    }}
                  >
                    <span className="msn-token__grip" aria-hidden="true" {...handlers(o.id)}>
                      <svg viewBox="0 0 12 20" width="12" height="20">
                        {[4, 10, 16].map((y) => (
                          <g key={y}>
                            <circle cx="3" cy={y} r="1.6" fill="currentColor" />
                            <circle cx="9" cy={y} r="1.6" fill="currentColor" />
                          </g>
                        ))}
                      </svg>
                    </span>
                    <span>{o.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Button size="lg" block icon="envelope" disabled={!picked} onClick={onSeal}>
            Seal my forecast
          </Button>
        </>
      )}

      {sealed && (
        <div ref={continueRef} className="msn-forecast__after">
          <p className="msn-phase__sub">There is no right or wrong yet. If this choice comes back later, your envelope opens.</p>
          <Button size="lg" block iconRight="arrowRight" onClick={onContinue}>
            Choose an exit
          </Button>
        </div>
      )}
    </div>
  );
}
