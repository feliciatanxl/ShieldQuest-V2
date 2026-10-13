// Crash snapshots (collection 'session-snapshots'): enough to restore a live session after a restart,
// written at phase boundaries and deleted when the session closes. They deliberately leave out every
// seat-to-vote link and who held or pinned what: votes, forecasts, traces, reasons, holds and Steelman
// deals live in memory only. Pins are kept with their role icon alone. A Squad Dash keeps its question list
// and squad-level results; individual taps are never written (a restart mid-question asks it again).

import {
  chanceById,
  dashQuestionSec,
  missionById,
  phaseTiming,
  type AftershockDelivery,
  type BondView,
  type ChipBoard,
  type DebriefView,
  type DecisionView,
  type DistrictId,
  type EvidencePin,
  type GuardianId,
  type MissionTimeline,
  type Mood,
  type RevealView,
  type RoleAssignment,
  type SessionAggregate,
  type SessionConfig,
  type SessionPhase,
  type ShadowCheck,
  type ShieldResultView,
  type ShieldSlot,
  type SquadMissionPhase,
  type SquadRoleId,
  type SquadTotemId,
} from '@shieldquest/shared';
import {
  emptyPlayer,
  type DashRound,
  type DashState,
  type PendingShock,
  type PinEntry,
  type Seat,
  type SessionState,
  type Squad,
  type SquadMission,
} from './state';
import { boardView, missionOf } from './views';

export const SNAPSHOT_FORMAT = 1;

interface MissionDoc {
  missionId: string;
  index: number;
  phase: SquadMissionPhase;
  phaseStartedAt: number;
  phaseEndsAt: number;
  complete: boolean;
  skipped: boolean;
  sealLockUntil: number | null;
  aftershocks: AftershockDelivery[];
  shadow: ShadowCheck | null;
  holding: number;
  dealtSize: number;
  fallback: boolean;
  earlyHolds: number;
  seatsAtLive: number;
  pins: EvidencePin[];
  cleared: EvidencePin[];
  tracedRoles: SquadRoleId[];
  reveal: RevealView | null;
  chips: ChipBoard | null;
  decision: DecisionView | null;
  finalMood: Mood | null;
  steelmanDeals: number;
  shield: { picks: Partial<Record<ShieldSlot, string>>; result: ShieldResultView | null; attempts: number } | null;
  bond: BondView | null;
  surgeFired: boolean;
  guardiansUsed: GuardianId[];
  explainExtended: boolean;
  echoUsed: boolean;
  shared: boolean;
  folded: { votes: boolean; board: boolean; shield: boolean };
  stats: SquadMission['stats'];
}

interface SquadDoc {
  id: SquadTotemId;
  seatIds: string[];
  gentle: boolean;
  guardians: GuardianId[];
  lumen: { wallet: number; trust: Partial<Record<DistrictId, number>> };
  decisions: { missionId: string; choiceId: string }[];
  pending: PendingShock[];
  finale: AftershockDelivery[];
  recovered: string[];
  mission: MissionDoc | null;
}

/** A Squad Dash without its taps (those never leave memory). */
interface DashDoc {
  id: string;
  questionIds: string[];
  index: number;
  stage: DashState['stage'];
  stageStartedAt: number;
  endsAt: number | null;
  rounds: DashRound[];
}

interface SeatDoc {
  id: string;
  tokenHash: string;
  pseudonym: string;
  squadId: SquadTotemId;
  epoch: number;
  players: number;
  lastSeenAt: number;
  role: RoleAssignment | null;
}

export interface SessionDoc {
  /** The room code (crash snapshots only; deleted when the session closes). */
  id: string;
  format: typeof SNAPSHOT_FORMAT;
  savedAt: number;
  code: string;
  hostKeyHash: string;
  seed: string;
  createdAt: number;
  lastActivity: number;
  config: SessionConfig;
  phase: SessionPhase;
  missionIndex: number | null;
  missionComplete: boolean;
  played: number[];
  acceptingJoins: boolean;
  paused: boolean;
  pausedAt: number | null;
  timeline: MissionTimeline | null;
  roomFreeze: SessionState['roomFreeze'];
  v: number;
  spotlight: SquadTotemId | null;
  lanterns: number;
  holdsMade: number;
  mindsChangedSafer: number;
  seeDifferently: number;
  seatsCreated: number;
  aggregate: SessionAggregate;
  debrief: DebriefView | null;
  endedAt: number | null;
  seats: SeatDoc[];
  squads: SquadDoc[];
  /** Added with Squad Dash: absent in older snapshots. */
  dash?: DashDoc | null;
  dashRuns?: number;
  dashUsed?: string[];
}

function dashDoc(d: DashState): DashDoc {
  return {
    id: d.id,
    questionIds: [...d.questionIds],
    index: d.index,
    stage: d.stage,
    stageStartedAt: d.stageStartedAt,
    endsAt: d.endsAt,
    rounds: d.rounds.map((r) => ({
      questionId: r.questionId,
      skipped: r.skipped,
      squads: r.squads.map((e) => ({ squadId: e.squadId, counts: e.counts.map((c) => ({ ...c })), result: { ...e.result } })),
    })),
  };
}

/** Restores a Dash. A question that was open when the server stopped starts again with a fresh clock. */
function dashFrom(doc: SessionDoc, now: number): DashState | null {
  const d = doc.dash;
  if (!d || d.questionIds.length === 0 || !d.questionIds.every((id) => chanceById(id))) return null;
  const index = Math.max(0, Math.min(d.index, d.questionIds.length - 1));
  const dash: DashState = { ...d, index, rounds: d.rounds ?? [], answers: new Map() };
  if (dash.stage === 'question') {
    const resume = doc.paused && doc.pausedAt !== null ? doc.pausedAt : now;
    dash.stageStartedAt = resume;
    dash.endsAt = doc.config.calm ? null : resume + dashQuestionSec({ band: doc.config.band, relaxed: doc.config.relaxed }) * 1000;
  }
  return dash;
}

function missionDoc(m: SquadMission): MissionDoc {
  const board = boardView(m, missionOf(m.missionId));
  return {
    missionId: m.missionId,
    index: m.index,
    phase: m.phase,
    phaseStartedAt: m.phaseStartedAt,
    phaseEndsAt: m.phaseEndsAt,
    complete: m.complete,
    skipped: m.skipped,
    sealLockUntil: m.sealLockUntil,
    aftershocks: m.aftershocks,
    shadow: m.shadow,
    holding: m.holding.size,
    dealtSize: m.dealtSize,
    fallback: m.fallback,
    earlyHolds: m.earlyHolds,
    seatsAtLive: m.seatsAtLive,
    pins: board.pins,
    cleared: board.cleared,
    tracedRoles: board.tracedRoles,
    reveal: m.reveal,
    chips: m.chips,
    decision: m.decision,
    finalMood: m.finalMood,
    steelmanDeals: m.steelmanDeals,
    shield: m.shield ? { picks: { ...m.shield.picks }, result: m.shield.result, attempts: m.shield.attempts } : null,
    bond: m.bond,
    surgeFired: m.surgeFired,
    guardiansUsed: [...m.guardiansUsed],
    explainExtended: m.explainExtended,
    echoUsed: m.echoUsed,
    shared: m.shared,
    folded: { ...m.folded },
    stats: { ...m.stats },
  };
}

export function toDoc(s: SessionState, now: number): SessionDoc {
  return {
    id: s.code,
    format: SNAPSHOT_FORMAT,
    savedAt: now,
    code: s.code,
    hostKeyHash: s.hostKeyHash,
    seed: s.seed,
    createdAt: s.createdAt,
    lastActivity: s.lastActivity,
    config: { ...s.config, missionIds: [...s.config.missionIds] },
    phase: s.phase,
    missionIndex: s.missionIndex,
    missionComplete: s.missionComplete,
    played: [...s.played],
    acceptingJoins: s.acceptingJoins,
    paused: s.paused,
    pausedAt: s.pausedAt,
    timeline: s.timeline ? { ...s.timeline } : null,
    roomFreeze: { ...s.roomFreeze },
    v: s.v,
    spotlight: s.spotlight,
    lanterns: s.lanterns,
    holdsMade: s.holdsMade,
    mindsChangedSafer: s.mindsChangedSafer,
    seeDifferently: s.seeDifferently,
    seatsCreated: s.seatsCreated,
    aggregate: s.aggregate,
    debrief: s.debrief,
    endedAt: s.endedAt,
    seats: [...s.seats.values()].map((x) => ({
      id: x.id,
      tokenHash: x.tokenHash,
      pseudonym: x.pseudonym,
      squadId: x.squadId,
      epoch: x.epoch,
      players: x.players,
      lastSeenAt: x.lastSeenAt,
      role: x.role,
    })),
    squads: [...s.squads.values()].map((sq) => ({
      id: sq.id,
      seatIds: [...sq.seatIds],
      gentle: sq.gentle,
      guardians: [...sq.guardians],
      lumen: { wallet: sq.lumen.wallet, trust: { ...sq.lumen.trust } },
      decisions: sq.decisions.map((d) => ({ ...d })),
      pending: sq.pending.map((p) => ({ ...p })),
      finale: sq.finale,
      recovered: [...sq.recovered],
      mission: sq.mission ? missionDoc(sq.mission) : null,
    })),
    dash: s.dash ? dashDoc(s.dash) : null,
    dashRuns: s.dashRuns,
    dashUsed: [...s.dashUsed],
  };
}

const pinMap = (pins: EvidencePin[]): Map<string, Map<string, PinEntry>> =>
  new Map(pins.map((p) => [p.clueId, new Map(p.roles.map((role) => [`restored:${role}`, { role, live: p.live }]))]));

/** Rebuilds a session from its crash snapshot. Returns null for unusable docs (unknown missions, old format). */
export function fromDoc(doc: SessionDoc, now: number): SessionState | null {
  if (doc.format !== SNAPSHOT_FORMAT || !doc.config.missionIds.every((id) => missionById(id))) return null;
  const seats = new Map<string, Seat>();
  for (const x of doc.seats) {
    seats.set(x.id, {
      id: x.id,
      tokenHash: x.tokenHash,
      pseudonym: x.pseudonym,
      squadId: x.squadId,
      epoch: x.epoch,
      players: x.players,
      sockets: new Set(),
      lastSeenAt: x.lastSeenAt,
      ready: false,
      onBreak: false,
      needHelp: false,
      roomHolding: false,
      role: x.role,
      held: false,
      playersState: Array.from({ length: x.players }, emptyPlayer),
      steelman: null,
      lateHolds: new Set(),
    });
  }
  const running = doc.phase === 'mission' && !doc.missionComplete;
  const squads = new Map<SquadTotemId, Squad>();
  for (const q of doc.squads) {
    let mission: SquadMission | null = null;
    const md = q.mission;
    if (md) {
      mission = {
        ...md,
        holding: new Set(Array.from({ length: md.holding }, (_, i) => `restored:${i}`)),
        pins: pinMap(md.pins),
        cleared: pinMap(md.cleared),
        tracedRoles: new Set(md.tracedRoles),
        voteIds: new Map(),
        tie: null,
        tieBreakerSeat: null,
        shield: md.shield ? { ...md.shield, sendOpenAt: null, sendOpen: false } : null,
        guardiansUsed: new Set(md.guardiansUsed),
      };
      // Votes were never written to disk: a squad caught between Think and Re-seal seals again.
      if (running && !md.complete && !md.decision && ['think', 'reveal', 'explain', 'reseal'].includes(md.phase)) {
        const m = missionById(md.missionId);
        const t = m ? phaseTiming({ band: doc.config.band, scaffold: m.scaffold, relaxed: doc.config.relaxed, calm: doc.config.calm }) : null;
        const resume = doc.paused && doc.pausedAt !== null ? doc.pausedAt : doc.savedAt;
        mission.phase = 'think';
        mission.phaseStartedAt = resume;
        mission.phaseEndsAt = resume + (t?.think ?? 30) * 1000;
        mission.sealLockUntil = resume + (t?.sealLock ?? 10) * 1000;
        mission.reveal = null;
        mission.chips = null;
      }
    }
    squads.set(q.id, {
      id: q.id,
      seatIds: q.seatIds.filter((id) => seats.has(id)),
      gentle: q.gentle,
      guardians: new Set(q.guardians),
      lumen: { wallet: q.lumen.wallet, trust: { ...q.lumen.trust } },
      decisions: q.decisions,
      pending: q.pending,
      finale: q.finale,
      recovered: new Set(q.recovered),
      mission,
    });
  }
  const aggregate = doc.aggregate;
  const missionAgg =
    doc.missionIndex !== null ? (aggregate.perMission.filter((m) => m.missionId === doc.config.missionIds[doc.missionIndex ?? -1]).at(-1) ?? null) : null;
  return {
    code: doc.code,
    hostKeyHash: doc.hostKeyHash,
    seed: doc.seed,
    createdAt: doc.createdAt,
    lastActivity: Math.max(doc.lastActivity, now),
    config: doc.config,
    phase: doc.phase,
    missionIndex: doc.missionIndex,
    missionComplete: doc.missionComplete,
    played: doc.played,
    acceptingJoins: doc.acceptingJoins,
    // A restored running mission waits paused for the Conductor; deadlines shift by the downtime on resume.
    paused: running ? true : doc.paused,
    pausedAt: running ? (doc.paused && doc.pausedAt !== null ? doc.pausedAt : doc.savedAt) : doc.pausedAt,
    timeline: doc.timeline,
    roomFreeze: { ...doc.roomFreeze, amount: 0 },
    squads,
    seats,
    tokens: new Map([...seats.values()].map((x) => [x.tokenHash, x.id])),
    v: doc.v + 1,
    spotlight: doc.spotlight,
    lanterns: doc.lanterns,
    holdsMade: doc.holdsMade,
    mindsChangedSafer: doc.mindsChangedSafer,
    seeDifferently: doc.seeDifferently,
    seatsCreated: doc.seatsCreated,
    aggregate,
    missionAgg,
    debrief: doc.debrief,
    endedAt: doc.endedAt,
    dash: doc.phase === 'ended' ? null : dashFrom(doc, now),
    dashRuns: doc.dashRuns ?? 0,
    dashUsed: doc.dashUsed ?? [],
  };
}
