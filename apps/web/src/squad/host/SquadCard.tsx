import { useState } from 'react';
import {
  SQUAD_LIMITS,
  SQUAD_TOTEMS,
  guardianById,
  type HostCommand,
  type HostSnapshot,
  type HostSquad,
  type SquadTotemId,
} from '@shieldquest/shared';
import { Icon } from '../../ui/Icon';
import { PHASE_LABEL, awayLabel, roleName } from '../logic';
import { Countdown, MoodBadge, RoleIcon, TotemBadge } from '../parts';

/**
 * One squad on the Conductor grid (GDD §7.3): devices, phase letter, sealed n/N, pins, Guardians, agreement
 * (United / Mostly agree / Split; never the counts), help flags and the anonymous number on Pause.
 */
export function SquadCard({
  squad,
  snap,
  now,
  command,
}: {
  squad: HostSquad;
  snap: HostSnapshot;
  now: number;
  command: (cmd: HostCommand) => void;
}) {
  const [open, setOpen] = useState(false);
  const running = snap.session.phase === 'mission' && !snap.session.missionComplete;
  const others = snap.squads.filter((s) => s.id !== squad.id);
  const moveTargets: { id: SquadTotemId; name: string }[] = running
    ? others.map((s) => ({ id: s.id, name: s.name }))
    : SQUAD_TOTEMS.filter((t) => t.id !== squad.id).map((t) => ({ id: t.id, name: t.name }));
  const spotlit = snap.spotlight === squad.id;
  const full = squad.seats.length >= SQUAD_LIMITS.maxSize;

  return (
    <article className="sq-scard" data-help={squad.needHelp > 0 ? '' : undefined} aria-labelledby={`sq-scard-${squad.id}`}>
      <header className="sq-scard__head">
        <h3 id={`sq-scard-${squad.id}`} className="sq-scard__name">
          <TotemBadge id={squad.id} size={26} />
        </h3>
        <span className="sq-scard__devices" title="Phones connected">
          <Icon name="phone" /> {squad.connected}/{squad.seats.length}
        </span>
      </header>

      <div className="sq-scard__phase">
        {squad.phase ? (
          <>
            <span className="sq-scard__letter" aria-hidden="true">
              {squad.letter ?? '·'}
            </span>
            <span>
              {squad.complete ? 'Done · phones down' : PHASE_LABEL[squad.phase]}
              {!squad.complete && <Countdown endsAt={squad.phaseEndsAt} now={now} />}
            </span>
          </>
        ) : (
          <span className="sq-scard__idle">In the lobby</span>
        )}
      </div>

      <dl className="sq-scard__stats">
        <div>
          <dt>Sealed</dt>
          <dd>
            {squad.sealed.count}/{squad.sealed.total}
          </dd>
        </div>
        <div>
          <dt>Pins</dt>
          <dd>{squad.pins}</dd>
        </div>
        <div>
          <dt>Agreement</dt>
          <dd>{squad.agreement ? <MoodBadge mood={squad.agreement} /> : '—'}</dd>
        </div>
        <div>
          <dt>Decided</dt>
          <dd>{squad.tiePending ? 'Tie: Safety Lead choosing' : squad.decided ? 'Yes' : 'Not yet'}</dd>
        </div>
      </dl>

      {(squad.needHelp > 0 || squad.onBreak > 0) && (
        <p className="sq-scard__flags" role="status">
          {squad.needHelp > 0 && (
            <span className="sq-scard__help">
              <Icon name="help" /> {squad.needHelp} {squad.needHelp === 1 ? 'asks' : 'ask'} for help
              <button type="button" className="sq-linkbtn" onClick={() => command({ type: 'clearHelp', squadId: squad.id })}>
                Clear
              </button>
            </span>
          )}
          {squad.onBreak > 0 && (
            <span>
              <Icon name="door" /> {squad.onBreak} on a break
            </span>
          )}
        </p>
      )}

      {squad.guardians.length > 0 && (
        <p className="sq-scard__guardians">
          <Icon name="shield" /> {squad.guardians.map((g) => guardianById(g).name).join(', ')}
        </p>
      )}

      <div className="sq-scard__actions">
        {running && !squad.complete && (
          <>
            <button type="button" className="sq-cbtn" onClick={() => command({ type: 'next', squadId: squad.id })}>
              <Icon name="arrowRight" /> Next
            </button>
            <button type="button" className="sq-cbtn" onClick={() => command({ type: 'extend', squadId: squad.id, sec: 30 })}>
              <Icon name="clock" /> +30 s
            </button>
          </>
        )}
        <label className="sq-cbtn sq-cbtn--check">
          <input type="checkbox" checked={squad.gentle} onChange={(e) => command({ type: 'squadGentle', squadId: squad.id, on: e.target.checked })} />
          Gentle
        </label>
        {squad.shared && (
          <button
            type="button"
            className="sq-cbtn"
            aria-pressed={spotlit}
            onClick={() => command({ type: 'spotlight', squadId: spotlit ? null : squad.id })}
          >
            <Icon name="eye" /> {spotlit ? 'Clear spotlight' : 'Spotlight'}
          </button>
        )}
        <button type="button" className="sq-cbtn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Icon name="users" /> Seats
        </button>
      </div>

      {open && (
        <table className="sq-seats">
          <caption className="sr-only">Seats in {squad.name} (made-up names only)</caption>
          <thead>
            <tr>
              <th scope="col">Seat</th>
              <th scope="col">Role</th>
              <th scope="col">Phones</th>
              <th scope="col">Move</th>
            </tr>
          </thead>
          <tbody>
            {squad.seats.map((seat) => (
              <tr key={seat.seatId} data-away={seat.connected ? undefined : ''}>
                <th scope="row">
                  <span className="sq-dot" data-on={seat.connected ? '' : undefined} aria-hidden="true" />
                  {seat.pseudonym}
                  <span className="sq-seats__away">{seat.connected ? <span className="sr-only">connected</span> : `away ${awayLabel(seat.awayMs)}`}</span>
                </th>
                <td>
                  {seat.role ? (
                    <span className="sq-seats__role">
                      <RoleIcon role={seat.role} label={false} /> {seat.shadow ? 'Shadow Clue' : roleName(seat.role)}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <select
                    aria-label={`Players sharing ${seat.pseudonym}'s phone`}
                    value={seat.players}
                    onChange={(e) => command({ type: 'setSeatPlayers', seatId: seat.seatId, players: Number(e.target.value) })}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? '1 player' : `${n} sharing`}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="sq-seats__move">
                  <select
                    aria-label={`Move ${seat.pseudonym} to another squad`}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) command({ type: 'moveSeat', seatId: seat.seatId, squadId: e.target.value as SquadTotemId });
                    }}
                  >
                    <option value="">Move to…</option>
                    {moveTargets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {!seat.connected && (
                    <button
                      type="button"
                      className="sq-linkbtn"
                      onClick={() => command({ type: 'removeSeat', seatId: seat.seatId })}
                      aria-label={`Remove ${seat.pseudonym} (phone has left)`}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {open && full && <p className="sq-scard__note">This squad is full ({SQUAD_LIMITS.maxSize}).</p>}
    </article>
  );
}
