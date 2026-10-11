import { feedbackSentence, tacticById, type FeedbackCard as FeedbackSpec } from '@shieldquest/shared';
import { Icon } from '../../../ui/Icon';
import './parts.css';

const withStop = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

export interface FeedbackCardProps {
  feedback: FeedbackSpec;
  heading?: string;
}

/**
 * Fixed, offender-focused template (GAME_DESIGN.md §6.3):
 * "[Tactic] is designed to [effect]. A safer move is [action]. If it already happened, [recovery]."
 */
export function FeedbackCard({ feedback, heading = 'How the trick works' }: FeedbackCardProps) {
  const tactic = tacticById(feedback.tactic);
  const f = feedbackSentence(feedback, tactic.name, tactic.designedTo);
  return (
    <article className="msn-feedback msn-paper">
      <p className="msn-feedback__kicker">
        <Icon name="book" /> {heading}
      </p>
      <p className="msn-feedback__text">
        <strong>{f.tactic}</strong> is designed to {withStop(f.designedTo)} A safer move is <strong>{withStop(f.saferMove)}</strong> If it
        already happened, {withStop(f.ifItHappened)}
      </p>
      <p className="msn-feedback__counter">
        <span className="msn-feedback__ring">{tactic.ringLabel}</span> {tactic.counter}
      </p>
    </article>
  );
}
