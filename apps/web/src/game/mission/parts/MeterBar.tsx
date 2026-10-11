import { StatusShape, type Status } from '../../../ui/StatusBadge';
import './parts.css';

export interface MeterBarProps {
  /** GUARD: how defensive the friend is (lower is better). DOUBT: how much they doubt the risky plan (higher is better). */
  kind: 'guard' | 'doubt';
  /** 0-100. */
  value: number;
  /** Change since the last tile, shown as +n / −n. */
  delta?: number;
  friend?: string;
}

function describe(kind: MeterBarProps['kind'], v: number): { word: string; status: Status } {
  if (kind === 'guard') {
    if (v >= 60) return { word: 'Defensive', status: 'attention' };
    if (v > 40) return { word: 'Wary', status: 'unknown' };
    return { word: 'Opening up', status: 'safe' };
  }
  if (v >= 60) return { word: 'Having doubts', status: 'safe' };
  if (v >= 35) return { word: 'Wondering', status: 'unknown' };
  return { word: 'Sure it is fine', status: 'attention' };
}

/** A meter that never relies on colour: icon + word + number + five segments. */
export function MeterBar({ kind, value, delta, friend = 'They' }: MeterBarProps) {
  const v = Math.round(Math.max(0, Math.min(100, value)));
  const { word, status } = describe(kind, v);
  const filled = Math.round(v / 20);
  const title = kind === 'guard' ? 'GUARD' : 'DOUBT';
  const help = kind === 'guard' ? `How defensive ${friend} feels. Lower is better.` : `How much ${friend} doubts the plan. Higher is better.`;
  return (
    <div className="msn-meter" data-kind={kind}>
      <div className="msn-meter__head">
        <StatusShape status={status} size={20} />
        <span className="msn-meter__title">{title}</span>
        <span className="msn-meter__word">{word}</span>
        <span className="msn-meter__num">
          {v}
          <span className="sr-only"> out of 100</span>
        </span>
        {delta !== undefined && delta !== 0 && (
          <span key={`${v}-${delta}`} className="msn-meter__delta" data-up={delta > 0 ? '' : undefined}>
            {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
          </span>
        )}
      </div>
      <div
        className="msn-meter__bar"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        aria-valuetext={`${v}, ${word}`}
        aria-label={`${title}: ${help}`}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="msn-meter__seg" data-on={i < filled ? '' : undefined} />
        ))}
      </div>
      <p className="msn-meter__help">{help}</p>
    </div>
  );
}
