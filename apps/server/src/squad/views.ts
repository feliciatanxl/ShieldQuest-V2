// Audience-specific snapshots. This file is the privacy boundary of the live session:
// - seats get their own squad (counts-only reveal, role-tagged pins) plus their own private state;
// - the Conductor gets squad agreement as United / Mostly / Split and room counts only at n >= ROOM_MIN_N;
// - the Big Screen gets positive, room-level trends and never a choice or a risky split (GDD §7.3, §11.12).

import {
  PROTOCOL_VERSION,
  ROLE_ORDER,
  ROOM_MIN_N,
  ROOM_MIN_SQUADS,
  SQUAD_PHASE_LETTERS,
  SQUAD_TOTEMS,
  chanceById,
  emptyHoldBuckets,
  evaluateShield,
  hostPath,
  joinPath,
  missionById,
  screenPath,
  shieldSlotsFor,
  shieldSlotsForBand,
  surgesEnabled,
  tallyVotes,
  totalVotes,
  totemById,
  type ChanceQuestion,
  type ChoiceCount,
  type DashBase,
  type DashScore,
  type HostDashView,
  type ScreenDashView,
  type SeatDashView,
  type SquadTotemId,
  type EvidenceBoard,
  type EvidencePin,
  type HostSnapshot,
  type HostSquad,
  type Mission,
  type PlayerVoteState,
  type RoomPositive,
  type RoomVotes,
  type ScreenSnapshot,
  type ScreenSquad,
  type SeatPrivate,
  type SeatSnapshot,
  type SessionPublic,
  type ShieldSlot,
  type ShieldView,
  type SquadMember,
  type SquadMissionView,
  type SquadRoleId,
  type SquadView,
} from '@shieldquest/shared';
import type { DashRound, DashState, PinEntry, Seat, SessionState, Squad, SquadMission } from './state';

// ---------------------------------------------------------------------------------------------
// Small helpers shared with the session state machine

export const isConnected = (seat: Seat): boolean => seat.sockets.size > 0;
export const isActive = (seat: Seat): boolean => isConnected(seat) && !seat.onBreak;

export function missionOf(id: string): Mission {
  const m = missionById(id);
  if (!m) throw new Error(`Unknown mission ${id}`);
  return m;
}

export function squadSeats(s: SessionState, sq: Squad): Seat[] {
  const out: Seat[] = [];
  for (const id of sq.seatIds) {
    const seat = s.seats.get(id);
    if (seat) out.push(seat);
  }
  return out;
}

export function squadsInOrder(s: SessionState): Squad[] {
  const out: Squad[] = [];
  for (const t of SQUAD_TOTEMS) {
    const sq = s.squads.get(t.id);
    if (sq) out.push(sq);
  }
  return out;
}

/** The open mission of a squad (not complete), or null. */
export function openMission(s: SessionState, sq: Squad): SquadMission | null {
  const m = sq.mission;
  return s.phase === 'mission' && m && !m.complete && m.index === s.missionIndex ? m : null;
}

/** Players on a seat, each with its state (pass-and-play seats have several). */
export function seatPlayers(seat: Seat) {
  return seat.playersState.slice(0, seat.players);
}

/** Which vote round the squad is in for the sealed counter. */
const roundFor = (m: SquadMission): 1 | 2 =>
  m.phase === 'reseal' || m.phase === 'release' || m.phase === 'shield' || m.phase === 'bond' ? 2 : 1;

export function sealedCount(s: SessionState, sq: Squad, m: SquadMission): { count: number; total: number } {
  const round = roundFor(m);
  let count = 0;
  let active = 0;
  for (const seat of squadSeats(s, sq)) {
    for (const ps of seatPlayers(seat)) {
      if (round === 1 ? ps.r1 : ps.r2) count += 1;
      if (isActive(seat)) active += 1;
    }
  }
  return { count, total: Math.max(count, active) };
}

export function seatDone(seat: Seat, m: SquadMission | null): boolean {
  if (!m) return seat.ready;
  if (m.phase === 'think') return seatPlayers(seat).every((p) => p.r1 !== null);
  if (m.phase === 'reseal') return m.decision !== null || seatPlayers(seat).every((p) => p.r2 !== null);
  return seat.ready;
}

const rolesOf = (entries: Iterable<PinEntry>): SquadRoleId[] => {
  const set = new Set<SquadRoleId>();
  for (const e of entries) set.add(e.role);
  return ROLE_ORDER.filter((r) => set.has(r));
};

function pinsFrom(map: Map<string, Map<string, PinEntry>>, order: string[]): EvidencePin[] {
  const out: EvidencePin[] = [];
  for (const clueId of order) {
    const owners = map.get(clueId);
    if (!owners || owners.size === 0) continue;
    const entries = [...owners.values()];
    out.push({ clueId, roles: rolesOf(entries), live: entries.some((e) => e.live) });
  }
  return out;
}

export function boardView(m: SquadMission, mission: Mission): EvidenceBoard {
  const order = mission.clues.map((c) => c.id);
  const red = new Set(mission.clues.filter((c) => c.redFlag).map((c) => c.id));
  const pins = pinsFrom(m.pins, order);
  const cleared = pinsFrom(m.cleared, order);
  return {
    pins,
    cleared,
    tracedRoles: ROLE_ORDER.filter((r) => m.tracedRoles.has(r)),
    liveFlags: pins.filter((p) => red.has(p.clueId) && p.live).length,
    heldFlags: pins.filter((p) => red.has(p.clueId) && !p.live).length,
  };
}

/** Seat that may SEND the Peer Shield message: the Peer Supporter, or anyone once they have been away. */
export function canSendShield(s: SessionState, sq: Squad, seat: Seat): boolean {
  const m = sq.mission;
  if (!m?.shield) return false;
  if (seat.role?.covers.includes('peer-supporter') && !seat.role.shadow) return true;
  const supporter = squadSeats(s, sq).find((x) => x.role?.covers.includes('peer-supporter') && !x.role.shadow);
  return !supporter || m.shield.sendOpen;
}

/** Roles holding each Peer Shield slot among connected seats. An empty list means any seat may play it. */
export function shieldOwners(s: SessionState, sq: Squad): Partial<Record<ShieldSlot, SquadRoleId[]>> {
  const band = s.config.band;
  const owners: Partial<Record<ShieldSlot, SquadRoleId[]>> = {};
  for (const slot of shieldSlotsForBand(band)) {
    const roles = new Set<SquadRoleId>();
    for (const seat of squadSeats(s, sq)) {
      if (seat.role && isConnected(seat) && shieldSlotsFor(seat.role, band).includes(slot)) roles.add(seat.role.role);
    }
    owners[slot] = ROLE_ORDER.filter((r) => roles.has(r));
  }
  return owners;
}

export function squadSurgeAt(s: SessionState, sq: Squad): number | null {
  if (!s.timeline || sq.gentle || !surgesEnabled(s.config.band, s.config.gentle)) return null;
  return s.timeline.surgeAt;
}

// ---------------------------------------------------------------------------------------------
// Squad Dash helpers (shared with the session state machine)

/** Key for one player's tap on the current Dash question. */
export const dashAnswerKey = (seatId: string, player: number): string => `${seatId}#${player}`;

export function dashQuestion(d: DashState): ChanceQuestion | null {
  const id = d.stage === 'results' ? undefined : d.questionIds[d.index];
  return id ? (chanceById(id) ?? null) : null;
}

/** Squads that take part in a Dash question: every squad with at least one seat. */
export const dashSquads = (s: SessionState): Squad[] => squadsInOrder(s).filter((sq) => sq.seatIds.length > 0);

/** Players who could tap right now (connected seats not on a break, every player on a shared phone). */
export function activePlayers(s: SessionState, sq: Squad): number {
  return squadSeats(s, sq)
    .filter(isActive)
    .reduce((n, seat) => n + seat.players, 0);
}

/** A squad's live taps on the current question: counts per option only, never who. */
export function dashTally(s: SessionState, sq: Squad, q: ChanceQuestion): { counts: ChoiceCount[]; answered: number; total: number } {
  const picks: string[] = [];
  const answers = s.dash?.answers;
  for (const seat of squadSeats(s, sq)) {
    for (let p = 0; p < seat.players; p++) {
      const a = answers?.get(dashAnswerKey(seat.id, p));
      if (a) picks.push(a);
    }
  }
  const counts = tallyVotes(
    q.options.map((o) => o.id),
    picks,
  );
  const answered = totalVotes(counts);
  return { counts, answered, total: Math.max(answered, activePlayers(s, sq)) };
}

export function dashScore(d: DashState, squadId: SquadTotemId): DashScore {
  let correct = 0;
  let played = 0;
  for (const r of d.rounds) {
    const e = r.squads.find((x) => x.squadId === squadId);
    if (!e) continue;
    played += 1;
    if (e.result.correct) correct += 1;
  }
  return { correct, played };
}

/** The round being revealed right now (the last scored one), or null. */
const revealedRound = (d: DashState): DashRound | null =>
  d.stage === 'reveal' ? (d.rounds.findLast((r) => !r.skipped && r.questionId === d.questionIds[d.index]) ?? null) : null;

function dashBase(s: SessionState, d: DashState): DashBase {
  const round = revealedRound(d);
  let correct = 0;
  let played = 0;
  for (const r of d.rounds) {
    for (const e of r.squads) {
      played += 1;
      if (e.result.correct) correct += 1;
    }
  }
  return {
    id: d.id,
    length: d.questionIds.length,
    index: d.index,
    stage: d.stage,
    questionId: dashQuestion(d)?.id ?? null,
    stageStartedAt: d.stageStartedAt,
    endsAt: d.stage === 'question' ? d.endsAt : null,
    quiet: s.config.calm || s.config.gentle,
    room: round ? { correct: round.squads.filter((e) => e.result.correct).length, squads: round.squads.length } : null,
    totals: { correct, played },
  };
}

/** A phone sees only its own squad's taps (counts) and result, and its own taps. */
function seatDash(s: SessionState, sq: Squad, seat: Seat): SeatDashView | null {
  const d = s.dash;
  if (!d) return null;
  const q = dashQuestion(d);
  const round = revealedRound(d);
  const entry = round?.squads.find((e) => e.squadId === sq.id) ?? null;
  const shared = seat.players > 1;
  let tally: SeatDashView['tally'] = null;
  if (d.stage === 'question' && q) tally = dashTally(s, sq, q);
  else if (entry) tally = { counts: entry.counts.map((c) => ({ ...c })), answered: entry.result.answered, total: entry.result.answered };
  return {
    ...dashBase(s, d),
    tally,
    mine: Array.from({ length: seat.players }, (_, player) => {
      const optionId = d.stage === 'question' ? d.answers.get(dashAnswerKey(seat.id, player)) : undefined;
      return optionId && !shared ? { player, optionId } : { player };
    }),
    result: entry ? { ...entry.result } : null,
    score: dashScore(d, sq.id),
  };
}

/** The Conductor sees progress (how many tapped, never what) and, after the reveal, each squad's pick. */
function hostDash(s: SessionState): HostDashView | null {
  const d = s.dash;
  if (!d) return null;
  const q = dashQuestion(d);
  const round = revealedRound(d);
  return {
    ...dashBase(s, d),
    squads: dashSquads(s).map((sq) => {
      const totem = totemById(sq.id);
      const entry = round?.squads.find((e) => e.squadId === sq.id) ?? null;
      const live = d.stage === 'question' && q ? dashTally(s, sq, q) : null;
      const answered = live?.answered ?? entry?.result.answered ?? 0;
      return {
        squadId: sq.id,
        name: totem.name,
        shape: totem.shape,
        answered,
        total: live?.total ?? Math.max(answered, activePlayers(s, sq)),
        result: entry ? { ...entry.result } : null,
        score: dashScore(d, sq.id),
      };
    }),
    rounds: d.rounds.map((r) => ({
      questionId: r.questionId,
      skipped: r.skipped,
      correct: r.squads.filter((e) => e.result.correct).length,
      squads: r.squads.length,
    })),
  };
}

/** The projector: progress counts and squad totals only; never a squad's pick or a split. */
function screenDash(s: SessionState): ScreenDashView | null {
  const d = s.dash;
  if (!d) return null;
  const q = dashQuestion(d);
  return {
    ...dashBase(s, d),
    squads: dashSquads(s).map((sq) => {
      const totem = totemById(sq.id);
      const live = d.stage === 'question' && q ? dashTally(s, sq, q) : null;
      return {
        squadId: sq.id,
        name: totem.name,
        shape: totem.shape,
        answered: live?.answered ?? 0,
        total: live?.total ?? activePlayers(s, sq),
        score: dashScore(d, sq.id),
      };
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// Views

export function publicView(s: SessionState): SessionPublic {
  return {
    code: s.code,
    band: s.config.band,
    phase: s.phase,
    missionIds: [...s.config.missionIds],
    missionIndex: s.missionIndex,
    missionComplete: s.missionComplete,
    acceptingJoins: s.acceptingJoins,
    options: {
      gentle: s.config.gentle,
      discreet: s.config.discreet,
      calm: s.config.calm,
      relaxed: s.config.relaxed,
      autoAdvance: s.config.autoAdvance,
    },
    paused: s.paused,
    pausedAt: s.pausedAt,
    timeline: s.timeline ? { ...s.timeline } : null,
    roomFreeze: { active: s.roomFreeze.active, done: s.roomFreeze.done },
    joinPath: joinPath(s.code),
    disclaimerRequired: true,
  };
}

function shieldView(s: SessionState, sq: Squad, m: SquadMission, mission: Mission): ShieldView | null {
  if (!mission.peerShield || !m.shield) return null;
  const live = evaluateShield(mission.peerShield, m.shield.picks);
  return {
    slots: shieldSlotsForBand(s.config.band),
    owners: shieldOwners(s, sq),
    picks: { ...m.shield.picks },
    guard: live.guard,
    doubt: live.doubt,
    result: m.shield.result,
    attempts: m.shield.attempts,
    canRetry: m.phase === 'shield' && !!m.shield.result && m.shield.result.traps > 0 && m.shield.attempts < 2,
  };
}

function missionView(s: SessionState, sq: Squad, m: SquadMission): SquadMissionView {
  const mission = missionOf(m.missionId);
  return {
    missionId: m.missionId,
    index: m.index,
    phase: m.phase,
    phaseStartedAt: m.phaseStartedAt,
    phaseEndsAt: m.phaseEndsAt,
    complete: m.complete,
    sealLockUntil: m.sealLockUntil,
    aftershocks: m.aftershocks,
    shadow: m.shadow,
    holding: m.holding.size,
    board: boardView(m, mission),
    sealed: sealedCount(s, sq, m),
    reveal: m.reveal,
    chips: m.chips,
    tie: m.tie,
    decision: m.decision,
    shield: shieldView(s, sq, m, mission),
    bond: m.bond,
    surgeAt: squadSurgeAt(s, sq),
    guardiansUsed: [...m.guardiansUsed],
    explainExtended: m.explainExtended,
    echoUsed: m.echoUsed,
    shared: m.shared,
  };
}

function memberView(s: SessionState, sq: Squad, seat: Seat): SquadMember {
  return {
    seatId: seat.id,
    pseudonym: seat.pseudonym,
    seatIndex: sq.seatIds.indexOf(seat.id),
    role: seat.role?.role ?? null,
    shadow: seat.role?.shadow ?? false,
    connected: isConnected(seat),
    done: seatDone(seat, openMission(s, sq)),
    players: seat.players,
  };
}

export function squadView(s: SessionState, sq: Squad): SquadView {
  const totem = totemById(sq.id);
  return {
    id: sq.id,
    name: totem.name,
    shape: totem.shape,
    gentle: sq.gentle,
    members: squadSeats(s, sq).map((seat) => memberView(s, sq, seat)),
    guardians: [...sq.guardians],
    lumen: { wallet: sq.lumen.wallet, trust: { ...sq.lumen.trust } },
    decisions: sq.decisions.map((d) => ({ ...d })),
    mission: sq.mission && sq.mission.index === s.missionIndex ? missionView(s, sq, sq.mission) : null,
    finale: sq.finale,
  };
}

function playerVotes(seat: Seat): PlayerVoteState[] {
  // On a pass-and-play seat the next player must not see the previous player's Exit.
  const shared = seat.players > 1;
  return seatPlayers(seat).map((ps, player) => ({
    player,
    round1: ps.r1
      ? shared
        ? { ...(ps.r1.confidence ? { confidence: ps.r1.confidence } : {}) }
        : { choiceId: ps.r1.choiceId, ...(ps.r1.confidence ? { confidence: ps.r1.confidence } : {}) }
      : null,
    round2: ps.r2 ? (shared ? {} : { choiceId: ps.r2.choiceId }) : null,
    forecast: ps.forecast !== null,
    trace: ps.trace !== null,
    reasons: [...ps.reasons],
  }));
}

function seatPrivate(s: SessionState, sq: Squad, seat: Seat): SeatPrivate {
  const m = sq.mission && sq.mission.index === s.missionIndex ? sq.mission : null;
  const mine = (map: Map<string, Map<string, PinEntry>>): string[] =>
    [...map.entries()].filter(([, owners]) => owners.has(seat.id)).map(([clueId]) => clueId);
  return {
    seatId: seat.id,
    pseudonym: seat.pseudonym,
    squadId: sq.id,
    seatIndex: sq.seatIds.indexOf(seat.id),
    players: seat.players,
    role: seat.role,
    shieldSlots: seat.role ? shieldSlotsFor(seat.role, s.config.band) : [],
    held: seat.held,
    pins: m ? mine(m.pins) : [],
    cleared: m ? mine(m.cleared) : [],
    votes: playerVotes(seat),
    steelman: seat.steelman,
    tieBreaker: !!m?.tie && m.tieBreakerSeat === seat.id,
    canSendShield: m?.phase === 'shield' && !m.shield?.result ? canSendShield(s, sq, seat) : false,
    canShare: !!seat.role && seat.role.role === 'safety-lead' && !seat.role.shadow,
    ready: seat.ready,
    onBreak: seat.onBreak,
    needHelp: seat.needHelp,
    lateHolds: [...new Set([...seat.lateHolds].map((k) => k.slice(0, k.lastIndexOf('#'))))],
  };
}

export function seatSnapshot(s: SessionState, seat: Seat, now: number): SeatSnapshot | null {
  const sq = s.squads.get(seat.squadId);
  if (!sq) return null;
  return {
    protocol: PROTOCOL_VERSION,
    v: s.v,
    serverNow: now,
    kind: 'seat',
    session: publicView(s),
    squad: squadView(s, sq),
    me: seatPrivate(s, sq, seat),
    debrief: s.debrief,
    dash: seatDash(s, sq, seat),
  };
}

export function roomPositive(s: SessionState): RoomPositive {
  return {
    lanterns: s.lanterns,
    holdsMade: s.holdsMade,
    mindsChangedSafer: s.mindsChangedSafer,
    roomFreeze: { amount: s.roomFreeze.amount, peak: s.roomFreeze.peak },
  };
}

function roomVotes(s: SessionState): RoomVotes | null {
  const agg = s.missionAgg;
  if (!agg) return null;
  const choices = missionOf(agg.missionId).choices.map((c) => c.id);
  const counts = (rec: Record<string, number>) => choices.map((choiceId) => ({ choiceId, n: rec[choiceId] ?? 0 }));
  // Votes are folded in per squad at its decision, so `decisions` counts the squads behind these numbers.
  const squads = Object.values(agg.decisions).reduce((sum, n) => sum + n, 0);
  const show = (total: number) => total >= ROOM_MIN_N && squads >= ROOM_MIN_SQUADS;
  return {
    missionId: agg.missionId,
    first: show(agg.firstTotal) ? counts(agg.firstCounts) : null,
    final: show(agg.finalTotal) ? counts(agg.finalCounts) : null,
    firstTotal: agg.firstTotal,
    finalTotal: agg.finalTotal,
  };
}

function hostSquad(s: SessionState, sq: Squad, now: number): HostSquad {
  const totem = totemById(sq.id);
  const seats = squadSeats(s, sq);
  const m = sq.mission && sq.mission.index === s.missionIndex ? sq.mission : null;
  const agreement = m ? (m.decision ? m.finalMood : (m.reveal?.mood ?? null)) : null;
  return {
    id: sq.id,
    name: totem.name,
    shape: totem.shape,
    seats: seats.map((seat) => ({
      seatId: seat.id,
      pseudonym: seat.pseudonym,
      connected: isConnected(seat),
      role: seat.role?.role ?? null,
      shadow: seat.role?.shadow ?? false,
      players: seat.players,
      awayMs: isConnected(seat) ? 0 : Math.max(0, now - seat.lastSeenAt),
    })),
    connected: seats.filter(isConnected).length,
    phase: m?.phase ?? null,
    phaseEndsAt: m?.phaseEndsAt ?? null,
    complete: m?.complete ?? false,
    letter: m ? (SQUAD_PHASE_LETTERS[m.phase][0] ?? null) : null,
    sealed: m ? sealedCount(s, sq, m) : { count: 0, total: 0 },
    pins: m ? boardView(m, missionOf(m.missionId)).pins.length : 0,
    guardians: [...sq.guardians],
    agreement,
    needHelp: seats.filter((x) => x.needHelp).length,
    onBreak: seats.filter((x) => x.onBreak).length,
    decided: !!m?.decision,
    tiePending: !!m?.tie && !m.decision,
    shared: m?.shared ?? false,
    gentle: sq.gentle,
  };
}

export function hostSnapshot(s: SessionState, now: number): HostSnapshot {
  const seats = [...s.seats.values()];
  return {
    protocol: PROTOCOL_VERSION,
    v: s.v,
    serverNow: now,
    kind: 'host',
    session: { ...publicView(s), hostPath: hostPath(s.code), screenPath: screenPath(s.code) },
    config: { ...s.config, missionIds: [...s.config.missionIds] },
    squads: squadsInOrder(s).map((sq) => hostSquad(s, sq, now)),
    room: {
      ...roomPositive(s),
      seats: seats.length,
      connected: seats.filter(isConnected).length,
      needHelp: seats.filter((x) => x.needHelp).length,
      onBreak: seats.filter((x) => x.onBreak).length,
      holdBuckets: s.missionAgg ? { ...s.missionAgg.holdBuckets } : emptyHoldBuckets(),
      votes: roomVotes(s),
      seeDifferently: s.seeDifferently,
    },
    spotlight: s.spotlight,
    debrief: s.debrief,
    dash: hostDash(s),
  };
}

function screenSquad(s: SessionState, sq: Squad): ScreenSquad {
  const totem = totemById(sq.id);
  const m = sq.mission && sq.mission.index === s.missionIndex ? sq.mission : null;
  const district = m ? missionOf(m.missionId).district : null;
  return {
    id: sq.id,
    name: totem.name,
    shape: totem.shape,
    connected: squadSeats(s, sq).filter(isConnected).length,
    phase: m?.phase ?? null,
    phaseEndsAt: m?.phaseEndsAt ?? null,
    complete: m?.complete ?? false,
    holding: m?.holding.size ?? 0,
    sealed: m ? sealedCount(s, sq, m) : { count: 0, total: 0 },
    decided: !!m?.decision,
    guardians: [...sq.guardians],
    trust: !s.config.discreet && district ? (sq.lumen.trust[district] ?? 0) : null,
  };
}

export function screenSnapshot(s: SessionState, now: number): ScreenSnapshot {
  const sq = s.spotlight ? s.squads.get(s.spotlight) : undefined;
  const m = sq?.mission && sq.mission.index === s.missionIndex ? sq.mission : null;
  const totem = sq ? totemById(sq.id) : null;
  return {
    protocol: PROTOCOL_VERSION,
    v: s.v,
    serverNow: now,
    kind: 'screen',
    session: publicView(s),
    squads: squadsInOrder(s).map((x) => screenSquad(s, x)),
    room: roomPositive(s),
    spotlight:
      sq && m?.shared && totem
        ? {
            squadId: sq.id,
            name: totem.name,
            shape: totem.shape,
            board: boardView(m, missionOf(m.missionId)),
            shield: m.shield?.result ? { picks: { ...m.shield.picks }, outcome: m.shield.result.outcome } : null,
          }
        : null,
    debrief: s.debrief,
    dash: screenDash(s),
  };
}
