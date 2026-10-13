import { districtById, missionById, type Mission, type ScreenSnapshot, type SpotlightView, type SquadMissionPhase } from '@shieldquest/shared';
import { SHIELD_SLOT_LABEL, castName } from '../../game/mission/runLogic';
import { Icon } from '../../ui/Icon';
import { StatusBadge, StatusShape, type Status } from '../../ui/StatusBadge';
import { useElementSize } from '../hooks';
import { clock, secondsLeft } from '../logic';
import { QrCode, RoleIcon, RoomCode, TotemBadge, TotemShape, joinUrl } from '../parts';
import { laneView, lookUpTeaser } from './screenLogic';

// ---------------------------------------------------------------------------------------------
// City Pulse: room totals that only ever grow (holds made, minds changed towards safer, lanterns lit)

export function CityPulse({ room, compact }: { room: ScreenSnapshot['room']; compact?: boolean }) {
  return (
    <dl className="sq-scr-pulse" data-compact={compact ? '' : undefined}>
      <div>
        <dt>
          <Icon name="spark" /> Lanterns lit
        </dt>
        <dd>{room.lanterns}</dd>
      </div>
      <div>
        <dt>
          <Icon name="pause" /> Holds made
        </dt>
        <dd>{room.holdsMade}</dd>
      </div>
      <div>
        <dt>
          <Icon name="heart" /> Minds changed towards safer
        </dt>
        <dd>{room.mindsChangedSafer}</dd>
      </div>
    </dl>
  );
}

// ---------------------------------------------------------------------------------------------
// Lobby: a QR big enough to scan from the back row, the code to read aloud, squads lighting up

export function LobbyView({ snap }: { snap: ScreenSnapshot }) {
  const { session, squads } = snap;
  const [ref, box] = useElementSize<HTMLElement>();
  const join = joinUrl(session.joinPath);
  // As big as the frame allows: the back row has to scan it.
  const qr = Math.round(Math.max(180, Math.min(box.h - 12, box.w * 0.42)));
  const phones = squads.reduce((n, s) => n + s.connected, 0);
  const next = missionById(session.missionIds[0] ?? '');
  return (
    <section ref={ref} className="sq-scr-lobby" aria-label="How to join">
      <div className="sq-scr-lobby__qr">
        {session.acceptingJoins ? (
          <QrCode text={join.full} size={qr} label={`QR code to join session ${session.code}`} />
        ) : (
          <div className="sq-scr-lobby__locked" style={{ width: qr, height: qr }}>
            <Icon name="lock" size="2em" />
            <span>Joining paused</span>
          </div>
        )}
      </div>
      <div className="sq-scr-lobby__info">
        <p className="sq-scr-lobby__scan">Scan to join</p>
        <p className="sq-scr-lobby__label">or go to</p>
        <p className="sq-scr-lobby__url">{join.short}</p>
        <RoomCode code={session.code} className="sq-scr-lobby__code" />
        <p className="sq-scr-lobby__fine">
          <Icon name="lock" /> No download. No sign-up. No names.
        </p>
        <p className="sq-scr-lobby__count" role="status">
          {phones === 0 ? 'Waiting for the first phone…' : `${phones} ${phones === 1 ? 'phone' : 'phones'} in`}
          {session.roomFreeze.done && next ? ` · Next: ${next.title}` : ''}
        </p>
        {squads.length > 0 && (
          <ul className="sq-scr-lobby__squads" aria-label="Squads">
            {squads.map((sq) => (
              <li key={sq.id} data-lit={sq.connected > 0 ? '' : undefined}>
                <TotemBadge id={sq.id} size={40} />
                <span className="sq-scr-lobby__n">{sq.connected}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Room Freeze: the rain stops drop by drop as more of the room holds

export function RoomFreezeView({ amount, peak, reduced }: { amount: number; peak: number; reduced: boolean }) {
  const pct = Math.round(Math.max(0, Math.min(1, amount)) * 100);
  const all = pct >= 100;
  return (
    <section className="sq-scr-freeze" data-all={all ? '' : undefined} data-reduced={reduced ? '' : undefined} aria-label="Room Freeze">
      <p className="sq-scr-freeze__ask">{all ? 'The whole room froze time.' : 'Everyone, press and hold.'}</p>
      <div
        className="sq-scr-freeze__meter"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="How much of the room is holding"
      >
        <span className="sq-scr-freeze__fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="sq-scr-freeze__pct">
        <strong>{pct}%</strong> of the room is holding
        {peak > amount + 0.01 && <span> · best so far {Math.round(peak * 100)}%</span>}
      </p>
      {all && <p className="sq-scr-freeze__line">Holding is the skill. Scams need you to hurry.</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Look Up (between missions): City Pulse and a class-level teaser

export function LookUpView({ snap }: { snap: ScreenSnapshot }) {
  const teaser = lookUpTeaser(snap);
  const n = (snap.session.missionIndex ?? 0) + 1;
  return (
    <section className="sq-scr-lookupview" aria-label="Look Up">
      <p className="sq-scr-lead">Mission {n} done. Here is the whole room so far.</p>
      <CityPulse room={snap.room} />
      {teaser && <p className="sq-scr-teaser">{teaser}</p>}
    </section>
  );
}

/** Freeze All Phones: a breathing circle and the City Pulse while everyone stretches. */
export function PausedView({ room, reduced }: { room: ScreenSnapshot['room']; reduced: boolean }) {
  return (
    <section className="sq-scr-paused" data-reduced={reduced ? '' : undefined} aria-label="Look Up break">
      <div className="sq-scr-paused__breath" aria-hidden="true" />
      <p className="sq-scr-lead">Breathe in… and out. Stretch. Look around the room.</p>
      <CityPulse room={room} compact />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// During a mission: a short centre line for the room's phase (the scene and the towers do the rest)

export function MissionCentre({
  snap,
  phase,
  mission,
  reduced,
}: {
  snap: ScreenSnapshot;
  phase: SquadMissionPhase;
  mission: Mission | undefined;
  reduced: boolean;
}) {
  const { room } = snap;
  switch (phase) {
    case 'aftershock':
      return (
        <section className="sq-scr-centre sq-scr-ripple" data-reduced={reduced ? '' : undefined} aria-label="Aftershock slot">
          <div className="sq-scr-ripple__rings" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="sq-scr-lead">Choices from earlier are still rippling through the city.</p>
          <p className="sq-scr-sub">Watch your phones. Telling someone is always a good late move.</p>
        </section>
      );
    case 'role-flip':
      return (
        <section className="sq-scr-centre" aria-label="Role Flip">
          {mission && <p className="sq-scr-lead">{districtById(mission.district).name}</p>}
          <p className="sq-scr-sub">Read your role card out loud. Roles rotate every mission.</p>
        </section>
      );
    case 'live':
      // The scene is the star: the newest message runs in the caption band.
      return null;
    case 'investigate':
      return (
        <section className="sq-scr-centre sq-scr-centre--low" aria-label="Investigate">
          <p className="sq-scr-sub">Look closely on your phones. Pin what feels wrong. “Seems fine” is a good call too.</p>
          <CityPulse room={room} compact />
        </section>
      );
    case 'think':
    case 'reveal':
    case 'explain':
    case 'reseal':
      return null;
    case 'release':
    case 'shield':
    case 'bond':
      return (
        <section className="sq-scr-centre sq-scr-centre--low" aria-label="The room so far">
          <CityPulse room={room} compact />
        </section>
      );
  }
}

// ---------------------------------------------------------------------------------------------
// Squad towers: counts only, fixed totem order, the same size for every squad (never a ranking)

export function Lanes({ snap, now }: { snap: ScreenSnapshot; now: number }) {
  const { squads, session } = snap;
  if (squads.length === 0) return null;
  return (
    <ul className="sq-scr-lanes" aria-label="Squads" data-count={squads.length}>
      {squads.map((sq) => {
        const lane = laneView(sq, session.phase);
        const left = lane.endsAt !== null && !session.options.gentle && !session.paused ? secondsLeft(lane.endsAt, now) : null;
        return (
          <li key={sq.id} className="sq-scr-lane" data-beam={lane.beam ? '' : undefined} data-phase={sq.phase ?? undefined}>
            <span className="sq-scr-lane__beam" aria-hidden="true" />
            <TotemBadge id={sq.id} size={36} className="sq-scr-lane__name" />
            {lane.meter && (
              <span className="sq-scr-lane__meter" data-kind={lane.meter.kind} aria-hidden="true">
                {Array.from({ length: Math.min(8, lane.meter.total) }, (_, i) => (
                  <span key={i} className="sq-scr-lane__seg" data-on={i < lane.meter!.filled ? '' : undefined} />
                ))}
              </span>
            )}
            <span className="sq-scr-lane__status">
              {lane.beam && <Icon name="spark" />} {lane.status}
            </span>
            {left !== null && left > 0 && (
              <span className="sq-scr-lane__clock" role="timer" aria-live="off">
                <Icon name="clock" /> {clock(left)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------------
// Spotlight: one squad's Evidence Board, only after its Safety Lead tapped Share

const OUTCOME: Record<'success' | 'partial' | 'fail', { status: Status; word: string }> = {
  success: { status: 'safe', word: 'Opened up' },
  partial: { status: 'attention', word: 'Thinking about it' },
  fail: { status: 'risk', word: 'Not yet' },
};

export function SpotlightPanel({ spotlight, mission }: { spotlight: SpotlightView; mission: Mission | undefined }) {
  const label = (clueId: string) => mission?.clues.find((c) => c.id === clueId)?.label ?? 'A detail';
  const { board, shield } = spotlight;
  const ps = mission?.peerShield;
  const parts = shield && ps
    ? (['opener', 'reason', 'offer', 'channel'] as const)
        .map((slot) => ({ slot, tile: ps.slots[slot].find((t) => t.id === shield.picks[slot]) }))
        .filter((p) => p.tile)
    : [];
  return (
    <section className="sq-scr-spot" aria-labelledby="sq-scr-spot-title">
      <h2 id="sq-scr-spot-title" className="sq-scr-spot__title">
        <TotemShape id={spotlight.squadId} size={44} /> {spotlight.name}’s board
        <small>Shared by their Safety Lead</small>
      </h2>
      {parts.length > 0 && ps ? (
        <div className="sq-scr-spot__shield">
          <p className="sq-scr-spot__kicker">Their message to {castName(mission!, ps.friend)}</p>
          <blockquote>
            {parts.map((p) => (
              <span key={p.slot} title={SHIELD_SLOT_LABEL[p.slot].title}>
                {p.tile!.text}{' '}
              </span>
            ))}
          </blockquote>
          {shield?.outcome && <StatusBadge status={OUTCOME[shield.outcome].status} label={OUTCOME[shield.outcome].word} />}
        </div>
      ) : board.pins.length === 0 ? (
        <p className="sq-scr-sub">Nothing pinned yet.</p>
      ) : (
        <ul className="sq-scr-spot__pins">
          {board.pins.slice(0, 6).map((p) => (
            <li key={p.clueId}>
              <Icon name="pin" />
              <span className="sq-scr-spot__label">{label(p.clueId)}</span>
              <span className="sq-scr-spot__roles">
                {p.roles.map((r, i) => (
                  <RoleIcon key={`${r}-${i}`} role={r} />
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!parts.length && board.cleared.length > 0 && (
        <p className="sq-scr-spot__cleared">
          <StatusShape status="safe" size={28} /> Seems fine: {board.cleared.map((p) => label(p.clueId)).join(' · ')}
        </p>
      )}
      <p className="sq-scr-spot__fine">Pins are tagged by role, never by name.</p>
    </section>
  );
}
