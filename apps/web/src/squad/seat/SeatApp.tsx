import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { GAME, MISSIONS, type SeatSnapshot } from '@shieldquest/shared';
import { useProgress } from '../../state/progress';
import { prefersReducedMotion, useSettings } from '../../state/settings';
import { Button, LinkButton } from '../../ui/Button';
import { HelpButton, HelpList } from '../../ui/HelpPanel';
import { Icon } from '../../ui/Icon';
import { LogoMark } from '../../ui/Logo';
import { SettingsPanel } from '../../ui/SettingsPanel';
import { Sheet } from '../../ui/Sheet';
import { useAnnouncer, useCues, safeHaptic } from '../../game/mission';
import { useAudioProfile, useWakeLock } from '../hooks';
import { ConnectionBanner, Disclaimer, TotemBadge } from '../parts';
import { useSquad } from '../socket';
import { act } from './actions';
import { SquadAftershock } from './AftershockPanels';
import { SeatMission } from './SeatMission';
import './seat.css';

/** The phone in a live squad session: one screen per session phase, plus Pause, Need help and reconnecting. */
export function SeatApp({ snap, onLeave }: { snap: SeatSnapshot; onLeave: () => void }) {
  const { session, me, squad } = snap;
  const status = useSquad((s) => s.status);
  const pending = useSquad((s) => s.pending);
  const notice = useSquad((s) => s.notice);
  const [leaving, setLeaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flash = useCallback((text: string) => setToast(text), []);
  const active = session.phase === 'room-freeze' || (session.phase === 'mission' && !squad.mission?.complete);
  useWakeLock(active && !me.onBreak);
  useAudioProfile('squad-phone');

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const noticeSeen = useRef(notice?.n ?? 0);
  useEffect(() => {
    if (!notice || notice.n <= noticeSeen.current) return;
    noticeSeen.current = notice.n;
    if (notice.value.kind === 'moved') setToast(`Your facilitator moved you to squad ${squad.name}.`);
  }, [notice, squad.name]);

  const setBreak = (on: boolean) => void act({ flash }, 'takeBreak', { on });

  let body;
  switch (session.phase) {
    case 'lobby':
      body = <SeatLobby snap={snap} onLeave={() => setLeaving(true)} />;
      break;
    case 'room-freeze':
      body = <RoomFreezePad snap={snap} flash={flash} />;
      break;
    case 'mission':
      body = <SeatMission snap={snap} onLeave={() => setLeaving(true)} onBreak={() => setBreak(true)} />;
      break;
    case 'debrief':
      body = <DebriefCompanion snap={snap} flash={flash} />;
      break;
    default:
      body = <SeatEnded code={session.code} />;
  }

  return (
    <div className="sq-seat" data-phase={session.phase}>
      <ConnectionBanner status={status} pending={pending} />
      {body}
      {toast && (
        <p className="sq-toast" role="status">
          {toast}
        </p>
      )}
      <BreakOverlay open={me.onBreak} onResume={() => setBreak(false)} />
      <FrozenOverlay open={session.paused && session.phase !== 'ended'} />
      <Sheet open={leaving} onClose={() => setLeaving(false)} title="Step out of the session?">
        <p>You can step out any time. Nobody is told why.</p>
        <p>This phone keeps your seat: open the same join link again to come back to your squad.</p>
        <div className="sq-sheet-actions">
          <Button variant="secondary" onClick={() => setLeaving(false)}>
            Stay
          </Button>
          <Button variant="primary" icon="door" onClick={onLeave}>
            Step out
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Overlays

/** Pause: a calm screen; the squad carries on, the facilitator only sees an anonymous count. */
function BreakOverlay({ open, onResume }: { open: boolean; onResume: () => void }) {
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
      className="sq-overlay sq-overlay--break"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onResume();
      }}
    >
      <div className="sq-overlay__inner">
        <div className="sq-overlay__moon" aria-hidden="true" />
        <h2 id={titleId}>Take a break</h2>
        <p>Your squad can carry on without you. Come back whenever you are ready; nothing is lost.</p>
        <p className="sq-overlay__soft">Breathe in slowly… and out. Stretch. Have some water.</p>
        <p className="sq-overlay__soft">Your facilitator only sees that someone is on a break, never who.</p>
        <button type="button" className="ui-btn ui-btn--primary ui-btn--lg" onClick={onResume} autoFocus>
          <Icon name="play" />
          <span>I’m back</span>
        </button>
        <details className="sq-overlay__help">
          <summary>Need to talk?</summary>
          <div className="sq-paper">
            <HelpList />
          </div>
        </details>
      </div>
    </dialog>
  );
}

/** Freeze All Phones (the Look Up break): nothing to do but look up. */
function FrozenOverlay({ open }: { open: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sq-overlay sq-overlay--frozen" aria-labelledby={titleId} onCancel={(e) => e.preventDefault()}>
      <div className="sq-overlay__inner" tabIndex={-1}>
        <Icon name="pause" size="3rem" />
        <h2 id={titleId}>Eyes up</h2>
        <p>Your facilitator has paused every phone. Look up, stretch, and listen in.</p>
        <p className="sq-overlay__soft">The clock is stopped. Your squad picks up exactly where it left off.</p>
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------------------------
// Lobby

function SeatHeader({ title, onLeave }: { title: string; onLeave?: () => void }) {
  const [settings, setSettings] = useState(false);
  return (
    <header className="sq-seat__head">
      <span className="sq-seat__brand">
        <LogoMark size={28} />
        <span>{title}</span>
      </span>
      <span className="sq-seat__head-actions">
        <button type="button" className="ui-iconbtn" onClick={() => setSettings(true)} aria-label="Text size and comfort settings">
          <span aria-hidden="true">Aa</span>
        </button>
        <HelpButton />
        {onLeave && (
          <button type="button" className="ui-iconbtn" onClick={onLeave} aria-label="Step out of the session">
            <Icon name="door" />
          </button>
        )}
      </span>
      <SettingsPanel open={settings} onClose={() => setSettings(false)} />
    </header>
  );
}

function SeatLobby({ snap, onLeave }: { snap: SeatSnapshot; onLeave: () => void }) {
  const { me, squad, session } = snap;
  const others = squad.members.filter((m) => m.seatId !== me.seatId);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <main id="main" className="sq-seat__page">
      <SeatHeader title="Squad session" onLeave={onLeave} />
      <section className="sq-lobby" aria-labelledby="sq-lobby-title">
        <p className="kicker">You’re in</p>
        <h1 id="sq-lobby-title" ref={headingRef} tabIndex={-1} className="sq-lobby__name">
          {me.pseudonym}
        </h1>
        <p className="sq-lobby__why">A made-up name, just for today. Nobody needs your real one.</p>
        <div className="sq-lobby__squad">
          <TotemBadge id={squad.id} size={40} />
          <p>
            {others.length === 0
              ? 'Your squad is filling up.'
              : `With ${others.map((m) => m.pseudonym).join(', ')}${me.players > 1 ? ` · this phone is shared by ${me.players}` : ''}.`}
          </p>
        </div>
        <p className="sq-lobby__wait" role="status">
          <span className="sq-lobby__pulse" aria-hidden="true" /> Waiting for your facilitator to start.
        </p>
        <ul className="sq-how">
          <li>
            <Icon name="pause" /> Scams need you to hurry. Your HOLD button stops time, just for you.
          </li>
          <li>
            <Icon name="users" /> Roles rotate each mission. Everyone can pin, vote and speak.
          </li>
          <li>
            <Icon name="lock" /> Votes are secret. Your squad only ever sees counts.
          </li>
          <li>
            <Icon name="door" /> Pause and Pass are always OK.
          </li>
        </ul>
        <div className="sq-lobby__calibrate">
          <p>If your facilitator asks, do the short check-in first. Then open your join link again; your seat is kept.</p>
          <LinkButton href={`/assess/pre?session=${encodeURIComponent(session.code)}`} variant="secondary" icon="book">
            Before we start: check-in
          </LinkButton>
        </div>
      </section>
      <Disclaimer />
    </main>
  );
}

// ---------------------------------------------------------------------------------------------
// The Room Freeze: everyone presses and holds together; the projector's rain stops mid-air

function RoomFreezePad({ snap, flash }: { snap: SeatSnapshot; flash: (t: string) => void }) {
  const freeze = useSquad((s) => s.roomFreeze);
  const tapToHold = useSettings((s) => s.tapToHold);
  const motion = useSettings((s) => s.motion);
  const reduced = prefersReducedMotion(motion);
  const [holding, setHolding] = useState(false);
  const holdingRef = useRef(false);
  const { message, announce } = useAnnouncer();
  const { cue } = useCues();

  const set = useCallback(
    (on: boolean) => {
      if (holdingRef.current === on) return;
      holdingRef.current = on;
      setHolding(on);
      if (on) {
        safeHaptic(40);
        cue('freeze', { caption: null });
      }
      void act({ flash }, 'roomHold', { on });
    },
    [flash, cue],
  );
  useEffect(() => () => {
    if (holdingRef.current) void act({ flash: () => undefined }, 'roomHold', { on: false });
  }, []);

  const pct = Math.round((freeze?.amount ?? 0) * 100);
  const lastAnnounced = useRef(0);
  useEffect(() => {
    const step = Math.floor(pct / 25);
    if (step !== lastAnnounced.current) {
      lastAnnounced.current = step;
      if (pct >= 100) announce('Everyone is holding. The whole room froze time.');
      else if (step > 0) announce(`${pct} percent of the room is holding.`);
    }
  }, [pct, announce]);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (tapToHold) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    set(true);
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, down: boolean) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (tapToHold) {
      if (down && !e.repeat) set(!holdingRef.current);
      return;
    }
    if (down && !e.repeat) set(true);
    if (!down) set(false);
  };

  return (
    <main id="main" className="sq-seat__page sq-roomfreeze" data-holding={holding ? '' : undefined} data-reduced={reduced ? '' : undefined}>
      <SeatHeader title={`${snap.squad.name} · Room Freeze`} />
      <h1 className="sq-roomfreeze__title" tabIndex={-1}>
        Freeze the room together
      </h1>
      <p className="sq-lead">
        {tapToHold ? 'Tap the button to hold, tap again to let go.' : 'Press and keep holding the button.'} Watch the big screen: when
        everyone holds, the rain stops in mid-air.
      </p>
      <button
        type="button"
        className="sq-roomfreeze__pad"
        aria-pressed={holding}
        onPointerDown={onPointerDown}
        onPointerUp={() => !tapToHold && set(false)}
        onPointerCancel={() => !tapToHold && set(false)}
        onLostPointerCapture={() => !tapToHold && set(false)}
        onClick={() => tapToHold && set(!holdingRef.current)}
        onKeyDown={(e) => onKey(e, true)}
        onKeyUp={(e) => onKey(e, false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Icon name="pause" size="2.5rem" />
        <span>{holding ? 'Holding' : 'HOLD'}</span>
      </button>
      <div className="sq-roomfreeze__meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Room holding">
        <span className="sq-roomfreeze__fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="sq-roomfreeze__count">{pct}% of the room is holding</p>
      <p className="sr-only" aria-live="polite">
        {message}
      </p>
    </main>
  );
}

// ---------------------------------------------------------------------------------------------
// Debrief Companion: Long Fast-Forward deliveries, then phones down, "I see it differently", Carry It Out

const IF_ACTIONS = ['hold and check it myself first', 'say no, even to a friend', 'call the official number I look up myself', 'keep the evidence'] as const;
const IF_PEOPLE = ['a parent or carer', 'a teacher', 'an older sibling or cousin', 'a counsellor', 'a friend I trust'] as const;

function DebriefCompanion({ snap, flash }: { snap: SeatSnapshot; flash: (t: string) => void }) {
  const { squad, session } = snap;
  const motion = useSettings((s) => s.motion);
  const reduced = prefersReducedMotion(motion);
  const cues = useCues();
  const { message, announce } = useAnnouncer();
  const [done, setDone] = useState<string[]>([]);
  const [signalAt, setSignalAt] = useState(0);
  const [action, setAction] = useState<string | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const todo = squad.finale.filter((d) => !done.includes(d.key));
  const current = todo[0];
  const lastMission = session.missionIds[session.missionIds.length - 1] ?? MISSIONS[0]?.id ?? 'squad';

  if (current) {
    return (
      <main id="main" className="sq-seat__page sq-seat__page--sheet">
        <SeatHeader title="The Long Fast-Forward" />
        <div className="sq-seat__sheet">
          <SquadAftershock
            key={current.key}
            ctx={{ snap, band: session.band, reduced, cues, announce, flash }}
            delivery={current}
            position={squad.finale.length > 1 ? `${squad.finale.indexOf(current) + 1} of ${squad.finale.length}` : undefined}
            onDone={() => setDone((d) => [...d, current.key])}
          />
        </div>
        <p className="sr-only" aria-live="polite">
          {message}
        </p>
      </main>
    );
  }

  const ifThen = action && person ? `If someone rushes me with money or a secret, I will ${action} and talk to ${person}.` : null;
  const canSignal = Date.now() - signalAt > 20_000;

  return (
    <main id="main" className="sq-seat__page">
      <SeatHeader title="Debrief" />
      <section className="sq-debrief" aria-labelledby="sq-debrief-title">
        <p className="kicker">Phones down</p>
        <h1 id="sq-debrief-title" tabIndex={-1}>
          Eyes on the big screen
        </h1>
        <p className="sq-lead">Your facilitator will walk through what the room did. Nothing on the screen is about one person.</p>
        <Button
          size="lg"
          block
          variant="secondary"
          icon="users"
          disabled={!canSignal}
          onClick={() => {
            setSignalAt(Date.now());
            void act({ flash }, 'signal', { kind: 'see-differently' });
            announce('Sent. Your facilitator sees only a count.');
          }}
        >
          {canSignal ? 'I see it differently' : 'Sent. Only a count is shown'}
        </Button>
      </section>

      <section className="sq-carry" aria-labelledby="sq-carry-title">
        <h2 id="sq-carry-title" className="sq-h2">
          Carry it out
        </h2>
        <p>Build a private If-Then card. It stays on this phone. Use a role, like “my sister”, not a name.</p>
        <fieldset className="sq-carry__set">
          <legend>If someone rushes me with money or a secret, I will…</legend>
          {IF_ACTIONS.map((a) => (
            <label key={a} className="sq-carry__chip">
              <input type="radio" name="sq-if-action" checked={action === a} onChange={() => setAction(a)} />
              <span>{a}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="sq-carry__set">
          <legend>…and talk to</legend>
          {IF_PEOPLE.map((p) => (
            <label key={p} className="sq-carry__chip">
              <input type="radio" name="sq-if-person" checked={person === p} onChange={() => setPerson(p)} />
              <span>{p}</span>
            </label>
          ))}
        </fieldset>
        {ifThen && <p className="sq-ifthen__text">{ifThen}</p>}
        {saved ? (
          <p className="sq-progress" role="status">
            <Icon name="check" /> Kept on this phone only.
          </p>
        ) : (
          <Button
            icon="lock"
            disabled={!ifThen}
            onClick={() => {
              if (!ifThen) return;
              useProgress.getState().saveIfThen(lastMission, ifThen);
              setSaved(true);
            }}
          >
            Keep it on this phone
          </Button>
        )}
      </section>

      <section className="sq-helpcard" aria-labelledby="sq-helpcard-title">
        <h2 id="sq-helpcard-title" className="sq-h2">
          Help Card
        </h2>
        <HelpList />
      </section>
      <Disclaimer />
      <p className="sr-only" aria-live="polite">
        {message}
      </p>
    </main>
  );
}

function SeatEnded({ code }: { code: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <main id="main" className="sq-seat__page sq-ended">
      <SeatHeader title="Session closed" />
      <section className="sq-ended__card">
        <LogoMark size={64} />
        <h1 ref={ref} tabIndex={-1}>
          {GAME.closing}
        </h1>
        <p>Thank you for playing. Nothing about you leaves this phone: your If-Then card and letters stay here.</p>
        <LinkButton href={`/assess/post?session=${encodeURIComponent(code)}`} size="lg" icon="book">
          Last step: the check-out
        </LinkButton>
        <LinkButton href="/play" variant="secondary" icon="map">
          Keep exploring Lumen on your own
        </LinkButton>
      </section>
      <section className="sq-helpcard" aria-labelledby="sq-ended-help">
        <h2 id="sq-ended-help" className="sq-h2">
          Need to talk?
        </h2>
        <HelpList />
      </section>
      <Disclaimer />
    </main>
  );
}
