// The server-authoritative state machine for one live squad session (GDD §5.3, §6.5, §7.2, §12.5).
// No sockets, no timers and no clock in here: callers pass `now` and wire the hooks, so the whole
// session can be driven deterministically in tests. Every mutation bumps the version and calls
// hooks.changed(); phase boundaries also call hooks.boundary() so a crash snapshot is written.

import {
  DASH_ALL_IN_SEC,
  RECLAIM_AFTER_MS,
  ROOM_SYNCED_PHASES,
  SKILLS,
  SQUAD_LIMITS,
  SQUAD_TOTEMS,
  activeRoles,
  chipBoard,
  dashQuestionSec,
  dashSquadPick,
  emptyDashAggregate,
  evaluateShield,
  guardianForSkill,
  hashSeed,
  holdBucket,
  isEarlyHold,
  majorityOf,
  missionById,
  moodFor,
  mulberry32,
  phaseIndex,
  phaseTiming,
  pickChanceSet,
  pickSteelmanSeat,
  roleAssignment,
  roleForSeat,
  safestChoice,
  shieldSlotsFor,
  shieldSlotsForBand,
  shiftBetween,
  steelmanTarget,
  surgesEnabled,
  tallyVotes,
  totalVotes,
  type AckResult,
  type AftershockDelivery,
  type BecauseTileId,
  type BondView,
  type DashLength,
  type DecisionView,
  type ErrorCode,
  type GuardianId,
  type HostCommand,
  type Mission,
  type PhaseTiming,
  type ReasonChipId,
  type RevealView,
  type Safety,
  type ServerToClientEvents,
  type SessionAggregate,
  type SessionConfig,
  type ShadowCheck,
  type ShieldSlot,
  type SkillId,
  type SquadMissionPhase,
  type SquadTotemId,
} from '@shieldquest/shared';
import { addCount, addShieldLine, cloneAggregate, debriefFrom, newSessionAggregate, openMissionAggregate } from './aggregate';
import { emptyPlayer, type DashState, type PlayerState, type Seat, type SessionState, type Squad, type SquadMission } from './state';
import {
  boardView,
  canSendShield,
  activePlayers,
  dashAnswerKey,
  dashQuestion,
  dashSquads,
  dashTally,
  isActive,
  isConnected,
  missionOf,
  openMission,
  seatPlayers,
  shieldOwners,
  squadSeats,
  squadSurgeAt,
  squadsInOrder,
} from './views';
import { hashSecret, makePseudonym, matchesHash, newId, newSecret } from './words';

type Payload<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>[0];

export interface SessionHooks {
  /** State changed: schedule a snapshot broadcast. */
  changed(): void;
  /** A phase boundary (or a join, a command): write the crash snapshot. */
  boundary(): void;
  emitSquad<E extends keyof ServerToClientEvents>(squadId: SquadTotemId, event: E, payload: Payload<E>): void;
  emitSeat<E extends keyof ServerToClientEvents>(seatId: string, event: E, payload: Payload<E>): void;
  emitAll<E extends keyof ServerToClientEvents>(event: E, payload: Payload<E>): void;
  /** A seat changed squad: move its sockets between squad rooms. */
  seatMoved(seatId: string, from: SquadTotemId, to: SquadTotemId): void;
  /** Persist the (counts-only) session aggregate. */
  aggregate(agg: SessionAggregate): void;
  /** The session closed for good. */
  ended(): void;
}

export type JoinResult = { ok: true; seatId: string } | { ok: false; error: ErrorCode };

const SEC = 1000;
const OK: AckResult = { ok: true };
const DUP: AckResult = { ok: true, dup: true };
const fail = (error: ErrorCode): AckResult => ({ ok: false, error });
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Seats seen within Socket.IO's recovery window still get a role when a mission opens. */
const PRESENT_WINDOW_MS = 180_000;
/** At most this many Aftershocks per squad per slot; the rest roll to the next slot (GDD §6.3). */
const MAX_SLOT_DELIVERIES = 2;

const PIN_PHASES: readonly SquadMissionPhase[] = ['live', 'investigate', 'think'];
const STRING_PHASES: readonly SquadMissionPhase[] = ['live', 'investigate', 'think'];
const SHARE_PHASES: readonly SquadMissionPhase[] = ['investigate', 'think', 'reveal', 'explain', 'reseal', 'release', 'shield', 'bond'];
const REASON_PHASES: readonly SquadMissionPhase[] = ['reveal', 'explain', 'reseal'];

/** When each Guardian's once-per-mission ability makes sense (GDD §6.2). */
const GUARDIAN_PHASES: Record<GuardianId, readonly SquadMissionPhase[]> = {
  shieldfin: ['investigate', 'shield'],
  cluepaw: ['live', 'investigate'],
  echo: ['explain'],
  verifox: ['live', 'investigate', 'think'],
  bytebuddy: ['live', 'investigate', 'think'],
  beacon: ['investigate', 'think', 'reseal', 'shield'],
};

const safetyOf = (mission: Mission, choiceId: string): Safety =>
  mission.choices.find((c) => c.id === choiceId)?.safety ?? 'unsure';

function shockSpec(missionId: string, choiceId: string) {
  const mission = missionById(missionId);
  const choice = mission?.choices.find((c) => c.id === choiceId);
  return mission && choice?.aftershock ? { mission, choice, spec: choice.aftershock } : null;
}

export function newSquadMission(
  missionId: string,
  index: number,
  phase: SquadMissionPhase,
  now: number,
  endsAt: number,
): SquadMission {
  return {
    missionId,
    index,
    phase,
    phaseStartedAt: now,
    phaseEndsAt: endsAt,
    complete: false,
    skipped: false,
    sealLockUntil: null,
    aftershocks: [],
    shadow: null,
    holding: new Set(),
    dealtSize: 0,
    fallback: false,
    earlyHolds: 0,
    seatsAtLive: 0,
    pins: new Map(),
    cleared: new Map(),
    tracedRoles: new Set(),
    voteIds: new Map(),
    reveal: null,
    chips: null,
    tie: null,
    tieBreakerSeat: null,
    decision: null,
    finalMood: null,
    steelmanDeals: 0,
    shield: null,
    bond: null,
    surgeFired: false,
    guardiansUsed: new Set(),
    explainExtended: false,
    echoUsed: false,
    shared: false,
    folded: { votes: false, board: false, shield: false },
    stats: { forecastLikely: 0, forecastTotal: 0, traceCorrect: 0, traceTotal: 0 },
  };
}

/**
 * Replaces seat ids in a closed mission with anonymous keys: the board keeps its role-tagged pins and the
 * hold count, but nothing in memory can say any more which seat held, pinned or sealed what.
 */
function scrubSeatLinks(m: SquadMission): void {
  const anon = <V>(owners: Map<string, V>): Map<string, V> => new Map([...owners.values()].map((v, i) => [`x:${i}`, v]));
  m.holding = new Set([...m.holding].map((_, i) => `x:${i}`));
  for (const [clueId, owners] of m.pins) m.pins.set(clueId, anon(owners));
  for (const [clueId, owners] of m.cleared) m.cleared.set(clueId, anon(owners));
  m.voteIds.clear();
  m.tieBreakerSeat = null;
}

interface PlayCtx {
  seat: Seat;
  sq: Squad;
  m: SquadMission;
  mission: Mission;
}

export class SquadSession {
  constructor(
    readonly s: SessionState,
    private readonly hooks: SessionHooks,
  ) {}

  static create(
    input: { code: string; hostKeyHash: string; config: SessionConfig; now: number },
    hooks: SessionHooks,
  ): SquadSession {
    const { code, hostKeyHash, config, now } = input;
    const s: SessionState = {
      code,
      hostKeyHash,
      seed: newSecret(),
      createdAt: now,
      lastActivity: now,
      config,
      phase: 'lobby',
      missionIndex: null,
      missionComplete: false,
      played: [],
      acceptingJoins: true,
      paused: false,
      pausedAt: null,
      timeline: null,
      roomFreeze: { active: false, done: false, amount: 0, peak: 0 },
      squads: new Map(),
      seats: new Map(),
      tokens: new Map(),
      v: 1,
      spotlight: null,
      lanterns: 0,
      holdsMade: 0,
      mindsChangedSafer: 0,
      seeDifferently: 0,
      seatsCreated: 0,
      aggregate: newSessionAggregate(config.band, config.missionIds, now),
      missionAgg: null,
      debrief: null,
      endedAt: null,
      dash: null,
      dashRuns: 0,
      dashUsed: [],
    };
    const session = new SquadSession(s, hooks);
    for (let i = 0; i < (config.squadCount ?? 0); i++) session.createSquad();
    return session;
  }

  get code(): string {
    return this.s.code;
  }

  checkHostKey(key: string): boolean {
    return matchesHash(key, this.s.hostKeyHash);
  }

  // -------------------------------------------------------------------------------------------
  // Bookkeeping

  private touch(boundary = false): void {
    this.s.v += 1;
    this.hooks.changed();
    if (boundary) this.hooks.boundary();
  }

  private activity(now: number): void {
    this.s.lastActivity = now;
  }

  private get missionRunning(): boolean {
    return this.s.phase === 'mission' && !this.s.missionComplete;
  }

  private timing(mission: Mission): PhaseTiming {
    const { band, relaxed, calm } = this.s.config;
    return phaseTiming({ band, scaffold: mission.scaffold, relaxed, calm });
  }

  private lightLantern(): void {
    // City Pulse only ever increases (GDD §6.3.6).
    this.s.lanterns += 1;
    this.s.aggregate.lanterns = this.s.lanterns;
  }

  private adjustTrust(sq: Squad, district: Mission['district'], delta: number): void {
    if (!delta) return;
    sq.lumen.trust[district] = clamp((sq.lumen.trust[district] ?? 0) + delta, -3, 3);
  }

  private playerOf(seat: Seat, player: number | undefined): PlayerState | null {
    const i = player ?? 0;
    if (i < 0 || i >= seat.players) return null;
    while (seat.playersState.length < seat.players) seat.playersState.push(emptyPlayer());
    return seat.playersState[i] ?? null;
  }

  // -------------------------------------------------------------------------------------------
  // Squads, seats and joining

  private createSquad(id?: SquadTotemId): Squad | null {
    const s = this.s;
    if (s.squads.size >= SQUAD_LIMITS.maxSquads) return null;
    const totem = SQUAD_TOTEMS.find((t) => (id ? t.id === id : true) && !s.squads.has(t.id));
    if (!totem) return null;
    const sq: Squad = {
      id: totem.id,
      seatIds: [],
      gentle: false,
      guardians: new Set(),
      lumen: { wallet: 0, trust: {} },
      decisions: [],
      pending: [],
      finale: [],
      recovered: new Set(),
      mission: null,
    };
    s.squads.set(sq.id, sq);
    s.aggregate.squadsTotal = Math.max(s.aggregate.squadsTotal, s.squads.size);
    return sq;
  }

  /**
   * Requested totem first (tent card), else auto-balance: grow the number of squads so they stay at
   * 4-5 (auto mode, never mid-mission), then fill the smallest squad.
   */
  private pickSquad(requested?: SquadTotemId): Squad | null {
    const s = this.s;
    const canCreate = s.config.squadCount === null && !this.missionRunning;
    if (requested) {
      const sq = s.squads.get(requested) ?? (canCreate ? this.createSquad(requested) : null);
      if (sq && sq.seatIds.length < SQUAD_LIMITS.maxSize) return sq;
    }
    if (canCreate) {
      const desired = clamp(Math.ceil((s.seats.size + 1) / SQUAD_LIMITS.targetSize), 1, SQUAD_LIMITS.maxSquads);
      if (s.squads.size < desired) {
        const sq = this.createSquad();
        if (sq) return sq;
      }
    }
    let best: Squad | null = null;
    for (const sq of squadsInOrder(s)) {
      if (sq.seatIds.length >= SQUAD_LIMITS.maxSize) continue;
      if (!best || sq.seatIds.length < best.seatIds.length) best = sq;
    }
    return best ?? (canCreate ? this.createSquad() : null);
  }

  /** Handshake for a seat: same token -> same seat; Reclaim Seat; or a new seat with a generated pseudonym. */
  admitSeat(input: { seatToken: string; squad?: SquadTotemId; reclaimSeatId?: string }, now: number): JoinResult {
    const s = this.s;
    const hash = hashSecret(input.seatToken);
    const known = s.tokens.get(hash);
    if (known && s.seats.has(known)) return { ok: true, seatId: known };
    if (s.phase === 'ended') return { ok: false, error: 'ended' };
    if (input.reclaimSeatId) {
      const seat = s.seats.get(input.reclaimSeatId);
      if (!seat) return { ok: false, error: 'not-found' };
      if (isConnected(seat) || now - seat.lastSeenAt < RECLAIM_AFTER_MS) return { ok: false, error: 'seat-taken' };
      s.tokens.delete(seat.tokenHash);
      seat.tokenHash = hash;
      seat.epoch += 1;
      s.tokens.set(hash, seat.id);
      this.activity(now);
      this.touch(true);
      return { ok: true, seatId: seat.id };
    }
    if (!s.acceptingJoins) return { ok: false, error: 'joins-locked' };
    if (s.seats.size >= SQUAD_LIMITS.maxSeats) return { ok: false, error: 'session-full' };
    const sq = this.pickSquad(input.squad);
    if (!sq) return { ok: false, error: 'squad-full' };
    const used = new Set([...s.seats.values()].map((x) => x.pseudonym));
    const seat: Seat = {
      id: newId(),
      tokenHash: hash,
      pseudonym: makePseudonym(used),
      squadId: sq.id,
      epoch: 0,
      players: 1,
      sockets: new Set(),
      lastSeenAt: now,
      ready: false,
      onBreak: false,
      needHelp: false,
      roomHolding: false,
      role: null,
      held: false,
      playersState: [emptyPlayer()],
      steelman: null,
      lateHolds: new Set(),
    };
    s.seats.set(seat.id, seat);
    s.tokens.set(hash, seat.id);
    sq.seatIds.push(seat.id);
    s.seatsCreated += 1;
    s.aggregate.seatsTotal = s.seatsCreated;
    this.activity(now);
    this.touch(true);
    return { ok: true, seatId: seat.id };
  }

  /** A socket for this seat connected (fresh, rejoin or recovered). Returns false if the seat is gone. */
  connectSeat(seatId: string, socketId: string, now: number): boolean {
    const seat = this.s.seats.get(seatId);
    if (!seat) return false;
    seat.sockets.add(socketId);
    seat.lastSeenAt = now;
    this.activity(now);
    const sq = this.s.squads.get(seat.squadId);
    const m = sq ? openMission(this.s, sq) : null;
    if (sq && m) {
      // Late joiners take an open lens or a Shadow Clue lens (GDD §6.6).
      if (!seat.role) this.lateRole(sq, m, seat);
      if (m.shield && seat.role?.covers.includes('peer-supporter') && !seat.role.shadow) {
        m.shield.sendOpenAt = null;
        m.shield.sendOpen = false;
      }
    }
    if (this.s.phase === 'room-freeze') this.recomputeFreeze();
    this.touch();
    return true;
  }

  disconnectSeat(seatId: string, socketId: string, now: number): void {
    const seat = this.s.seats.get(seatId);
    if (!seat || !seat.sockets.delete(socketId) || seat.sockets.size > 0) return;
    seat.lastSeenAt = now;
    seat.roomHolding = false;
    const sq = this.s.squads.get(seat.squadId);
    const m = sq ? openMission(this.s, sq) : null;
    if (m?.shield && !m.shield.result && seat.role?.covers.includes('peer-supporter') && !seat.role.shadow) {
      m.shield.sendOpenAt = now + this.timing(missionOf(m.missionId)).shieldSendFallback * SEC;
    }
    if (this.s.phase === 'room-freeze') this.recomputeFreeze();
    this.touch();
    if (sq) this.checkQuorum(sq, now);
  }

  /** Seats that may be reclaimed by a new device (disconnected for a while). */
  openSeats(now: number): { seatId: string; pseudonym: string; squadId: SquadTotemId }[] {
    if (this.s.phase === 'ended') return [];
    return [...this.s.seats.values()]
      .filter((x) => !isConnected(x) && now - x.lastSeenAt >= RECLAIM_AFTER_MS)
      .map((x) => ({ seatId: x.id, pseudonym: x.pseudonym, squadId: x.squadId }));
  }

  private dealRoles(sq: Squad, m: SquadMission, now: number): void {
    const seats = squadSeats(this.s, sq);
    const present = seats.filter((x) => isConnected(x) || now - x.lastSeenAt < PRESENT_WINDOW_MS);
    m.dealtSize = present.length;
    for (const seat of seats) seat.role = null;
    present.forEach((seat, i) => {
      seat.role = roleForSeat(i, m.index, present.length, this.s.config.band);
    });
  }

  private lateRole(sq: Squad, m: SquadMission, seat: Seat): void {
    const taken = new Set(
      squadSeats(this.s, sq)
        .filter((x) => x !== seat && x.role && !x.role.shadow)
        .map((x) => x.role?.role),
    );
    const open = activeRoles(Math.max(1, m.dealtSize), this.s.config.band).find((r) => !taken.has(r.role));
    seat.role = open
      ? roleAssignment(open.role, open.covers, false)
      : roleAssignment('evidence-checker', ['evidence-checker'], true);
  }

  private safetyLeadSeat(sq: Squad): Seat | null {
    const seats = squadSeats(this.s, sq);
    const leads = seats.filter((x) => x.role?.role === 'safety-lead' && !x.role.shadow);
    return (
      leads.find(isConnected) ??
      seats.find((x) => isConnected(x) && x.role && !x.role.shadow) ??
      seats.find(isConnected) ??
      null
    );
  }

  /** Removes a seat from its squad (and from the open mission's board and votes). */
  private detachSeat(seat: Seat): Squad | null {
    const s = this.s;
    const from = s.squads.get(seat.squadId);
    if (!from) return null;
    from.seatIds = from.seatIds.filter((id) => id !== seat.id);
    const m = openMission(s, from);
    if (m) {
      for (const owners of m.pins.values()) owners.delete(seat.id);
      for (const owners of m.cleared.values()) owners.delete(seat.id);
      m.holding.delete(seat.id);
      for (const [voteId, key] of m.voteIds) if (key.startsWith(`${seat.id}#`)) m.voteIds.delete(voteId);
      if (m.tieBreakerSeat === seat.id) m.tieBreakerSeat = null;
    }
    seat.playersState = Array.from({ length: seat.players }, emptyPlayer);
    seat.steelman = null;
    seat.role = null;
    seat.ready = false;
    // A Squad Dash tap belongs to the squad the seat was in: drop it rather than carry it across.
    const dash = s.dash;
    if (dash) for (const key of [...dash.answers.keys()]) if (key.startsWith(`${seat.id}#`)) dash.answers.delete(key);
    if (m) {
      if (m.chips) m.chips = chipBoard(this.reasonPicks(from));
      if (m.tie && !m.tieBreakerSeat) m.tieBreakerSeat = this.safetyLeadSeat(from)?.id ?? null;
    }
    return from;
  }

  private moveSeatTo(seat: Seat, to: Squad): void {
    const from = this.detachSeat(seat);
    to.seatIds.push(seat.id);
    seat.squadId = to.id;
    const m = openMission(this.s, to);
    if (m) this.lateRole(to, m, seat);
    if (from) this.hooks.seatMoved(seat.id, from.id, to.id);
    this.hooks.emitSeat(seat.id, 'notice', { kind: 'moved', squadId: to.id });
  }

  // -------------------------------------------------------------------------------------------
  // Room Freeze (onboarding)

  private recomputeFreeze(): void {
    const s = this.s;
    const connected = [...s.seats.values()].filter(isConnected);
    const holding = connected.filter((x) => x.roomHolding).length;
    const amount = connected.length ? holding / connected.length : 0;
    s.roomFreeze.amount = amount;
    s.roomFreeze.peak = Math.max(s.roomFreeze.peak, amount);
    s.aggregate.roomFreezePeak = Math.round(s.roomFreeze.peak * 100) / 100;
    this.hooks.emitAll('roomFreeze', { amount, peak: s.roomFreeze.peak });
  }

  private stopRoomFreeze(): void {
    const s = this.s;
    s.roomFreeze.active = false;
    s.roomFreeze.done = true;
    s.roomFreeze.amount = 0;
    for (const seat of s.seats.values()) seat.roomHolding = false;
    if (s.phase === 'room-freeze') s.phase = 'lobby';
  }

  // -------------------------------------------------------------------------------------------
  // Missions

  private planSlot(sq: Squad, index: number, prevIndex: number | null): { deliveries: AftershockDelivery[]; shadow: ShadowCheck | null } {
    const due = sq.pending
      .filter((p) => p.dueIndex <= index)
      .sort((a, b) => a.dueIndex - b.dueIndex)
      .slice(0, MAX_SLOT_DELIVERIES);
    sq.pending = sq.pending.filter((p) => !due.includes(p));
    const deliveries = due.map((p) => ({
      key: p.key,
      missionId: p.missionId,
      choiceId: p.choiceId,
      aftershockId: p.aftershockId,
      finale: false,
      forecast: { ...p.forecast },
    }));
    // Shadow check: after a non-risky decision, "Meanwhile, in another timeline…" shows the risky branch.
    let shadow: ShadowCheck | null = null;
    const last = sq.decisions[sq.decisions.length - 1];
    const prevId = prevIndex === null ? null : this.s.config.missionIds[prevIndex];
    if (last && last.missionId === prevId) {
      const lm = missionById(last.missionId);
      const chosen = lm?.choices.find((c) => c.id === last.choiceId);
      const risky = lm?.choices.find((c) => c.safety === 'risky' && c.aftershock);
      if (lm && chosen && chosen.safety !== 'risky' && risky?.aftershock) {
        shadow = { missionId: lm.id, choiceId: risky.id, aftershockId: risky.aftershock.id };
      }
    }
    return { deliveries, shadow };
  }

  private landShock(sq: Squad, d: AftershockDelivery): void {
    const found = shockSpec(d.missionId, d.choiceId);
    if (!found) return;
    sq.lumen.wallet += found.spec.effects.wallet ?? 0;
    this.adjustTrust(sq, found.mission.district, found.spec.effects.trust ?? 0);
    this.s.aggregate.aftershocksDelivered += 1;
    if (found.spec.polarity === 'protective') this.lightLantern();
  }

  private startMission(index: number, now: number): AckResult {
    const s = this.s;
    if (s.phase === 'debrief') return fail('wrong-phase');
    if (index < 0 || index >= s.config.missionIds.length) return fail('bad-request');
    if (s.played.includes(index)) return fail('used');
    if (s.dash) this.closeDash(now);
    if (this.missionRunning) this.closeMission(now, true);
    if (s.phase === 'room-freeze') this.stopRoomFreeze();
    this.autoBalance(now);
    const missionId = s.config.missionIds[index];
    if (!missionId) return fail('bad-request');
    const mission = missionOf(missionId);
    const t = this.timing(mission);
    const prevIndex = s.played[s.played.length - 1] ?? null;

    s.phase = 'mission';
    s.missionIndex = index;
    s.missionComplete = false;
    s.played.push(index);
    s.spotlight = null;
    s.paused = false;
    s.pausedAt = null;
    s.missionAgg = openMissionAggregate(s.aggregate, missionId);
    for (const seat of s.seats.values()) {
      seat.role = null;
      seat.held = false;
      seat.ready = false;
      seat.steelman = null;
      seat.playersState = Array.from({ length: seat.players }, emptyPlayer);
    }

    const plans = new Map<SquadTotemId, ReturnType<SquadSession['planSlot']>>();
    for (const sq of squadsInOrder(s)) {
      if (sq.seatIds.length === 0) {
        sq.mission = null;
        continue;
      }
      plans.set(sq.id, this.planSlot(sq, index, prevIndex));
    }
    const slot = [...plans.values()].some((p) => p.deliveries.length > 0 || p.shadow) ? t.aftershock : 0;
    const roleFlipAt = now + slot * SEC;
    const liveAt = roleFlipAt + t.roleFlip * SEC;
    const liveEndsAt = liveAt + mission.live.durationSec * SEC;
    s.timeline = {
      missionId,
      index,
      openedAt: now,
      roleFlipAt,
      liveAt,
      liveEndsAt,
      freezeEndAt: Math.max(liveAt + t.freezeEnd * SEC, liveEndsAt + 60 * SEC),
      surgeAt: surgesEnabled(s.config.band, s.config.gentle) ? liveEndsAt + t.surgeAfterLive * SEC : null,
    };
    for (const sq of squadsInOrder(s)) {
      const plan = plans.get(sq.id);
      if (!plan) continue;
      const m = newSquadMission(missionId, index, slot ? 'aftershock' : 'role-flip', now, slot ? roleFlipAt : liveAt);
      m.aftershocks = plan.deliveries;
      m.shadow = plan.shadow;
      sq.mission = m;
      this.dealRoles(sq, m, now);
      for (const d of plan.deliveries) this.landShock(sq, d);
    }
    s.missionAgg.squads = plans.size;
    this.touch(true);
    return OK;
  }

  /** Closes the current mission in every squad. `skip` = closed by the Conductor (Skip scenario / moving on). */
  private closeMission(now: number, skip: boolean): void {
    const s = this.s;
    for (const sq of squadsInOrder(s)) {
      const m = openMission(s, sq);
      if (!m) continue;
      m.complete = true;
      m.skipped = true;
      m.tie = null;
      m.tieBreakerSeat = null;
      // A squad that already decided keeps its Peer Shield result (a complete message is auto-sent).
      if (m.decision) this.finishShield(m, missionOf(m.missionId));
      this.foldBoard(m);
    }
    s.missionComplete = true;
    if (!skip) s.aggregate.missionsCompleted += 1;
    if (s.spotlight && !s.squads.get(s.spotlight)?.mission?.shared) s.spotlight = null;
    // The aggregate is written: drop every seat-to-vote and seat-to-hold link now (GDD §5.3, §6.5).
    for (const seat of s.seats.values()) {
      seat.playersState = Array.from({ length: seat.players }, emptyPlayer);
      seat.steelman = null;
      seat.ready = false;
      seat.held = false;
    }
    for (const sq of s.squads.values()) if (sq.mission) scrubSeatLinks(sq.mission);
    this.hooks.aggregate(cloneAggregate(s.aggregate));
    this.activity(now);
    this.touch(true);
  }

  private enterSynced(sq: Squad, m: SquadMission, phase: SquadMissionPhase, startedAt: number, endsAt: number): void {
    m.phase = phase;
    m.phaseStartedAt = startedAt;
    m.phaseEndsAt = endsAt;
    for (const seat of squadSeats(this.s, sq)) seat.ready = false;
    this.touch(true);
  }

  private endLive(sq: Squad, m: SquadMission, now: number): void {
    const s = this.s;
    const tl = s.timeline;
    if (!tl) return;
    const connected = squadSeats(s, sq).filter(isConnected);
    m.seatsAtLive = connected.length;
    // Late auto-freeze: counted in the 'late' bucket, no penalty. The seat itself is never stored.
    const agg = s.missionAgg;
    if (agg) agg.holdBuckets.late += connected.filter((x) => !x.held).length;
    this.enterSynced(sq, m, 'investigate', tl.liveEndsAt, Math.max(tl.freezeEndAt, now + 30 * SEC));
  }

  private enter(sq: Squad, m: SquadMission, phase: SquadMissionPhase, now: number): void {
    const s = this.s;
    const mission = missionOf(m.missionId);
    const t = this.timing(mission);
    m.phase = phase;
    m.phaseStartedAt = now;
    for (const seat of squadSeats(s, sq)) seat.ready = false;
    switch (phase) {
      case 'think':
        m.sealLockUntil = now + t.sealLock * SEC;
        m.phaseEndsAt = now + t.think * SEC;
        break;
      case 'reveal':
        m.reveal = this.buildReveal(sq, mission);
        m.phaseEndsAt = now + t.reveal * SEC;
        break;
      case 'explain':
        m.chips = chipBoard(this.reasonPicks(sq));
        m.phaseEndsAt = now + t.explain * SEC;
        this.dealSteelman(sq, m, mission, false);
        break;
      case 'reseal':
        m.phaseEndsAt = now + t.reseal * SEC;
        break;
      case 'release':
        m.phaseEndsAt = now + t.release * SEC;
        break;
      case 'shield': {
        m.shield = { picks: {}, result: null, attempts: 0, sendOpenAt: null, sendOpen: false };
        const supporter = squadSeats(s, sq).find((x) => x.role?.covers.includes('peer-supporter') && !x.role.shadow);
        if (supporter && !isConnected(supporter)) m.shield.sendOpenAt = now + t.shieldSendFallback * SEC;
        m.phaseEndsAt = now + t.shield * SEC;
        break;
      }
      case 'bond':
        this.finishShield(m, mission);
        m.bond = this.computeBond(sq, m, mission);
        m.phaseEndsAt = now + t.bond * SEC;
        break;
      default:
        m.phaseEndsAt = now + 15 * SEC;
    }
    this.touch(true);
  }

  /** Moves a squad on from its current per-squad phase. Room-synced phases follow the timeline instead. */
  private advance(sq: Squad, now: number, forced: boolean): void {
    const m = openMission(this.s, sq);
    if (!m) return;
    const mission = missionOf(m.missionId);
    switch (m.phase) {
      case 'aftershock':
      case 'role-flip':
      case 'live':
        return;
      case 'investigate':
        return this.enter(sq, m, 'think', now);
      case 'think':
        return this.enter(sq, m, 'reveal', now);
      case 'reveal':
        return this.enter(sq, m, 'explain', now);
      case 'explain':
        return this.enter(sq, m, 'reseal', now);
      case 'reseal':
        return this.decide(sq, m, mission, now, forced);
      case 'release':
        return this.enter(sq, m, mission.peerShield ? 'shield' : 'bond', now);
      case 'shield':
        return this.enter(sq, m, 'bond', now);
      case 'bond':
        return this.completeSquad(m, now);
    }
  }

  private round1Votes(sq: Squad): string[] {
    const out: string[] = [];
    for (const seat of squadSeats(this.s, sq)) for (const ps of seatPlayers(seat)) if (ps.r1) out.push(ps.r1.choiceId);
    return out;
  }

  private finalVotes(sq: Squad): string[] {
    const out: string[] = [];
    for (const seat of squadSeats(this.s, sq)) {
      for (const ps of seatPlayers(seat)) {
        const v = ps.r2 ?? ps.r1;
        if (v) out.push(v.choiceId);
      }
    }
    return out;
  }

  private reasonPicks(sq: Squad): ReasonChipId[][] {
    const out: ReasonChipId[][] = [];
    for (const seat of squadSeats(this.s, sq)) for (const ps of seatPlayers(seat)) out.push(ps.reasons);
    return out;
  }

  /** Counts only (dots), or Mood for the junior band. Never who voted for what. */
  private buildReveal(sq: Squad, mission: Mission): RevealView {
    const counts = tallyVotes(
      mission.choices.map((c) => c.id),
      this.round1Votes(sq),
    );
    const total = totalVotes(counts);
    const mood = moodFor(counts);
    return this.s.config.band === 'junior' ? { kind: 'mood', mood, total } : { kind: 'dots', counts, total, mood };
  }

  /**
   * Steelman card: on a split, one seat chosen by seeded RNG (session seed, mission, squad, deal number;
   * never the votes) is asked to make the best case for the minority Exit. Echo's Invite deals one even
   * when the squad is united, for an Exit nobody picked.
   */
  private dealSteelman(sq: Squad, m: SquadMission, mission: Mission, invite: boolean): void {
    const counts = tallyVotes(
      mission.choices.map((c) => c.id),
      this.round1Votes(sq),
    );
    const target = steelmanTarget(counts) ?? (invite ? (counts.find((c) => c.n === 0)?.choiceId ?? null) : null);
    if (!target) return;
    const seatIds = squadSeats(this.s, sq)
      .filter(isConnected)
      .map((x) => x.id);
    const pick = pickSteelmanSeat(this.s.seed, m.index, sq.id, m.steelmanDeals, seatIds);
    m.steelmanDeals += 1;
    const seat = pick ? this.s.seats.get(pick) : undefined;
    if (!seat) return;
    seat.steelman = { choiceId: target };
    this.hooks.emitSeat(seat.id, 'steelman', { missionId: m.missionId, choiceId: target });
  }

  /** End of Re-seal: majority decides; a tie opens the Safety Lead's tie-break window. */
  private decide(sq: Squad, m: SquadMission, mission: Mission, now: number, forced: boolean): void {
    if (m.decision) return this.enter(sq, m, 'release', now);
    const choiceIds = mission.choices.map((c) => c.id);
    const safety = (id: string) => safetyOf(mission, id);
    if (m.tie) {
      if (!forced && now < m.tie.endsAt) return;
      const options = m.tie.options;
      const pick = safestChoice(options, safety) ?? options[0];
      if (!pick) return;
      return this.setDecision(sq, m, mission, pick, { options, choiceId: pick, because: null, by: 'timeout' }, now, false);
    }
    const { winner, tied } = majorityOf(tallyVotes(choiceIds, this.finalVotes(sq)));
    if (winner) return this.setDecision(sq, m, mission, winner, null, now, false);
    if (tied.length === 0) {
      // Nobody sealed (everyone away): play the safest Exit, but it earns no letter or lantern.
      const pick = safestChoice(choiceIds, safety) ?? choiceIds[0];
      if (!pick) return;
      return this.setDecision(sq, m, mission, pick, { options: choiceIds, choiceId: pick, because: null, by: 'timeout' }, now, true);
    }
    const t = this.timing(mission);
    m.tie = { options: tied, endsAt: now + t.tieBreak * SEC };
    m.phaseEndsAt = m.tie.endsAt;
    m.tieBreakerSeat = this.safetyLeadSeat(sq)?.id ?? null;
    this.touch(true);
  }

  private setDecision(
    sq: Squad,
    m: SquadMission,
    mission: Mission,
    choiceId: string,
    tieBreak: DecisionView['tieBreak'],
    now: number,
    fallback: boolean,
  ): void {
    const s = this.s;
    const agg = s.missionAgg;
    const safety = (id: string) => safetyOf(mission, id);
    const influence = new Map(mission.influence.options.map((o) => [o.id, o.correct]));
    const likely = new Map(mission.forecast.options.map((o) => [o.id, o.likely]));
    let mindsChanged = 0;
    let safer = 0;
    const finals: string[] = [];
    // Fold this squad's votes into the counts-only mission aggregate.
    for (const seat of squadSeats(s, sq)) {
      for (const ps of seatPlayers(seat)) {
        const fin = ps.r2 ?? ps.r1;
        if (fin) finals.push(fin.choiceId);
        if (ps.r1 && fin && fin.choiceId !== ps.r1.choiceId) mindsChanged += 1;
        if (ps.forecast) {
          m.stats.forecastTotal += 1;
          if (likely.get(ps.forecast)) m.stats.forecastLikely += 1;
        }
        if (ps.trace) {
          m.stats.traceTotal += 1;
          if (influence.get(ps.trace)) m.stats.traceCorrect += 1;
        }
        if (!agg) continue;
        if (ps.r1) {
          addCount(agg.firstCounts, ps.r1.choiceId);
          agg.firstTotal += 1;
          if (safety(ps.r1.choiceId) === 'safe') agg.firstSafe += 1;
          const c = ps.r1.confidence ?? 2;
          agg.confidenceHist = agg.confidenceHist.map((n, i) => (i === c - 1 ? n + 1 : n)) as [number, number, number];
        }
        if (fin) {
          addCount(agg.finalCounts, fin.choiceId);
          agg.finalTotal += 1;
          if (safety(fin.choiceId) === 'safe') agg.finalSafe += 1;
        }
        if (ps.r1 && fin) {
          const shift = shiftBetween(safety(ps.r1.choiceId), safety(fin.choiceId));
          if (shift === 'safer') {
            agg.shiftedSafer += 1;
            safer += 1;
          } else if (shift === 'riskier') agg.shiftedRiskier += 1;
          else agg.unchanged += 1;
        }
        if (ps.forecast) {
          addCount(agg.forecastCounts, ps.forecast);
          agg.forecastTotal += 1;
          if (likely.get(ps.forecast)) agg.forecastLikely += 1;
        }
        if (ps.trace) {
          agg.traceTotal += 1;
          if (influence.get(ps.trace)) agg.traceCorrect += 1;
        }
        for (const chip of ps.reasons) addCount(agg.reasonChipCounts, chip);
      }
    }
    if (agg) {
      addCount(agg.decisions, choiceId);
      if (tieBreak && !fallback) agg.tieBreaks += 1;
    }
    s.mindsChangedSafer += safer;
    m.folded.votes = true;
    m.finalMood = moodFor(
      tallyVotes(
        mission.choices.map((c) => c.id),
        finals,
      ),
    );
    m.decision = { choiceId, mindsChanged, tieBreak };
    m.fallback = fallback;
    m.tie = null;
    m.tieBreakerSeat = null;

    sq.decisions.push({ missionId: m.missionId, choiceId });
    const choice = mission.choices.find((c) => c.id === choiceId);
    if (choice) {
      sq.lumen.wallet += choice.outcome.effects.wallet ?? 0;
      this.adjustTrust(sq, mission.district, choice.outcome.effects.trust ?? 0);
      const shock = choice.aftershock;
      if (shock) {
        // Plant the Seed: it lands at a later mission's Aftershock slot, or at the finale.
        const key = `${mission.id}:${shock.id}`;
        sq.pending = sq.pending.filter((p) => p.key !== key);
        sq.pending.push({
          key,
          missionId: mission.id,
          choiceId,
          aftershockId: shock.id,
          dueIndex: m.index + Math.max(1, shock.afterMissions),
          forecast: { matched: m.stats.forecastLikely, total: m.stats.forecastTotal },
        });
      }
      if (choice.safety === 'safe' && !fallback) this.lightLantern();
    }
    this.enter(sq, m, 'release', now);
  }

  private sendShield(m: SquadMission, mission: Mission): void {
    if (!m.shield || !mission.peerShield) return;
    const res = evaluateShield(mission.peerShield, m.shield.picks);
    m.shield.result = {
      outcome: res.outcome,
      guard: res.guard,
      doubt: res.doubt,
      score: res.score,
      traps: res.tiles.filter((t) => t.quality === 'harmful').length,
    };
    m.shield.attempts += 1;
  }

  /** At the end of Peer Shield: auto-send a complete message, then fold the outcome into the aggregate. */
  private finishShield(m: SquadMission, mission: Mission): void {
    if (!mission.peerShield || !m.shield || m.folded.shield) return;
    const agg = this.s.missionAgg;
    const shield = m.shield;
    if (!shield.result && shieldSlotsForBand(this.s.config.band).every((slot) => shield.picks[slot])) {
      this.sendShield(m, mission);
    }
    const r = shield.result;
    if (agg) {
      if (r) {
        agg.shieldOutcomes[r.outcome] += 1;
        agg.trapTiles += r.traps;
        addShieldLine(agg, shield.picks, r.outcome);
      } else agg.shieldOutcomes.none += 1;
    }
    if (r?.outcome === 'success') this.lightLantern();
    m.folded.shield = true;
  }

  /** Guardian rules: deterministic predicates over the squad's mission (GDD §6.2), evaluated at Bond. */
  private computeBond(sq: Squad, m: SquadMission, mission: Mission): BondView {
    const board = boardView(m, mission);
    const red = mission.clues.filter((c) => c.redFlag).map((c) => c.id);
    const pinned = new Set(board.pins.map((p) => p.clueId));
    const found = red.filter((id) => pinned.has(id)).length;
    const falseAlarms = board.pins.filter((p) => !red.includes(p.clueId)).length;
    const decided = m.decision ? mission.choices.find((c) => c.id === m.decision?.choiceId) : undefined;
    const earned = new Set<SkillId>();
    if ((red.length === 0 || found / red.length >= 0.6) && falseAlarms <= 1) earned.add('S');
    if (m.seatsAtLive > 0 && m.earlyHolds * 2 >= m.seatsAtLive) earned.add('H');
    if (m.stats.traceTotal > 0 && m.stats.traceCorrect * 2 >= m.stats.traceTotal) earned.add('I');
    if (m.stats.forecastTotal > 0 && m.stats.forecastLikely * 2 >= m.stats.forecastTotal) earned.add('E');
    if (decided?.safety === 'safe' && !m.fallback) earned.add('L');
    if (m.shield?.result?.outcome === 'success') earned.add('D');
    const letters = SKILLS.map((k) => k.id).filter((id) => earned.has(id));
    const newlyBonded = letters.map((l) => guardianForSkill(l).id).filter((g) => !sq.guardians.has(g));
    const agg = this.s.missionAgg;
    for (const l of letters) if (agg) addCount(agg.lettersEarned, l);
    for (const g of newlyBonded) {
      sq.guardians.add(g);
      if (agg) addCount(agg.guardiansBonded, g);
    }
    return { letters, newlyBonded };
  }

  private foldBoard(m: SquadMission): void {
    const agg = this.s.missionAgg;
    if (m.folded.board || !agg) return;
    const board = boardView(m, missionOf(m.missionId));
    agg.liveFlags += board.liveFlags;
    agg.heldFlags += board.heldFlags;
    for (const p of board.pins) addCount(agg.clueFinds, p.clueId);
    m.folded.board = true;
  }

  private completeSquad(m: SquadMission, now: number): void {
    const s = this.s;
    m.complete = true;
    this.foldBoard(m);
    if (s.missionAgg) s.missionAgg.squadsCompleted += 1;
    this.touch(true);
    const stillOpen = squadsInOrder(s).some((sq) => openMission(s, sq));
    if (!stillOpen) this.closeMission(now, false);
  }

  // -------------------------------------------------------------------------------------------
  // Clock

  /** Applies deadlines. Called by the server's ticker; a no-op while paused. */
  tick(now: number): void {
    const s = this.s;
    const tl = s.timeline;
    const dash = s.dash;
    if (dash && !s.paused && dash.stage === 'question' && dash.endsAt !== null && now >= dash.endsAt) this.dashReveal(now);
    if (s.phase !== 'mission' || s.paused || !tl || s.missionComplete) return;
    for (const sq of squadsInOrder(s)) {
      const m = openMission(s, sq);
      if (!m) continue;
      switch (m.phase) {
        case 'aftershock':
          if (now >= tl.roleFlipAt) this.enterSynced(sq, m, 'role-flip', tl.roleFlipAt, tl.liveAt);
          break;
        case 'role-flip':
          if (now >= tl.liveAt) this.enterSynced(sq, m, 'live', tl.liveAt, tl.liveEndsAt);
          break;
        case 'live':
          if (now >= tl.liveEndsAt) this.endLive(sq, m, now);
          break;
        case 'investigate': {
          // Pressure Surge: squad-wide, from the in-story pusher, and it never changes a timer.
          const surgeAt = squadSurgeAt(s, sq);
          if (surgeAt !== null && !m.surgeFired && now >= surgeAt && now < m.phaseEndsAt) {
            m.surgeFired = true;
            this.hooks.emitSquad(sq.id, 'surge', { squadId: sq.id, missionId: m.missionId, at: surgeAt });
            this.touch();
          }
          if (now >= m.phaseEndsAt) this.advance(sq, now, false);
          break;
        }
        default:
          if (m.phase === 'shield' && m.shield && !m.shield.sendOpen && m.shield.sendOpenAt !== null && now >= m.shield.sendOpenAt) {
            m.shield.sendOpen = true;
            this.touch();
          }
          if (now >= m.phaseEndsAt) this.advance(sq, now, false);
      }
    }
  }

  /** Quorum (GDD §12.5): a phase ends early once every connected seat (not on Pause) has acted. */
  private checkQuorum(sq: Squad, now: number): void {
    const s = this.s;
    if (!s.config.autoAdvance || s.paused) return;
    const m = openMission(s, sq);
    if (!m) return;
    const active = squadSeats(s, sq).filter(isActive);
    if (active.length === 0) return;
    let done: boolean;
    switch (m.phase) {
      case 'think':
        done = active.every((seat) => seatPlayers(seat).every((p) => p.r1 !== null));
        break;
      case 'reseal':
        if (m.tie || m.decision) return;
        done = active.every((seat) => seatPlayers(seat).every((p) => p.r2 !== null));
        break;
      case 'investigate':
      case 'reveal':
      case 'explain':
      case 'release':
      case 'bond':
        done = active.every((seat) => seat.ready);
        break;
      case 'shield':
        done = !!m.shield?.result && active.every((seat) => seat.ready);
        break;
      default:
        return;
    }
    if (done) this.advance(sq, now, false);
  }

  private syncedPhaseEnds(): void {
    const s = this.s;
    const tl = s.timeline;
    if (!tl) return;
    for (const sq of squadsInOrder(s)) {
      const m = openMission(s, sq);
      if (!m) continue;
      if (m.phase === 'aftershock') m.phaseEndsAt = tl.roleFlipAt;
      else if (m.phase === 'role-flip') m.phaseEndsAt = tl.liveAt;
      else if (m.phase === 'live') m.phaseEndsAt = tl.liveEndsAt;
    }
  }

  private inSyncedPhase(): SquadMissionPhase | null {
    const s = this.s;
    let earliest: SquadMissionPhase | null = null;
    for (const sq of squadsInOrder(s)) {
      const m = openMission(s, sq);
      if (m && ROOM_SYNCED_PHASES.includes(m.phase) && (!earliest || phaseIndex(m.phase) < phaseIndex(earliest))) {
        earliest = m.phase;
      }
    }
    return earliest;
  }

  /** Moves the shared room timeline on to its next point now (Conductor Next / Skip phase). */
  private skipSynced(now: number): void {
    const tl = this.s.timeline;
    const phase = this.inSyncedPhase();
    if (!tl || !phase) return;
    const shift = (d: number, keys: ('roleFlipAt' | 'liveAt' | 'liveEndsAt' | 'freezeEndAt')[]) => {
      for (const k of keys) tl[k] -= d;
      if (tl.surgeAt !== null) tl.surgeAt -= d;
    };
    if (phase === 'aftershock') {
      shift(Math.max(0, tl.roleFlipAt - now), ['roleFlipAt', 'liveAt', 'liveEndsAt', 'freezeEndAt']);
    } else if (phase === 'role-flip') {
      shift(Math.max(0, tl.liveAt - now), ['liveAt', 'liveEndsAt', 'freezeEndAt']);
    } else {
      tl.liveEndsAt = Math.min(tl.liveEndsAt, now);
    }
    this.syncedPhaseEnds();
    this.tick(now);
  }

  /** Shifts every future deadline by `d` ms (resume after pause). */
  private shiftTimes(from: number, d: number): void {
    const s = this.s;
    const tl = s.timeline;
    if (tl) {
      const liveRunning = from >= tl.liveAt && from < tl.liveEndsAt;
      if (tl.roleFlipAt > from) tl.roleFlipAt += d;
      // While Live plays, t0 moves too, so every phone resumes the moment where it froze.
      if (tl.liveAt > from || liveRunning) tl.liveAt += d;
      if (tl.liveEndsAt > from) tl.liveEndsAt += d;
      if (tl.freezeEndAt > from) tl.freezeEndAt += d;
      if (tl.surgeAt !== null && tl.surgeAt > from) tl.surgeAt += d;
    }
    for (const sq of squadsInOrder(s)) {
      const m = openMission(s, sq);
      if (!m) continue;
      m.phaseStartedAt += d;
      if (m.phaseEndsAt > from) m.phaseEndsAt += d;
      if (m.sealLockUntil !== null && m.sealLockUntil > from) m.sealLockUntil += d;
      if (m.tie && m.tie.endsAt > from) m.tie.endsAt += d;
      if (m.shield?.sendOpenAt != null && m.shield.sendOpenAt > from) m.shield.sendOpenAt += d;
    }
    const dash = s.dash;
    if (dash) {
      dash.stageStartedAt += d;
      if (dash.endsAt !== null && dash.endsAt > from) dash.endsAt += d;
    }
  }

  // -------------------------------------------------------------------------------------------
  // Conductor commands

  command(cmd: HostCommand, now: number): AckResult {
    const s = this.s;
    this.activity(now);
    if (s.phase === 'ended') return fail('ended');
    switch (cmd.type) {
      case 'startRoomFreeze': {
        if (s.phase !== 'lobby') return fail('wrong-phase');
        if (s.dash) this.closeDash(now);
        this.autoBalance(now);
        s.phase = 'room-freeze';
        s.roomFreeze.active = true;
        for (const seat of s.seats.values()) seat.roomHolding = false;
        this.recomputeFreeze();
        this.touch(true);
        return OK;
      }
      case 'endRoomFreeze': {
        if (s.phase !== 'room-freeze') return fail('wrong-phase');
        this.stopRoomFreeze();
        this.touch(true);
        return OK;
      }
      case 'startMission':
        return this.startMission(cmd.index, now);
      case 'next':
        return this.next(cmd.squadId, now);
      case 'setPhase':
        return this.setPhase(cmd.phase, cmd.squadId, now);
      case 'extend':
        return this.extend(cmd.squadId, (cmd.sec ?? 30) * SEC, now);
      case 'endMission': {
        if (!this.missionRunning) return fail('wrong-phase');
        this.closeMission(now, true);
        return OK;
      }
      case 'pause': {
        if (s.paused) return DUP;
        s.paused = true;
        s.pausedAt = now;
        this.touch(true);
        return OK;
      }
      case 'resume': {
        if (!s.paused) return DUP;
        this.shiftTimes(s.pausedAt ?? now, now - (s.pausedAt ?? now));
        s.paused = false;
        s.pausedAt = null;
        this.touch(true);
        for (const sq of squadsInOrder(s)) this.checkQuorum(sq, now);
        return OK;
      }
      case 'setOption': {
        s.config[cmd.key] = cmd.value;
        // Calm Mode takes the Dash clock away (the Conductor reveals); turning it off starts a fresh one.
        if (cmd.key === 'calm' && s.dash?.stage === 'question') s.dash.endsAt = cmd.value ? null : now + this.dashSec() * SEC;
        this.touch(true);
        if (cmd.key === 'autoAdvance' && cmd.value) for (const sq of squadsInOrder(s)) this.checkQuorum(sq, now);
        return OK;
      }
      case 'squadGentle': {
        const sq = s.squads.get(cmd.squadId);
        if (!sq) return fail('not-found');
        sq.gentle = cmd.on;
        this.touch(true);
        return OK;
      }
      case 'lockJoins': {
        if (s.phase === 'debrief') return fail('wrong-phase');
        s.acceptingJoins = !cmd.locked;
        this.touch(true);
        return OK;
      }
      case 'moveSeat': {
        const seat = s.seats.get(cmd.seatId);
        if (!seat) return fail('not-found');
        if (seat.squadId === cmd.squadId) return DUP;
        const to = s.squads.get(cmd.squadId) ?? (this.missionRunning ? null : this.createSquad(cmd.squadId));
        if (!to) return fail('not-found');
        if (to.seatIds.length >= SQUAD_LIMITS.maxSize) return fail('squad-full');
        const fromId = seat.squadId;
        this.moveSeatTo(seat, to);
        this.dropEmptySquads();
        this.touch(true);
        const from = s.squads.get(fromId);
        if (from) this.checkQuorum(from, now);
        return OK;
      }
      case 'setSeatPlayers': {
        const seat = s.seats.get(cmd.seatId);
        if (!seat) return fail('not-found');
        seat.players = cmd.players;
        seat.playersState = seat.playersState.slice(0, cmd.players);
        while (seat.playersState.length < cmd.players) seat.playersState.push(emptyPlayer());
        this.touch(true);
        return OK;
      }
      case 'removeSeat': {
        const seat = s.seats.get(cmd.seatId);
        if (!seat) return fail('not-found');
        if (isConnected(seat)) return fail('busy');
        const from = this.detachSeat(seat);
        s.seats.delete(seat.id);
        s.tokens.delete(seat.tokenHash);
        this.dropEmptySquads();
        this.touch(true);
        if (from) this.checkQuorum(from, now);
        return OK;
      }
      case 'addSquad': {
        if (this.missionRunning) return fail('wrong-phase');
        return this.createSquad() ? (this.touch(true), OK) : fail('session-full');
      }
      case 'balanceSquads':
        return this.balance(now);
      case 'clearHelp': {
        for (const seat of s.seats.values()) if (!cmd.squadId || seat.squadId === cmd.squadId) seat.needHelp = false;
        this.touch();
        return OK;
      }
      case 'spotlight': {
        if (cmd.squadId === null) {
          s.spotlight = null;
          this.touch();
          return OK;
        }
        const m = s.squads.get(cmd.squadId)?.mission;
        // Only after the squad's Safety Lead tapped Share (GDD §7.3).
        if (!m || m.index !== s.missionIndex || !m.shared) return fail('forbidden');
        s.spotlight = cmd.squadId;
        this.touch();
        return OK;
      }
      case 'endSession':
        return this.endSession(now);
      case 'dashStart':
        return this.dashStart(cmd.questions, now);
      case 'dashNext':
        return this.dashNext(now);
      case 'dashSkip':
        return this.dashSkip(now);
      case 'dashEnd':
        return this.dashEnd(now);
    }
  }

  private nextUnplayed(): number | null {
    for (let i = 0; i < this.s.config.missionIds.length; i++) if (!this.s.played.includes(i)) return i;
    return null;
  }

  /** The one big button: always does the right thing for where the room is. */
  private next(squadId: SquadTotemId | undefined, now: number): AckResult {
    const s = this.s;
    if (s.dash) return this.dashNext(now);
    switch (s.phase) {
      case 'lobby': {
        if (!s.roomFreeze.done) return this.command({ type: 'startRoomFreeze' }, now);
        const i = this.nextUnplayed();
        return i === null ? this.endSession(now) : this.startMission(i, now);
      }
      case 'room-freeze':
        return this.command({ type: 'endRoomFreeze' }, now);
      case 'debrief':
        return this.endSession(now);
      case 'ended':
        return fail('ended');
      case 'mission': {
        if (s.missionComplete) {
          const i = this.nextUnplayed();
          return i === null ? this.endSession(now) : this.startMission(i, now);
        }
        if (this.inSyncedPhase()) {
          this.skipSynced(now);
          return OK;
        }
        const targets = squadId ? [s.squads.get(squadId)] : squadsInOrder(s);
        for (const sq of targets) if (sq) this.advance(sq, now, true);
        return OK;
      }
    }
  }

  /** Jump forward to a phase (never backwards: votes may already be folded and dropped). */
  private setPhase(target: SquadMissionPhase, squadId: SquadTotemId | undefined, now: number): AckResult {
    const s = this.s;
    if (!this.missionRunning) return fail('wrong-phase');
    const goal = phaseIndex(target);
    for (let i = 0; i < 4; i++) {
      const synced = this.inSyncedPhase();
      if (!synced || phaseIndex(synced) >= goal) break;
      this.skipSynced(now);
    }
    const targets = squadId ? [s.squads.get(squadId)] : squadsInOrder(s);
    for (const sq of targets) {
      if (!sq) continue;
      for (let guard = 0; guard < 16; guard++) {
        const m = openMission(s, sq);
        if (!m || ROOM_SYNCED_PHASES.includes(m.phase) || phaseIndex(m.phase) >= goal) break;
        this.advance(sq, now, true);
      }
    }
    return OK;
  }

  private extend(squadId: SquadTotemId | undefined, ms: number, now: number): AckResult {
    const s = this.s;
    const tl = s.timeline;
    if (s.dash) {
      // +30 s during a Squad Dash question: more talking time (there is no clock in Calm Mode).
      if (s.dash.stage !== 'question' || s.dash.endsAt === null) return fail('wrong-phase');
      s.dash.endsAt += ms;
      this.touch(true);
      return OK;
    }
    if (!this.missionRunning || !tl) return fail('wrong-phase');
    if (this.inSyncedPhase()) {
      if (now >= tl.liveAt && now < tl.liveEndsAt) {
        // The live moment has a fixed length; +30 s goes to Freeze End instead.
        tl.freezeEndAt += ms;
      } else {
        for (const k of ['roleFlipAt', 'liveAt', 'liveEndsAt', 'freezeEndAt'] as const) if (tl[k] > now) tl[k] += ms;
        if (tl.surgeAt !== null && tl.surgeAt > now) tl.surgeAt += ms;
      }
      this.syncedPhaseEnds();
    } else {
      const targets = squadId ? [s.squads.get(squadId)] : squadsInOrder(s);
      for (const sq of targets) {
        const m = sq ? openMission(s, sq) : null;
        if (!m) continue;
        m.phaseEndsAt += ms;
        if (m.tie) m.tie.endsAt += ms;
      }
    }
    this.touch(true);
    return OK;
  }

  private dropEmptySquads(): void {
    const s = this.s;
    // Only before the first mission and in auto mode: later, an empty squad still owns its city state.
    if (s.config.squadCount !== null || s.played.length > 0) return;
    for (const sq of [...s.squads.values()]) if (sq.seatIds.length === 0 && s.squads.size > 1) s.squads.delete(sq.id);
  }

  /** Evens out squad sizes between missions (fewest moves; earliest joiners stay put). */
  private balance(now: number): AckResult {
    const s = this.s;
    if (this.missionRunning || s.phase === 'debrief') return fail('wrong-phase');
    const total = s.seats.size;
    if (total === 0) return OK;
    const order = (sq: Squad) => SQUAD_TOTEMS.findIndex((t) => t.id === sq.id);
    let keep = squadsInOrder(s);
    if (s.config.squadCount === null) {
      const k = clamp(Math.ceil(total / SQUAD_LIMITS.targetSize), 1, SQUAD_LIMITS.maxSquads);
      keep = [...keep].sort((a, b) => b.seatIds.length - a.seatIds.length || order(a) - order(b)).slice(0, k);
      while (keep.length < k) {
        const sq = this.createSquad();
        if (!sq) break;
        keep.push(sq);
      }
    }
    if (keep.length === 0) return OK;
    const base = Math.floor(total / keep.length);
    const extra = total % keep.length;
    const target = new Map<SquadTotemId, number>();
    [...keep]
      .sort((a, b) => b.seatIds.length - a.seatIds.length || order(a) - order(b))
      .forEach((sq, i) => target.set(sq.id, base + (i < extra ? 1 : 0)));
    const overflow: Seat[] = [];
    for (const sq of squadsInOrder(s)) {
      const limit = target.get(sq.id) ?? 0;
      for (const id of sq.seatIds.slice(limit)) {
        const seat = s.seats.get(id);
        if (seat) overflow.push(seat);
      }
    }
    for (const sq of keep) {
      while (sq.seatIds.length < (target.get(sq.id) ?? 0)) {
        const seat = overflow.shift();
        if (!seat) break;
        this.moveSeatTo(seat, sq);
      }
    }
    for (const sq of [...s.squads.values()]) {
      if (sq.seatIds.length === 0 && !target.has(sq.id) && sq.decisions.length === 0) s.squads.delete(sq.id);
    }
    this.activity(now);
    this.touch(true);
    return OK;
  }

  /**
   * Auto mode joins fill squads to 5 before opening the next, so 6 players arrive as 5 + 1. Before roles are
   * first dealt (Room Freeze or the first mission), a squad left with fewer than 3 players is evened out
   * (GDD §7.2: squads of 4-5, 3-6 supported). Fixed squad counts (tent cards) are never moved automatically.
   */
  private autoBalance(now: number): void {
    const s = this.s;
    if (s.config.squadCount !== null || s.played.length > 0 || s.seats.size < 2 * SQUAD_LIMITS.minSize) return;
    const small = squadsInOrder(s).some((sq) => sq.seatIds.length > 0 && sq.seatIds.length < SQUAD_LIMITS.minSize);
    if (small) this.balance(now);
  }

  /** First call: Long Fast-Forward (every pending Seed lands) and the debrief. Second call: close. */
  private endSession(now: number): AckResult {
    const s = this.s;
    if (s.phase === 'debrief') {
      s.phase = 'ended';
      s.endedAt = now;
      s.acceptingJoins = false;
      s.paused = false;
      s.aggregate.complete = true;
      this.hooks.aggregate(cloneAggregate(s.aggregate));
      this.hooks.emitAll('notice', { kind: 'session-ended' });
      this.touch();
      this.hooks.ended();
      return OK;
    }
    if (s.dash) this.closeDash(now);
    if (this.missionRunning) this.closeMission(now, true);
    if (s.phase === 'room-freeze') this.stopRoomFreeze();
    for (const sq of squadsInOrder(s)) {
      const due = [...sq.pending].sort((a, b) => a.dueIndex - b.dueIndex);
      sq.pending = [];
      for (const p of due) {
        const d: AftershockDelivery = {
          key: p.key,
          missionId: p.missionId,
          choiceId: p.choiceId,
          aftershockId: p.aftershockId,
          finale: true,
          forecast: { ...p.forecast },
        };
        sq.finale.push(d);
        this.landShock(sq, d);
      }
    }
    s.phase = 'debrief';
    s.paused = false;
    s.pausedAt = null;
    s.acceptingJoins = false;
    s.spotlight = null;
    s.debrief = debriefFrom(s.aggregate, s.lanterns, s.roomFreeze.peak);
    this.hooks.aggregate(cloneAggregate(s.aggregate));
    this.touch(true);
    return OK;
  }

  /** Idle expiry: keep the counts, mark the aggregate incomplete. */
  expire(): SessionAggregate {
    this.s.aggregate.complete = false;
    return cloneAggregate(this.s.aggregate);
  }

  // -------------------------------------------------------------------------------------------
  // Squad Dash: a short team quiz between missions. Every player taps, the squad's majority is its pick,
  // and only squads are scored. Taps stay in memory and are dropped the moment a question is revealed.

  /** A Dash may open only when no mission is running: in the lobby, or at Look Up between missions. */
  private get dashAllowed(): boolean {
    const s = this.s;
    return s.phase === 'lobby' || (s.phase === 'mission' && s.missionComplete);
  }

  private dashSec(): number {
    return dashQuestionSec({ band: this.s.config.band, relaxed: this.s.config.relaxed });
  }

  private openDashQuestion(d: DashState, index: number, now: number): void {
    d.index = index;
    d.stage = 'question';
    d.stageStartedAt = now;
    d.answers.clear();
    // Calm Mode: no clock, no countdown pressure. The Conductor reveals when the room is ready.
    d.endsAt = this.s.config.calm ? null : now + this.dashSec() * SEC;
  }

  private dashStart(questions: DashLength, now: number): AckResult {
    const s = this.s;
    if (s.dash || !this.dashAllowed) return fail('wrong-phase');
    // Seeded by the session seed and the round number: a restart deals the same round again.
    const rng = mulberry32(hashSeed(s.seed, 'dash', s.dashRuns));
    const picked = pickChanceSet(s.config.band, questions, rng, { kinds: ['scam-or-safe'], avoid: s.dashUsed });
    if (picked.length === 0) return fail('bad-request');
    const ids = picked.map((q) => q.id);
    s.dashRuns += 1;
    s.dashUsed = [...new Set([...s.dashUsed, ...ids])];
    const d: DashState = {
      id: newId(),
      questionIds: ids,
      index: 0,
      stage: 'question',
      stageStartedAt: now,
      endsAt: null,
      answers: new Map(),
      rounds: [],
    };
    this.openDashQuestion(d, 0, now);
    s.dash = d;
    s.spotlight = null;
    (s.aggregate.dash ??= emptyDashAggregate()).rounds += 1;
    this.activity(now);
    this.touch(true);
    return OK;
  }

  /** Scores the current question for every squad, folds the counts into the aggregate and drops the taps. */
  private dashReveal(now: number): void {
    const s = this.s;
    const d = s.dash;
    const q = d ? dashQuestion(d) : null;
    if (!d || !q || d.stage !== 'question') return;
    const squads = [];
    for (const sq of dashSquads(s)) {
      const t = dashTally(s, sq, q);
      // A squad with nobody here and no taps sits this question out rather than scoring a miss.
      if (t.answered === 0 && activePlayers(s, sq) === 0) continue;
      const pick = dashSquadPick(t.counts);
      squads.push({
        squadId: sq.id,
        counts: t.counts,
        result: { pick, correct: pick === q.answer, split: pick === null && t.answered > 0, answered: t.answered },
      });
    }
    d.rounds.push({ questionId: q.id, skipped: false, squads });
    d.answers.clear();
    d.stage = 'reveal';
    d.stageStartedAt = now;
    d.endsAt = null;
    const agg = (s.aggregate.dash ??= emptyDashAggregate());
    agg.questions += 1;
    const byQ = (agg.byQuestion[q.id] ??= { squads: 0, correct: 0 });
    for (const e of squads) {
      agg.squadAnswers += 1;
      byQ.squads += 1;
      if (e.result.correct) {
        agg.squadCorrect += 1;
        byQ.correct += 1;
      } else if (e.result.split) agg.splits += 1;
      else if (e.result.pick === null) agg.none += 1;
    }
    this.touch(true);
  }

  /** After a question (revealed or skipped): the next question, or the results card after the last one. */
  private dashAfter(d: DashState, now: number): void {
    if (d.index + 1 < d.questionIds.length) this.openDashQuestion(d, d.index + 1, now);
    else this.dashResults(d, now);
    this.touch(true);
  }

  private dashResults(d: DashState, now: number): void {
    d.answers.clear();
    d.stage = 'results';
    d.stageStartedAt = now;
    d.endsAt = null;
  }

  private closeDash(now: number): void {
    const s = this.s;
    if (!s.dash) return;
    s.dash = null;
    this.hooks.aggregate(cloneAggregate(s.aggregate));
    this.activity(now);
    this.touch(true);
  }

  private dashNext(now: number): AckResult {
    const d = this.s.dash;
    if (!d) return fail('wrong-phase');
    this.activity(now);
    if (d.stage === 'question') this.dashReveal(now);
    else if (d.stage === 'reveal') this.dashAfter(d, now);
    else this.closeDash(now);
    return OK;
  }

  private dashSkip(now: number): AckResult {
    const d = this.s.dash;
    if (!d || d.stage === 'results') return fail('wrong-phase');
    this.activity(now);
    if (d.stage === 'question') {
      const q = dashQuestion(d);
      if (q) d.rounds.push({ questionId: q.id, skipped: true, squads: [] });
      d.answers.clear();
    }
    this.dashAfter(d, now);
    return OK;
  }

  private dashEnd(now: number): AckResult {
    const d = this.s.dash;
    if (!d) return fail('wrong-phase');
    this.activity(now);
    // Nothing scored yet, or already on the results card: close. Otherwise show the totals so far.
    if (d.stage === 'results' || !d.rounds.some((r) => !r.skipped)) {
      this.closeDash(now);
      return OK;
    }
    this.dashResults(d, now);
    this.touch(true);
    return OK;
  }

  /** Once every active player has tapped, the question reveals a few seconds later (never in Calm Mode). */
  private dashAllIn(d: DashState, now: number): void {
    const s = this.s;
    if (!s.config.autoAdvance || s.config.calm || d.endsAt === null) return;
    const q = dashQuestion(d);
    if (!q) return;
    let any = false;
    for (const sq of dashSquads(s)) {
      const t = dashTally(s, sq, q);
      if (t.answered < activePlayers(s, sq)) return;
      if (t.answered > 0) any = true;
    }
    if (any) d.endsAt = Math.min(d.endsAt, now + DASH_ALL_IN_SEC * SEC);
  }

  dashAnswer(seatId: string, p: { questionId: string; optionId: string; player?: number }, now: number): AckResult {
    const s = this.s;
    const seat = s.seats.get(seatId);
    if (!seat) return fail('not-found');
    if (s.phase === 'ended') return fail('ended');
    if (s.paused) return fail('paused');
    const d = s.dash;
    const q = d ? dashQuestion(d) : null;
    if (!d || !q || d.stage !== 'question' || p.questionId !== q.id) return fail('wrong-phase');
    if (!q.options.some((o) => o.id === p.optionId)) return fail('unknown-choice');
    const player = p.player ?? 0;
    if (player >= seat.players) return fail('bad-request');
    const key = dashAnswerKey(seat.id, player);
    // Taps can change until the reveal: talking it over is the point.
    if (d.answers.get(key) === p.optionId) return DUP;
    d.answers.set(key, p.optionId);
    this.dashAllIn(d, now);
    this.activity(now);
    this.touch();
    return OK;
  }

  // -------------------------------------------------------------------------------------------
  // Seat events

  private ctx(seatId: string): PlayCtx | ErrorCode {
    const s = this.s;
    const seat = s.seats.get(seatId);
    if (!seat) return 'not-found';
    if (s.phase === 'ended') return 'ended';
    if (s.paused) return 'paused';
    const sq = s.squads.get(seat.squadId);
    if (!sq) return 'not-found';
    const m = openMission(s, sq);
    if (!m) return 'wrong-phase';
    return { seat, sq, m, mission: missionOf(m.missionId) };
  }

  hold(seatId: string, p: { missionId: string; atSec: number }, now: number): AckResult {
    const c = this.ctx(seatId);
    if (typeof c === 'string') return fail(c);
    const { seat, m, mission } = c;
    const s = this.s;
    if (p.missionId !== m.missionId) return fail('wrong-phase');
    if (seat.held) return DUP;
    // A hold that arrives after the decision second was already counted as 'late'.
    if (phaseIndex(m.phase) > phaseIndex('live')) return DUP;
    if (m.phase !== 'live' || !s.timeline) return fail('wrong-phase');
    const elapsed = Math.max(0, (now - s.timeline.liveAt) / SEC);
    const atSec = clamp(p.atSec, 0, elapsed + 1);
    seat.held = true;
    m.holding.add(seat.id);
    // Only the latency bucket is kept; which seat held is not stored anywhere (GDD §5.3).
    const bucket = holdBucket(atSec, mission.live.durationSec);
    if (s.missionAgg) s.missionAgg.holdBuckets[bucket] += 1;
    if (bucket !== 'late') s.holdsMade += 1;
    if (isEarlyHold(mission, atSec)) m.earlyHolds += 1;
    this.activity(now);
    this.touch();
    return OK;
  }

  pin(seatId: string, p: { clueId: string; live: boolean; fine?: boolean }, now: number): AckResult {
    const c = this.ctx(seatId);
    if (typeof c === 'string') return fail(c);
    const { seat, m, mission } = c;
    if (!PIN_PHASES.includes(m.phase)) return fail('wrong-phase');
    if (!mission.clues.some((x) => x.id === p.clueId)) return fail('bad-request');
    const into = p.fine ? m.cleared : m.pins;
    const other = p.fine ? m.pins : m.cleared;
    other.get(p.clueId)?.delete(seat.id);
    let owners = into.get(p.clueId);
    if (!owners) {
      owners = new Map();
      into.set(p.clueId, owners);
    }
    if (owners.has(seat.id)) return DUP;
    // Pins carry the role icon only, never the seat or pseudonym.
    owners.set(seat.id, { role: seat.role?.role ?? 'evidence-checker', live: p.live && m.phase === 'live' && !seat.held });
    this.activity(now);
    this.touch();
    return OK;
  }

  unpin(seatId: string, p: { clueId: string }, now: number): AckResult {
    const c = this.ctx(seatId);
    if (typeof c === 'string') return fail(c);
    const { seat, m } = c;
    if (!PIN_PHASES.includes(m.phase)) return fail('wrong-phase');
    const a = m.pins.get(p.clueId)?.delete(seat.id) ?? false;
    const b = m.cleared.get(p.clueId)?.delete(seat.id) ?? false;
    if (!a && !b) return DUP;
    this.activity(now);
    this.touch();
    return OK;
  }

  trace(seatId: string, p: { optionId: string; player?: number }, now: number): AckResult {
    const c = this.ctx(seatId);
    if (typeof c === 'string') return fail(c);
    const { seat, m, mission } = c;
    if (!STRING_PHASES.includes(m.phase)) return fail('wrong-phase');
    if (!mission.influence.options.some((o) => o.id === p.optionId)) return fail('bad-request');
    const ps = this.playerOf(seat, p.player);
    if (!ps) return fail('bad-request');
    if (ps.trace === p.optionId) return DUP;
    ps.trace = p.optionId;
    m.tracedRoles.add(seat.role?.role ?? 'evidence-checker');
    this.activity(now);
    this.touch();
    return OK;
  }

  forecast(seatId: string, p: { optionId: string; player?: number }, now: number): AckResult {
    const c = this.ctx(seatId);
    if (typeof c === 'string') return fail(c);
    const { seat, m, mission } = c;
    if (!STRING_PHASES.includes(m.phase)) return fail('wrong-phase');
    if (!mission.forecast.options.some((o) => o.id === p.optionId)) return fail('bad-request');
    const ps = this.playerOf(seat, p.player);
    if (!ps) return fail('bad-request');
    if (ps.r1) return fail('already-sealed');
    if (ps.forecast === p.optionId) return DUP;
    ps.forecast = p.optionId;
    this.activity(now);
    this.touch();
    return OK;
  }

  seal(
    seatId: string,
    p: { voteId: string; round: 1 | 2; choiceId: string; confidence?: 1 | 2 | 3; player?: number },
    now: number,
  ): AckResult {
    const c = this.ctx(seatId);
    if (typeof c === 'string') return fail(c);
    const { seat, sq, m, mission } = c;
    const player = p.player ?? 0;
    const key = `${seat.id}#${player}#${p.round}`;
    // Idempotent by voteId: a retried seal is acknowledged again, even after the phase moved on.
    const prior = m.voteIds.get(p.voteId);
    if (prior) return prior === key ? DUP : fail('bad-request');
    if (m.phase !== (p.round === 1 ? 'think' : 'reseal')) return fail('wrong-phase');
    if (p.round === 1 && m.sealLockUntil !== null && now < m.sealLockUntil) return fail('locked');
    if (p.round === 2 && (m.tie || m.decision)) return fail('locked');
    if (!mission.choices.some((x) => x.id === p.choiceId)) return fail('unknown-choice');
    const ps = this.playerOf(seat, player);
    if (!ps) return fail('bad-request');
    if (p.round === 1 ? ps.r1 : ps.r2) return fail('already-sealed');
    if (p.round === 1) ps.r1 = { voteId: p.voteId, choiceId: p.choiceId, confidence: p.confidence ?? 2 };
    else ps.r2 = { voteId: p.voteId, choiceId: p.choiceId };
    m.voteIds.set(p.voteId, key);
    this.activity(now);
    this.touch();
    this.checkQuorum(sq, now);
    return OK;
  }

  reasons(seatId: string, p: { chips: ReasonChipId[]; player?: number }, now: number): AckResult {
    const c = this.ctx(seatId);
    if (typeof c === 'string') return fail(c);
    const { seat, sq, m } = c;
    if (!REASON_PHASES.includes(m.phase)) return fail('wrong-phase');
    const ps = this.playerOf(seat, p.player);
    if (!ps) return fail('bad-request');
    ps.reasons = [...new Set(p.chips)].slice(0, 2);
    // Chip counts reach the squad only when >= 2 picked the same chip (chipBoard pools the rest).
    m.chips = chipBoard(this.reasonPicks(sq));
    this.activity(now);
    this.touch();
    return OK;
  }

  tiebreak(seatId: string, p: { choiceId: string; because: BecauseTileId }, now: number): AckResult {
    const c = this.ctx(seatId);
    if (typeof c === 'string') return fail(c);
    const { seat, sq, m, mission } = c;
    if (m.decision) return m.decision.tieBreak?.choiceId === p.choiceId ? DUP : fail('used');
    if (!m.tie) return fail('wrong-phase');
    if (m.tieBreakerSeat !== seat.id) return fail('not-tie-breaker');
    if (!m.tie.options.includes(p.choiceId)) return fail('unknown-choice');
    this.activity(now);
    const options = m.tie.options;
    this.setDecision(sq, m, mission, p.choiceId, { options, choiceId: p.choiceId, because: p.because, by: 'safety-lead' }, now, false);
    return OK;
  }

  shieldTile(seatId: string, p: { slot: ShieldSlot; tileId: string }, now: number): AckResult {
    const c = this.ctx(seatId);
    if (typeof c === 'string') return fail(c);
    const { seat, sq, m, mission } = c;
    const band = this.s.config.band;
    if (m.phase !== 'shield' || !m.shield || !mission.peerShield) return fail('wrong-phase');
    if (m.shield.result) return fail('locked');
    if (!shieldSlotsForBand(band).includes(p.slot)) return fail('bad-request');
    if (!mission.peerShield.slots[p.slot].some((t) => t.id === p.tileId)) return fail('bad-request');
    const mine = seat.role ? shieldSlotsFor(seat.role, band).includes(p.slot) : false;
    // Tiles are dealt by role; if nobody connected holds a slot, anyone may play it.
    if (!mine && (shieldOwners(this.s, sq)[p.slot]?.length ?? 0) > 0) return fail('not-your-slot');
    if (m.shield.picks[p.slot] === p.tileId) return DUP;
    m.shield.picks[p.slot] = p.tileId;
    this.activity(now);
    this.touch();
    return OK;
  }

  shieldSend(seatId: string, now: number): AckResult {
    const c = this.ctx(seatId);
    if (typeof c === 'string') return fail(c);
    const { seat, sq, m, mission } = c;
    if (m.phase !== 'shield' || !m.shield) return fail('wrong-phase');
    if (m.shield.result) return fail('used');
    if (!canSendShield(this.s, sq, seat)) return fail('forbidden');
    const shield = m.shield;
    if (!shieldSlotsForBand(this.s.config.band).every((slot) => shield.picks[slot])) return fail('bad-request');
    this.sendShield(m, mission);
    this.activity(now);
    this.touch(true);
    return OK;
  }

  shieldRetry(seatId: string, now: number): AckResult {
    const c = this.ctx(seatId);
    if (typeof c === 'string') return fail(c);
    const { m, mission } = c;
    if (m.phase !== 'shield' || !m.shield?.result || !mission.peerShield) return fail('wrong-phase');
    // One retry after a trap tile: practice, not penalty (GDD §6.4).
    if (m.shield.result.traps === 0 || m.shield.attempts >= 2) return fail('used');
    for (const slot of shieldSlotsForBand(this.s.config.band)) {
      const tile = mission.peerShield.slots[slot].find((t) => t.id === m.shield?.picks[slot]);
      if (tile?.quality === 'harmful') delete m.shield.picks[slot];
    }
    m.shield.result = null;
    for (const seat of squadSeats(this.s, c.sq)) seat.ready = false;
    this.activity(now);
    this.touch();
    return OK;
  }

  share(seatId: string, on: boolean, now: number): AckResult {
    const c = this.ctx(seatId);
    if (typeof c === 'string') return fail(c);
    const { seat, sq, m } = c;
    if (seat.role?.role !== 'safety-lead' || seat.role.shadow) return fail('forbidden');
    if (!SHARE_PHASES.includes(m.phase)) return fail('wrong-phase');
    m.shared = on;
    if (!on && this.s.spotlight === sq.id) this.s.spotlight = null;
    this.activity(now);
    this.touch();
    return OK;
  }

  guardian(seatId: string, g: GuardianId, now: number): AckResult {
    const c = this.ctx(seatId);
    if (typeof c === 'string') return fail(c);
    const { seat, sq, m, mission } = c;
    if (!sq.guardians.has(g)) return fail('not-bonded');
    // Once per mission, by any seat: the first press wins (GDD §6.2).
    if (m.guardiansUsed.has(g)) return fail('used');
    if (!GUARDIAN_PHASES[g].includes(m.phase)) return fail('wrong-phase');
    m.guardiansUsed.add(g);
    const byRole = seat.role?.role ?? null;
    switch (g) {
      case 'shieldfin': {
        const order = squadSeats(this.s, sq)
          .filter(isConnected)
          .map((x) => sq.seatIds.indexOf(x.id));
        this.hooks.emitSquad(sq.id, 'guardian', { guardian: 'shieldfin', byRole, order, delayMs: 250 });
        break;
      }
      case 'cluepaw': {
        const clue = mission.clues.find((x) => x.redFlag && !(m.pins.get(x.id)?.size ?? 0));
        this.hooks.emitSquad(sq.id, 'guardian', { guardian: 'cluepaw', byRole, clueId: clue?.id ?? null });
        break;
      }
      case 'echo': {
        const added = this.timing(mission).echoExtend;
        m.echoUsed = true;
        m.phaseEndsAt += added * SEC;
        this.dealSteelman(sq, m, mission, true);
        this.hooks.emitSquad(sq.id, 'guardian', { guardian: 'echo', byRole, addedSec: added });
        break;
      }
      default:
        this.hooks.emitSquad(sq.id, 'guardian', { guardian: g, byRole });
    }
    this.activity(now);
    this.touch();
    return OK;
  }

  extendExplain(seatId: string, now: number): AckResult {
    const c = this.ctx(seatId);
    if (typeof c === 'string') return fail(c);
    const { m, mission } = c;
    if (m.phase !== 'explain') return fail('wrong-phase');
    if (m.explainExtended) return fail('used');
    m.explainExtended = true;
    m.phaseEndsAt += this.timing(mission).explainExtend * SEC;
    this.activity(now);
    this.touch();
    return OK;
  }

  ready(seatId: string, p: { phase: SquadMissionPhase; on?: boolean }, now: number): AckResult {
    const c = this.ctx(seatId);
    if (typeof c === 'string') return fail(c);
    const { seat, sq, m } = c;
    if (m.phase !== p.phase) return fail('wrong-phase');
    const on = p.on ?? true;
    if (seat.ready === on) return DUP;
    seat.ready = on;
    this.activity(now);
    this.touch();
    this.checkQuorum(sq, now);
    return OK;
  }

  needHelp(seatId: string, on: boolean, now: number): AckResult {
    const seat = this.s.seats.get(seatId);
    if (!seat) return fail('not-found');
    if (this.s.phase === 'ended') return fail('ended');
    if (seat.needHelp === on) return DUP;
    if (on && this.missionRunning && this.s.missionAgg) this.s.missionAgg.helpRequests += 1;
    seat.needHelp = on;
    this.activity(now);
    this.touch();
    return OK;
  }

  takeBreak(seatId: string, on: boolean, now: number): AckResult {
    const seat = this.s.seats.get(seatId);
    if (!seat) return fail('not-found');
    if (this.s.phase === 'ended') return fail('ended');
    if (seat.onBreak === on) return DUP;
    seat.onBreak = on;
    this.activity(now);
    this.touch();
    const sq = this.s.squads.get(seat.squadId);
    if (sq) this.checkQuorum(sq, now);
    return OK;
  }

  roomHold(seatId: string, on: boolean, now: number): AckResult {
    const seat = this.s.seats.get(seatId);
    if (!seat) return fail('not-found');
    if (this.s.phase !== 'room-freeze') return fail('wrong-phase');
    if (seat.roomHolding === on) return DUP;
    seat.roomHolding = on;
    this.recomputeFreeze();
    this.activity(now);
    this.touch();
    return OK;
  }

  lateHold(seatId: string, p: { key: string; optionId: string; player?: number }, now: number): AckResult {
    const s = this.s;
    const seat = s.seats.get(seatId);
    if (!seat) return fail('not-found');
    if (s.phase === 'ended') return fail('ended');
    if (s.paused) return fail('paused');
    const sq = s.squads.get(seat.squadId);
    if (!sq) return fail('not-found');
    const current = sq.mission?.index === s.missionIndex ? (sq.mission?.aftershocks ?? []) : [];
    const delivery = [...current, ...sq.finale].find((d) => d.key === p.key);
    if (!delivery) return fail('not-found');
    const found = shockSpec(delivery.missionId, delivery.choiceId);
    const option = found?.spec.recovery?.options.find((o) => o.id === p.optionId);
    if (!found || !option) return fail('bad-request');
    const player = p.player ?? 0;
    if (player >= seat.players) return fail('bad-request');
    const k = `${p.key}#${player}`;
    if (seat.lateHolds.has(k)) return DUP;
    seat.lateHolds.add(k);
    s.aggregate.lateHold.total += 1;
    if (option.good) {
      s.aggregate.lateHold.good += 1;
      // Coming forward relights a lantern, once per squad per Aftershock (GDD §6.3.4).
      if (!sq.recovered.has(p.key)) {
        sq.recovered.add(p.key);
        this.adjustTrust(sq, found.mission.district, 1);
        this.lightLantern();
      }
    }
    this.activity(now);
    this.touch();
    return OK;
  }

  signal(seatId: string, now: number): AckResult {
    if (!this.s.seats.has(seatId)) return fail('not-found');
    if (this.s.phase !== 'debrief') return fail('wrong-phase');
    this.s.seeDifferently += 1;
    this.activity(now);
    this.touch();
    return OK;
  }
}
