import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams, useSearch } from 'wouter';
import {
  MISSIONS,
  SCENES,
  findAftershock,
  missionById,
  tacticById,
  type Clue,
  type GuardianId,
  type Mission,
  type SceneAnchor,
  type ShieldSlot,
} from '@shieldquest/shared';
import { useProgress } from '../../state/progress';
import { prefersReducedMotion, useSettings } from '../../state/settings';
import { LinkButton } from '../../ui/Button';
import { useRenderMode, type MissionSceneProps, type SceneMode } from '../../world';
import { CaptionBand } from './parts/CaptionBand';
import { safeAmbient, safeMotif, safeUnlock, useAnnouncer, useCues } from './parts/cues';
import { HoldButton, type RingTactic } from './parts/HoldButton';
import { MissionStage } from './parts/MissionStage';
import { PauseOverlay } from './parts/PauseOverlay';
import { ShieldRail } from './parts/ShieldRail';
import { StageLayout, type StageEmphasis } from './parts/StageLayout';
import { TopBar } from './parts/TopBar';
import { AftershockInterlude } from './phases/AftershockInterlude';
import { BondPhase } from './phases/BondPhase';
import { ExplainPhase } from './phases/ExplainPhase';
import { ForecastPhase } from './phases/ForecastPhase';
import { FreezePhase, keyForClue } from './phases/FreezePhase';
import { IntroPhase } from './phases/IntroPhase';
import { LivePhase } from './phases/LivePhase';
import { PeerShieldPhase } from './phases/PeerShieldPhase';
import { focusPhaseHeading } from './phases/PhaseHeading';
import { ReleasePhase } from './phases/ReleasePhase';
import { ThinkPhase } from './phases/ThinkPhase';
import { TracePhase } from './phases/TracePhase';
import { SHIELD_MAX_TRIES } from './runReducer';
import {
  PHASE_PROMPT,
  exitFor,
  landedCount,
  litTactics,
  moodForChoice,
  newRunSeed,
  nextMissionId,
  pinnedDecoys,
  railLetters,
  ringTactics,
  sentenceCase,
  speakerAt,
  stageHotspots,
  surgeLine,
  type Call,
  type StageView,
} from './runLogic';
import { useMissionRun } from './useMissionRun';
import './mission.css';

/** At most two Aftershocks land per slot; the rest roll on to the next mission or Nightfall. */
const SHOCKS_PER_SLOT = 2;

const PHASE_EMPHASIS: Record<string, StageEmphasis> = {
  intro: 'panel',
  live: 'balanced',
  freeze: 'balanced',
  trace: 'balanced',
  forecast: 'panel',
  think: 'panel',
  explain: 'panel',
  release: 'balanced',
  shield: 'sheet-only',
  saved: 'sheet-only',
};

function isTyping(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/** /play/m/:id — the solo mission player. */
export default function MissionPage() {
  const params = useParams<{ id: string }>();
  const mission = missionById(params.id ?? '');
  const [nonce, setNonce] = useState(0);

  if (!mission) return <MissionNotFound />;
  // Keyed so a new mission id (Next) or a Replay starts a fresh run, with any newly due Aftershocks first.
  return <MissionRunner key={`${mission.id}:${nonce}`} mission={mission} onReplay={() => setNonce((n) => n + 1)} />;
}

function MissionNotFound() {
  useEffect(() => {
    document.title = 'Moment not found · ShieldQuest';
  }, []);
  return (
    <main id="main" className="msn-notfound">
      <div className="msn-notfound__card">
        <p className="kicker">ShieldQuest City</p>
        <h1>This moment isn't here</h1>
        <p>It may have moved, or the link is not quite right. Every open moment is on the city map.</p>
        <LinkButton href="/play" icon="map" size="lg">
          Back to the city
        </LinkButton>
      </div>
    </main>
  );
}

function MissionRunner({ mission, onReplay }: { mission: Mission; onReplay: () => void }) {
  const band = useSettings((s) => s.band);
  const motion = useSettings((s) => s.motion);
  const tapToHold = useSettings((s) => s.tapToHold);
  const holdMs = useSettings((s) => s.holdMs);
  const gentle = useSettings((s) => s.gentle);
  const reduced = prefersReducedMotion(motion);
  const renderMode = useRenderMode();
  const cues = useCues();
  const { cue } = cues;
  const { message, announce } = useAnnouncer();
  const ifThenCards = useProgress((s) => s.progress.ifThenCards);
  // Missions started from a City Board tile (?from=board) return to the board.
  const fromBoard = new URLSearchParams(useSearch()).get('from') === 'board';
  const backHref = fromBoard ? '/play/board' : '/play';

  // Aftershocks due before this mission, snapshotted so landing one doesn't reshuffle the queue.
  const [shocks] = useState(() =>
    useProgress
      .getState()
      .due()
      .map((pending) => ({ pending, found: findAftershock(MISSIONS, pending) }))
      .filter((x): x is { pending: typeof x.pending; found: NonNullable<typeof x.found> } => x.found !== null)
      .slice(0, SHOCKS_PER_SLOT),
  );
  const [shockIndex, setShockIndex] = useState(0);
  const [shockSeed] = useState(newRunSeed);
  const inShocks = shockIndex < shocks.length;

  const run = useMissionRun({ mission, band, reduced, cues, announce, gentle });
  const { state, dispatch, t, paused, setPaused, hold, exits, unfolded, completion, nudge, freezeElapsed } = run;
  const { phase } = state;
  const [selected, setSelected] = useState<string | null>(null);
  const sceneAnchors = SCENES[mission.scene] as readonly SceneAnchor[];

  useEffect(() => {
    document.title = `${mission.title} · ShieldQuest`;
  }, [mission.title]);

  // Ambient pad for the district while this moment is open.
  useEffect(() => () => safeAmbient(null), []);

  // Focus the new step's heading so keyboard and screen-reader players start at the top.
  const focusKey = inShocks ? `shock-${shockIndex}` : phase;
  useEffect(() => {
    const id = window.setTimeout(() => focusPhaseHeading(document.querySelector('.msn-layout__sheet') ?? document), 30);
    return () => window.clearTimeout(id);
  }, [focusKey]);

  useEffect(() => {
    if (phase !== 'freeze') setSelected(null);
  }, [phase]);

  // Esc opens the pause screen (the pause dialog's own Esc resumes).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || paused || document.querySelector('dialog[open]') || isTyping(e.target)) return;
      if (phase === 'freeze' && selected) {
        setSelected(null);
        return;
      }
      setPaused(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused, phase, selected, setPaused]);

  // Peer Shield reply sound.
  const shieldOutcome = state.shieldResult?.outcome;
  useEffect(() => {
    if (shieldOutcome) cue(shieldOutcome === 'success' ? 'success' : 'soft-fail');
  }, [shieldOutcome, cue]);

  // ---- Stage ---------------------------------------------------------------------------------
  const landed = landedCount(mission, t);
  const stageView: StageView = phase === 'live' ? 'live' : phase === 'freeze' ? 'frozen' : 'after';
  const hotspots = useMemo(
    () => (phase === 'intro' ? [] : stageHotspots(mission, stageView, phase === 'live' ? t : state.frozenAt, state.looks, state.calls)),
    // t only matters through the number of landed beats.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mission, phase, stageView, landed, state.frozenAt, state.looks, state.calls],
  );
  const thread = useMemo(
    () => (phase === 'trace' ? { from: mission.influence.from, revealed: state.threadPulled } : null),
    [phase, mission.influence.from, state.threadPulled],
  );
  const finalChoice = mission.choices.find((c) => c.id === state.finalChoice);
  const sceneMode: SceneMode =
    phase === 'intro' ? 'intro' : phase === 'live' ? 'live' : phase === 'release' || phase === 'shield' || phase === 'saved' ? 'released' : 'frozen';
  const mood: MissionSceneProps['mood'] = phase === 'live' ? 'tense' : phase === 'release' ? moodForChoice(finalChoice) : 'neutral';
  const speaker = phase === 'live' ? speakerAt(mission, t) : phase === 'trace' ? mission.influence.from : phase === 'release' ? mission.resident : null;

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const looksRef = useRef(state.looks);
  looksRef.current = state.looks;

  const onLook = useCallback(
    (clueId: string) => {
      if (looksRef.current.includes(clueId)) return;
      dispatch({ type: 'look', clueId });
      cue('clue', { step: looksRef.current.length, caption: '[soft pluck: first look pinned]' });
    },
    [dispatch, cue],
  );
  const onHotspot = useCallback(
    (clueId: string) => {
      const clue = mission.clues.find((c) => c.id === clueId);
      if (!clue) return;
      if (phaseRef.current === 'live') onLook(clueId);
      else if (phaseRef.current === 'freeze') setSelected(keyForClue(clue));
    },
    [mission.clues, onLook],
  );

  const stage =
    inShocks || phase === 'shield' || phase === 'saved' ? undefined : (
      <MissionStage
        mission={mission}
        mode={sceneMode}
        t={t}
        hotspots={hotspots}
        onHotspot={onHotspot}
        thread={thread}
        mood={mood}
        focusCast={speaker}
        renderMode={renderMode}
        label={`Scene: ${mission.title}. Everything in it is also in the panel.`}
      />
    );

  // ---- HOLD and the Pressure Ring -----------------------------------------------------------
  const ring = useMemo(() => ringTactics(mission), [mission]);
  const lit = litTactics(mission, phase === 'live' ? t : state.frozenAt).length;
  const ringView: RingTactic[] = useMemo(() => {
    const on = new Set(litTactics(mission, phase === 'live' ? t : state.frozenAt));
    return ring.map((id) => ({ id, label: tacticById(id).ringLabel, lit: on.has(id) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ring, lit, mission, phase === 'live']);
  const onChargeStart = useCallback(() => cue('holdCharge', { caption: null }), [cue]);
  const showHold = !inShocks && (phase === 'live' || (phase === 'freeze' && !state.freezeDone));
  const holdButton = showHold && (
    <HoldButton
      onHold={hold}
      tactics={ringView}
      tapToHold={tapToHold}
      holdMs={holdMs}
      status={phase === 'live' ? 'ready' : state.surge === 'showing' ? 'surge' : 'held'}
      disabled={paused}
      onChargeStart={onChargeStart}
    />
  );

  // ---- Phase handlers -----------------------------------------------------------------------
  const next = useCallback(() => {
    dispatch({ type: 'next' });
    cue('pageTurn', { caption: null });
  }, [dispatch, cue]);

  const onCall = useCallback(
    (clueId: string, call: Call) => {
      dispatch({ type: 'call', clueId, call });
      const n = Object.keys(state.calls).length;
      cue(call === 'flag' ? 'clue' : 'clueOk', { step: n, caption: call === 'flag' ? '[soft pluck: pinned]' : '[soft tick]' });
    },
    [dispatch, cue, state.calls],
  );

  const onGuardian = useCallback(
    (guardian: GuardianId, target?: string) => {
      dispatch({ type: 'guardian', guardian, target });
      cue('reveal', { caption: `[${guardian === 'cluepaw' ? 'paw prints' : guardian === 'shieldfin' ? 'a whoosh of fins' : 'a soft chime'}]` });
    },
    [dispatch, cue],
  );

  const start = () => {
    safeUnlock();
    safeAmbient(mission.district);
    dispatch({ type: 'start' });
  };

  // ---- Rail, prompt, top bar ---------------------------------------------------------------
  const rail = railLetters(mission, phase);
  const top = (
    <TopBar
      district={mission.district}
      rail={inShocks ? undefined : <ShieldRail current={rail.current} done={rail.done} scaffold={mission.scaffold} />}
      help={mission.help}
      onPause={() => setPaused(true)}
      backHref={backHref}
      backLabel={fromBoard ? 'Back to the City Board' : undefined}
    />
  );
  const prompt = !inShocks && mission.scaffold === 'guided' ? (PHASE_PROMPT[phase] ?? null) : null;

  // ---- Sheet content -------------------------------------------------------------------------
  let body: ReactNode;
  let sheetLabel = 'Mission panel';
  if (inShocks) {
    const shock = shocks[shockIndex]!;
    sheetLabel = 'Aftershock';
    body = (
      <AftershockInterlude
        key={shock.pending.key}
        pending={shock.pending}
        found={shock.found}
        band={band}
        seed={shockSeed}
        reduced={reduced}
        position={shocks.length > 1 ? `${shockIndex + 1} of ${shocks.length}` : undefined}
        onArrive={(polarity) => {
          cue(polarity === 'risk' ? 'aftershock' : 'afterglow');
          announce(polarity === 'risk' ? 'An Aftershock from an earlier choice is landing.' : 'An Afterglow from an earlier choice is landing.');
        }}
        onResolve={(optionId) => useProgress.getState().resolve(shock.pending.key, optionId)}
        onDone={() => setShockIndex((i) => i + 1)}
      />
    );
  } else {
    switch (phase) {
      case 'intro':
        sheetLabel = 'Mission intro';
        body = <IntroPhase mission={mission} band={band} onStart={start} tapToHold={tapToHold} />;
        break;
      case 'live':
        sheetLabel = 'ChatLah messages';
        body = (
          <LivePhase
            mission={mission}
            t={t}
            looks={state.looks}
            onLook={onLook}
            showCountdown={band !== 'junior' && !gentle}
            replyTried={state.replyTried}
            onReply={() => dispatch({ type: 'reply' })}
            reduced={reduced}
          />
        );
        break;
      case 'freeze':
        sheetLabel = 'Investigate';
        body = (
          <FreezePhase
            mission={mission}
            sceneAnchors={sceneAnchors}
            frozenAt={state.frozenAt}
            heldAtSec={state.heldAtSec}
            autoFrozen={state.autoFrozen}
            looks={state.looks}
            calls={state.calls}
            onCall={onCall}
            selected={selected}
            onSelect={setSelected}
            unfolded={unfolded}
            guardiansUsed={state.guardiansUsed}
            onGuardian={onGuardian}
            sniffed={state.sniffed}
            scanned={state.scanned}
            crossChecked={state.crossChecked}
            surge={state.surge}
            surgeLine={surgeLine(mission)}
            onSurgeHold={hold}
            done={state.freezeDone}
            onDone={() => {
              dispatch({ type: 'freezeDone' });
              cue('reveal', { caption: '[counter clicks up]' });
            }}
            onContinue={next}
            nudge={nudge && freezeElapsed > 0 ? nudge : null}
            band={band}
            reduced={reduced}
          />
        );
        break;
      case 'trace':
        sheetLabel = 'Pull the thread';
        body = (
          <TracePhase
            mission={mission}
            pulled={state.threadPulled}
            answers={state.traceAnswers}
            onPull={() => {
              dispatch({ type: 'pullThread' });
              cue('reveal', { caption: '[thread pulls tight]' });
            }}
            onAnswer={(optionId) => dispatch({ type: 'trace', optionId })}
            onContinue={next}
            seed={state.seed}
            reduced={reduced}
          />
        );
        break;
      case 'forecast':
        sheetLabel = 'Sealed forecast';
        body = (
          <ForecastPhase
            forecast={mission.forecast}
            missionId={mission.id}
            selected={state.forecastOptionId}
            sealed={state.forecastSealed}
            onPick={(optionId) => {
              dispatch({ type: 'forecast', optionId });
              cue('tap', { caption: null });
            }}
            onSeal={() => {
              dispatch({ type: 'sealForecast' });
              cue('seal');
            }}
            onContinue={next}
            seed={state.seed}
          />
        );
        break;
      case 'think':
        sheetLabel = 'Think and seal';
        body = (
          <ThinkPhase
            mission={mission}
            exits={exits}
            firstVote={state.firstVote}
            confidence={state.confidence}
            onSeal={(choiceId, confidence) => {
              dispatch({ type: 'seal', choiceId, confidence });
              cue('seal');
              announce('Your vote is sealed.');
            }}
            onContinue={next}
            paused={paused}
          />
        );
        break;
      case 'explain':
        sheetLabel = 'Explain';
        body = (
          <ExplainPhase
            mission={mission}
            exits={exits}
            firstVote={state.firstVote ?? mission.choices[0]!.id}
            reasons={state.reasons}
            onReason={(chip) => dispatch({ type: 'reason', chip })}
            finalChoice={state.finalChoice}
            onReseal={(choiceId) => {
              dispatch({ type: 'reseal', choiceId });
              cue('seal');
              announce('Your final choice is sealed.');
            }}
            onContinue={next}
            echo={{ unfolded: unfolded.echo, used: state.guardiansUsed.includes('echo'), onUse: () => onGuardian('echo') }}
            pinned={mission.clues.filter((c: Clue) => state.calls[c.id] === 'flag')}
            band={band}
          />
        );
        break;
      case 'release':
        sheetLabel = 'Outcome';
        body = finalChoice ? (
          <ReleasePhase
            mission={mission}
            choice={finalChoice}
            exit={exitFor(exits, finalChoice.id)}
            firstVote={state.firstVote}
            confidence={state.confidence}
            pinnedDecoys={pinnedDecoys(mission, state.looks, state.calls)}
            onContinue={next}
            continueLabel={mission.peerShield ? `${sentenceCase(mission.peerShield.timeLabel).replace(/[.…]+$/, '')}…` : 'See what you learned'}
            reduced={reduced}
          />
        ) : null;
        break;
      case 'shield':
        sheetLabel = 'Peer Shield';
        body = mission.peerShield ? (
          <PeerShieldPhase
            mission={mission}
            shield={mission.peerShield}
            slots={state.shieldSlots}
            picks={state.shieldPicks}
            result={state.shieldResult}
            tries={state.shieldTries}
            maxTries={SHIELD_MAX_TRIES}
            seed={state.seed}
            onPick={(slot: ShieldSlot, tileId: string) => dispatch({ type: 'shieldPick', slot, tileId })}
            onSend={() => dispatch({ type: 'shieldSend' })}
            onRetry={() => dispatch({ type: 'shieldRetry' })}
            onContinue={next}
            beacon={{ unfolded: unfolded.beacon, used: state.guardiansUsed.includes('beacon'), onUse: () => onGuardian('beacon') }}
          />
        ) : null;
        break;
      case 'saved': {
        sheetLabel = 'Bond';
        const nextId = nextMissionId(mission, band);
        body = completion ? (
          <BondPhase
            mission={mission}
            summary={completion.summary}
            levelUps={completion.guardianLevelUps}
            heldAtSec={state.heldAtSec}
            savedIfThen={ifThenCards.find((c) => c.missionId === mission.id)?.text ?? null}
            onSaveIfThen={(text) => useProgress.getState().saveIfThen(mission.id, text)}
            nextHref={nextId ? `/play/m/${nextId}` : null}
            backHref={backHref}
            onReplay={onReplay}
            onMotif={(litLetters) => {
              safeMotif(litLetters);
              cues.showCaption('[six-note S.H.I.E.L.D. melody]');
            }}
            onUnfold={() => cue('unfold')}
            reduced={reduced}
            renderMode={renderMode}
            band={band}
          />
        ) : (
          <p className="msn-saving" role="status">
            Saving this moment on your device…
          </p>
        );
        break;
      }
    }
  }

  return (
    <main id="main" className="msn-page" data-phase={inShocks ? 'aftershock' : phase}>
      <StageLayout
        top={top}
        stage={stage}
        caption={<CaptionBand text={cues.caption} />}
        hold={holdButton || undefined}
        prompt={prompt}
        emphasis={inShocks ? 'sheet-only' : (PHASE_EMPHASIS[phase] ?? 'balanced')}
        frozen={!inShocks && phase !== 'live' && phase !== 'intro' && phase !== 'release'}
        sheetLabel={sheetLabel}
        overlay={
          <PauseOverlay
            open={paused}
            onResume={() => {
              setPaused(false);
              announce(phase === 'live' ? 'Resumed. The moment is live again.' : 'Resumed.');
            }}
            help={mission.help}
          />
        }
      >
        {body}
      </StageLayout>
      <p className="sr-only" aria-live="polite" role="status">
        {message}
      </p>
    </main>
  );
}
