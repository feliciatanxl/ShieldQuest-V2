import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SeatDashView, SeatSnapshot } from '@shieldquest/shared';
import { safeHaptic, useAnnouncer, useCues } from '../../game/mission';
import { Icon } from '../../ui/Icon';
import { Countdown, Disclaimer, TotemBadge } from '../parts';
import { useServerNow } from '../socket';
import { act } from '../seat/actions';
import {
  dashQuestionOf,
  dashResultLine,
  dashRoomLine,
  dashStageLabel,
  dashTip,
  livePickLine,
  optionLetter,
  optionText,
  scoreLine,
} from './dashLogic';
import './dash.css';

/**
 * Squad Dash on a phone: tap an answer, see your squad's live counts (never who), and after the reveal
 * the answer, the one-line why and how your squad did. Taps can change until the reveal.
 */
export function SeatDash({ snap, dash, header, flash }: { snap: SeatSnapshot; dash: SeatDashView; header: ReactNode; flash: (t: string) => void }) {
  const { squad, me, session } = snap;
  const q = dashQuestionOf(dash);
  const now = useServerNow(500, dash.stage === 'question' && dash.endsAt !== null);
  const { message, announce } = useAnnouncer();
  const { cue } = useCues();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shared = me.players > 1;
  const [player, setPlayer] = useState(0);
  // This phone's own taps per question and player: shown back after the reveal, and on shared phones
  // (where the server never echoes a tap back, so the next player cannot see the last one's).
  const [taps, setTaps] = useState<Record<string, string>>({});
  const tapKey = (p: number) => `${dash.id}:${dash.questionId ?? ''}:${p}`;
  const [lastTap, setLastTap] = useState<{ questionId: string; optionId: string } | null>(null);

  // A new question or stage: move focus to its heading so screen readers start from the top.
  const stageKey = `${dash.id}:${dash.index}:${dash.stage}`;
  useEffect(() => {
    headingRef.current?.focus();
  }, [stageKey]);

  // New question on a shared phone: back to player 1.
  useEffect(() => setPlayer(0), [dash.id, dash.index]);

  // Reveal: announce the answer and the squad's result once, with a gentle cue.
  const announced = useRef('');
  useEffect(() => {
    if (dash.stage !== 'reveal' || !q || announced.current === stageKey) return;
    announced.current = stageKey;
    const answer = optionText(q, q.answer);
    const room = dashRoomLine(dash.room);
    announce(`The answer is ${answer}. ${dashResultLine(dash.result, q)}${room ? ` ${room}.` : ''}`);
    cue(dash.result?.correct ? 'afterglow' : 'reveal', { caption: dash.result?.correct ? '[warm chime]' : '[soft chime]' });
    if (dash.result?.correct) safeHaptic(30);
  }, [dash.stage, dash.result, dash.room, q, stageKey, announce, cue]);

  const mineFromServer = dash.mine[player]?.optionId;
  const selected = shared ? taps[tapKey(player)] : (mineFromServer ?? taps[tapKey(player)]);

  const tap = (optionId: string) => {
    if (!q || dash.stage !== 'question') return;
    setTaps((t) => ({ ...t, [tapKey(player)]: optionId }));
    if (!shared) setLastTap({ questionId: q.id, optionId });
    safeHaptic(15);
    void act({ flash }, 'dashAnswer', { questionId: q.id, optionId, ...(shared ? { player } : {}) });
  };

  const clockHidden = dash.quiet || session.paused;

  return (
    <main id="main" className="sq-seat__page sq-dash" data-stage={dash.stage}>
      {header}
      <p className="sq-dash__kicker">
        <TotemBadge id={squad.id} size={22} />
        <span>Squad Dash · {dashStageLabel(dash)}</span>
      </p>

      {dash.stage === 'results' ? (
        <section className="sq-dash__results" aria-labelledby="sq-dash-title">
          <h1 id="sq-dash-title" ref={headingRef} tabIndex={-1} className="sq-dash__prompt">
            Squad totals
          </h1>
          <p className="sq-dash__bigscore">
            <strong>{dash.score.correct}</strong>
            <span>of {dash.score.played} right for {squad.name}</span>
          </p>
          {dash.totals.played > 0 && (
            <p className="sq-lead">
              The whole room: {dash.totals.correct} of {dash.totals.played} squad picks were right.
            </p>
          )}
          <p className="sq-callout">
            <Icon name="shield" /> {dashTip(dash.id)}
          </p>
          <p className="sq-progress" role="status">
            <Icon name="check" /> Eyes on the big screen. Your facilitator will carry on.
          </p>
        </section>
      ) : !q ? (
        <p role="status">Loading the question…</p>
      ) : (
        <section className="sq-dash__card" aria-labelledby="sq-dash-title">
          <h1 id="sq-dash-title" ref={headingRef} tabIndex={-1} className="sq-dash__prompt">
            {dash.stage === 'reveal' ? 'The answer' : 'Scam or safe?'}
          </h1>
          <p className="sq-dash__question">{q.prompt}</p>

          {shared && dash.stage === 'question' && (
            <div className="sq-dash__players" role="group" aria-label="Who is tapping on this shared phone?">
              {dash.mine.map((m) => (
                <button key={m.player} type="button" className="sq-dash__player" aria-pressed={player === m.player} onClick={() => setPlayer(m.player)}>
                  Player {m.player + 1}
                  {taps[tapKey(m.player)] && <Icon name="check" size="0.9em" label=", tapped" />}
                </button>
              ))}
            </div>
          )}

          <ul className="sq-dash__opts" aria-label={dash.stage === 'question' ? 'Answers: tap one' : 'Answers'}>
            {q.options.map((o, i) => {
              const n = dash.tally?.counts.find((c) => c.choiceId === o.id)?.n ?? 0;
              const isAnswer = dash.stage === 'reveal' && o.id === q.answer;
              const mine = dash.stage === 'question' ? selected === o.id : !shared && lastTap?.questionId === q.id && lastTap.optionId === o.id;
              const countText = `${n} of your squad`;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    className="sq-dash-opt"
                    aria-pressed={dash.stage === 'question' ? mine : undefined}
                    aria-disabled={dash.stage !== 'question' || undefined}
                    data-answer={isAnswer ? '' : undefined}
                    data-dim={dash.stage === 'reveal' && !isAnswer ? '' : undefined}
                    onClick={() => tap(o.id)}
                  >
                    <span className="sq-dash-opt__letter" aria-hidden="true">
                      {optionLetter(i)}
                    </span>
                    <span className="sq-dash-opt__text">
                      <span className="sr-only">{optionLetter(i)}. </span>
                      {o.text}
                    </span>
                    <span className="sq-dash-opt__tally">
                      <span aria-hidden="true" className="sq-dash-opt__dots">
                        {n > 0 ? '●'.repeat(Math.min(n, 8)) : '○'}
                      </span>
                      <span className="sq-dash-opt__n">
                        <span className="sr-only">, </span>
                        {countText}
                      </span>
                    </span>
                    {isAnswer && (
                      <span className="sq-dash-opt__flag">
                        <Icon name="check" /> Answer
                      </span>
                    )}
                    {mine && (
                      <span className="sq-dash-opt__mine">{dash.stage === 'question' ? (shared ? `Player ${player + 1}’s tap` : 'Your tap') : 'You tapped'}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {dash.stage === 'question' ? (
            <>
              {dash.tally && <p className="sq-dash__live">{livePickLine(dash.tally.counts, q)}</p>}
              <p className="sq-note">
                <Icon name="users" />
                <span>
                  Your squad’s pick is the answer most of you tap. You can change your tap until the reveal. Nobody sees who tapped what.
                </span>
              </p>
              <p className="sq-dash__status">
                {dash.tally && (
                  <span>
                    <Icon name="check" /> {dash.tally.answered} of {dash.tally.total} tapped
                  </span>
                )}
                {clockHidden || dash.endsAt === null ? (
                  <span className="sq-dash__calm">No rush: your facilitator reveals when the room is ready.</span>
                ) : (
                  <Countdown endsAt={dash.endsAt} now={now} label="to talk it over" />
                )}
              </p>
            </>
          ) : (
            <div className="sq-dash__reveal">
              <p className="sq-dash__why">{q.why}</p>
              <p className="sq-dash__result" data-correct={dash.result?.correct ? '' : undefined}>
                <Icon name={dash.result?.correct ? 'check' : 'info'} /> {dashResultLine(dash.result, q)}
              </p>
              {dash.room && <p className="sq-dash__room">{dashRoomLine(dash.room)}.</p>}
              <p className="sq-dash__score">
                {squad.name}: {scoreLine(dash.score)} so far
              </p>
            </div>
          )}
        </section>
      )}
      <p className="sr-only" aria-live="polite">
        {message}
      </p>
      <Disclaimer />
    </main>
  );
}
