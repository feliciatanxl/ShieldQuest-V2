import { useId, useState } from 'react';
import { SKILLS, skillById, type Mission, type SkillId } from '@shieldquest/shared';
import { SKILL_PROMPT } from '../runLogic';
import './parts.css';

export interface ShieldRailProps {
  /** Letter being practised now (enlarged, bold, underlined and boxed). */
  current: SkillId | null;
  /** Letters already passed in this run (shown with a check shape). */
  done: readonly SkillId[];
  /**
   * Prompt fading (GAME_DESIGN.md §5.5). guided: letters only here (the layout shows the prompt line);
   * light: tap a letter to see its prompt; wildcard: the rail is hidden.
   */
  scaffold?: Mission['scaffold'];
}

function CheckShape() {
  return (
    <svg className="msn-rail__check" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <circle cx="8" cy="8" r="7.2" fill="var(--safe)" />
      <path d="M4.6 8.3l2.2 2.2 4.6-4.8" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The six S.H.I.E.L.D. letter badges. Status is shape + word, never colour alone. */
export function ShieldRail({ current, done, scaffold = 'guided' }: ShieldRailProps) {
  const [open, setOpen] = useState<SkillId | null>(null);
  const tipId = useId();
  if (scaffold === 'wildcard') {
    return <p className="sr-only">Wildcard moment: no step prompts this time.</p>;
  }
  const tappable = scaffold === 'light';
  return (
    <nav className="msn-rail" aria-label="S.H.I.E.L.D. steps">
      <ol className="msn-rail__list">
        {SKILLS.map((s) => {
          const isCurrent = s.id === current;
          const isDone = done.includes(s.id);
          const state = isCurrent ? 'current step' : isDone ? 'done' : 'not yet';
          const content = (
            <>
              <span className="msn-rail__letter" aria-hidden="true">
                {s.id}
              </span>
              {isDone && !isCurrent && <CheckShape />}
              <span className="sr-only">
                {s.name}: {state}
              </span>
            </>
          );
          return (
            <li
              key={s.id}
              className="msn-rail__item"
              data-current={isCurrent ? '' : undefined}
              data-done={isDone ? '' : undefined}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {tappable ? (
                <button
                  type="button"
                  className="msn-rail__btn"
                  aria-expanded={open === s.id}
                  aria-controls={tipId}
                  onClick={() => setOpen((o) => (o === s.id ? null : s.id))}
                >
                  {content}
                </button>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>
      {tappable && (
        <p id={tipId} className="msn-rail__tip" role="status" hidden={!open}>
          {open && (
            <>
              <strong>{skillById(open).name}.</strong> {SKILL_PROMPT[open]}
            </>
          )}
        </p>
      )}
    </nav>
  );
}
