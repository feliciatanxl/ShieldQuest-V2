import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  GAME,
  districtById,
  missionById,
  phaseIndex,
  type Mission,
  type ScreenSnapshot,
  type SquadMissionPhase,
} from '@shieldquest/shared';
import { speakerAt } from '../../game/mission/runLogic';
import { prefersReducedMotion, useSettings } from '../../state/settings';
import { Icon } from '../../ui/Icon';
import { LogoMark } from '../../ui/Logo';
import { useRenderMode, type SceneMode } from '../../world';
import * as audio from '../../audio/sfx';
import { setCalmAudio, useWakeLock } from '../hooks';
import { SESSION_PHASE_LABEL, clock, liveSeconds, secondsLeft } from '../logic';
import { ConnectionBanner, RoomCode } from '../parts';
import { useServerNow, useSquad } from '../socket';
import { DebriefStage, ClosingView, debriefSteps, stepCaption, stepTitle, type DebriefStep } from './Debrief';
import {
  DEBRIEF_FRAME_TITLE,
  SCREEN_PHASE_TITLE,
  missionCaption,
  roomDeadline,
  roomPhase,
  screenLanterns,
  screenTrust,
  sessionMarkers,
} from './screenLogic';
import { Lanes, LobbyView, LookUpView, MissionCentre, PausedView, RoomFreezeView, SpotlightPanel } from './views';
import { ScreenCity, ScreenMission } from './World';
import { ScreenDash, screenDashText } from '../dash/ScreenDash';

const SCAFFOLD = { guided: 'Guided', light: 'Light', wildcard: 'Wildcard Sprint' } as const;

function sceneModeFor(phase: SquadMissionPhase): SceneMode {
  if (phase === 'aftershock' || phase === 'role-flip') return 'intro';
  if (phase === 'live') return 'live';
  return phaseIndex(phase) >= phaseIndex('release') ? 'released' : 'frozen';
}

/** Debrief position, kept per room for this projector tab (a reload stays on the same frame). */
function useDebriefStep(code: string, steps: readonly DebriefStep[]): [number, (i: number) => void] {
  const key = `sq.screen.step:${code}`;
  const [index, setIndex] = useState(() => {
    try {
      const v = Number(sessionStorage.getItem(key));
      return Number.isFinite(v) && v >= 0 ? v : 0;
    } catch {
      return 0;
    }
  });
  const clamped = Math.min(index, Math.max(0, steps.length - 1));
  const set = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(steps.length - 1, i));
      setIndex(next);
      try {
        sessionStorage.setItem(key, String(next));
      } catch {
        // Ignore: the frame just restarts after a reload.
      }
    },
    [key, steps.length],
  );
  return [clamped, set];
}

/** The Big Screen: a projector view with no required controls, readable from the back of the room. */
export function BigScreen({ snap }: { snap: ScreenSnapshot }) {
  const { session, squads, room, spotlight, debrief } = snap;
  const status = useSquad((s) => s.status);
  const freeze = useSquad((s) => s.roomFreeze);
  const motion = useSettings((s) => s.motion);
  const reduced = prefersReducedMotion(motion);
  const renderMode = useRenderMode();
  const playing = session.phase === 'mission' && !session.missionComplete;
  const now = useServerNow(playing || session.phase === 'room-freeze' || snap.dash?.stage === 'question' ? 200 : 1000);
  useWakeLock(session.phase !== 'ended');

  const mission: Mission | undefined =
    session.missionIndex !== null ? missionById(session.missionIds[session.missionIndex] ?? '') : undefined;
  const phase = roomPhase(snap, now);
  const tl = session.timeline;
  const pausedAt = session.paused ? session.pausedAt : null;
  const duration = mission?.live.durationSec ?? 60;
  const t = tl ? liveSeconds(tl, now, pausedAt, duration) : 0;
  const tStage = Math.round(t * 10) / 10;

  // ---- Debrief frames (keyboard or presentation clicker on the projector) ----------------------------
  const steps = useMemo(() => debriefSteps(debrief, session.missionIds), [debrief, session.missionIds]);
  const [stepIndex, setStep] = useDebriefStep(session.code, steps);
  const step = session.phase === 'debrief' ? (steps[stepIndex] ?? null) : null;

  // ---- Sound: only the projector carries ambience, after someone turns it on (browsers need a gesture) ----
  const [sound, setSound] = useState(false);
  const ambientWhere = mission && playing ? mission.district : 'city';
  useEffect(() => {
    if (!sound || session.phase === 'ended') return;
    try {
      audio.startAmbient(ambientWhere);
    } catch {
      // Sound is a bonus.
    }
    return () => {
      try {
        audio.stopAmbient();
      } catch {
        // Ignore.
      }
    };
  }, [sound, ambientWhere, session.phase]);
  useEffect(() => {
    setCalmAudio(session.options.calm);
  }, [session.options.calm]);

  // ---- Backdrop ---------------------------------------------------------------------------------------
  // Stable props between snapshots, so the city canvas does not re-render on every clock tick.
  const trust = useMemo(() => screenTrust(snap), [snap]);
  const markers = useMemo(() => sessionMarkers(snap), [snap]);
  const lanterns = useMemo(() => screenLanterns(squads, session.phase), [squads, session.phase]);
  let world: ReactNode;
  const rewind = step?.frame === 'rewind' ? missionById(session.missionIds[0] ?? '') : undefined;
  if (playing && mission && phase && phase !== 'aftershock') {
    const mode = sceneModeFor(phase);
    world = (
      <ScreenMission
        mission={mission}
        mode={mode}
        t={mode === 'live' ? tStage : duration}
        mood={mode === 'live' ? 'tense' : 'neutral'}
        focusCast={mode === 'live' ? speakerAt(mission, tStage) : null}
        renderMode={renderMode}
      />
    );
  } else if (rewind) {
    world = <ScreenMission mission={rewind} mode="frozen" t={rewind.live.durationSec} mood="neutral" focusCast={null} renderMode={renderMode} />;
  } else {
    const freezeAmount = session.phase === 'room-freeze' ? (freeze?.amount ?? room.roomFreeze.amount) : 0;
    const lookUp = session.phase === 'mission' && session.missionComplete;
    world = (
      <ScreenCity
        focus={lookUp && mission ? mission.district : null}
        districtTrust={trust}
        markers={markers}
        freezeAmount={freezeAmount}
        lanterns={lanterns}
        showcase={!reduced && session.phase !== 'room-freeze'}
        renderMode={renderMode}
      />
    );
  }

  // ---- Header, caption and centre ----------------------------------------------------------------------
  let kicker = '';
  let title: string = SESSION_PHASE_LABEL[session.phase];
  let caption: string;
  let centre: ReactNode;
  let showLanes = false;
  let deadline = playing ? roomDeadline(tl, phase) : null;

  if (mission && session.missionIndex !== null && (session.phase === 'mission' || session.phase === 'room-freeze')) {
    kicker = `Mission ${session.missionIndex + 1} of ${session.missionIds.length} · ${districtById(mission.district).name} · ${SCAFFOLD[mission.scaffold]}`;
  }

  switch (session.phase) {
    case 'lobby': {
      const next = missionById(session.missionIds[0] ?? '');
      title = session.roomFreeze.done ? 'Get ready' : 'Join the squad session';
      kicker = next ? `${session.missionIds.length} ${session.missionIds.length === 1 ? 'mission' : 'missions'} today` : '';
      caption = session.acceptingJoins
        ? 'Scan the QR code with your phone camera. No download, no sign-up, no names.'
        : 'Joining is paused. Ask your facilitator if you still need to join.';
      centre = <LobbyView snap={snap} />;
      break;
    }
    case 'room-freeze':
      title = 'The Room Freeze';
      kicker = '';
      caption = 'Everyone, press and hold your HOLD button. Watch the rain.';
      centre = <RoomFreezeView amount={freeze?.amount ?? room.roomFreeze.amount} peak={Math.max(freeze?.peak ?? 0, room.roomFreeze.peak)} reduced={reduced} />;
      break;
    case 'mission':
      if (session.missionComplete || !phase) {
        title = 'Look Up';
        caption = 'Eyes up. Stretch with us. Phones down for a moment.';
        centre = <LookUpView snap={snap} />;
      } else {
        title = phase === 'role-flip' && mission ? mission.title : SCREEN_PHASE_TITLE[phase];
        caption = missionCaption(phase, mission, t);
        centre = spotlight ? (
          <SpotlightPanel spotlight={spotlight} mission={mission} />
        ) : (
          <MissionCentre snap={snap} phase={phase} mission={mission} reduced={reduced} />
        );
        // A spotlit board needs the whole frame; the towers come back when the spotlight clears.
        showLanes = !spotlight;
      }
      break;
    case 'debrief':
      title = step ? stepTitle(step) : DEBRIEF_FRAME_TITLE.flip;
      kicker = step && step.pages > 1 ? `${step.page + 1} of ${step.pages}` : 'Debrief';
      caption = step ? stepCaption(step, session.missionIds) : 'Phones down, eyes up.';
      centre = step ? <DebriefStage step={step} snap={snap} reduced={reduced} /> : null;
      break;
    default:
      title = 'Thank you';
      kicker = '';
      caption = 'Last step on your phone: the short check-out. Thank you for playing.';
      centre = <ClosingView snap={snap} reduced={reduced} />;
  }

  // Squad Dash (lobby or Look Up only): the question, then the answer, then squad totals.
  const dash = snap.dash && (session.phase === 'lobby' || (session.phase === 'mission' && session.missionComplete)) ? snap.dash : null;
  if (dash) {
    const text = screenDashText(dash);
    title = text.title;
    kicker = text.kicker;
    caption = text.caption;
    centre = <ScreenDash dash={dash} />;
    showLanes = false;
    // A soft clock, and none at all in Calm or Gentle mode.
    deadline = dash.stage === 'question' && dash.endsAt !== null && !dash.quiet ? { endsAt: dash.endsAt, label: 'to talk it over' } : null;
  }

  // Freeze All Phones (the Look Up break): the whole projector becomes the stretch break.
  if (session.paused && session.phase !== 'ended') {
    title = 'Look Up';
    caption = 'Eyes up. Stretch with us. Every phone is paused and the clock is stopped.';
    centre = <PausedView room={room} reduced={reduced} />;
    showLanes = false;
  }

  const joinChip = session.acceptingJoins && (session.phase === 'room-freeze' || session.phase === 'mission');

  return (
    <div
      className="sq-scr"
      data-phase={session.phase}
      data-room-phase={phase ?? undefined}
      data-reduced={reduced ? '' : undefined}
      data-paused={session.paused ? '' : undefined}
      data-dash={dash ? dash.stage : undefined}
    >
      <div className="sq-scr__world" inert>
        {world}
      </div>
      <div className="sq-scr__shade" aria-hidden="true" />

      <div className="sq-scr__frame">
        <header className="sq-scr__head">
          <span className="sq-scr__brand">
            <LogoMark size={44} />
            <span className="sq-scr__brand-word">
              Shield<b>Quest</b>
            </span>
          </span>
          <div className="sq-scr__titles">
            {kicker && <p className="sq-scr__kicker">{kicker}</p>}
            <h1 className="sq-scr__title">{title}</h1>
          </div>
          <div className="sq-scr__side">
            {deadline && !session.options.gentle && !session.paused && (
              <p className="sq-scr__clock" role="timer" aria-live="off">
                <Icon name="clock" /> {clock(secondsLeft(deadline.endsAt, now))} <span>{deadline.label}</span>
              </p>
            )}
            {joinChip && (
              <p className="sq-scr__join">
                Join: <RoomCode code={session.code} />
              </p>
            )}
          </div>
        </header>

        <main id="main" className="sq-scr__main">
          {centre}
        </main>

        {showLanes && <Lanes snap={snap} now={now} />}

        <div className="sq-scr__caption">
          <p role="status" aria-live="polite" aria-atomic="true">
            {caption}
          </p>
        </div>

        <footer className="sq-scr__foot">
          <p>{GAME.disclaimer}</p>
        </footer>
      </div>

      <ScreenControls
        sound={sound}
        onSound={() => {
          try {
            audio.unlockAudio();
          } catch {
            // Ignore.
          }
          setSound((s) => !s);
        }}
        debrief={
          session.phase === 'debrief'
            ? { index: stepIndex, total: steps.length, go: setStep }
            : null
        }
      />
      <ConnectionBanner status={status} staff />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Controls: fullscreen, sound, debrief frames. Hidden until the mouse moves or a key is pressed.

function ScreenControls({
  sound,
  onSound,
  debrief,
}: {
  sound: boolean;
  onSound: () => void;
  debrief: { index: number; total: number; go: (i: number) => void } | null;
}) {
  const [awake, setAwake] = useState(true);
  const [full, setFull] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement));
  const timer = useRef<number | undefined>(undefined);
  const wake = useCallback(() => {
    setAwake(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAwake(false), 3500);
  }, []);

  const toggleFull = useCallback(() => {
    const doc = document;
    if (doc.fullscreenElement) void doc.exitFullscreen?.().catch(() => undefined);
    else void doc.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);

  const debriefRef = useRef(debrief);
  debriefRef.current = debrief;
  const soundRef = useRef(onSound);
  soundRef.current = onSound;

  useEffect(() => {
    wake();
    const onFull = () => setFull(Boolean(document.fullscreenElement));
    const onKey = (e: KeyboardEvent) => {
      wake();
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      const onButton = target?.tagName === 'BUTTON';
      const d = debriefRef.current;
      const k = e.key;
      if (k === 'f' || k === 'F') toggleFull();
      else if (k === 'm' || k === 'M') soundRef.current();
      else if (d && ['ArrowRight', 'ArrowDown', 'PageDown'].includes(k)) d.go(d.index + 1);
      else if (d && !onButton && (k === ' ' || k === 'Enter')) d.go(d.index + 1);
      else if (d && ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) d.go(d.index - 1);
      else if (d && k === 'Home') d.go(0);
      else if (d && k === 'End') d.go(d.total - 1);
      else return;
      e.preventDefault();
    };
    document.addEventListener('fullscreenchange', onFull);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointermove', wake, { passive: true });
    window.addEventListener('pointerdown', wake, { passive: true });
    return () => {
      window.clearTimeout(timer.current);
      document.removeEventListener('fullscreenchange', onFull);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
    };
  }, [wake, toggleFull]);

  return (
    <div className="sq-scr__controls" data-awake={awake ? '' : undefined} role="toolbar" aria-label="Big Screen controls">
      {debrief && (
        <>
          <button type="button" className="sq-scr__ctrl" onClick={() => debrief.go(debrief.index - 1)} disabled={debrief.index === 0}>
            <Icon name="arrowLeft" /> <span>Back</span>
          </button>
          <span className="sq-scr__ctrl-pos" aria-live="polite">
            {debrief.index + 1} / {debrief.total}
          </span>
          <button
            type="button"
            className="sq-scr__ctrl"
            onClick={() => debrief.go(debrief.index + 1)}
            disabled={debrief.index >= debrief.total - 1}
          >
            <span>Next</span> <Icon name="arrowRight" />
          </button>
        </>
      )}
      <button type="button" className="sq-scr__ctrl" aria-pressed={sound} onClick={onSound}>
        <Icon name={sound ? 'sound' : 'mute'} /> <span>{sound ? 'Sound on' : 'Sound off'}</span>
      </button>
      <button type="button" className="sq-scr__ctrl" aria-pressed={full} onClick={toggleFull}>
        <Icon name="external" /> <span>{full ? 'Exit full screen' : 'Full screen'}</span>
      </button>
    </div>
  );
}
