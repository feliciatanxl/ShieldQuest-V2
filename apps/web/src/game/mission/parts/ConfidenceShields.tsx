import { useId } from 'react';
import './parts.css';

export type Confidence = 1 | 2 | 3;

export const CONFIDENCE_LABEL: Record<Confidence, string> = { 1: 'Unsure', 2: 'Fairly sure', 3: 'Certain' };

function Shields({ n }: { n: Confidence }) {
  return (
    <span className="msn-conf__shields" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <svg key={i} viewBox="0 0 24 24" width="1.25em" height="1.25em" data-on={i <= n ? '' : undefined}>
          <path d="M12 2.5l8 3.2v6c0 5-3.4 8.9-8 10.3-4.6-1.4-8-5.3-8-10.3v-6z" />
        </svg>
      ))}
    </span>
  );
}

export interface ConfidenceShieldsProps {
  /** Tapping a shield seals the vote with that confidence. */
  onSeal: (confidence: Confidence) => void;
  value?: Confidence | null;
  disabled?: boolean;
  /** Why it is disabled (e.g. "Pick an exit first", "Unlocks in 6 s"). */
  note?: string;
}

/** Unsure (1) / Fairly sure (2) / Certain (3). The tap *is* the seal. */
export function ConfidenceShields({ onSeal, value, disabled, note }: ConfidenceShieldsProps) {
  const noteId = useId();
  return (
    <div className="msn-conf" role="group" aria-label="Seal with how sure you are" aria-describedby={note ? noteId : undefined}>
      {([1, 2, 3] as const).map((c) => (
        <button
          key={c}
          type="button"
          className="msn-conf__btn"
          data-picked={value === c ? '' : undefined}
          disabled={disabled}
          onClick={() => onSeal(c)}
        >
          <Shields n={c} />
          <span className="msn-conf__word">{CONFIDENCE_LABEL[c]}</span>
          <span className="sr-only"> ({c} of 3). Seals your vote.</span>
        </button>
      ))}
      {note && (
        <p id={noteId} className="msn-conf__note">
          {note}
        </p>
      )}
    </div>
  );
}
