// Rewards, the City Board and daily play. Pure functions only: the web store (apps/web/src/state/rewards.ts)
// persists RewardsState on the device and calls these, and the tests pin the rules down.
//
// Design guardrails (proposal safeguards + PDPA):
// - Stars are earned by playing, never bought. There is no real money anywhere and no paid randomness.
// - Cosmetics have fixed prices. No loot boxes, no mystery packs.
// - Nothing here is ranked against other players. Personal disclosures never earn points.
// - The player handle is generated from fixed word lists, so it can never contain a real name.

import type { DistrictId } from './framework';
import type { Choice } from './mission';

// ---------------------------------------------------------------------------------------------
// Days and streaks (Singapore time, so "today" flips at local midnight for every pilot school)
// ---------------------------------------------------------------------------------------------

const SGT_OFFSET_MS = 8 * 3_600_000;

/** 'YYYY-MM-DD' in Singapore time. */
export function dayKey(ts: number): string {
  return new Date(ts + SGT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Whole days between two day keys (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

// ---------------------------------------------------------------------------------------------
// Mini-games
// ---------------------------------------------------------------------------------------------

export type MiniGameId = 'wordsearch' | 'real-or-fake' | 'money-trail';

export interface MiniGameInfo {
  id: MiniGameId;
  name: string;
  /** One line shown on the board tile and in the Arcade. */
  pitch: string;
  /** The SHIELD skill the game practises. */
  skill: 'S' | 'H' | 'I' | 'E' | 'L' | 'D';
}

export const MINI_GAMES: readonly MiniGameInfo[] = [
  { id: 'wordsearch', name: 'Red-Flag Wordsearch', pitch: 'Find the scam words hiding in the message.', skill: 'S' },
  { id: 'real-or-fake', name: 'Real or Fake?', pitch: 'Swipe: real offer or scam? Trust your checks.', skill: 'I' },
  { id: 'money-trail', name: 'Money Trail', pitch: 'Follow the "easy money" and see where it really goes.', skill: 'E' },
];

export const miniGameById = (id: MiniGameId): MiniGameInfo => MINI_GAMES.find((g) => g.id === id)!;

/** A mini-game reports a 0..1 accuracy score. At or above this, a board tile is claimed. */
export const CLAIM_SCORE = 0.7;

/** The mini-game of the day earns double Stars. Rotates through the list by date. */
export function dailyMiniGame(day: string): MiniGameId {
  const n = Math.abs(daysBetween('2026-01-01', day));
  return MINI_GAMES[n % MINI_GAMES.length]!.id;
}

// ---------------------------------------------------------------------------------------------
// The City Board: a ring of 21 tiles around the three launch districts (Monopoly-style)
// ---------------------------------------------------------------------------------------------

export type TileKind = 'hq' | 'mission' | 'minigame' | 'chance' | 'bonus';

export interface BoardTile {
  id: string;
  kind: TileKind;
  /** Null for the corner tiles. */
  district: DistrictId | null;
  label: string;
  minigame?: MiniGameId;
}

export const BOARD_DISTRICTS = ['school-street', 'retail-district', 'digi-district'] as const satisfies readonly DistrictId[];
export type BoardDistrictId = (typeof BOARD_DISTRICTS)[number];

const SIDE_PATTERN: { kind: TileKind; minigame?: MiniGameId; label: string }[] = [
  { kind: 'minigame', minigame: 'wordsearch', label: 'Wordsearch' },
  { kind: 'mission', label: 'Mission' },
  { kind: 'chance', label: 'Signal Check' },
  { kind: 'minigame', minigame: 'real-or-fake', label: 'Real or Fake?' },
  { kind: 'mission', label: 'Mission' },
  { kind: 'minigame', minigame: 'money-trail', label: 'Money Trail' },
];

const CORNERS: Record<number, BoardTile> = {
  0: { id: 'hq', kind: 'hq', district: null, label: 'ShieldQuest HQ' },
  7: { id: 'hawker-break', kind: 'bonus', district: null, label: 'Hawker Break' },
  14: { id: 'pop-quiz', kind: 'chance', district: null, label: 'Pop Quiz' },
};

function buildBoard(): BoardTile[] {
  const tiles: BoardTile[] = [];
  let side = 0;
  for (let i = 0; i < 21; i++) {
    const corner = CORNERS[i];
    if (corner) {
      tiles.push(corner);
      continue;
    }
    const district = BOARD_DISTRICTS[Math.floor(side / SIDE_PATTERN.length)]!;
    const slot = SIDE_PATTERN[side % SIDE_PATTERN.length]!;
    tiles.push({ id: `${district}-${side % SIDE_PATTERN.length}`, district, ...slot });
    side++;
  }
  return tiles;
}

/** Index 0 is HQ. Order: HQ, School Street ×6, Hawker Break, Retail District ×6, Pop Quiz, Digi-District ×6. */
export const BOARD: readonly BoardTile[] = buildBoard();

export const tileById = (id: string): BoardTile | undefined => BOARD.find((t) => t.id === id);

/** Tiles that can be claimed (everything inside a district). */
export const districtTiles = (d: DistrictId): BoardTile[] => BOARD.filter((t) => t.district === d);

// ---------------------------------------------------------------------------------------------
// Stars
// ---------------------------------------------------------------------------------------------

export const STARS = {
  passHq: 10,
  bonusTile: 15,
  chanceCorrect: 10,
  missionFirst: 20,
  missionSaferBonus: 10,
  missionReplay: 5,
  /** Mini-game Stars = round(score * this), doubled for the game of the day. */
  miniGameMax: 20,
  claimTile: 10,
  secureDistrict: 50,
  /** Streak bonus on the first finished challenge of a day: per streak day, capped at 7 days. */
  streakPerDay: 5,
  shard: 3,
} as const;

/** Free rolls topped up each new day; rolls earned by play are capped. */
export const DAILY_ROLLS = 3;
export const MAX_ROLLS = 9;

export function miniGameStars(score: number, isDaily: boolean): number {
  const base = Math.round(Math.max(0, Math.min(1, score)) * STARS.miniGameMax);
  return isDaily ? base * 2 : base;
}

export function missionStars(firstTime: boolean, safety: Choice['safety']): number {
  if (!firstTime) return STARS.missionReplay;
  return STARS.missionFirst + (safety === 'safe' ? STARS.missionSaferBonus : 0);
}

// ---------------------------------------------------------------------------------------------
// Cosmetics (fixed prices) and badges
// ---------------------------------------------------------------------------------------------

export type CosmeticSlot = 'token' | 'color' | 'title';

export interface Cosmetic {
  id: string;
  slot: CosmeticSlot;
  name: string;
  /** Stars to unlock. 0 = owned from the start. Ignored when `badge` is set. */
  price: number;
  /** Unlocked by earning this badge instead of buying. */
  badge?: BadgeId;
}

export const COSMETICS: readonly Cosmetic[] = [
  { id: 'token-shield', slot: 'token', name: 'Shield', price: 0 },
  { id: 'token-crane', slot: 'token', name: 'Paper Crane', price: 40 },
  { id: 'token-otter', slot: 'token', name: 'Otter', price: 60 },
  { id: 'token-kopi', slot: 'token', name: 'Kopi Cup', price: 60 },
  { id: 'token-hornbill', slot: 'token', name: 'Hornbill', price: 90 },
  { id: 'token-train', slot: 'token', name: 'MRT Train', price: 120 },
  { id: 'token-durian', slot: 'token', name: 'Durian', price: 150 },
  { id: 'token-lantern', slot: 'token', name: 'Lantern', price: 0, badge: 'city-secured' },

  { id: 'color-teal', slot: 'color', name: 'Teal', price: 0 },
  { id: 'color-coral', slot: 'color', name: 'Coral', price: 25 },
  { id: 'color-violet', slot: 'color', name: 'Violet', price: 25 },
  { id: 'color-sunny', slot: 'color', name: 'Sunny', price: 25 },
  { id: 'color-night', slot: 'color', name: 'Night Sky', price: 50 },
  { id: 'color-gold', slot: 'color', name: 'Gold', price: 0, badge: 'streak-7' },

  { id: 'title-rookie', slot: 'title', name: 'Rookie Shield', price: 0 },
  { id: 'title-spotter', slot: 'title', name: 'Red-Flag Spotter', price: 0, badge: 'wordsearch-ace' },
  { id: 'title-checker', slot: 'title', name: 'Fact Checker', price: 0, badge: 'fake-spotter' },
  { id: 'title-tracer', slot: 'title', name: 'Money Tracer', price: 0, badge: 'trail-tracer' },
  { id: 'title-steady', slot: 'title', name: 'Steady Hand', price: 80 },
  { id: 'title-guardian', slot: 'title', name: 'City Guardian', price: 0, badge: 'city-secured' },
];

export const cosmeticById = (id: string): Cosmetic | undefined => COSMETICS.find((c) => c.id === id);

export type BadgeId =
  | 'first-roll'
  | 'first-claim'
  | 'secured-school-street'
  | 'secured-retail-district'
  | 'secured-digi-district'
  | 'city-secured'
  | 'streak-3'
  | 'streak-7'
  | 'wordsearch-ace'
  | 'fake-spotter'
  | 'trail-tracer'
  | 'shard-hunter';

export interface BadgeInfo {
  id: BadgeId;
  name: string;
  how: string;
}

export const BADGES: readonly BadgeInfo[] = [
  { id: 'first-roll', name: 'First Roll', how: 'Roll the dice on the City Board.' },
  { id: 'first-claim', name: 'Claimed!', how: 'Claim your first board tile.' },
  { id: 'secured-school-street', name: 'School Street Secured', how: 'Claim every tile on School Street.' },
  { id: 'secured-retail-district', name: 'Retail Secured', how: 'Claim every tile in the Retail District.' },
  { id: 'secured-digi-district', name: 'Digi Secured', how: 'Claim every tile in the Digi-District.' },
  { id: 'city-secured', name: 'City Secured', how: 'Secure all three districts.' },
  { id: 'streak-3', name: '3-Day Streak', how: 'Play on 3 days in a row.' },
  { id: 'streak-7', name: '7-Day Streak', how: 'Play on 7 days in a row.' },
  { id: 'wordsearch-ace', name: 'Wordsearch Ace', how: 'Score 100% in Red-Flag Wordsearch.' },
  { id: 'fake-spotter', name: 'Fake Spotter', how: 'Call 25 Real-or-Fake cards correctly.' },
  { id: 'trail-tracer', name: 'Trail Tracer', how: 'Finish Money Trail 3 times.' },
  { id: 'shard-hunter', name: 'Shard Hunter', how: 'Find 10 Shield Shards while exploring.' },
];

// ---------------------------------------------------------------------------------------------
// Player handle (generated, never typed)
// ---------------------------------------------------------------------------------------------

const HANDLE_ADJ = ['Swift', 'Brave', 'Calm', 'Sharp', 'Bright', 'Steady', 'Clever', 'Quick', 'Bold', 'Keen', 'Sunny', 'Lucky'];
const HANDLE_NOUN = ['Crane', 'Otter', 'Hornbill', 'Kite', 'Lantern', 'Comet', 'Falcon', 'Tiger', 'Orca', 'Gecko', 'Panda', 'Star'];

export function generateHandle(rng: () => number = Math.random): string {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)]!;
  const num = String(Math.floor(rng() * 9000) + 1000);
  return `${pick(HANDLE_ADJ)}${pick(HANDLE_NOUN)}-${num}`;
}

// ---------------------------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------------------------

export interface RewardsState {
  version: 1;
  handle: string;
  stars: number;
  /** Lifetime Stars earned (never decreases; spending does not touch it). */
  starsEarned: number;
  rolls: number;
  /** Board position (index into BOARD). */
  position: number;
  /** The tile the player landed on and has not finished yet. */
  landed: string | null;
  claimed: string[];
  badges: BadgeId[];
  owned: string[];
  equipped: Record<CosmeticSlot, string>;
  /** Last day rolls were topped up. */
  rollsDay: string | null;
  /** Last day a challenge was finished, and the streak ending on that day. */
  lastPlayDay: string | null;
  streak: number;
  bestStreak: number;
  stats: { wordsearchPerfect: number; fakeCorrect: number; trailRuns: number; shards: number; miniGames: number };
  /** Shield Shards found today in Explore mode (resets daily). */
  shardsDay: string | null;
  shardsFound: string[];
}

export function emptyRewards(rng: () => number = Math.random): RewardsState {
  return {
    version: 1,
    handle: generateHandle(rng),
    stars: 0,
    starsEarned: 0,
    rolls: 0,
    position: 0,
    landed: null,
    claimed: [],
    badges: [],
    owned: COSMETICS.filter((c) => c.price === 0 && !c.badge).map((c) => c.id),
    equipped: { token: 'token-shield', color: 'color-teal', title: 'title-rookie' },
    rollsDay: null,
    lastPlayDay: null,
    streak: 0,
    bestStreak: 0,
    stats: { wordsearchPerfect: 0, fakeCorrect: 0, trailRuns: 0, shards: 0, miniGames: 0 },
    shardsDay: null,
    shardsFound: [],
  };
}

/** What changed, for toasts ("+20 Stars", "Badge: Claimed!"). */
export interface RewardEvent {
  stars: number;
  rolls: number;
  claimed: string | null;
  secured: DistrictId | null;
  badges: BadgeId[];
  passedHq: boolean;
  streakBonus: number;
}

const noEvent = (): RewardEvent => ({ stars: 0, rolls: 0, claimed: null, secured: null, badges: [], passedHq: false, streakBonus: 0 });

function addStars(s: RewardsState, e: RewardEvent, n: number): void {
  s.stars += n;
  s.starsEarned += n;
  e.stars += n;
}

function award(s: RewardsState, e: RewardEvent, b: BadgeId): void {
  if (s.badges.includes(b)) return;
  s.badges.push(b);
  e.badges.push(b);
  for (const c of COSMETICS) if (c.badge === b && !s.owned.includes(c.id)) s.owned.push(c.id);
}

const clone = (s: RewardsState): RewardsState => ({
  ...s,
  claimed: [...s.claimed],
  badges: [...s.badges],
  owned: [...s.owned],
  equipped: { ...s.equipped },
  stats: { ...s.stats },
  shardsFound: [...s.shardsFound],
});

/** Opening the board on a new day tops rolls up to DAILY_ROLLS (it never removes banked rolls). */
export function topUpDaily(prev: RewardsState, now: number): { state: RewardsState; added: number } {
  const today = dayKey(now);
  if (prev.rollsDay === today) return { state: prev, added: 0 };
  const s = clone(prev);
  const added = Math.max(0, DAILY_ROLLS - s.rolls);
  s.rolls += added;
  s.rollsDay = today;
  return { state: s, added };
}

/** Rolls one die and moves. Cannot roll while a landed tile is unfinished (skip it first). */
export function roll(
  prev: RewardsState,
  rng: () => number = Math.random,
): { state: RewardsState; die: number; path: number[]; event: RewardEvent } | null {
  if (prev.rolls <= 0 || prev.landed) return null;
  const s = clone(prev);
  const e = noEvent();
  const die = Math.floor(rng() * 6) + 1;
  s.rolls -= 1;
  award(s, e, 'first-roll');
  const path: number[] = [];
  for (let i = 1; i <= die; i++) path.push((prev.position + i) % BOARD.length);
  if (prev.position + die >= BOARD.length) {
    e.passedHq = true;
    addStars(s, e, STARS.passHq);
  }
  s.position = path[path.length - 1]!;
  const tile = BOARD[s.position]!;
  if (tile.kind === 'bonus') addStars(s, e, STARS.bonusTile);
  else if (tile.kind !== 'hq') s.landed = tile.id;
  return { state: s, die, path, event: e };
}

/** Leaves the landed tile without playing it (no reward, no penalty). */
export function skipLanded(prev: RewardsState): RewardsState {
  return prev.landed ? { ...clone(prev), landed: null } : prev;
}

function bumpStreak(s: RewardsState, e: RewardEvent, now: number): void {
  const today = dayKey(now);
  if (s.lastPlayDay === today) return;
  s.streak = s.lastPlayDay && daysBetween(s.lastPlayDay, today) === 1 ? s.streak + 1 : 1;
  s.lastPlayDay = today;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  const bonus = STARS.streakPerDay * Math.min(s.streak, 7);
  e.streakBonus = bonus;
  addStars(s, e, bonus);
  if (s.streak >= 3) award(s, e, 'streak-3');
  if (s.streak >= 7) award(s, e, 'streak-7');
}

function claimLanded(s: RewardsState, e: RewardEvent, passed: boolean, matches: (t: BoardTile) => boolean): void {
  const tile = s.landed ? tileById(s.landed) : undefined;
  if (!tile || !matches(tile)) return;
  s.landed = null;
  s.rolls = Math.min(MAX_ROLLS, s.rolls + 1);
  e.rolls += 1;
  if (!passed || !tile.district || s.claimed.includes(tile.id)) return;
  s.claimed.push(tile.id);
  e.claimed = tile.id;
  addStars(s, e, STARS.claimTile);
  award(s, e, 'first-claim');
  if (districtTiles(tile.district).every((t) => s.claimed.includes(t.id))) {
    e.secured = tile.district;
    addStars(s, e, STARS.secureDistrict);
    award(s, e, `secured-${tile.district}` as BadgeId);
    if (BOARD_DISTRICTS.every((d) => districtTiles(d).every((t) => s.claimed.includes(t.id)))) award(s, e, 'city-secured');
  }
}

export interface MiniGameResult {
  game: MiniGameId;
  /** 0..1 */
  score: number;
  /** Real or Fake: cards called correctly this round. */
  correct?: number;
}

/** Records a finished mini-game, from the board or the Arcade. Claims the landed tile if it matches. */
export function recordMiniGame(prev: RewardsState, r: MiniGameResult, now: number): { state: RewardsState; event: RewardEvent } {
  const s = clone(prev);
  const e = noEvent();
  bumpStreak(s, e, now);
  addStars(s, e, miniGameStars(r.score, dailyMiniGame(dayKey(now)) === r.game));
  s.stats.miniGames += 1;
  if (r.game === 'wordsearch' && r.score >= 1) {
    s.stats.wordsearchPerfect += 1;
    award(s, e, 'wordsearch-ace');
  }
  if (r.game === 'real-or-fake') {
    s.stats.fakeCorrect += r.correct ?? 0;
    if (s.stats.fakeCorrect >= 25) award(s, e, 'fake-spotter');
  }
  if (r.game === 'money-trail') {
    s.stats.trailRuns += 1;
    if (s.stats.trailRuns >= 3) award(s, e, 'trail-tracer');
  }
  claimLanded(s, e, r.score >= CLAIM_SCORE, (t) => t.kind === 'minigame' && t.minigame === r.game);
  return { state: s, event: e };
}

/** Records a finished story mission. Any path counts: the lesson is in the debrief, not the score. */
export function recordMission(
  prev: RewardsState,
  m: { district: DistrictId; firstTime: boolean; safety: Choice['safety'] },
  now: number,
): { state: RewardsState; event: RewardEvent } {
  const s = clone(prev);
  const e = noEvent();
  bumpStreak(s, e, now);
  addStars(s, e, missionStars(m.firstTime, m.safety));
  claimLanded(s, e, true, (t) => t.kind === 'mission' && t.district === m.district);
  return { state: s, event: e };
}

/** Records a Signal Check / Pop Quiz answer for the landed chance tile. */
export function recordChance(prev: RewardsState, correct: boolean, now: number): { state: RewardsState; event: RewardEvent } {
  const s = clone(prev);
  const e = noEvent();
  bumpStreak(s, e, now);
  if (correct) addStars(s, e, STARS.chanceCorrect);
  // Corner Pop Quiz has no district, so it is never claimed; it still returns a roll.
  claimLanded(s, e, correct, (t) => t.kind === 'chance');
  return { state: s, event: e };
}

/** Shield Shards: fixed spots in Explore mode, collectable once per day each. */
export function recordShard(prev: RewardsState, shardId: string, now: number): { state: RewardsState; event: RewardEvent } | null {
  const today = dayKey(now);
  const found = prev.shardsDay === today ? prev.shardsFound : [];
  if (found.includes(shardId)) return null;
  const s = clone(prev);
  const e = noEvent();
  s.shardsDay = today;
  s.shardsFound = [...found, shardId];
  s.stats.shards += 1;
  addStars(s, e, STARS.shard);
  if (s.stats.shards >= 10) award(s, e, 'shard-hunter');
  return { state: s, event: e };
}

export function buyCosmetic(prev: RewardsState, id: string): RewardsState | null {
  const c = cosmeticById(id);
  if (!c || c.badge || prev.owned.includes(id) || prev.stars < c.price) return null;
  const s = clone(prev);
  s.stars -= c.price;
  s.owned.push(id);
  return s;
}

export function equipCosmetic(prev: RewardsState, id: string): RewardsState | null {
  const c = cosmeticById(id);
  if (!c || !prev.owned.includes(id)) return null;
  const s = clone(prev);
  s.equipped[c.slot] = id;
  return s;
}

