import type { ScreenDashView } from '@shieldquest/shared';
import { Icon } from '../../ui/Icon';
import { TotemBadge } from '../parts';
import { dashQuestionOf, dashRoomLine, dashTip, optionLetter, optionText } from './dashLogic';
import './dash.css';

/** Projector title, kicker and caption for a Squad Dash stage (the caption band is the polite live region). */
export function screenDashText(dash: ScreenDashView): { title: string; kicker: string; caption: string } {
  const q = dashQuestionOf(dash);
  if (dash.stage === 'results') {
    return { title: 'Squad Dash: squad totals', kicker: `${dash.length} questions`, caption: dashTip(dash.id) };
  }
  const kicker = `Squad Dash · Question ${dash.index + 1} of ${dash.length}`;
  if (dash.stage === 'reveal' && q) {
    const room = dashRoomLine(dash.room);
    return { title: 'The answer', kicker, caption: `Answer: ${optionText(q, q.answer)}.${room ? ` ${room}.` : ''}` };
  }
  return {
    title: 'Scam or safe?',
    kicker,
    caption: dash.quiet
      ? 'Talk it over with your squad. No rush: the answer comes when the room is ready.'
      : 'Talk it over with your squad. Your squad’s pick is the answer most of you tap.',
  };
}

/**
 * The projector during a Squad Dash: the question and its options, how far each squad is (counts), the
 * answer with its one-line why, and at the end each squad's total in fixed totem order (never ranked).
 * It never shows a squad's pick, a split or anything about a single player.
 */
export function ScreenDash({ dash }: { dash: ScreenDashView }) {
  const q = dashQuestionOf(dash);
  if (dash.stage === 'results') {
    return (
      <section className="sq-scr-dash sq-scr-dash--results" aria-label="Squad Dash totals">
        <ul className="sq-scr-dash__totals">
          {dash.squads.map((sq) => (
            <li key={sq.squadId}>
              <TotemBadge id={sq.squadId} size={44} />
              <span className="sq-scr-dash__total">
                <strong>{sq.score.correct}</strong> of {sq.score.played}
              </span>
              <span className="sq-scr-dash__segs" aria-hidden="true">
                {Array.from({ length: Math.min(8, sq.score.played) }, (_, i) => (
                  <span key={i} data-on={i < sq.score.correct ? '' : undefined} />
                ))}
              </span>
            </li>
          ))}
        </ul>
        {dash.totals.played > 0 && (
          <p className="sq-scr-sub">
            The whole room: {dash.totals.correct} of {dash.totals.played} squad picks right.
          </p>
        )}
        <p className="sq-scr-dash__tip">
          <Icon name="shield" /> {dashTip(dash.id)}
        </p>
      </section>
    );
  }
  if (!q) return null;
  const reveal = dash.stage === 'reveal';
  return (
    <section className="sq-scr-dash" data-stage={dash.stage} aria-label={reveal ? 'The answer' : 'Squad Dash question'}>
      <p className="sq-scr-dash__prompt">{q.prompt}</p>
      <ol className="sq-scr-dash__opts" data-count={q.options.length}>
        {q.options.map((o, i) => {
          const isAnswer = reveal && o.id === q.answer;
          return (
            <li key={o.id} className="sq-scr-dash__opt" data-answer={isAnswer ? '' : undefined} data-dim={reveal && !isAnswer ? '' : undefined}>
              <span className="sq-scr-dash__letter" aria-hidden="true">
                {optionLetter(i)}
              </span>
              <span>{o.text}</span>
              {isAnswer && (
                <span className="sq-scr-dash__flag">
                  <Icon name="check" /> Answer
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {reveal ? (
        // How many squads got it right is in the caption band (the room's live region), so it is not repeated here.
        <p className="sq-scr-dash__why">{q.why}</p>
      ) : (
        <ul className="sq-scr-dash__squads" aria-label="Squads tapping">
          {dash.squads.map((sq) => (
            <li key={sq.squadId} data-in={sq.total > 0 && sq.answered >= sq.total ? '' : undefined}>
              <TotemBadge id={sq.squadId} size={32} />
              <span className="sq-scr-dash__segs" aria-hidden="true">
                {Array.from({ length: Math.min(8, Math.max(1, sq.total)) }, (_, i) => (
                  <span key={i} data-on={i < sq.answered ? '' : undefined} />
                ))}
              </span>
              <span className="sq-scr-dash__n">
                {sq.answered}/{sq.total}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
