// Squad session protocol: the one contract between the squad server (apps/server/src/squad) and the
// phone, Conductor and Big Screen clients. Types plus small pure helpers that both sides run.
// See docs/GAME_DESIGN.md §5.3 (squad mission anatomy), §6.5 (Think-Vote-Explain), §6.6 (roles),
// §7.2-7.3 (run sheet, Conductor, Big Screen), §11 (privacy) and §12.5 (real-time events).
//
// Privacy rules this contract encodes (GDD §11):
// - Seats are pseudonymous (generated adjective + animal). Nobody ever types a name.
// - Squad reveals are counts only (Mood for the junior band). Reason chips show only when >= 2 share them.
// - The Big Screen never receives risky splits, only positive trends. The Conductor sees each squad's
//   agreement only as United / Mostly / Split, and room-level counts only when n >= 5.
// - Persisted analytics (SessionAggregate) carry no seat ids, pseudonyms, squad names or times finer than an hour.

import {
  SQUAD_ROLES,
  SQUAD_TOTEMS,
  type BandId,
  type DistrictId,
  type GuardianId,
  type SkillId,
  type SquadRoleId,
  type SquadTotemId,
} from './framework';
import type { Safety, ShieldSlot } from './mission';

export const PROTOCOL_VERSION = 1 as const;
export const SOCKET_PATH = '/socket.io';
/** Hard cap for any client -> server message (Socket.IO maxHttpBufferSize). */
export const MAX_PAYLOAD_BYTES = 16 * 1024;

// ---------------------------------------------------------------------------------------------
// Codes, tokens and paths

/** Room codes: 6 characters from [A-HJ-NP-Z2-9] (no I, O, 0 or 1), e.g. "H7KQ2M". */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

/** Uppercases and strips spaces and dashes, so "h7k-q2m" and "H7K Q2M" both work. */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '').slice(0, 16);
}

export const isRoomCode = (code: string): boolean => ROOM_CODE_RE.test(code);

/**
 * Seat tokens are generated on the device (>= 128 bits, base64url) and kept in localStorage.
 * The same token always rejoins the same seat; the server keeps only a hash of it.
 */
export const SEAT_TOKEN_RE = /^[A-Za-z0-9_-]{22,64}$/;

export const joinPath = (code: string, squad?: SquadTotemId): string => (squad ? `/j/${code}/${squad}` : `/j/${code}`);
export const hostPath = (code: string): string => `/host/${code}`;
export const screenPath = (code: string): string => `/screen/${code}`;

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * base64url (no padding) for a seat token. Clients call it with 16+ bytes from crypto.getRandomValues
 * and keep the result in localStorage; the same token always rejoins the same seat.
 */
export function encodeSeatToken(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 8) / 6));
    for (let k = 0; k < chars; k++) out += B64URL[(n >> (18 - 6 * k)) & 63];
  }
  return out;
}

/** A seat disconnected for at least this long may be taken over by a new device (Reclaim Seat). */
export const RECLAIM_AFTER_MS = 30_000;
/** Sessions with no activity for this long are closed; their seats are deleted. */
export const SESSION_IDLE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Clock offset from one clockPing round trip: add it to Date.now() to get server time.
 * `sentAt` = the `c` you sent, `serverAt` = the `s` you got back, `receivedAt` = Date.now() on the ack.
 */
export const clockOffset = (sentAt: number, serverAt: number, receivedAt: number): number =>
  Math.round(serverAt - (sentAt + receivedAt) / 2);

// ---------------------------------------------------------------------------------------------
// Squads

export type SquadTotem = (typeof SQUAD_TOTEMS)[number];

export const SQUAD_LIMITS = {
  minSquads: 2,
  maxSquads: SQUAD_TOTEMS.length,
  /** Auto-balancing aims for squads of 4-5. */
  targetSize: 5,
  /** Smallest squad auto mode leaves in play: before roles are first dealt, smaller squads are evened out. */
  minSize: 3,
  /** Hard cap per squad (beyond 5, extra seats get a Shadow Clue lens). */
  maxSize: 8,
  maxSeats: 48,
} as const;

export const totemById = (id: SquadTotemId): SquadTotem => SQUAD_TOTEMS.find((t) => t.id === id)!;
export const isSquadTotemId = (id: string): id is SquadTotemId => SQUAD_TOTEMS.some((t) => t.id === id);

// ---------------------------------------------------------------------------------------------
// Phases

export const SESSION_PHASES = ['lobby', 'room-freeze', 'mission', 'debrief', 'ended'] as const;
export type SessionPhase = (typeof SESSION_PHASES)[number];

/**
 * Per-squad mission phases (GDD §5.3). 'aftershock' is the optional slot before Role Flip in missions 2-3,
 * used only when a squad has a due Aftershock or a shadow check. 'shield' is skipped when the mission has
 * no Peer Shield. A squad stays on 'bond' with complete = true until the Conductor opens the next mission.
 */
export const SQUAD_MISSION_PHASES = [
  'aftershock',
  'role-flip',
  'live',
  'investigate',
  'think',
  'reveal',
  'explain',
  'reseal',
  'release',
  'shield',
  'bond',
] as const;
export type SquadMissionPhase = (typeof SQUAD_MISSION_PHASES)[number];

/** S.H.I.E.L.D. letters practised in each phase; the first is the one the rail highlights. */
export const SQUAD_PHASE_LETTERS: Record<SquadMissionPhase, readonly SkillId[]> = {
  aftershock: ['E'],
  'role-flip': [],
  live: ['S', 'H'],
  investigate: ['S', 'I'],
  think: ['E', 'L'],
  reveal: [],
  explain: ['L'],
  reseal: ['L'],
  release: ['E'],
  shield: ['D'],
  bond: [],
};

/**
 * Phases on the shared room timeline: every phone and the Big Screen play the same moment from the same
 * t0 (MissionTimeline.liveAt). Later phases run per squad, each with its own deadline.
 */
export const ROOM_SYNCED_PHASES: readonly SquadMissionPhase[] = ['aftershock', 'role-flip', 'live'];

export const phaseIndex = (phase: SquadMissionPhase): number => SQUAD_MISSION_PHASES.indexOf(phase);

// ---------------------------------------------------------------------------------------------
// Session configuration and timing

export interface SessionOptions {
  /** No Pressure Surges and no countdown visuals (always effectively on for the junior band's surges). */
  gentle: boolean;
  /** Projector shows class-level effects only; no Trust on squad towers. Default for junior and teen. */
  discreet: boolean;
  /** Calm Mode: slows timers for phases that start while it is on, mutes pressure audio on clients. */
  calm: boolean;
  /** Relaxed timing: longer Think / Explain / Re-seal / Release / Peer Shield windows. */
  relaxed: boolean;
  /** A phase may end early when every connected seat is done or sealed. */
  autoAdvance: boolean;
}

export interface SessionConfig extends SessionOptions {
  band: BandId;
  /** 1-3 missions, played in order (Guided, Light, Wildcard). */
  missionIds: string[];
  /** Fixed number of squads (2-6), or null to create squads on demand as players join. */
  squadCount: number | null;
}

export type SessionOptionKey = keyof SessionOptions;
export const SESSION_OPTION_KEYS = ['gentle', 'discreet', 'calm', 'relaxed', 'autoAdvance'] as const satisfies readonly SessionOptionKey[];

/** Projector defaults to Discreet for 10-13 and 14-16 and Open for 17-24 (GDD §5.4). */
export const defaultSessionOptions = (band: BandId): SessionOptions => ({
  gentle: false,
  discreet: band !== 'young-adult',
  calm: false,
  relaxed: false,
  autoAdvance: true,
});

/** Pressure Surges never run for the junior band or in Gentle mode (GDD §11.21). */
export const surgesEnabled = (band: BandId, gentle: boolean): boolean => band !== 'junior' && !gentle;

/** Seconds for each part of a squad mission (GDD §5.3, §5.4). */
export interface PhaseTiming {
  /** Aftershock slot before Role Flip (missions 2-3, only when something is due). */
  aftershock: number;
  roleFlip: number;
  /** Freeze End, measured from the start of Live (fixed server time; holding earlier buys more time). */
  freezeEnd: number;
  /** Pressure Surge, seconds after Live ends (never for juniors or in Gentle mode). */
  surgeAfterLive: number;
  think: number;
  /** SEAL stays locked for the first seconds of Think while the breathing ring runs. */
  sealLock: number;
  reveal: number;
  explain: number;
  /** The squad may ask once for more Explain time. */
  explainExtend: number;
  /** Echo's Invite adds this once. */
  echoExtend: number;
  reseal: number;
  /** Window for the Safety Lead to break a tie. */
  tieBreak: number;
  release: number;
  shield: number;
  /** If the Peer Supporter is disconnected this long, any seat may SEND. */
  shieldSendFallback: number;
  bond: number;
}

const BASE_TIMING: PhaseTiming = {
  aftershock: 90,
  roleFlip: 15,
  freezeEnd: 210,
  surgeAfterLive: 45,
  think: 30,
  sealLock: 10,
  reveal: 15,
  explain: 120,
  explainExtend: 30,
  echoExtend: 60,
  reseal: 20,
  tieBreak: 20,
  release: 40,
  shield: 180,
  shieldSendFallback: 20,
  bond: 20,
};

/** Timing for one mission, given the band, the mission's scaffold and the session's options. */
export function phaseTiming(input: {
  band: BandId;
  scaffold: 'guided' | 'light' | 'wildcard';
  relaxed?: boolean;
  calm?: boolean;
}): PhaseTiming {
  const t: PhaseTiming = { ...BASE_TIMING };
  if (input.scaffold === 'wildcard') {
    // Wildcard Sprint: Freeze End at Live start + 2:30, Explain 1:00 (GDD §5.3).
    t.freezeEnd = 150;
    t.explain = 60;
  }
  if (input.band === 'junior') {
    // More reading time for 10-13 (Plain mode).
    t.think += 10;
    t.reseal += 5;
  }
  const slow = (input.relaxed ? 1.5 : 1) * (input.calm ? 1.25 : 1);
  if (slow > 1) {
    for (const k of ['think', 'reveal', 'explain', 'reseal', 'tieBreak', 'release', 'shield', 'bond'] as const) {
      t[k] = Math.round(t[k] * slow);
    }
    t.freezeEnd = Math.round(t.freezeEnd * Math.min(slow, 1.25));
  }
  return t;
}

// ---------------------------------------------------------------------------------------------
// Roles and lenses (GDD §6.6)

export type LensId = 'path' | 'clue' | 'heart' | 'thread' | 'ripple';

export const ROLE_LENS: Record<SquadRoleId, LensId> = {
  'safety-lead': 'path',
  'evidence-checker': 'clue',
  'peer-supporter': 'heart',
  'influence-tracer': 'thread',
  'future-reader': 'ripple',
};

export const ROLE_LETTER: Record<SquadRoleId, SkillId> = {
  'safety-lead': 'L',
  'evidence-checker': 'S',
  'peer-supporter': 'D',
  'influence-tracer': 'I',
  'future-reader': 'E',
};

export const ROLE_ORDER: readonly SquadRoleId[] = SQUAD_ROLES.map((r) => r.id);

export interface RoleAssignment {
  role: SquadRoleId;
  /** Roles whose lens and job this seat carries after merges (always includes `role`). */
  covers: SquadRoleId[];
  lenses: LensId[];
  /** An extra seat beyond the active roles: a Shadow Clue lens with no unique job. */
  shadow: boolean;
  letter: SkillId;
}

/**
 * Active roles for a squad and what each one covers after merges:
 * 5+ seats: all five roles. 4: Ripple merges into Path. 3 (and the junior band): Thread also merges into Clue,
 * leaving Clue, Heart and Path. Smaller squads (attrition) fold further so every job is still carried.
 */
export function activeRoles(squadSize: number, band: BandId): { role: SquadRoleId; covers: SquadRoleId[] }[] {
  const size = Math.max(1, Math.floor(squadSize));
  if (size >= 5 && band !== 'junior') return ROLE_ORDER.map((role) => ({ role, covers: [role] }));
  if (size === 4 && band !== 'junior') {
    return [
      { role: 'safety-lead', covers: ['safety-lead', 'future-reader'] },
      { role: 'evidence-checker', covers: ['evidence-checker'] },
      { role: 'peer-supporter', covers: ['peer-supporter'] },
      { role: 'influence-tracer', covers: ['influence-tracer'] },
    ];
  }
  if (size >= 3) {
    return [
      { role: 'safety-lead', covers: ['safety-lead', 'future-reader'] },
      { role: 'evidence-checker', covers: ['evidence-checker', 'influence-tracer'] },
      { role: 'peer-supporter', covers: ['peer-supporter'] },
    ];
  }
  if (size === 2) {
    return [
      { role: 'safety-lead', covers: ['safety-lead', 'future-reader', 'peer-supporter'] },
      { role: 'evidence-checker', covers: ['evidence-checker', 'influence-tracer'] },
    ];
  }
  return [{ role: 'safety-lead', covers: [...ROLE_ORDER] }];
}

/** Role for a seat in a mission: (seatIndex + missionIndex) mod squadSize over the active roles, then Shadow Clue. */
export function roleForSeat(seatIndex: number, missionIndex: number, squadSize: number, band: BandId = 'teen'): RoleAssignment {
  const size = Math.max(1, Math.floor(squadSize));
  const roles = activeRoles(size, band);
  const slot = (((seatIndex + missionIndex) % size) + size) % size;
  const active = roles[slot];
  if (active) return roleAssignment(active.role, active.covers, false);
  return roleAssignment('evidence-checker', ['evidence-checker'], true);
}

export function roleAssignment(role: SquadRoleId, covers: SquadRoleId[], shadow: boolean): RoleAssignment {
  const ordered = ROLE_ORDER.filter((r) => r === role || covers.includes(r));
  return { role, covers: ordered, lenses: ordered.map((r) => ROLE_LENS[r]), shadow, letter: ROLE_LETTER[role] };
}

/** Peer Shield tiles are dealt by role, never by chance (GDD §6.4). Opener goes to two seats. */
export const ROLE_SHIELD_SLOTS: Record<SquadRoleId, readonly ShieldSlot[]> = {
  'safety-lead': ['channel'],
  'evidence-checker': ['opener'],
  'peer-supporter': ['offer'],
  'influence-tracer': ['reason'],
  'future-reader': ['opener'],
};

export const SHIELD_SLOT_ORDER: readonly ShieldSlot[] = ['opener', 'reason', 'offer', 'channel'];

/** 10-13 builds a three-part message: Opener, Offer, Channel. */
export const shieldSlotsForBand = (band: BandId): ShieldSlot[] =>
  band === 'junior' ? ['opener', 'offer', 'channel'] : [...SHIELD_SLOT_ORDER];

/** The Peer Shield slots a seat owns (1-2). Shadow seats share the Opener. */
export function shieldSlotsFor(role: RoleAssignment, band: BandId): ShieldSlot[] {
  const allowed = shieldSlotsForBand(band);
  const owned = new Set<ShieldSlot>(role.shadow ? ['opener'] : role.covers.flatMap((r) => ROLE_SHIELD_SLOTS[r]));
  return allowed.filter((s) => owned.has(s));
}

// ---------------------------------------------------------------------------------------------
// Reason chips and "Because..." tiles (no free text anywhere in live play)

export const REASON_CHIPS = [
  { id: 'too-urgent', label: 'Too urgent' },
  { id: 'cant-verify', label: "Can't verify it" },
  { id: 'too-good', label: 'Too good to be true' },
  { id: 'who-gains', label: 'Who gains?' },
  { id: 'friend-says-fine', label: "Friend says it's fine" },
  { id: 'easy-money', label: 'Easy money' },
  { id: 'need-money', label: 'Need the money' },
] as const;
export type ReasonChipId = (typeof REASON_CHIPS)[number]['id'];
export const isReasonChipId = (id: string): id is ReasonChipId => REASON_CHIPS.some((c) => c.id === id);

/** Up to 2 reason chips per player in Explain. */
export const MAX_REASON_CHIPS = 2;
/** A chip's count is shown only when at least this many players picked it; the rest pool as "other reasons". */
export const CHIP_SHOW_MIN = 2;

/** The Safety Lead's tie-break must carry one of these, and the whole squad sees it. */
export const BECAUSE_TILES = [
  { id: 'check-first', label: 'Because we can check it first' },
  { id: 'trusted-adult', label: 'Because a trusted adult can help' },
  { id: 'cant-verify', label: "Because we can't verify it" },
  { id: 'hurry-warning', label: 'Because the hurry is a warning sign' },
  { id: 'protects-friend', label: 'Because it protects our friend' },
  { id: 'least-harm', label: 'Because it does the least harm' },
] as const;
export type BecauseTileId = (typeof BECAUSE_TILES)[number]['id'];
export const isBecauseTileId = (id: string): id is BecauseTileId => BECAUSE_TILES.some((t) => t.id === id);

export interface ChipCount {
  chipId: ReasonChipId;
  n: number;
}

export interface ChipBoard {
  /** Chips picked by >= CHIP_SHOW_MIN players, most picked first. */
  chips: ChipCount[];
  /** Picks of chips below the threshold, pooled. */
  other: number;
  /** Players who picked at least one chip. */
  players: number;
}

/** Builds the squad's chip board from each player's picks (duplicates within a player count once). */
export function chipBoard(picks: Iterable<readonly ReasonChipId[]>): ChipBoard {
  const counts = new Map<ReasonChipId, number>();
  let players = 0;
  for (const p of picks) {
    const uniq = [...new Set(p)].slice(0, MAX_REASON_CHIPS);
    if (uniq.length > 0) players += 1;
    for (const c of uniq) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const order = (id: ReasonChipId) => REASON_CHIPS.findIndex((c) => c.id === id);
  const chips: ChipCount[] = [];
  let other = 0;
  for (const [chipId, n] of counts) {
    if (n >= CHIP_SHOW_MIN) chips.push({ chipId, n });
    else other += n;
  }
  chips.sort((a, b) => b.n - a.n || order(a.chipId) - order(b.chipId));
  return { chips, other, players };
}

// ---------------------------------------------------------------------------------------------
// Votes: tallies, mood, majority and the tie rule

export type Mood = 'united' | 'mostly' | 'split';
export const MOOD_LABEL: Record<Mood, string> = { united: 'United', mostly: 'Mostly agree', split: 'Split' };

export interface ChoiceCount {
  choiceId: string;
  n: number;
}

/** Counts per choice, in authored order, zeros included. Unknown choice ids are ignored. */
export function tallyVotes(choiceIds: readonly string[], votes: Iterable<string>): ChoiceCount[] {
  const counts = new Map(choiceIds.map((id) => [id, 0]));
  for (const v of votes) {
    const n = counts.get(v);
    if (n !== undefined) counts.set(v, n + 1);
  }
  return choiceIds.map((choiceId) => ({ choiceId, n: counts.get(choiceId) ?? 0 }));
}

export const totalVotes = (counts: readonly ChoiceCount[]): number => counts.reduce((s, c) => s + c.n, 0);

/** United = everyone on one Exit; Mostly = the top Exit has at least two thirds; otherwise Split. null = no votes. */
export function moodFor(counts: readonly ChoiceCount[]): Mood | null {
  const total = totalVotes(counts);
  if (total === 0) return null;
  const top = Math.max(...counts.map((c) => c.n));
  if (top === total) return 'united';
  return top * 3 >= total * 2 ? 'mostly' : 'split';
}

/** Plurality winner, or the tied top choices (in authored order) when there is no single winner. */
export function majorityOf(counts: readonly ChoiceCount[]): { winner: string | null; tied: string[] } {
  const top = Math.max(0, ...counts.map((c) => c.n));
  if (top === 0) return { winner: null, tied: [] };
  const tied = counts.filter((c) => c.n === top).map((c) => c.choiceId);
  return tied.length === 1 ? { winner: tied[0] ?? null, tied: [] } : { winner: null, tied };
}

export const SAFETY_RANK: Record<Safety, number> = { risky: 0, unsure: 1, safe: 2 };

export type Shift = 'safer' | 'riskier' | 'same';
export function shiftBetween(first: Safety, final: Safety): Shift {
  const d = SAFETY_RANK[final] - SAFETY_RANK[first];
  return d > 0 ? 'safer' : d < 0 ? 'riskier' : 'same';
}

/** The safest of some choices (first in the given order on equal safety). */
export function safestChoice(choiceIds: readonly string[], safetyOf: (id: string) => Safety): string | null {
  let best: string | null = null;
  for (const id of choiceIds) {
    if (best === null || SAFETY_RANK[safetyOf(id)] > SAFETY_RANK[safetyOf(best)]) best = id;
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Seeded randomness (Steelman cards are dealt by seeded RNG, independent of votes)

/** FNV-1a over the joined parts: a stable 32-bit seed. */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small, fast, deterministic PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Picks the seat that receives a Steelman card. Only the session seed, the mission, the squad and a deal
 * counter feed the RNG: votes are never consulted. `seatIds` must be in seat order.
 */
export function pickSteelmanSeat(
  sessionSeed: string,
  missionIndex: number,
  squadId: string,
  deal: number,
  seatIds: readonly string[],
): string | null {
  if (seatIds.length === 0) return null;
  const rand = mulberry32(hashSeed(sessionSeed, missionIndex, squadId, 'steelman', deal));
  return seatIds[Math.floor(rand() * seatIds.length)] ?? null;
}

/**
 * The Exit the Steelman card argues for ("Make the best case for B"): the least-picked Exit that someone
 * still picked and that is not the leader. On a top tie, the second tied Exit. null when nobody is split.
 */
export function steelmanTarget(counts: readonly ChoiceCount[]): string | null {
  const picked = counts.filter((c) => c.n > 0);
  if (picked.length < 2) return null;
  const top = Math.max(...picked.map((c) => c.n));
  const minority = picked.filter((c) => c.n < top).sort((a, b) => a.n - b.n);
  if (minority[0]) return minority[0].choiceId;
  return picked[1]?.choiceId ?? null;
}

// ---------------------------------------------------------------------------------------------
// Hold latency (bucketed before anything is stored; the seat is never stored)

export const HOLD_BUCKETS = ['0-5', '5-15', '15-30', '30+', 'late'] as const;
export type HoldBucket = (typeof HOLD_BUCKETS)[number];

/** Seconds into Live -> bucket. No hold, or a hold at/after the decision second, is 'late'. */
export function holdBucket(atSec: number | null, liveDurationSec: number): HoldBucket {
  if (atSec === null || !Number.isFinite(atSec) || atSec >= liveDurationSec) return 'late';
  if (atSec < 5) return '0-5';
  if (atSec < 15) return '5-15';
  if (atSec < 30) return '15-30';
  return '30+';
}

export const emptyHoldBuckets = (): Record<HoldBucket, number> => ({ '0-5': 0, '5-15': 0, '15-30': 0, '30+': 0, late: 0 });

/** Room-level numbers are shown to the Conductor only once at least this many responses exist. */
export const ROOM_MIN_N = 5;
/**
 * ...and only once this many squads have decided, so room-level counts can never be one squad's split in
 * disguise (the Conductor sees each squad's agreement only as United / Mostly / Split, GDD §11.12).
 */
export const ROOM_MIN_SQUADS = 2;

// ---------------------------------------------------------------------------------------------
// Squad Dash: a short, optional team quiz the Conductor runs between missions (or as a warm-up).
// Questions come from the chance bank (content/chance.ts). Each squad answers as one: every player taps,
// the squad's pick is its majority, and only squads are ever scored. Nobody sees who tapped what.

/** Round lengths the Conductor can choose. */
export const DASH_LENGTHS = [4, 6, 8] as const;
export type DashLength = (typeof DASH_LENGTHS)[number];

/** question: players tap · reveal: answer + why · results: squad totals and a closing tip. */
export const DASH_STAGES = ['question', 'reveal', 'results'] as const;
export type DashStage = (typeof DASH_STAGES)[number];

/** Once every active player has tapped, the question reveals after this many seconds (not in Calm Mode). */
export const DASH_ALL_IN_SEC = 5;

/**
 * Seconds to answer one question: a soft clock, longer for the junior band and with Relaxed timing.
 * In Calm Mode there is no clock at all (the Conductor reveals when the room is ready).
 */
export function dashQuestionSec(input: { band: BandId; relaxed?: boolean }): number {
  const base = input.band === 'junior' ? 30 : 20;
  return Math.round(base * (input.relaxed ? 1.5 : 1));
}

/**
 * The squad's pick for a question: the option most of its players tapped. A tie for the top is a split
 * (no pick, so it does not score), and so is a question nobody answered.
 */
export function dashSquadPick(counts: readonly ChoiceCount[]): string | null {
  return majorityOf(counts).winner;
}

export interface DashResult {
  /** The squad's majority pick, or null for a split (tied top) or no taps. */
  pick: string | null;
  correct: boolean;
  /** Players tapped, but the top options were tied. */
  split: boolean;
  /** Players who tapped (a count only). */
  answered: number;
}

export interface DashScore {
  /** Questions this squad got right. */
  correct: number;
  /** Questions this squad was scored on. */
  played: number;
}

/** What every audience gets about a running Squad Dash. Times are server epoch ms. */
export interface DashBase {
  /** Changes for every new round (clients reset local state on a new id). */
  id: string;
  /** Questions in this round (fewer than chosen only if a band runs short). */
  length: number;
  /** Current question, 0-based (on the results card: the number of questions played). */
  index: number;
  stage: DashStage;
  /** The current question id (look it up with chanceById), or null on the results card. */
  questionId: string | null;
  stageStartedAt: number;
  /** Soft countdown for the question; null in Calm Mode, after the question and while paused. */
  endsAt: number | null;
  /** No countdown visuals (Calm or Gentle mode). */
  quiet: boolean;
  /** On reveal: squads whose pick was right, out of the squads scored on this question. */
  room: { correct: number; squads: number } | null;
  /** Running room total: right squad picks out of squad picks scored so far. */
  totals: { correct: number; played: number };
}

export interface SeatDashView extends DashBase {
  /** This squad's taps per option (counts only, never who); null on the results card. */
  tally: { counts: ChoiceCount[]; answered: number; total: number } | null;
  /** This phone's own taps per player. optionId is omitted on shared (pass-and-play) phones. */
  mine: { player: number; optionId?: string }[];
  /** On reveal: this squad's pick and whether it was right. */
  result: DashResult | null;
  score: DashScore;
}

export interface HostDashSquad {
  squadId: SquadTotemId;
  name: string;
  shape: string;
  /** Players who have tapped this question / players who can (counts only, never which option). */
  answered: number;
  total: number;
  /** On reveal: the squad's pick (squad-level only). */
  result: DashResult | null;
  score: DashScore;
}

export interface HostDashView extends DashBase {
  squads: HostDashSquad[];
  /** Every question scored or skipped so far, room level. */
  rounds: { questionId: string; skipped: boolean; correct: number; squads: number }[];
}

export interface ScreenDashSquad {
  squadId: SquadTotemId;
  name: string;
  shape: string;
  answered: number;
  total: number;
  score: DashScore;
}

export interface ScreenDashView extends DashBase {
  /** Fixed totem order, never ranked. */
  squads: ScreenDashSquad[];
}

// ---------------------------------------------------------------------------------------------
// Snapshot building blocks

export type Audience = 'host' | 'screen' | 'seat';

export interface MissionTimeline {
  missionId: string;
  index: number;
  /** Mission open: the Aftershock slot starts (equals roleFlipAt when there is no slot). */
  openedAt: number;
  roleFlipAt: number;
  /** t0 of the live moment: every phone and the Big Screen animate from here. */
  liveAt: number;
  /** The decision second: phones that have not held freeze automatically ("late", no penalty). */
  liveEndsAt: number;
  /** Freeze End: Investigate ends for every squad that has not finished early. */
  freezeEndAt: number;
  /** Pressure Surge time, or null when surges are off (junior band, Gentle mode). */
  surgeAt: number | null;
}

/** Public, room-level session state that every audience receives. Times are server epoch ms. */
export interface SessionPublic {
  code: string;
  band: BandId;
  phase: SessionPhase;
  missionIds: string[];
  /** Current (or most recent) mission index, null before the first mission. */
  missionIndex: number | null;
  /** The current mission has finished in every squad (Look Up time). */
  missionComplete: boolean;
  acceptingJoins: boolean;
  options: SessionOptions;
  /** Freeze All Phones / Look Up: timers stop while paused; deadlines shift on resume. */
  paused: boolean;
  pausedAt: number | null;
  timeline: MissionTimeline | null;
  roomFreeze: { active: boolean; done: boolean };
  joinPath: string;
  disclaimerRequired: true;
}

export interface SquadMember {
  seatId: string;
  pseudonym: string;
  seatIndex: number;
  role: SquadRoleId | null;
  shadow: boolean;
  connected: boolean;
  /** Readiness tick for the current phase (sealed, in Think and Re-seal). Never a choice. */
  done: boolean;
  /** Pass-and-play device: several players take turns on this seat. */
  players: number;
}

export interface EvidencePin {
  clueId: string;
  /** Role icons of whoever pinned it. Pins are never tagged with a seat or a pseudonym. */
  roles: SquadRoleId[];
  /** Pinned during the live moment ("first look") rather than after holding. */
  live: boolean;
}

export interface EvidenceBoard {
  pins: EvidencePin[];
  /** Clues marked "Seems fine" (the right call for red herrings). */
  cleared: EvidencePin[];
  /** Roles that pulled the String to the hidden beneficiary. */
  tracedRoles: SquadRoleId[];
  /** Squad LIVE vs HELD totals of genuine red flags (not a KPI). */
  liveFlags: number;
  heldFlags: number;
}

export type RevealView =
  | { kind: 'dots'; counts: ChoiceCount[]; total: number; mood: Mood | null }
  | { kind: 'mood'; mood: Mood | null; total: number };

export interface TieBreakView {
  /** The tied Exits the Safety Lead chooses between. */
  options: string[];
  endsAt: number;
}

export interface DecisionView {
  choiceId: string;
  /** "2 minds changed" — a count only. */
  mindsChanged: number;
  tieBreak: {
    options: string[];
    choiceId: string;
    because: BecauseTileId | null;
    /** 'timeout' = nobody chose in time, so the safest tied Exit was used. */
    by: 'safety-lead' | 'timeout';
  } | null;
}

export interface ShieldResultView {
  outcome: 'success' | 'partial' | 'fail';
  guard: number;
  doubt: number;
  score: number;
  /** Number of trap tiles in the sent message. */
  traps: number;
}

export interface ShieldView {
  /** Slots in play for this band. */
  slots: ShieldSlot[];
  /** Which roles hold each slot's tiles. */
  owners: Partial<Record<ShieldSlot, SquadRoleId[]>>;
  picks: Partial<Record<ShieldSlot, string>>;
  /** Live GUARD / DOUBT meters for the current picks (0-100). */
  guard: number;
  doubt: number;
  result: ShieldResultView | null;
  attempts: number;
  /** One retry is allowed after a message with a trap tile (practice, not penalty). */
  canRetry: boolean;
}

export interface BondView {
  /** Letters the squad demonstrated this mission. */
  letters: SkillId[];
  /** Guardians that unfolded for the squad this mission. */
  newlyBonded: GuardianId[];
}

/** A delayed consequence delivered to a squad. Clients look up the content with findAftershock(). */
export interface AftershockDelivery {
  /** `${missionId}:${aftershockId}` */
  key: string;
  missionId: string;
  choiceId: string;
  aftershockId: string;
  /** Delivered in the Long Fast-Forward at the end of the session. */
  finale: boolean;
  /** "3 of 5 forecasts matched" for the mission that planted it. */
  forecast: { matched: number; total: number };
}

/** "Meanwhile, in another timeline…": the risky branch a safe squad avoided, so every forecast can be checked. */
export interface ShadowCheck {
  missionId: string;
  choiceId: string;
  aftershockId: string;
}

export interface SquadMissionView {
  missionId: string;
  index: number;
  phase: SquadMissionPhase;
  phaseStartedAt: number;
  phaseEndsAt: number;
  /** Bond finished; waiting for the Conductor to open the next mission. */
  complete: boolean;
  /** SEAL is locked until this time in Think. */
  sealLockUntil: number | null;
  aftershocks: AftershockDelivery[];
  shadow: ShadowCheck | null;
  /** Seats that pressed HOLD this mission (count only). */
  holding: number;
  board: EvidenceBoard;
  /** Sealed count for the current round ("4 of 5 sealed"). */
  sealed: { count: number; total: number };
  reveal: RevealView | null;
  chips: ChipBoard | null;
  tie: TieBreakView | null;
  decision: DecisionView | null;
  shield: ShieldView | null;
  bond: BondView | null;
  surgeAt: number | null;
  guardiansUsed: GuardianId[];
  explainExtended: boolean;
  echoUsed: boolean;
  /** The Safety Lead tapped Share, so the Conductor may Spotlight this squad. */
  shared: boolean;
}

export interface SquadCity {
  /** In-fiction S$ for the squad's city. (The `lumen` field name is kept for saved-session compatibility.) */
  wallet: number;
  /** Per-district Trust Meter, -3..+3. */
  trust: Partial<Record<DistrictId, number>>;
}

export interface SquadView {
  id: SquadTotemId;
  name: string;
  shape: string;
  /** Gentle mode for this squad (no surges, no countdown visuals), set by the Conductor. */
  gentle: boolean;
  members: SquadMember[];
  /** Guardians the squad has bonded this session (shared credit). */
  guardians: GuardianId[];
  lumen: SquadCity;
  /** The squad's decided Exit per finished mission (for Ripple Trace and later scenes). */
  decisions: { missionId: string; choiceId: string }[];
  mission: SquadMissionView | null;
  /** Long Fast-Forward deliveries (debrief only). */
  finale: AftershockDelivery[];
}

export interface PlayerVoteState {
  player: number;
  /** choiceId is omitted on shared (pass-and-play) seats so the next player cannot see it. */
  round1: { choiceId?: string; confidence?: 1 | 2 | 3 } | null;
  round2: { choiceId?: string } | null;
  forecast: boolean;
  trace: boolean;
  reasons: ReasonChipId[];
}

export interface SeatPrivate {
  seatId: string;
  pseudonym: string;
  squadId: SquadTotemId;
  seatIndex: number;
  players: number;
  role: RoleAssignment | null;
  /** Peer Shield slots whose tiles this seat holds. */
  shieldSlots: ShieldSlot[];
  held: boolean;
  pins: string[];
  cleared: string[];
  votes: PlayerVoteState[];
  /** Steelman card dealt to this seat ("Make the best case for …"). Pass is always available. */
  steelman: { choiceId: string } | null;
  /** This seat must break the current tie. */
  tieBreaker: boolean;
  /** This seat may tap SEND in Peer Shield. */
  canSendShield: boolean;
  /** This seat may tap Share (Spotlight) — the Safety Lead. */
  canShare: boolean;
  ready: boolean;
  onBreak: boolean;
  needHelp: boolean;
  /** Late Hold picks already sent, by aftershock key (counts only reach the server's aggregate). */
  lateHolds: string[];
}

export interface SnapshotBase {
  protocol: typeof PROTOCOL_VERSION;
  /** Session state version: ignore any snapshot older than the one you have. */
  v: number;
  /** Server clock when this snapshot was sent: offset = serverNow - Date.now() (refine with clockPing). */
  serverNow: number;
}

export interface SeatSnapshot extends SnapshotBase {
  kind: 'seat';
  session: SessionPublic;
  squad: SquadView;
  me: SeatPrivate;
  debrief: DebriefView | null;
  /** A running Squad Dash (absent from older servers). */
  dash?: SeatDashView | null;
}

export interface HostSeat {
  seatId: string;
  pseudonym: string;
  connected: boolean;
  role: SquadRoleId | null;
  shadow: boolean;
  players: number;
  /** Disconnected for this long (ms), or 0. Lets the Conductor tidy up abandoned seats. */
  awayMs: number;
}

export interface HostSquad {
  id: SquadTotemId;
  name: string;
  shape: string;
  seats: HostSeat[];
  connected: number;
  phase: SquadMissionPhase | null;
  phaseEndsAt: number | null;
  complete: boolean;
  letter: SkillId | null;
  sealed: { count: number; total: number };
  pins: number;
  guardians: GuardianId[];
  /** United / Mostly agree / Split — never the counts (GDD §11.12). */
  agreement: Mood | null;
  /** Anonymous "needs help" flags from this squad. */
  needHelp: number;
  /** Anonymous number of players on Pause. */
  onBreak: number;
  decided: boolean;
  tiePending: boolean;
  shared: boolean;
  gentle: boolean;
}

export interface RoomVotes {
  missionId: string;
  /**
   * Room-level counts across all decided squads; null until at least ROOM_MIN_N votes from at least
   * ROOM_MIN_SQUADS squads exist (a one-squad room never shows counts, only agreement).
   */
  first: ChoiceCount[] | null;
  final: ChoiceCount[] | null;
  firstTotal: number;
  finalTotal: number;
}

export interface RoomPositive {
  /** City Pulse: only ever increases. */
  lanterns: number;
  holdsMade: number;
  mindsChangedSafer: number;
  roomFreeze: { amount: number; peak: number };
}

export interface HostSnapshot extends SnapshotBase {
  kind: 'host';
  session: SessionPublic & { hostPath: string; screenPath: string };
  config: SessionConfig;
  squads: HostSquad[];
  room: RoomPositive & {
    seats: number;
    connected: number;
    needHelp: number;
    onBreak: number;
    holdBuckets: Record<HoldBucket, number>;
    votes: RoomVotes | null;
    /** "I see it differently" signals during the debrief. */
    seeDifferently: number;
  };
  spotlight: SquadTotemId | null;
  debrief: DebriefView | null;
  dash?: HostDashView | null;
}

export interface ScreenSquad {
  id: SquadTotemId;
  name: string;
  shape: string;
  connected: number;
  phase: SquadMissionPhase | null;
  phaseEndsAt: number | null;
  complete: boolean;
  /** "Hornbill 3/5 holding": the lantern frosts one segment per hold. */
  holding: number;
  sealed: { count: number; total: number };
  /** Lantern beam: "Hornbill decided". The choice is never sent to the screen. */
  decided: boolean;
  guardians: GuardianId[];
  /** Open projector mode only (null when Discreet): Trust for the current mission's district. */
  trust: number | null;
}

export interface SpotlightView {
  squadId: SquadTotemId;
  name: string;
  shape: string;
  board: EvidenceBoard;
  /** The assembled Peer Shield message (tile ids) and the friend's reaction, when sent. */
  shield: { picks: Partial<Record<ShieldSlot, string>>; outcome: ShieldResultView['outcome'] | null } | null;
}

export interface ScreenSnapshot extends SnapshotBase {
  kind: 'screen';
  session: SessionPublic;
  squads: ScreenSquad[];
  room: RoomPositive;
  spotlight: SpotlightView | null;
  debrief: DebriefView | null;
  dash?: ScreenDashView | null;
}

export interface ShieldLine {
  tiles: Partial<Record<ShieldSlot, string>>;
  outcome: ShieldResultView['outcome'];
  squads: number;
}

/** Room-level debrief numbers (positive trends and totals only). */
export interface DebriefView {
  missions: {
    missionId: string;
    squads: number;
    holdsMade: number;
    liveFlags: number;
    heldFlags: number;
    mindsChangedSafer: number;
    forecastLikely: number;
    forecastTotal: number;
    /** Squads that pinned each clue (clue heatmap; the most-missed clue is the lowest). */
    clueFinds: Record<string, number>;
    /** Shield Lines Wall: the room's most-built messages and how the friend reacted. */
    shieldLines: ShieldLine[];
  }[];
  lanterns: number;
  roomFreezePeak: number;
}

export type Snapshot = SeatSnapshot | HostSnapshot | ScreenSnapshot;

// ---------------------------------------------------------------------------------------------
// Socket.IO events

export type ErrorCode =
  | 'bad-request'
  | 'not-found'
  | 'unauthorized'
  | 'forbidden'
  | 'joins-locked'
  | 'session-full'
  | 'squad-full'
  | 'seat-taken'
  | 'wrong-phase'
  | 'locked'
  | 'already-sealed'
  | 'unknown-choice'
  | 'not-your-slot'
  | 'not-tie-breaker'
  | 'used'
  | 'not-bonded'
  | 'paused'
  | 'rate-limited'
  | 'ended'
  | 'busy'
  | 'internal';

export type AckResult = { ok: true; dup?: boolean } | { ok: false; error: ErrorCode };
export type AckFn = (res: AckResult) => void;
export type SyncResult = { ok: true; snapshot: Snapshot } | { ok: false; error: ErrorCode };

/** Socket.IO handshake `auth`. Connection errors arrive as connect_error with err.message = ErrorCode. */
export type HandshakeAuth =
  | { role: 'host'; code: string; hostKey: string }
  | { role: 'screen'; code: string }
  | {
      role: 'seat';
      code: string;
      seatToken: string;
      /** The table's totem (tent card /j/CODE/hornbill). Ignored if that squad is full or not in play. */
      squad?: SquadTotemId;
      /** Reclaim Seat: take over a seat that has been disconnected for a while. */
      reclaimSeatId?: string;
    }
  /** Network check from the Conductor's pre-flight: connects without a session and reports the transport. */
  | { role: 'probe' };

export type EmptyPayload = Record<string, never>;

/** Several players on one pass-and-play device are numbered 0..players-1. Omit for a normal seat. */
export interface PlayerRef {
  player?: number;
}

export interface HoldPayload {
  missionId: string;
  /** Seconds into Live when this device held. Only the latency bucket is kept. */
  atSec: number;
}

export interface PinPayload {
  clueId: string;
  /** Pinned while the moment was still live (first look). */
  live: boolean;
  /** "Seems fine" instead of PIN (the right call for red herrings). */
  fine?: boolean;
}

export interface SealPayload extends PlayerRef {
  /** Client-generated id; re-sending the same voteId is acknowledged with dup: true. */
  voteId: string;
  round: 1 | 2;
  choiceId: string;
  /** Shield count on the first seal: 1 Unsure, 2 Fairly sure, 3 Certain. */
  confidence?: 1 | 2 | 3;
}

export type GuardianEvent =
  | { guardian: 'shieldfin'; byRole: SquadRoleId | null; order: number[]; delayMs: number }
  | { guardian: 'cluepaw'; byRole: SquadRoleId | null; clueId: string | null }
  | { guardian: 'echo'; byRole: SquadRoleId | null; addedSec: number }
  | { guardian: 'verifox' | 'beacon' | 'bytebuddy'; byRole: SquadRoleId | null };

export interface SurgeEvent {
  squadId: SquadTotemId;
  missionId: string;
  at: number;
}

export interface SteelmanEvent {
  missionId: string;
  choiceId: string;
}

export type Notice =
  | { kind: 'moved'; squadId: SquadTotemId }
  | { kind: 'seat-reclaimed' }
  | { kind: 'seat-removed' }
  | { kind: 'session-ended' };

/** Commands from the Conductor console (`command` event). */
export type HostCommand =
  | { type: 'startRoomFreeze' }
  | { type: 'endRoomFreeze' }
  | { type: 'startMission'; index: number }
  /** Advance squads to their next phase now (all squads, or one). Room-synced phases move the whole room. */
  | { type: 'next'; squadId?: SquadTotemId }
  /** Jump forward to a phase (never backwards: votes are already dropped). */
  | { type: 'setPhase'; phase: SquadMissionPhase; squadId?: SquadTotemId }
  /** +30 s (or `sec`) on the current phase deadline. */
  | { type: 'extend'; squadId?: SquadTotemId; sec?: number }
  /** Skip scenario: end the current mission now (for sensitive content). */
  | { type: 'endMission' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'setOption'; key: SessionOptionKey; value: boolean }
  /** Gentle mode for one squad: no surges, no countdown visuals. */
  | { type: 'squadGentle'; squadId: SquadTotemId; on: boolean }
  | { type: 'lockJoins'; locked: boolean }
  | { type: 'moveSeat'; seatId: string; squadId: SquadTotemId }
  | { type: 'setSeatPlayers'; seatId: string; players: number }
  /** Remove a seat that is disconnected (e.g. a phone that left for good). */
  | { type: 'removeSeat'; seatId: string }
  | { type: 'addSquad' }
  /** Even out squad sizes (lobby only). */
  | { type: 'balanceSquads' }
  | { type: 'clearHelp'; squadId?: SquadTotemId }
  /** Put a squad's Evidence Board on the Big Screen (only after its Safety Lead tapped Share), or null to clear. */
  | { type: 'spotlight'; squadId: SquadTotemId | null }
  /** First call: Long Fast-Forward + debrief. Second call (in debrief): end and close the session. */
  | { type: 'endSession' }
  /**
   * Squad Dash (only while no mission is running: in the lobby or at Look Up). Starting a mission, the Room
   * Freeze or the debrief closes an open Dash first. While a Dash is open, `next` does what dashNext does.
   */
  | { type: 'dashStart'; questions: DashLength }
  /** Question -> reveal now; reveal -> next question (or the results card); results -> close the Dash. */
  | { type: 'dashNext' }
  /** Drop the current question unscored and move on. */
  | { type: 'dashSkip' }
  /** Straight to the results card (the current question is dropped unless revealed); on the results card, close. */
  | { type: 'dashEnd' };

export interface ClientToServerEvents {
  /** Full snapshot for this socket's audience (e.g. on visibilitychange). */
  sync: (p: EmptyPayload, ack: (res: SyncResult) => void) => void;
  clockPing: (p: { c: number }, ack: (res: { c: number; s: number }) => void) => void;
  // Seat events
  hold: (p: HoldPayload, ack: AckFn) => void;
  pin: (p: PinPayload, ack: AckFn) => void;
  unpin: (p: { clueId: string }, ack: AckFn) => void;
  trace: (p: { optionId: string } & PlayerRef, ack: AckFn) => void;
  forecast: (p: { optionId: string } & PlayerRef, ack: AckFn) => void;
  seal: (p: SealPayload, ack: AckFn) => void;
  reasons: (p: { chips: ReasonChipId[] } & PlayerRef, ack: AckFn) => void;
  tiebreak: (p: { choiceId: string; because: BecauseTileId }, ack: AckFn) => void;
  shieldTile: (p: { slot: ShieldSlot; tileId: string }, ack: AckFn) => void;
  shieldSend: (p: EmptyPayload, ack: AckFn) => void;
  shieldRetry: (p: EmptyPayload, ack: AckFn) => void;
  share: (p: { on: boolean }, ack: AckFn) => void;
  guardian: (p: { guardian: GuardianId }, ack: AckFn) => void;
  extendExplain: (p: EmptyPayload, ack: AckFn) => void;
  ready: (p: { phase: SquadMissionPhase; on?: boolean }, ack: AckFn) => void;
  needHelp: (p: { on: boolean }, ack: AckFn) => void;
  takeBreak: (p: { on: boolean }, ack: AckFn) => void;
  roomHold: (p: { on: boolean }, ack: AckFn) => void;
  lateHold: (p: { key: string; optionId: string } & PlayerRef, ack: AckFn) => void;
  signal: (p: { kind: 'see-differently' }, ack: AckFn) => void;
  /** Squad Dash tap (changeable until the reveal). */
  dashAnswer: (p: { questionId: string; optionId: string } & PlayerRef, ack: AckFn) => void;
  // Conductor
  command: (cmd: HostCommand, ack: AckFn) => void;
}

export interface ServerToClientEvents {
  /** Sent on connect, on rejoin and whenever this audience's view changes. */
  snapshot: (s: Snapshot) => void;
  /** Room Freeze: share of connected seats holding right now (0..1). */
  roomFreeze: (p: { amount: number; peak: number }) => void;
  surge: (p: SurgeEvent) => void;
  guardian: (p: GuardianEvent) => void;
  steelman: (p: SteelmanEvent) => void;
  notice: (p: Notice) => void;
  probe: (p: { serverNow: number; transport: string }) => void;
}

export type InterServerEvents = Record<string, never>;

export interface SocketData {
  audience: Audience | 'probe';
  code: string;
  seatId: string | null;
  /** Seat epoch at connect; a seat reclaimed by another device turns away recovered old sockets. */
  epoch: number;
}

// ---------------------------------------------------------------------------------------------
// REST

/** POST /api/sessions */
export interface CreateSessionRequest {
  band: BandId;
  missionIds: string[];
  squadCount?: number;
  gentle?: boolean;
  discreet?: boolean;
  calm?: boolean;
  relaxed?: boolean;
  autoAdvance?: boolean;
}

export interface CreateSessionResponse {
  code: string;
  /** 128-bit secret for the Conductor. Returned once; the server keeps only its hash. */
  hostKey: string;
  joinPath: string;
  hostPath: string;
  screenPath: string;
}

/** GET /api/sessions/:code — public info, no counts that could identify anyone. */
export interface SessionInfoResponse {
  exists: boolean;
  band?: BandId;
  phase?: SessionPhase;
  acceptingJoins?: boolean;
  /** Squads in play (for the "tap your table's totem" step). */
  squads?: { id: SquadTotemId; name: string; shape: string }[];
}

/** GET /api/sessions/:code/open-seats — seats disconnected for a while that a new device may reclaim. */
export interface OpenSeatsResponse {
  seats: { seatId: string; pseudonym: string; squadId: SquadTotemId }[];
}

export interface ApiError {
  error: ErrorCode;
  message?: string;
}

// ---------------------------------------------------------------------------------------------
// Persisted analytics (collection 'session-aggregates'): counts only

export interface MissionAggregate {
  missionId: string;
  /** Squads that played this mission / finished it. */
  squads: number;
  squadsCompleted: number;
  holdBuckets: Record<HoldBucket, number>;
  /** Squad sums of genuine red flags pinned live vs after holding. */
  liveFlags: number;
  heldFlags: number;
  /** Squads that pinned each clue. */
  clueFinds: Record<string, number>;
  traceCorrect: number;
  traceTotal: number;
  forecastLikely: number;
  forecastTotal: number;
  forecastCounts: Record<string, number>;
  firstCounts: Record<string, number>;
  finalCounts: Record<string, number>;
  /** Confidence on first seals: [Unsure, Fairly sure, Certain]. */
  confidenceHist: [number, number, number];
  firstTotal: number;
  firstSafe: number;
  finalTotal: number;
  finalSafe: number;
  shiftedSafer: number;
  shiftedRiskier: number;
  unchanged: number;
  /** Squads deciding each Exit. */
  decisions: Record<string, number>;
  tieBreaks: number;
  reasonChipCounts: Partial<Record<ReasonChipId, number>>;
  shieldOutcomes: { success: number; partial: number; fail: number; none: number };
  trapTiles: number;
  shieldLines: ShieldLine[];
  lettersEarned: Partial<Record<SkillId, number>>;
  guardiansBonded: Partial<Record<GuardianId, number>>;
  helpRequests: number;
}

export interface SessionAggregate {
  /** Random id, unrelated to the room code. */
  id: string;
  /** ISO time rounded down to the hour. */
  createdAt: string;
  band: BandId;
  missionIds: string[];
  seatsTotal: number;
  squadsTotal: number;
  missionsCompleted: number;
  perMission: MissionAggregate[];
  lateHold: { good: number; total: number };
  aftershocksDelivered: number;
  roomFreezePeak: number;
  lanterns: number;
  /** True once the session ended normally (false while in progress or after an idle expiry). */
  complete: boolean;
  /** Squad Dash counts (squad level only; absent when no Dash was played). */
  dash?: DashAggregate;
}

export interface DashAggregate {
  /** Squad Dash rounds opened. */
  rounds: number;
  /** Questions revealed (skipped ones are not counted). */
  questions: number;
  /** Squad picks scored (squads x questions) and how many were right. */
  squadAnswers: number;
  squadCorrect: number;
  /** Squad picks that were a split (tied top) and squads with no taps. */
  splits: number;
  none: number;
  /** Per question id: squads scored and squads right. */
  byQuestion: Record<string, { squads: number; correct: number }>;
}

export const emptyDashAggregate = (): DashAggregate => ({
  rounds: 0,
  questions: 0,
  squadAnswers: 0,
  squadCorrect: 0,
  splits: 0,
  none: 0,
  byQuestion: {},
});

export function emptyMissionAggregate(missionId: string): MissionAggregate {
  return {
    missionId,
    squads: 0,
    squadsCompleted: 0,
    holdBuckets: emptyHoldBuckets(),
    liveFlags: 0,
    heldFlags: 0,
    clueFinds: {},
    traceCorrect: 0,
    traceTotal: 0,
    forecastLikely: 0,
    forecastTotal: 0,
    forecastCounts: {},
    firstCounts: {},
    finalCounts: {},
    confidenceHist: [0, 0, 0],
    firstTotal: 0,
    firstSafe: 0,
    finalTotal: 0,
    finalSafe: 0,
    shiftedSafer: 0,
    shiftedRiskier: 0,
    unchanged: 0,
    decisions: {},
    tieBreaks: 0,
    reasonChipCounts: {},
    shieldOutcomes: { success: 0, partial: 0, fail: 0, none: 0 },
    trapTiles: 0,
    shieldLines: [],
    lettersEarned: {},
    guardiansBonded: {},
    helpRequests: 0,
  };
}
