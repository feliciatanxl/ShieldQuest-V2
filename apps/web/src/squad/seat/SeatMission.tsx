import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  SQUAD_PHASE_LETTERS,
  SQUAD_MISSION_PHASES,
  missionById,
  phaseIndex,
  surgesEnabled,
  tacticById,
  type GuardianId,
  type Mission,
  type SeatSnapshot,
  type SkillId,
  type SquadMissionPhase,
  type SquadMissionView,
} from '@shieldquest/shared';
import {
  CaptionBand,
  HoldButton,
  MissionStage,
  ShieldRail,
  StageLayout,
  TopBar,
  focusPhaseHeading,
  keyForClue,
  landedCount,
  litTactics,
  moodForChoice,
  ringTactics,
  safeHaptic,
  speakerAt,
  stageHotspots,
  useAnnouncer,
  useCues,
  type Call,
  type RingTactic,
  type StageEmphasis,
  type StageView,
} from '../../game/mission';
import type { MissionSceneProps, SceneMode } from '../../world';
import { useRenderMode } from '../../world';
import { prefersReducedMotion, useSettings } from '../../state/settings';
import { liveSeconds, squadExits } from '../logic';
import { send, useServerNow, useSquad } from '../socket';
import { act } from './actions';
import type { SeatCtx } from './context';
import { useSeatLocal } from './local';
import { AftershockSlot, RoleFlip } from './AftershockPanels';
import { InvestigatePanel, LivePanel } from './InvestigatePanel';
import { ExplainPanel, ResealPanel, RevealPanel, ThinkPanel } from './VotePanels';
import { BondPanel, ReleasePanel, ShieldPanel } from './OutcomePanels';
import { SquadStrip } from './SquadStrip';
import './seat.css';

const EMPHASIS: Record<SquadMissionPhase, StageEmphasis> = {
  aftershock: 'sheet-only',
  'role-flip': 'panel',
  live: 'balanced',
  investigate: 'balanced',
  think: 'panel',
  reveal: 'panel',
  explain: 'panel',
  reseal: 'panel',
  release: 'balanced',
  shield: 'sheet-only',
  bond: 'sheet-only',
};

/** Rail: the letter practised now, and the letters of every earlier phase as done. */
function railFor(phase: SquadMissionPhase): { current: SkillId | null; done: SkillId[] } {
  const current = SQUAD_PHASE_LETTERS[phase][0] ?? null;
  const done = new Set<SkillId>();
  for (const p of SQUAD_MISSION_PHASES.slice(0, phaseIndex(phase))) {
    // The Aftershock slot is optional and replays an earlier mission's E, so it never lights this mission's letters.
    if (p === 'aftershock') continue;
    for (const l of SQUAD_PHASE_LETTERS[p]) done.add(l);
  }
  if (current) done.delete(current);
  return { current, done: [...done] };
}

/** The squad mission on a phone: the same stage + sheet frame as solo, driven by the server's phases. */
export function SeatMission({ snap, onLeave, onBreak }: { snap: SeatSnapshot; onLeave: () => void; onBreak: () => void }) {
  const view = snap.squad.mission;
  const mission = view ? missionById(view.missionId) : undefined;
  const ensure = useSeatLocal((s) => s.ensure);
  const readyFor = useSeatLocal((s) => s.missionId);

  useLayoutEffect(() => {
    if (mission) ensure(mission.id);
  }, [mission, ensure]);

  if (!view || !mission) {
    return (
      <div className="sq-seat__wait" role="status">
        <p className="kicker">Squad</p>
        <h2>Getting the next moment ready…</h2>
        <p>If this stays here, ask your facilitator to check the session.</p>
      </div>
    );
  }
  if (readyFor !== mission.id) return null;
  return <MissionFrame snap={snap} view={view} mission={mission} onLeave={onLeave} onBreak={onBreak} />;
}

function MissionFrame({
  snap,
  view,
  mission,
  onLeave,
  onBreak,
}: {
  snap: SeatSnapshot;
  view: SquadMissionView;
  mission: Mission;
  onLeave: () => void;
  onBreak: () => void;
}) {
  const { session, squad, me } = snap;
  const band = session.band;
  const phase = view.phase;
  const local = useSeatLocal();
  const patch = local.patch;
  const status = useSquad((s) => s.status);
  const surgePulse = useSquad((s) => s.surge);
  const guardianPulse = useSquad((s) => s.guardian);
  const motion = useSettings((s) => s.motion);
  const tapToHold = useSettings((s) => s.tapToHold);
  const holdMs = useSettings((s) => s.holdMs);
  const reduced = prefersReducedMotion(motion);
  const renderMode = useRenderMode();
  const cues = useCues();
  const { cue } = cues;
  const { message, announce } = useAnnouncer();
  const gentle = session.options.gentle || squad.gentle;
  const live = phase === 'live';
  const now = useServerNow(live || phase === 'role-flip' ? 100 : 500);
  const exits = useMemo(() => squadExits(mission, session.code, squad.id), [mission, session.code, squad.id]);
  const [flashText, setFlashText] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const flash = useCallback((text: string) => {
    setFlashText(text);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashText(null), 4500);
  }, []);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  // ---- Live clock (shared t0) ------------------------------------------------------------------
  const tl = session.timeline;
  const duration = mission.live.durationSec;
  const t = tl ? liveSeconds(tl, now, session.paused ? session.pausedAt : null, duration) : 0;
  // Publish t to the stage at most 10 times a second (the Canvas must not re-render per frame).
  const tStage = Math.round(t * 10) / 10;
  const held = me.held || local.heldAtSec !== null;
  const frozenAt = local.heldAtSec ?? (live ? t : duration);

  // A phone that reloads after holding has lost its local hold time: freeze where the moment is now.
  useEffect(() => {
    if (live && me.held && local.heldAtSec === null) patch({ heldAtSec: t });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, me.held]);

  // Messages arriving during Live get a sound and a caption.
  const landed = landedCount(mission, t);
  const landedRef = useRef(landed);
  useEffect(() => {
    if (live && !held && landed > landedRef.current) cue('message');
    landedRef.current = landed;
  }, [landed, live, held, cue]);

  // ---- Phase changes: focus, announce, sound ----------------------------------------------------
  const prevPhase = useRef(phase);
  useEffect(() => {
    if (prevPhase.current === phase) return;
    const was = prevPhase.current;
    prevPhase.current = phase;
    if (phase === 'investigate' && was === 'live' && local.heldAtSec === null) {
      cue('freeze', { caption: '[time stops by itself]' });
      safeHaptic(60);
    }
    if (phase === 'reveal') cue('reveal', { caption: '[envelopes open]' });
    if (phase === 'release') cue('release');
    if (phase !== 'explain' && local.eyesUp) patch({ eyesUp: false });
    const id = window.setTimeout(() => focusPhaseHeading(document.querySelector('.msn-layout__sheet') ?? document), 40);
    return () => window.clearTimeout(id);
  }, [phase, cue, local.heldAtSec, local.eyesUp, patch]);

  // ---- Pressure Surge (squad-wide, never changes a timer) ----------------------------------------
  const surgesOn = surgesEnabled(band, gentle);
  useEffect(() => {
    if (!surgePulse || surgePulse.n <= local.surgeSeen) return;
    if (surgePulse.value.squadId !== squad.id || surgePulse.value.missionId !== mission.id) return;
    if (!surgesOn || local.step !== 'scene' || (phase !== 'investigate' && phase !== 'live')) {
      patch({ surgeSeen: surgePulse.n });
      return;
    }
    patch({ surgeSeen: surgePulse.n, surge: 'showing' });
    cue('surge');
    safeHaptic([40, 60, 40]);
    announce('A pressure message came in. Press HOLD again to clear it.');
  }, [surgePulse, local.surgeSeen, local.step, squad.id, mission.id, surgesOn, phase, patch, cue, announce]);

  // ---- Guardians used by any squad seat ----------------------------------------------------------
  const guardianSeen = useRef(guardianPulse?.n ?? 0);
  useEffect(() => {
    if (!guardianPulse || guardianPulse.n <= guardianSeen.current) return;
    guardianSeen.current = guardianPulse.n;
    const g = guardianPulse.value;
    switch (g.guardian) {
      case 'cluepaw':
        if (g.clueId) patch({ sniffed: g.clueId });
        cue('reveal', { caption: '[paw prints]' });
        announce('Cluepaw sniffed out a sign nobody has pinned yet.');
        break;
      case 'bytebuddy':
        patch({ scanned: true });
        cue('reveal', { caption: '[soft scan beep]' });
        break;
      case 'shieldfin': {
        // The manta swims across the squad in seat order, 250 ms apart.
        const slot = Math.max(0, g.order.indexOf(me.seatIndex));
        window.setTimeout(() => {
          useSeatLocal.getState().patch((s) => (s.surge === 'showing' ? { surge: 'shieldfin' } : {}));
        }, slot * g.delayMs);
        cue('reveal', { caption: '[a whoosh of fins]' });
        break;
      }
      case 'echo':
        cue('reveal', { caption: '[a soft chime]' });
        announce(`Echo gave your squad ${g.addedSec} more seconds and one more view.`);
        break;
      case 'beacon':
        cue('reveal', { caption: '[a warm glow]' });
        break;
      default:
        cue('reveal', { caption: '[a soft chime]' });
    }
  }, [guardianPulse, me.seatIndex, patch, cue, announce]);

  // ---- Outbox: seals the server has not shown yet are re-sent when the connection comes back --------
  useEffect(() => {
    if (status !== 'online') return;
    for (const [key, seal] of Object.entries(local.pendingSeal)) {
      const [r, p] = key.split(':');
      const round = r === '2' ? 2 : 1;
      const player = Number(p ?? 0);
      const v = me.votes[player];
      const landedVote = round === 1 ? v?.round1 : v?.round2;
      if (landedVote || phase !== (round === 1 ? 'think' : 'reseal')) continue;
      void send('seal', { voteId: seal.voteId, round, choiceId: seal.choiceId, player, ...(seal.confidence ? { confidence: seal.confidence } : {}) });
    }
    // Only when the connection status changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ---- HOLD --------------------------------------------------------------------------------------
  const hold = useCallback(() => {
    const st = useSeatLocal.getState();
    if (st.surge === 'showing') {
      st.patch({ surge: 'held' });
      cue('freeze', { caption: '[time stops again]' });
      announce('You held again. The pressure is cleared.');
      return;
    }
    if (phase !== 'live' || st.heldAtSec !== null || me.held) return;
    const atSec = Math.round(t * 10) / 10;
    st.patch({ heldAtSec: atSec, step: 'scene' });
    cue('freeze');
    safeHaptic(60);
    announce('Time is held. Nothing is rushing you now.');
    void act({ flash }, 'hold', { missionId: mission.id, atSec });
  }, [phase, me.held, t, mission.id, cue, announce, flash]);

  const ring = useMemo(() => ringTactics(mission), [mission]);
  const litAt = live && !held ? t : frozenAt;
  const litCount = litTactics(mission, litAt).length;
  const ringView: RingTactic[] = useMemo(() => {
    const on = new Set(litTactics(mission, litAt));
    return ring.map((id) => ({ id, label: tacticById(id).ringLabel, lit: on.has(id) }));
    // litAt only matters through the number of lit tactics.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ring, mission, litCount]);
  const onChargeStart = useCallback(() => cue('holdCharge', { caption: null }), [cue]);
  const frozenInvestigate = (phase === 'investigate' || (live && held)) && local.step === 'scene';
  const showHold = (live && !held) || (frozenInvestigate && local.surge === 'showing');
  const holdButton = showHold ? (
    <HoldButton
      onHold={hold}
      tactics={ringView}
      tapToHold={tapToHold}
      holdMs={holdMs}
      status={live && !held ? 'ready' : 'surge'}
      disabled={session.paused}
      onChargeStart={onChargeStart}
    />
  ) : undefined;

  // ---- Pins (first looks while live; calls while holding) -----------------------------------------
  const calls = useMemo(() => {
    const out: Record<string, Call> = {};
    for (const id of me.pins) if (!local.liveLooks.includes(id) || local.confirmed.includes(id)) out[id] = 'flag';
    for (const id of me.cleared) out[id] = 'fine';
    return out;
  }, [me.pins, me.cleared, local.liveLooks, local.confirmed]);
  const looks = useMemo(() => local.liveLooks.filter((id) => me.pins.includes(id) || me.cleared.includes(id)), [local.liveLooks, me.pins, me.cleared]);

  const onLook = useCallback(
    (clueId: string) => {
      const st = useSeatLocal.getState();
      if (st.liveLooks.includes(clueId)) return;
      st.patch({ liveLooks: [...st.liveLooks, clueId] });
      cue('clue', { step: st.liveLooks.length, caption: '[soft pluck: first look pinned]' });
      void act({ flash }, 'pin', { clueId, live: true });
    },
    [cue, flash],
  );

  // ---- Stage --------------------------------------------------------------------------------------
  const decided = view.decision ? mission.choices.find((c) => c.id === view.decision?.choiceId) : undefined;
  const stageView: StageView = live && !held ? 'live' : phase === 'role-flip' ? 'after' : phaseIndex(phase) <= phaseIndex('reseal') ? 'frozen' : 'after';
  const hotspots = useMemo(
    () => (phase === 'role-flip' ? [] : stageHotspots(mission, stageView, live && !held ? t : frozenAt, looks, calls)),
    // t only matters through the number of landed beats.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mission, phase, stageView, landed, frozenAt, looks, calls],
  );
  const thread = useMemo(
    () => (local.step === 'trace' && (phase === 'investigate' || live) ? { from: mission.influence.from, revealed: local.threadPulled } : null),
    [local.step, phase, live, mission.influence.from, local.threadPulled],
  );
  const sceneMode: SceneMode =
    phase === 'role-flip' ? 'intro' : live && !held ? 'live' : phaseIndex(phase) >= phaseIndex('release') ? 'released' : 'frozen';
  const mood: MissionSceneProps['mood'] = live && !held ? 'tense' : phase === 'release' ? moodForChoice(decided) : 'neutral';
  const speaker = live && !held ? speakerAt(mission, t) : phase === 'release' ? mission.resident : local.step === 'trace' ? mission.influence.from : null;
  const onHotspot = useCallback(
    (clueId: string) => {
      const clue = mission.clues.find((c) => c.id === clueId);
      if (!clue) return;
      const st = useSeatLocal.getState();
      if (phase === 'live' && st.heldAtSec === null && !me.held) onLook(clueId);
      else st.patch({ selected: keyForClue(clue), step: 'scene' });
    },
    [mission.clues, phase, me.held, onLook],
  );
  const emphasis = EMPHASIS[phase];
  const stage =
    emphasis === 'sheet-only' ? undefined : (
      <MissionStage
        mission={mission}
        mode={sceneMode}
        t={live && !held ? tStage : frozenAt}
        hotspots={hotspots}
        onHotspot={onHotspot}
        thread={thread}
        mood={mood}
        focusCast={speaker}
        renderMode={renderMode}
        label={`Scene: ${mission.title}. Everything in it is also in the panel.`}
      />
    );

  // ---- Panels ---------------------------------------------------------------------------------------
  const ctx: SeatCtx = {
    snap,
    view,
    mission,
    exits,
    now,
    band,
    gentle,
    reduced,
    renderMode,
    cues,
    announce,
    local,
    patch,
    flash,
  };

  const onGuardian = (guardian: GuardianId, target?: string) => {
    const st = useSeatLocal.getState();
    if (st.guardiansPressed.includes(guardian)) return;
    const extra: Partial<typeof st> = { guardiansPressed: [...st.guardiansPressed, guardian] };
    if (guardian === 'verifox' && target) extra.crossChecked = target;
    if (guardian === 'cluepaw' && target) extra.sniffed = target;
    if (guardian === 'bytebuddy') extra.scanned = true;
    if (guardian === 'shieldfin' && st.surge === 'showing') extra.surge = 'shieldfin';
    st.patch(extra);
    void act({ flash }, 'guardian', { guardian });
  };

  let body: ReactNode;
  let sheetLabel = 'Squad mission';
  switch (phase) {
    case 'aftershock':
      sheetLabel = 'Aftershock';
      body = <AftershockSlot ctx={ctx} />;
      break;
    case 'role-flip':
      sheetLabel = 'Role Flip';
      body = <RoleFlip ctx={ctx} tapToHold={tapToHold} />;
      break;
    case 'live':
      sheetLabel = held ? 'Investigate' : 'ChatLah messages';
      body = held ? (
        <InvestigatePanel ctx={ctx} frozenAt={frozenAt} calls={calls} looks={looks} onGuardian={onGuardian} onHold={hold} />
      ) : (
        <LivePanel ctx={ctx} t={t} looks={local.liveLooks} onLook={onLook} />
      );
      break;
    case 'investigate':
      sheetLabel = 'Investigate';
      body = <InvestigatePanel ctx={ctx} frozenAt={frozenAt} calls={calls} looks={looks} onGuardian={onGuardian} onHold={hold} />;
      break;
    case 'think':
      sheetLabel = 'Think and seal';
      body = <ThinkPanel ctx={ctx} />;
      break;
    case 'reveal':
      sheetLabel = 'Reveal';
      body = <RevealPanel ctx={ctx} />;
      break;
    case 'explain':
      sheetLabel = 'Explain';
      body = <ExplainPanel ctx={ctx} />;
      break;
    case 'reseal':
      sheetLabel = 'Re-seal';
      body = <ResealPanel ctx={ctx} />;
      break;
    case 'release':
      sheetLabel = 'Outcome';
      body = <ReleasePanel ctx={ctx} />;
      break;
    case 'shield':
      sheetLabel = 'Peer Shield';
      body = <ShieldPanel ctx={ctx} />;
      break;
    case 'bond':
      sheetLabel = 'Bond';
      body = <BondPanel ctx={ctx} />;
      break;
  }

  const rail = railFor(phase);
  const top = (
    <TopBar
      district={mission.district}
      rail={phase === 'aftershock' ? undefined : <ShieldRail current={rail.current} done={rail.done} scaffold={mission.scaffold} />}
      help={mission.help}
      onPause={onBreak}
      onBack={onLeave}
      backLabel="Step out of the session"
    />
  );

  return (
    <main id="main" className="sq-mission" data-phase={phase} data-eyes-up={local.eyesUp ? '' : undefined}>
      <StageLayout
        top={top}
        stage={stage}
        caption={<CaptionBand text={cues.caption} />}
        hold={holdButton}
        emphasis={emphasis}
        frozen={phase !== 'live' && phase !== 'role-flip' && phaseIndex(phase) < phaseIndex('release') ? true : live && held}
        sheetLabel={sheetLabel}
      >
        <SquadStrip ctx={ctx} />
        {flashText && (
          <p className="sq-flash" role="status">
            {flashText}
          </p>
        )}
        {body}
      </StageLayout>
      <p className="sr-only" aria-live="polite" role="status">
        {message}
      </p>
    </main>
  );
}
