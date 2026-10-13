import { useId, useState } from 'react';
import { BANDS, DASH_LENGTHS, type DashLength, type HostCommand, type HostSnapshot } from '@shieldquest/shared';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { clock } from '../logic';
import { TotemBadge } from '../parts';
import {
  dashCanStart,
  dashClockSec,
  dashQuestionOf,
  dashRoomLine,
  dashStageLabel,
  optionLetter,
  optionText,
  scoreLine,
} from './dashLogic';
import './dash.css';

/**
 * Conductor: start a Squad Dash (4, 6 or 8 questions for the session's band) and run it. Progress per squad
 * is a count of taps, never which option; after the reveal each squad's pick shows (squad level only).
 */
export function DashPanel({ snap, now, command, busy }: { snap: HostSnapshot; now: number; command: (cmd: HostCommand) => void; busy: boolean }) {
  const dash = snap.dash ?? null;
  const { session } = snap;
  const [length, setLength] = useState<DashLength>(6);
  const groupId = useId();
  const can = dashCanStart(session, Boolean(dash));
  const band = BANDS.find((b) => b.id === session.band);

  if (!dash) {
    return (
      <section className="sq-panel sq-dashpanel" aria-labelledby="sq-dash-start-title">
        <h2 id="sq-dash-start-title" className="sq-panel__title">
          Squad Dash <small>Optional team quiz · squads score, never players</small>
        </h2>
        <p className="sq-dashpanel__lead">
          Quick “Scam or safe?” questions for the {band ? `${band.label} (${band.ages})` : ''} band. Every player taps; each squad’s pick is
          its majority, and a tie is a split that does not score.
        </p>
        <fieldset className="sq-dashpanel__lengths" aria-describedby={`${groupId}-why`}>
          <legend>Questions</legend>
          {DASH_LENGTHS.map((n) => (
            <label key={n} className="sq-cbtn sq-cbtn--check">
              <input type="radio" name={`${groupId}-len`} value={n} checked={length === n} onChange={() => setLength(n)} />
              {n}
            </label>
          ))}
        </fieldset>
        <Button icon="play" disabled={!can.ok || busy} onClick={() => command({ type: 'dashStart', questions: length })}>
          Start Squad Dash
        </Button>
        <p id={`${groupId}-why`} className="sq-dashpanel__hint">
          {can.reason}
          {session.options.calm ? ' Calm Mode is on: no clock, you reveal each answer.' : ''}
        </p>
      </section>
    );
  }

  const q = dashQuestionOf(dash);
  const left = dashClockSec(dash, now, session.paused);
  const lastQuestion = dash.index + 1 >= dash.length;
  return (
    <section className="sq-panel sq-panel--wide sq-dashpanel" data-live="" aria-labelledby="sq-dash-title">
      <h2 id="sq-dash-title" className="sq-panel__title">
        Squad Dash <small>{dashStageLabel(dash)}</small>
        {left !== null && (
          <span className="sq-ctrl__clock" role="timer" aria-live="off">
            {clock(left)}
          </span>
        )}
        {dash.stage === 'question' && dash.endsAt === null && <span className="sq-tag">No clock · you reveal</span>}
      </h2>

      {q && dash.stage !== 'results' && (
        <div className="sq-dashpanel__q">
          <p className="sq-dashpanel__prompt">{q.prompt}</p>
          <p className="sq-dashpanel__answer">
            <Icon name="check" /> Answer: {optionText(q, q.answer)}
            {dash.stage === 'question' && <span className="sq-tag">Conductor only until the reveal</span>}
          </p>
          {dash.stage === 'reveal' && <p className="sq-dashpanel__why">{q.why}</p>}
        </div>
      )}

      <ul className="sq-dashpanel__squads" aria-label="Squads">
        {dash.squads.map((sq) => {
          const r = sq.result;
          const status =
            dash.stage === 'question'
              ? `${sq.answered} of ${sq.total} tapped`
              : dash.stage === 'reveal'
                ? !r
                  ? 'Sat this one out'
                  : r.correct
                    ? `Picked ${q ? optionLetter(q.options.findIndex((o) => o.id === r.pick)) : ''} · right`
                    : r.split
                      ? 'Split · no squad pick'
                      : r.pick === null
                        ? 'No taps'
                        : `Picked ${q ? optionLetter(q.options.findIndex((o) => o.id === r.pick)) : ''} · not this time`
                : scoreLine(sq.score);
          return (
            <li key={sq.squadId} data-in={dash.stage === 'question' && sq.total > 0 && sq.answered >= sq.total ? '' : undefined} data-right={r?.correct ? '' : undefined}>
              <TotemBadge id={sq.squadId} size={24} />
              {dash.stage === 'question' && (
                <span className="sq-dashpanel__bar" aria-hidden="true">
                  <span style={{ width: `${sq.total ? Math.min(100, (sq.answered / sq.total) * 100) : 0}%` }} />
                </span>
              )}
              <span className="sq-dashpanel__status">
                {dash.stage === 'reveal' && r?.correct && <Icon name="check" />} {status}
              </span>
              {dash.stage !== 'results' && <span className="sq-dashpanel__score">{scoreLine(sq.score)}</span>}
            </li>
          );
        })}
      </ul>

      {dash.stage === 'reveal' && dash.room && <p className="sq-dashpanel__room">{dashRoomLine(dash.room)}.</p>}
      {dash.stage === 'results' && (
        <p className="sq-dashpanel__room">
          Room: {dash.totals.correct} of {dash.totals.played} squad picks right.{' '}
          {dash.rounds.map((r, i) => (r.skipped ? `Q${i + 1} skipped` : `Q${i + 1}: ${r.correct}/${r.squads}`)).join(' · ')}
        </p>
      )}

      <div className="sq-ctrl__row" role="group" aria-label="Squad Dash controls">
        <button type="button" className="sq-cbtn" disabled={busy} onClick={() => command({ type: 'dashNext' })}>
          <Icon name="arrowRight" />{' '}
          {dash.stage === 'question' ? 'Reveal now' : dash.stage === 'reveal' ? (lastQuestion ? 'Show totals' : 'Next question') : 'Close Squad Dash'}
        </button>
        {dash.stage === 'question' && (
          <button type="button" className="sq-cbtn" disabled={busy} onClick={() => command({ type: 'dashSkip' })}>
            <Icon name="close" /> Skip question
          </button>
        )}
        {dash.stage === 'question' && dash.endsAt !== null && (
          <button type="button" className="sq-cbtn" disabled={busy} onClick={() => command({ type: 'extend', sec: 30 })}>
            <Icon name="clock" /> +30 s
          </button>
        )}
        {dash.stage !== 'results' && (
          <button type="button" className="sq-cbtn sq-cbtn--warn" disabled={busy} onClick={() => command({ type: 'dashEnd' })}>
            <Icon name="door" /> {dash.rounds.some((r) => !r.skipped) ? 'End: show totals' : 'End Squad Dash'}
          </button>
        )}
      </div>
    </section>
  );
}
