/**
 * Mission player building blocks, shared by the solo player (/play/m/:id) and the squad phone client.
 *
 * How to drive them
 * - Every phase component in ./phases is PROPS-DRIVEN: it reads no store, does no routing and owns only
 *   transient UI state (a highlighted tile, a drag). Callbacks report what the player did; the owner decides
 *   what happens (solo: runReducer via useMissionRun; squad: emit a socket event and wait for the server).
 * - Frame every screen with <StageLayout top={<TopBar …/>} stage={<MissionStage …/>} caption={<CaptionBand …/>}
 *   hold={<HoldButton …/>}>{phase}</StageLayout>. StageLayout is the 58/42 stage + sheet on phone portrait and
 *   62/38 side by side on landscape, tablet and desktop; emphasis 'panel' gives reading phases more room and
 *   'sheet-only' drops the stage (Peer Shield, Bond, Aftershocks).
 * - Stage: pass MissionStage stable props. Use stageHotspots(mission, view, t, looks, calls) memoised on the
 *   number of landed beats, and update `t` at most 10 times a second (the Canvas must not re-render per frame).
 * - HOLD: render <HoldButton> in StageLayout's `hold` slot during live (status 'ready') and freeze ('held', or
 *   'surge' while a Pressure Surge shows, so pressing it again clears the surge). Space and H work page-wide.
 * - Sounds: play through useCues().cue so every meaningful sound gets a caption in <CaptionBand>.
 * - Squad: pass hideStart / hideContinue to IntroPhase, ThinkPhase, ExplainPhase, ReleasePhase and PeerShieldPhase
 *   when the server moves everyone on; IntroPhase takes the seat's role and lens; FreezePhase's Done is the
 *   seat's "Done" tap; ExplainPhase's Echo Council can be replaced by the squad's anonymous dots.
 * - Focus: each phase renders a focusable h2 (data-msn-focus); call focusPhaseHeading() after a phase change.
 */

// Phases
export { IntroPhase, SOLO_ROLE, type IntroPhaseProps, type IntroRole } from './phases/IntroPhase';
export { LivePhase, type LivePhaseProps } from './phases/LivePhase';
export { FreezePhase, keyForClue, type FreezePhaseProps } from './phases/FreezePhase';
export { TracePhase, type TracePhaseProps } from './phases/TracePhase';
export { ForecastPhase, FORECAST_SEALED_LINE, type ForecastPhaseProps } from './phases/ForecastPhase';
export { ThinkPhase, type ThinkPhaseProps } from './phases/ThinkPhase';
export { ExplainPhase, type ExplainPhaseProps } from './phases/ExplainPhase';
export { ReleasePhase, REMEMBER_LINE, SEED_LINE, type ReleasePhaseProps } from './phases/ReleasePhase';
export { PeerShieldPhase, type PeerShieldPhaseProps } from './phases/PeerShieldPhase';
export { BondPhase, ifThenText, type BondPhaseProps } from './phases/BondPhase';
export { AftershockInterlude, type AftershockInterludeProps } from './phases/AftershockInterlude';
export { PhaseHeading, focusPhaseHeading, type PhaseHeadingProps } from './phases/PhaseHeading';

// Parts
export { StageLayout, type StageLayoutProps, type StageEmphasis } from './parts/StageLayout';
export { TopBar, type TopBarProps } from './parts/TopBar';
export { ShieldRail, type ShieldRailProps } from './parts/ShieldRail';
export { CaptionBand, type CaptionBandProps } from './parts/CaptionBand';
export { HoldButton, type HoldButtonProps, type RingTactic } from './parts/HoldButton';
export { ChatThread, PawPrint, type ChatThreadProps, type ChatMark } from './parts/ChatThread';
export { InspectCard, type InspectCardProps } from './parts/InspectCard';
export { ExitCard, ExitPatternSwatch, type ExitCardProps } from './parts/ExitCard';
export { ExitGroup, type ExitGroupProps } from './parts/ExitGroup';
export { ConfidenceShields, CONFIDENCE_LABEL, type Confidence, type ConfidenceShieldsProps } from './parts/ConfidenceShields';
export { BreathingRing, type BreathingRingProps } from './parts/BreathingRing';
export { SealEnvelope, type SealEnvelopeProps } from './parts/SealEnvelope';
export { MeterBar, type MeterBarProps } from './parts/MeterBar';
export { FeedbackCard, type FeedbackCardProps } from './parts/FeedbackCard';
export { EffectDials, type EffectDialsProps } from './parts/EffectDials';
export { TimelineRibbon, type TimelineRibbonProps } from './parts/TimelineRibbon';
export { PauseOverlay, type PauseOverlayProps } from './parts/PauseOverlay';
export { MissionStage, GuardianStage, type MissionStageProps, type GuardianStageProps } from './parts/MissionStage';
export { useCues, useAnnouncer, captionFor, safeHaptic, safeTension, safeMotif, safeUnlock, safeAmbient, type Cues } from './parts/cues';
export { useDragToTarget, type DragState } from './parts/useDragToTarget';

// Pure logic (no DOM): the solo reducer and shared helpers
export {
  runReducer,
  createRunState,
  buildRunInput,
  canAdvance,
  phaseAfter,
  SHIELD_MAX_TRIES,
  type RunState,
  type RunAction,
  type SurgeState,
} from './runReducer';
export * from './runLogic';
export { useMissionRun, HOLD_EASE_MS, type MissionRunApi, type RunCompletion, type UseMissionRunOptions } from './useMissionRun';
