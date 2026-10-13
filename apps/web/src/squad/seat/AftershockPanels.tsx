import { useEffect, useState } from 'react';
import {
  MISSIONS,
  districtById,
  findAftershock,
  type AftershockDelivery,
  type PendingAftershock,
} from '@shieldquest/shared';
import { AftershockInterlude, PhaseHeading, TimelineRibbon, residentName } from '../../game/mission';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { roleCard } from '../logic';
import { Countdown, RoleIcon } from '../parts';
import { act } from './actions';
import type { SeatCtx } from './context';

/** The engine's pending shape, built from a squad delivery so the solo Aftershock interlude can play it. */
export function pendingFrom(d: AftershockDelivery): PendingAftershock {
  return {
    key: d.key,
    missionId: d.missionId,
    choiceId: d.choiceId,
    aftershockId: d.aftershockId,
    dueAt: 0,
    forecastLikely: d.forecast.total > 0 && d.forecast.matched * 2 >= d.forecast.total,
  };
}

/** One squad Aftershock (or Afterglow): the solo interlude plus the squad's forecast check. */
export function SquadAftershock({
  ctx,
  delivery,
  position,
  onDone,
}: {
  ctx: Pick<SeatCtx, 'snap' | 'band' | 'reduced' | 'cues' | 'announce' | 'flash'>;
  delivery: AftershockDelivery;
  position?: string;
  onDone: () => void;
}) {
  const pending = pendingFrom(delivery);
  const found = findAftershock(MISSIONS, pending);
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));

  useEffect(() => {
    if (!found) onDone();
  }, [found, onDone]);
  if (!found) return null;

  const { matched, total } = delivery.forecast;
  return (
    <>
      {total > 0 && (
        <p className="sq-note sq-note--forecast">
          <Icon name="envelope" /> Forecast check: {matched} of {total} sealed forecasts in your squad saw this coming.
        </p>
      )}
      <AftershockInterlude
        key={delivery.key}
        pending={pending}
        found={found}
        band={ctx.band}
        seed={seed}
        reduced={ctx.reduced}
        position={position}
        onArrive={(polarity) => {
          ctx.cues.cue(polarity === 'risk' ? 'aftershock' : 'afterglow');
          ctx.announce(polarity === 'risk' ? 'An Aftershock from an earlier choice is landing.' : 'An Afterglow from an earlier choice is landing.');
        }}
        onResolve={(optionId) => {
          // Late Hold: only the count reaches the server. Afterglows have nothing to send.
          if (found.spec.polarity === 'risk' && !ctx.snap.me.lateHolds.includes(delivery.key)) {
            void act(ctx, 'lateHold', { key: delivery.key, optionId, player: 0 });
          }
        }}
        onDone={onDone}
      />
    </>
  );
}

/** "Meanwhile, in another Lumen…": the risky branch a safer squad avoided, so every forecast can be checked. */
function ShadowCard({ ctx, onDone }: { ctx: SeatCtx; onDone: () => void }) {
  const shadow = ctx.view.shadow!;
  const found = findAftershock(MISSIONS, {
    key: `${shadow.missionId}:${shadow.aftershockId}`,
    missionId: shadow.missionId,
    choiceId: shadow.choiceId,
    aftershockId: shadow.aftershockId,
    dueAt: 0,
    forecastLikely: false,
  });
  if (!found) return null;
  const who = residentName(found.mission);
  return (
    <div className="msn-phase sq-shadow">
      <PhaseHeading kicker="E · Evaluate the Consequences" title="Meanwhile, in another Lumen…">
        <p className="sq-lead">
          In a Lumen where {who} chose “{found.choice.label}”, this is what came next. Your squad’s choice kept it from happening.
        </p>
      </PhaseHeading>
      <TimelineRibbon tone="risk" label={found.spec.timeLabel} play={!ctx.reduced} />
      <article className="sq-shadow__card">
        <h3 className="sq-h3">{found.spec.title}</h3>
        <p>{found.spec.text}</p>
      </article>
      <Button size="lg" block iconRight="arrowRight" onClick={onDone}>
        Back to our Lumen
      </Button>
    </div>
  );
}

export function AftershockSlot({ ctx }: { ctx: SeatCtx }) {
  const { view, local, patch, snap, now } = ctx;
  const todo = view.aftershocks.filter((d) => !local.shocksDone.includes(d.key));
  const current = todo[0];
  const position = view.aftershocks.length > 1 && current ? `${view.aftershocks.indexOf(current) + 1} of ${view.aftershocks.length}` : undefined;
  // An Afterglow already shows its own "another Lumen" view for the same mission.
  const shadowCovered = Boolean(
    view.shadow &&
      view.aftershocks.some((d) => {
        const f = findAftershock(MISSIONS, pendingFrom(d));
        return d.missionId === view.shadow?.missionId && f?.spec.polarity === 'protective';
      }),
  );

  if (current) {
    return (
      <SquadAftershock
        key={current.key}
        ctx={ctx}
        delivery={current}
        position={position}
        onDone={() => patch((s) => ({ shocksDone: s.shocksDone.includes(current.key) ? s.shocksDone : [...s.shocksDone, current.key] }))}
      />
    );
  }
  if (view.shadow && !local.shadowDone && !shadowCovered) return <ShadowCard ctx={ctx} onDone={() => patch({ shadowDone: true })} />;

  return (
    <div className="msn-phase sq-waiting">
      <PhaseHeading kicker="Up next" title="Your roles flip in a moment">
        <p className="sq-lead">Look up while the rest of the room catches up.</p>
      </PhaseHeading>
      <p className="sq-note sq-note--clock">
        <Icon name="clock" /> Role Flip <Countdown endsAt={snap.session.timeline?.roleFlipAt ?? null} now={now} />
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Role Flip: a role card flips over (role, lens, letter, one-line job), then Live starts for the whole room

export function RoleFlip({ ctx, tapToHold }: { ctx: SeatCtx; tapToHold: boolean }) {
  const { snap, mission, now, reduced, gentle, band } = ctx;
  const role = snap.me.role;
  const card = role ? roleCard(role) : null;
  const d = districtById(mission.district);
  const [flipped, setFlipped] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => setFlipped(true), 700);
    return () => window.clearTimeout(t);
  }, [reduced]);
  const index = (snap.session.missionIndex ?? 0) + 1;

  return (
    <div className="msn-phase sq-roleflip">
      <PhaseHeading kicker={`Mission ${index} · ${d.name}`} title={mission.title}>
        <p className="sq-content-note">
          <Icon name="info" /> Content note: {mission.theme.toLowerCase()}. All people and brands are made up.
        </p>
      </PhaseHeading>

      <div className="sq-rolecard" data-flipped={flipped ? '' : undefined} data-reduced={reduced ? '' : undefined}>
        <div className="sq-rolecard__inner">
          <div className="sq-rolecard__front" aria-hidden="true">
            <Icon name="shield" size="2.5rem" />
            <span>Your role</span>
          </div>
          <div className="sq-rolecard__back" aria-hidden={!flipped && !reduced ? true : undefined}>
            <p className="sq-rolecard__kicker">Your role this mission</p>
            {card && role ? (
              <>
                <p className="sq-rolecard__name">
                  <RoleIcon role={role.role} label={false} size="1.4em" /> {card.name}
                  <span className="sq-rolecard__letter" aria-label={`Letter ${card.letter}`}>
                    {card.letter}
                  </span>
                </p>
                <p className="sq-rolecard__job">{card.job}</p>
                <p className="sq-rolecard__lens">
                  <Icon name="eye" /> Lens: {card.lenses}
                </p>
                {card.alsoCovers.length > 0 && <p className="sq-rolecard__also">Small squad: you also carry the {card.alsoCovers.join(' and ')} job.</p>}
              </>
            ) : (
              <p className="sq-rolecard__job">Your role arrives in a moment.</p>
            )}
          </div>
        </div>
      </div>

      <p className="sq-lead">{mission.intro}</p>

      <ul className="sq-how">
        <li>
          <Icon name="chat" /> Messages to {residentName(mission)} arrive live on every phone at once.
        </li>
        <li>
          <Icon name="pause" /> When you feel rushed, {tapToHold ? 'tap' : 'press and hold'} <strong>HOLD</strong> (or press Space or H).
          Time stops for you.
        </li>
        <li>
          <Icon name="users" /> Everyone can pin, pull strings and vote. Your lens adds your own angle.
        </li>
      </ul>

      <p className="sq-note sq-note--clock" role="status">
        <Icon name="play" /> {gentle || band === 'junior' ? 'Starting soon' : 'Live in'}{' '}
        {!gentle && band !== 'junior' && <Countdown endsAt={snap.session.timeline?.liveAt ?? null} now={now} label="" />}
      </p>
    </div>
  );
}
