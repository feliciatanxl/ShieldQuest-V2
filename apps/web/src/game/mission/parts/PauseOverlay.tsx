import { useEffect, useId, useRef } from 'react';
import { Link } from 'wouter';
import type { HelpChannelId } from '@shieldquest/shared';
import { Icon } from '../../../ui/Icon';
import { HelpList } from '../../../ui/HelpPanel';
import './parts.css';

export interface PauseOverlayProps {
  open: boolean;
  onResume: () => void;
  /** Leave link target (default /play). Pass onLeave to handle leaving yourself. */
  leaveHref?: string;
  onLeave?: () => void;
  help?: HelpChannelId[];
}

/** Calm "Take a break" screen. The mission clock is stopped while it shows; Esc resumes. */
export function PauseOverlay({ open, onResume, leaveHref = '/play', onLeave, help }: PauseOverlayProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="msn-pause"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onResume();
      }}
    >
      <div className="msn-pause__inner">
        <div className="msn-pause__moon" aria-hidden="true" />
        <h2 id={titleId}>Take a break</h2>
        <p>The moment is paused. Nothing will happen until you come back.</p>
        <p className="msn-pause__soft">Breathe in slowly… and out. Stretch. Have some water.</p>
        <div className="msn-pause__actions">
          <button type="button" className="ui-btn ui-btn--primary ui-btn--lg" onClick={onResume} autoFocus>
            <Icon name="play" />
            <span>Resume</span>
          </button>
          {onLeave ? (
            <button type="button" className="ui-btn ui-btn--secondary" onClick={onLeave}>
              <Icon name="door" />
              <span>Leave this moment</span>
            </button>
          ) : (
            <Link href={leaveHref} className="ui-btn ui-btn--secondary ui-btn--md">
              <Icon name="door" />
              <span>Leave this moment</span>
            </Link>
          )}
        </div>
        <details className="msn-pause__help">
          <summary>Need to talk?</summary>
          <div className="msn-paper">
            <HelpList extra={help} />
          </div>
        </details>
      </div>
    </dialog>
  );
}
