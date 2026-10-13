import { Icon } from '../../ui/Icon';
import { PHASE_LABEL, roleName } from '../logic';
import { Countdown, RoleIcon, TotemShape } from '../parts';
import { useSquad } from '../socket';
import { act } from './actions';
import type { SeatCtx } from './context';

const SHARE_FROM = ['investigate', 'think', 'reveal', 'explain', 'reseal', 'release', 'shield', 'bond'];

/**
 * Squad strip (GDD §5.2): the totem, each seat's role icon with a readiness tick, the phase clock,
 * and the anonymous "Need help" flag. It never shows anyone's choices.
 */
export function SquadStrip({ ctx }: { ctx: SeatCtx }) {
  const { snap, view, now, gentle } = ctx;
  const { squad, me } = snap;
  const pending = useSquad((s) => s.pending);
  const counting = view.phase === 'think' || view.phase === 'reseal';
  const synced = view.phase === 'aftershock' || view.phase === 'role-flip' || view.phase === 'live';
  const endsAt = synced ? null : view.phaseEndsAt;

  return (
    <div className="sq-strip" role="group" aria-label={`Squad ${squad.name}`}>
      <span className="sq-strip__totem">
        <TotemShape id={squad.id} size={22} />
        <span className="sq-strip__name">{squad.name}</span>
      </span>
      <ul className="sq-strip__seats" aria-label={counting ? `${view.sealed.count} of ${view.sealed.total} sealed` : 'Squad roles'}>
        {squad.members.map((m) => {
          const mine = m.seatId === me.seatId;
          const label = `${mine ? 'You' : m.pseudonym}${m.role ? `, ${m.shadow ? 'Shadow Clue' : roleName(m.role)}` : ''}${
            counting && m.done ? ', sealed' : ''
          }${m.connected ? '' : ', away'}`;
          return (
            <li
              key={m.seatId}
              className="sq-strip__seat"
              data-me={mine ? '' : undefined}
              data-away={m.connected ? undefined : ''}
              data-done={counting && m.done ? '' : undefined}
              title={label}
            >
              <span className="sr-only">{label}</span>
              <span aria-hidden="true" className="sq-strip__icon">
                {m.role ? <RoleIcon role={m.role} label={false} /> : <Icon name="user" />}
              </span>
              {counting && m.done && (
                <span className="sq-strip__tick" aria-hidden="true">
                  <Icon name="check" size="0.75em" />
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <span className="sq-strip__phase">
        <span className="sq-strip__phase-name">{PHASE_LABEL[view.phase]}</span>
        <Countdown endsAt={endsAt} now={now} hidden={gentle || view.complete} />
      </span>
      {pending > 0 && (
        <span className="sq-strip__sending" role="status">
          Sending…
        </span>
      )}
      <span className="sq-strip__actions">
        {me.canShare && SHARE_FROM.includes(view.phase) && (
          <button
            type="button"
            className="sq-strip__btn"
            aria-pressed={view.shared}
            onClick={() => void act(ctx, 'share', { on: !view.shared })}
          >
            <Icon name="eye" />
            <span>{view.shared ? 'Shared' : 'Share board'}</span>
          </button>
        )}
        <button
          type="button"
          className="sq-strip__btn"
          aria-pressed={me.needHelp}
          onClick={() => {
            void act(ctx, 'needHelp', { on: !me.needHelp });
            ctx.announce(me.needHelp ? 'Help request cleared.' : 'Your facilitator will come over. Nobody else sees who asked.');
          }}
        >
          <Icon name="help" />
          <span>{me.needHelp ? 'Help is coming' : 'Need help'}</span>
        </button>
      </span>
    </div>
  );
}
