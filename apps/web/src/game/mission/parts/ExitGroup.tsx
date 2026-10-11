import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { ExitView } from '../runLogic';
import { ExitCard } from './ExitCard';
import './parts.css';

export interface ExitGroupProps {
  exits: readonly ExitView[];
  value: string | null;
  onChange: (choiceId: string) => void;
  /** Accessible name of the radiogroup. */
  label: string;
  disabled?: boolean;
  /** Number keys 1-N pick an Exit from anywhere on the page (laptop layout). */
  keyboard?: boolean;
  /** Echo Council leanings per choice id (dots). Omit for none (e.g. the junior Mood reveal). */
  dots?: Readonly<Record<string, number>> | null;
  /** Small tags per choice id, e.g. "Your first seal". */
  tags?: Readonly<Record<string, string>>;
}

function isTyping(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/** Exit cards as one radiogroup: roving focus with arrow keys, and 1-4 shortcuts. */
export function ExitGroup({ exits, value, onChange, label, disabled, keyboard = true, dots, tags }: ExitGroupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const focusIndex = Math.max(0, exits.findIndex((e) => e.choice.id === value));

  useEffect(() => {
    if (!keyboard || disabled) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || document.querySelector('dialog[open]')) return;
      const n = Number.parseInt(e.key, 10);
      if (!Number.isInteger(n) || n < 1 || n > exits.length) return;
      e.preventDefault();
      onChange(exits[n - 1]!.choice.id);
      ref.current?.querySelectorAll<HTMLElement>('[role="radio"]')[n - 1]?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboard, disabled, exits, onChange]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!step || disabled) return;
    e.preventDefault();
    const radios = [...(ref.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])];
    const current = radios.indexOf(document.activeElement as HTMLElement);
    const next = (Math.max(0, current) + step + exits.length) % exits.length;
    onChange(exits[next]!.choice.id);
    radios[next]?.focus();
  };

  return (
    <div ref={ref} className="msn-exits" role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} onKeyDown={onKeyDown}>
      {exits.map((e, i) => (
        <ExitCard
          key={e.choice.id}
          letter={e.letter}
          pattern={e.pattern}
          label={e.choice.label}
          detail={e.choice.detail}
          selected={value === e.choice.id}
          onSelect={() => onChange(e.choice.id)}
          disabled={disabled}
          shortcut={keyboard && i < 9 ? i + 1 : undefined}
          dots={dots ? (dots[e.choice.id] ?? 0) : undefined}
          tag={tags?.[e.choice.id]}
          tabIndex={i === focusIndex ? 0 : -1}
        />
      ))}
    </div>
  );
}
