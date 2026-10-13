// In-memory state of one live squad session. Only the server process holds this; clients get
// audience-specific snapshots built in ./views.ts. Seat-to-vote links exist here and nowhere else
// (never in persisted snapshots or aggregates, GDD §11.7).

import type {
  AftershockDelivery,
  BondView,
  ChipBoard,
  ChoiceCount,
  DashResult,
  DashStage,
  DebriefView,
  DecisionView,
  DistrictId,
  GuardianId,
  MissionAggregate,
  MissionTimeline,
  Mood,
  ReasonChipId,
  RevealView,
  RoleAssignment,
  SessionAggregate,
  SessionConfig,
  SessionPhase,
  ShadowCheck,
  ShieldResultView,
  ShieldSlot,
  SquadMissionPhase,
  SquadRoleId,
  SquadTotemId,
  TieBreakView,
} from '@shieldquest/shared';

export interface VoteRecord {
  voteId: string;
  choiceId: string;
  confidence?: 1 | 2 | 3;
}

/** One player on a seat (a pass-and-play seat has several). Dropped when the mission closes. */
export interface PlayerState {
  r1: VoteRecord | null;
  r2: VoteRecord | null;
  forecast: string | null;
  trace: string | null;
  reasons: ReasonChipId[];
}

export const emptyPlayer = (): PlayerState => ({ r1: null, r2: null, forecast: null, trace: null, reasons: [] });

export interface Seat {
  id: string;
  /** SHA-256 of the device's seat token; the token itself is never kept. */
  tokenHash: string;
  pseudonym: string;
  squadId: SquadTotemId;
  /** Bumped when the seat is reclaimed by another device, so a recovered old socket is turned away. */
  epoch: number;
  players: number;
  sockets: Set<string>;
  /** Last time a socket for this seat connected or disconnected (for away time and Reclaim Seat). */
  lastSeenAt: number;
  ready: boolean;
  onBreak: boolean;
  needHelp: boolean;
  roomHolding: boolean;
  // Current mission (reset when a mission opens)
  role: RoleAssignment | null;
  held: boolean;
  playersState: PlayerState[];
  steelman: { choiceId: string } | null;
  /** `${aftershockKey}#${player}` for Late Hold picks already made. */
  lateHolds: Set<string>;
}

export interface PinEntry {
  role: SquadRoleId;
  live: boolean;
}

export interface ShieldState {
  picks: Partial<Record<ShieldSlot, string>>;
  result: ShieldResultView | null;
  attempts: number;
  /** When any seat may SEND because the Peer Supporter is away; null while they are here. */
  sendOpenAt: number | null;
  sendOpen: boolean;
}

/** Counts kept for Bond rules and the Aftershock forecast check after votes are dropped. */
export interface SquadMissionStats {
  forecastLikely: number;
  forecastTotal: number;
  traceCorrect: number;
  traceTotal: number;
}

export interface SquadMission {
  missionId: string;
  index: number;
  phase: SquadMissionPhase;
  phaseStartedAt: number;
  phaseEndsAt: number;
  complete: boolean;
  /** Closed by the Conductor (Skip scenario) before Bond. */
  skipped: boolean;
  sealLockUntil: number | null;
  aftershocks: AftershockDelivery[];
  shadow: ShadowCheck | null;
  /** Seats that pressed HOLD (count only leaves the server). */
  holding: Set<string>;
  /** Squad size the roles were dealt for (late joiners take an open role from this deal). */
  dealtSize: number;
  /** Decided without any votes (everyone away): the safest Exit is played but earns nothing. */
  fallback: boolean;
  /** Holds in the first 70% of Live (squad-level count for the H rule). */
  earlyHolds: number;
  /** Connected seats when Live ended. */
  seatsAtLive: number;
  /** clueId -> pin owner key (seat id, or `restored:<role>` after a restart) -> entry. */
  pins: Map<string, Map<string, PinEntry>>;
  cleared: Map<string, Map<string, PinEntry>>;
  tracedRoles: Set<SquadRoleId>;
  /** voteId -> `${seatId}#${player}#${round}` for idempotent seals. */
  voteIds: Map<string, string>;
  reveal: RevealView | null;
  chips: ChipBoard | null;
  tie: TieBreakView | null;
  tieBreakerSeat: string | null;
  decision: DecisionView | null;
  /** Agreement of the final votes, kept for the Conductor after the votes are dropped. */
  finalMood: Mood | null;
  steelmanDeals: number;
  shield: ShieldState | null;
  bond: BondView | null;
  surgeFired: boolean;
  guardiansUsed: Set<GuardianId>;
  explainExtended: boolean;
  echoUsed: boolean;
  shared: boolean;
  folded: { votes: boolean; board: boolean; shield: boolean };
  stats: SquadMissionStats;
}

export interface PendingShock {
  key: string;
  missionId: string;
  choiceId: string;
  aftershockId: string;
  /** Lands at the opening of the mission with this index (or at the finale). */
  dueIndex: number;
  forecast: { matched: number; total: number };
}

export interface Squad {
  id: SquadTotemId;
  seatIds: string[];
  gentle: boolean;
  guardians: Set<GuardianId>;
  lumen: { wallet: number; trust: Partial<Record<DistrictId, number>> };
  decisions: { missionId: string; choiceId: string }[];
  pending: PendingShock[];
  finale: AftershockDelivery[];
  /** Aftershock keys this squad already recovered from (one relit lantern each). */
  recovered: Set<string>;
  mission: SquadMission | null;
}

/** One squad's outcome for a scored Squad Dash question (squad level; no seat ever appears here). */
export interface DashSquadResult {
  squadId: SquadTotemId;
  /** Final taps per option for this squad (counts only; only this squad's own phones ever see them). */
  counts: ChoiceCount[];
  result: DashResult;
}

export interface DashRound {
  questionId: string;
  skipped: boolean;
  squads: DashSquadResult[];
}

/** A running Squad Dash. Taps live in memory only and are dropped as soon as the question is revealed. */
export interface DashState {
  id: string;
  questionIds: string[];
  index: number;
  stage: DashStage;
  stageStartedAt: number;
  endsAt: number | null;
  /** `${seatId}#${player}` -> option id, for the current question only. Never persisted. */
  answers: Map<string, string>;
  /** Scored or skipped questions, in order. */
  rounds: DashRound[];
}

export interface SessionState {
  code: string;
  hostKeyHash: string;
  /** Seeds the Steelman RNG. Random per session; never derived from votes. */
  seed: string;
  createdAt: number;
  lastActivity: number;
  config: SessionConfig;
  phase: SessionPhase;
  missionIndex: number | null;
  missionComplete: boolean;
  /** Indexes of missions already opened (a mission is never replayed in one session). */
  played: number[];
  acceptingJoins: boolean;
  paused: boolean;
  pausedAt: number | null;
  timeline: MissionTimeline | null;
  roomFreeze: { active: boolean; done: boolean; amount: number; peak: number };
  squads: Map<SquadTotemId, Squad>;
  seats: Map<string, Seat>;
  /** tokenHash -> seat id */
  tokens: Map<string, string>;
  /** Monotonic state version for snapshots. */
  v: number;
  spotlight: SquadTotemId | null;
  lanterns: number;
  holdsMade: number;
  mindsChangedSafer: number;
  seeDifferently: number;
  /** Seats ever created (for the aggregate). */
  seatsCreated: number;
  aggregate: SessionAggregate;
  /** The current mission's aggregate (also inside aggregate.perMission). */
  missionAgg: MissionAggregate | null;
  debrief: DebriefView | null;
  endedAt: number | null;
  /** The open Squad Dash, or null. */
  dash: DashState | null;
  /** Squad Dash rounds opened so far (seeds the question shuffle). */
  dashRuns: number;
  /** Question ids already used in this session's Dash rounds (dealt again only when the bank runs dry). */
  dashUsed: string[];
}
