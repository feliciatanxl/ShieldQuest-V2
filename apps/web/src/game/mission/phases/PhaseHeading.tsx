import type { ReactNode } from 'react';
import './phases.css';

export interface PhaseHeadingProps {
  /** Small line above the title, e.g. "H · Hold Before Acting". */
  kicker?: string;
  title: string;
  children?: ReactNode;
}

/**
 * Phase title. The h2 is focusable (tabIndex -1, data-msn-focus) so the player can move focus to it on every
 * phase change; screen readers then start reading the new step from the top.
 */
export function PhaseHeading({ kicker, title, children }: PhaseHeadingProps) {
  return (
    <header className="msn-phase__head">
      {kicker && <p className="msn-phase__kicker">{kicker}</p>}
      <h2 className="msn-phase__title" tabIndex={-1} data-msn-focus="">
        {title}
      </h2>
      {children}
    </header>
  );
}

/** Moves focus to the current phase heading (call after a phase change) and shows the step from its very top. */
export function focusPhaseHeading(root: ParentNode = document): void {
  const el = root.querySelector<HTMLElement>('[data-msn-focus]');
  if (!el) return;
  // Scrolling the heading itself into view would hide the kicker line above it; rewind the sheet instead.
  el.focus({ preventScroll: true });
  const scroller = el.closest<HTMLElement>('.msn-layout__sheet-body');
  if (!scroller) {
    el.scrollIntoView({ block: 'nearest' });
    return;
  }
  // 'instant' also cancels a smooth scroll still running from the previous step (e.g. the live chat following
  // its newest message), which would otherwise land the new step part-way down.
  scroller.scrollTo({ top: 0, behavior: 'instant' });
}
