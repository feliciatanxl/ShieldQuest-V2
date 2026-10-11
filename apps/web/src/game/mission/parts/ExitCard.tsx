import { useId } from 'react';
import type { ExitPattern } from '../runLogic';
import './parts.css';

/** Neutral pattern swatch (dots / stripes / grid / waves) so Exits never rely on colour or status shapes. */
export function ExitPatternSwatch({ pattern, size = 44 }: { pattern: ExitPattern; size?: number }) {
  const id = useId().replace(/:/g, '');
  const pid = `msn-pat-${pattern}-${id}`;
  return (
    <svg className="msn-exit__swatch" width={size} height={size} viewBox="0 0 44 44" aria-hidden="true">
      <defs>
        {pattern === 'dots' && (
          <pattern id={pid} width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="4" cy="4" r="1.8" fill="currentColor" />
          </pattern>
        )}
        {pattern === 'stripes' && (
          <pattern id={pid} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="2.6" height="7" fill="currentColor" />
          </pattern>
        )}
        {pattern === 'grid' && (
          <pattern id={pid} width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M8 0H0V8" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </pattern>
        )}
        {pattern === 'waves' && (
          <pattern id={pid} width="12" height="8" patternUnits="userSpaceOnUse">
            <path d="M0 4q3-4 6 0t6 0" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </pattern>
        )}
      </defs>
      <rect x="1" y="1" width="42" height="42" rx="10" fill={`url(#${pid})`} />
      <rect x="1" y="1" width="42" height="42" rx="10" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export interface ExitCardProps {
  letter: string;
  pattern: ExitPattern;
  label: string;
  detail?: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  /** Keyboard shortcut number shown on the card (1-4). */
  shortcut?: number;
  /** Echo Council leanings shown as dots (never for the junior band). */
  dots?: number;
  /** Small tag line, e.g. "Your first seal". */
  tag?: string;
  /** Roving focus inside the radiogroup (0 for the checked or first card, -1 for the rest). */
  tabIndex?: number;
}

/** One Exit: letter + neutral pattern + label. Rendered as a radio inside a role="radiogroup". */
export function ExitCard({ letter, pattern, label, detail, selected, onSelect, disabled, shortcut, dots, tag, tabIndex }: ExitCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className="msn-exit"
      data-selected={selected ? '' : undefined}
      onClick={onSelect}
      disabled={disabled}
      tabIndex={tabIndex}
    >
      <span className="msn-exit__badge">
        <ExitPatternSwatch pattern={pattern} />
        <span className="msn-exit__letter">{letter}</span>
      </span>
      <span className="msn-exit__body">
        <span className="msn-exit__label">
          <span className="sr-only">Exit {letter}: </span>
          {label}
        </span>
        {detail && <span className="msn-exit__detail">{detail}</span>}
        {(tag || dots !== undefined) && (
          <span className="msn-exit__meta">
            {tag && <span className="msn-exit__tag">{tag}</span>}
            {dots !== undefined && (
              <span className="msn-exit__dots">
                <span aria-hidden="true">{dots > 0 ? '●'.repeat(dots) : '○'}</span>
                <span className="sr-only">
                  {dots} of the Echo Council lean{dots === 1 ? 's' : ''} this way
                </span>
              </span>
            )}
          </span>
        )}
      </span>
      {shortcut !== undefined && (
        <kbd className="msn-exit__key" aria-hidden="true">
          {shortcut}
        </kbd>
      )}
      <span className="msn-exit__tick" aria-hidden="true" />
    </button>
  );
}
