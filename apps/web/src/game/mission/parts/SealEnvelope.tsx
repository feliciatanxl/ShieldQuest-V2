import type { ReactNode } from 'react';
import './parts.css';

export interface SealEnvelopeProps {
  /** Folded and sealed. */
  sealed: boolean;
  /** What is inside (shown on the card before it folds). */
  children?: ReactNode;
  /** Line shown once sealed, e.g. "Sealed. The city will check it later." */
  sealedLabel: string;
}

/** A card that folds into an envelope when sealed (a fade under reduced motion). */
export function SealEnvelope({ sealed, children, sealedLabel }: SealEnvelopeProps) {
  return (
    <div className="msn-envelope" data-sealed={sealed ? '' : undefined}>
      <div className="msn-envelope__card">{children}</div>
      <div className="msn-envelope__body" aria-hidden="true">
        <span className="msn-envelope__flap" />
        <span className="msn-envelope__wax" />
      </div>
      {sealed && (
        <p className="msn-envelope__label" role="status">
          {sealedLabel}
        </p>
      )}
    </div>
  );
}
