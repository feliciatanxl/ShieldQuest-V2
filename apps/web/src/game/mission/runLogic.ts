// Pure, DOM-free helpers for the mission player. Everything here is deterministic given its inputs
// (runs are shuffled from a seed), so the solo player, the squad client and tests share one source of truth.

import {
  MISSION_PHASES,
  PHASE_SKILL,
  SKILLS,
  evaluateShield,
  missionsInDistrict,
  tacticById,
  type BandId,
  type BeatAttachment,
  type CastMember,
  type Choice,
  type Clue,
  type LiveBeat,
  type Mission,
  type MissionPhase,
  type PeerShield,
  type Perspective,
  type SceneAnchor,
  type ShieldSlot,
  type SkillId,
  type TacticId,
} from '@shieldquest/shared';
import type { Hotspot, HotspotState, SceneMood } from '../../world/contracts';

// ---------------------------------------------------------------------------------------------
// Seeded randomness (mulberry32). Exit order, tile order and option order come from the run seed.

export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

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

/** Fisher-Yates with a seeded RNG. `salt` lets one run seed produce independent orders per list. */
export function seededShuffle<T>(items: readonly T[], seed: number, salt = ''): T[] {
  const out = [...items];
  const rand = mulberry32((seed ^ hashString(salt)) >>> 0);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function newRunSeed(): number {
  try {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0]!;
  } catch {
    return Math.floor(Math.random() * 0xffffffff) >>> 0;
  }
}

// ---------------------------------------------------------------------------------------------
// Cast and places

export const castById = (mission: Mission, id: string): CastMember | undefined => mission.cast.find((c) => c.id === id);

export function castName(mission: Mission, id: string): string {
  if (id === 'narrator') return 'Narrator';
  return castById(mission, id)?.name ?? id;
}

export const residentName = (mission: Mission): string => castName(mission, mission.resident);

/** "3 WEEKS LATER" -> "3 weeks later" (time labels are authored in capitals for the big ribbon). */
export const sentenceCase = (text: string): string => {
  const t = text.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Ends authored text with a full stop unless it already ends a sentence (labels may or may not carry one). */
export const withStop = (text: string): string => {
  const t = text.trim();
  return /[.!?…]$/.test(t) ? t : `${t}.`;
};

/** "stone-table" -> "Stone table". The 3D set registry has nicer labels, but importing it would pull in three.js. */
export function anchorLabel(anchor: string): string {
  const words = anchor.split('-').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const castAtAnchor = (mission: Mission, anchor: SceneAnchor): CastMember | undefined =>
  mission.cast.find((c) => c.anchor === anchor);

export function initials(name: string): string {
  const clean = name.replace(/[^A-Za-z0-9 _]/g, ' ').trim();
  const parts = clean.split(/[\s_]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]!.slice(0, 1) + parts[1]!.slice(0, 1)).toUpperCase();
}

// ---------------------------------------------------------------------------------------------
// The live timeline: every view is a pure function of mission time t.

/** Header shown the moment time is held (GAME_DESIGN.md 5.3, step 2a). */
export const HOLD_HEADER = 'Time is held. Nothing is rushing you now.';
/** Line shown when the live phase ends without a hold (no penalty). */
export const AUTO_FREEZE_LINE = 'You can always pause. Scams count on you forgetting that.';

/** Typing dots show for this long before a chat or speech beat lands. */
export const TYPING_LEAD_SEC = 1.4;

export type BeatState = 'landed' | 'typing' | 'frozen' | 'pending';

export interface BeatView {
  beat: LiveBeat;
  state: BeatState;
}

export function sortedBeats(mission: Mission): LiveBeat[] {
  return [...mission.live.beats].sort((a, b) => a.at - b.at);
}

/**
 * Beat states at time t. While frozen, beats that have not landed hang "in mid-air" and can be read early;
 * while live, only the next chat/speech beat shows typing dots.
 */
export function beatViews(mission: Mission, t: number, frozen: boolean): BeatView[] {
  const beats = sortedBeats(mission);
  let typingShown = false;
  return beats.map((beat) => {
    if (beat.at <= t) return { beat, state: 'landed' as const };
    if (frozen) return { beat, state: 'frozen' as const };
    const typable = beat.channel === 'chat' || beat.channel === 'speech';
    if (!typingShown && typable && beat.at - t <= TYPING_LEAD_SEC) {
      typingShown = true;
      return { beat, state: 'typing' as const };
    }
    typingShown = true; // only the very next beat may type
    return { beat, state: 'pending' as const };
  });
}

export const landedCount = (mission: Mission, t: number): number => mission.live.beats.filter((b) => b.at <= t).length;

/** Distinct tactics in the order their beats land: the Pressure Ring segments. */
export function ringTactics(mission: Mission): TacticId[] {
  const out: TacticId[] = [];
  for (const b of sortedBeats(mission)) if (b.tactic && !out.includes(b.tactic)) out.push(b.tactic);
  return out;
}

export function litTactics(mission: Mission, t: number): TacticId[] {
  const out: TacticId[] = [];
  for (const b of sortedBeats(mission)) if (b.at <= t && b.tactic && !out.includes(b.tactic)) out.push(b.tactic);
  return out;
}

/** Cast member who spoke last (camera leans towards them); null for narrator beats or before the first beat. */
export function speakerAt(mission: Mission, t: number): string | null {
  const landed = sortedBeats(mission).filter((b) => b.at <= t && b.from !== 'narrator');
  const last = landed[landed.length - 1];
  if (!last) return null;
  // Remote senders have no body in the scene; lean towards the resident holding the phone instead.
  return castById(mission, last.from)?.anchor ? last.from : mission.resident;
}

/** Reply chips appear about 30 s in (earlier in short junior moments). */
export const replyChipsAt = (mission: Mission): number => Math.min(30, mission.live.durationSec * 0.5);

export const REPLY_CHIPS = ['OK!', 'Send me the details'] as const;

// ---------------------------------------------------------------------------------------------
// Clues, the Scene List and the Evidence Board

export type Call = 'flag' | 'fine';

export const clueForBeat = (mission: Mission, beatId: string): Clue | undefined =>
  mission.clues.find((c) => c.target.kind === 'beat' && c.target.beatId === beatId);

export const clueById = (mission: Mission, id: string): Clue | undefined => mission.clues.find((c) => c.id === id);

export const beatById = (mission: Mission, id: string): LiveBeat | undefined => mission.live.beats.find((b) => b.id === id);

export type BoardColumn = 'S' | 'I' | 'E';

export const BOARD_COLUMNS: readonly { id: BoardColumn; title: string; hint: string }[] = [
  { id: 'S', title: 'Spot', hint: 'Warning signs' },
  { id: 'I', title: 'Identify', hint: 'Who is pushing, who gains' },
  { id: 'E', title: 'Evaluate', hint: 'What it could cost' },
];

const INFLUENCE_TACTICS: TacticId[] = ['everyone-does-it', 'authority', 'loyalty', 'fake-proof'];
const CONSEQUENCE_TACTICS: TacticId[] = ['too-good', 'small-ask', 'fear'];
const COST_ATTACHMENTS: BeatAttachment['kind'][] = ['payment', 'link', 'code', 'job'];

/** Files a pin under S / I / E on the Evidence Board (organisation only; it never affects scoring). */
export function boardColumn(mission: Mission, clue: Clue): BoardColumn {
  if (clue.tactic && INFLUENCE_TACTICS.includes(clue.tactic)) return 'I';
  if (clue.tactic && CONSEQUENCE_TACTICS.includes(clue.tactic)) return 'E';
  if (clue.tactic) return 'S';
  const pusher = mission.influence.from;
  if (clue.target.kind === 'anchor') return castAtAnchor(mission, clue.target.anchor)?.id === pusher ? 'I' : 'S';
  const beat = beatById(mission, clue.target.beatId);
  if (beat?.from === pusher) return 'I';
  if (beat?.attachment && COST_ATTACHMENTS.includes(beat.attachment.kind)) return 'E';
  return 'S';
}

export type InspectSection = 'messages' | 'around' | 'people';

export interface Inspectable {
  /** Stable key: `beat:<id>`, `clue:<id>`, `cast:<id>` or `place:<anchor>`. */
  key: string;
  section: InspectSection;
  kind: 'message' | 'place' | 'person';
  title: string;
  /** Neutral one-liner shown before inspecting (never gives the answer away). */
  detail: string;
  clue?: Clue;
  beat?: LiveBeat;
  anchor?: SceneAnchor;
  cast?: CastMember;
}

function personDetail(mission: Mission, c: CastMember): string {
  const resident = residentName(mission);
  switch (c.role) {
    case 'resident':
      return `The resident you are advising. You cannot choose for ${c.name}, but you can help them think.`;
    case 'stranger':
      return c.anchor ? 'Someone nearby you do not know.' : 'Only a chat handle. There is no way to see who is really behind it.';
    case 'trusted':
      return `Someone ${resident} could talk to.`;
    case 'friend':
      return `A friend of ${resident}.`;
    case 'bystander':
      return 'Someone passing by.';
    default:
      return c.anchor ? `Here with ${resident}.` : `Talking to ${resident} online.`;
  }
}

/**
 * Every inspectable thing, in Scene List order: messages that carry clues (red flags and ordinary details mixed),
 * places with quiet clues ("Look around"), then the other people and places in the set.
 */
export function inspectables(mission: Mission, sceneAnchors: readonly SceneAnchor[]): Inspectable[] {
  const items: Inspectable[] = [];
  for (const beat of sortedBeats(mission)) {
    const clue = clueForBeat(mission, beat.id);
    if (!clue) continue;
    items.push({
      key: `beat:${beat.id}`,
      section: 'messages',
      kind: 'message',
      title: beat.text,
      detail: beat.from === 'narrator' ? 'Scene' : castName(mission, beat.from),
      clue,
      beat,
    });
  }
  const clueAnchors = new Set<string>();
  for (const clue of mission.clues) {
    if (clue.target.kind !== 'anchor') continue;
    const anchor = clue.target.anchor;
    clueAnchors.add(anchor);
    const who = castAtAnchor(mission, anchor);
    items.push({
      key: `clue:${clue.id}`,
      section: 'around',
      kind: 'place',
      title: who ? `${anchorLabel(anchor)} · ${who.name}` : anchorLabel(anchor),
      detail: 'Take a closer look.',
      clue,
      anchor,
      cast: who,
    });
  }
  for (const c of mission.cast) {
    if (c.anchor && clueAnchors.has(c.anchor)) continue;
    items.push({ key: `cast:${c.id}`, section: 'people', kind: 'person', title: c.name, detail: personDetail(mission, c), cast: c, anchor: c.anchor });
  }
  for (const anchor of sceneAnchors) {
    if (clueAnchors.has(anchor) || castAtAnchor(mission, anchor)) continue;
    items.push({ key: `place:${anchor}`, section: 'people', kind: 'place', title: anchorLabel(anchor), detail: 'Part of the scene.', anchor });
  }
  return items;
}

/** Where a clue's 3D hotspot floats: its anchor, or the speaker's spot for something said in person. */
export function hotspotAnchor(mission: Mission, clue: Clue): SceneAnchor | null {
  if (clue.target.kind === 'anchor') return clue.target.anchor;
  const beat = beatById(mission, clue.target.beatId);
  if (!beat || beat.from === mission.resident) return null;
  return castById(mission, beat.from)?.anchor ?? null;
}

/**
 * Splits pins into the engine's liveFound / frozenFound. A live "first look" is untimed and unscored on its own:
 * it counts once it is confirmed as a red flag, or when it was a genuine red flag left unchallenged.
 */
export function foundIds(
  mission: Mission,
  looks: readonly string[],
  calls: Readonly<Record<string, Call>>,
): { liveFound: string[]; frozenFound: string[] } {
  const isRed = (id: string) => mission.clues.some((c) => c.id === id && c.redFlag);
  const liveFound = [...new Set(looks)].filter((id) => calls[id] === 'flag' || (calls[id] === undefined && isRed(id)));
  const frozenFound = Object.keys(calls).filter((id) => calls[id] === 'flag' && !liveFound.includes(id));
  return { liveFound, frozenFound };
}

/** The personal "Seen live: N · Found while holding: M" counter (red flags only). */
export function liveHeldCounts(
  mission: Mission,
  looks: readonly string[],
  calls: Readonly<Record<string, Call>>,
): { live: number; held: number; total: number } {
  const red = new Set(mission.clues.filter((c) => c.redFlag).map((c) => c.id));
  const { liveFound, frozenFound } = foundIds(mission, looks, calls);
  return {
    live: liveFound.filter((id) => red.has(id)).length,
    held: frozenFound.filter((id) => red.has(id)).length,
    total: red.size,
  };
}

/** Ordinary details the player pinned as red flags (explained gently at Release). */
export function pinnedDecoys(mission: Mission, looks: readonly string[], calls: Readonly<Record<string, Call>>): Clue[] {
  const { liveFound, frozenFound } = foundIds(mission, looks, calls);
  const ids = new Set([...liveFound, ...frozenFound]);
  return mission.clues.filter((c) => !c.redFlag && ids.has(c.id));
}

// ---------------------------------------------------------------------------------------------
// Guardian abilities

/** Cluepaw's Sniff Out: one genuine red flag not yet pinned; quiet (place) clues first, since they are easiest to miss. */
export function sniffTarget(mission: Mission, looks: readonly string[], calls: Readonly<Record<string, Call>>): Clue | null {
  const pinned = (id: string) => calls[id] === 'flag' || (calls[id] === undefined && looks.includes(id));
  const open = mission.clues.filter((c) => c.redFlag && !pinned(c.id));
  return open.find((c) => c.target.kind === 'anchor') ?? open[0] ?? null;
}

const SCAN_NOTES: Partial<Record<BeatAttachment['kind'], string>> = {
  link: 'Link: check where it really leads before tapping.',
  code: 'Asks for a code. Never share OTPs or login codes.',
  payment: 'Payment request: money is changing hands.',
  job: 'Job offer: check who is really hiring.',
};

/** ByteBuddy's Data Scan note for a beat, or null when there is nothing to outline. */
export function scanNote(beat: LiveBeat | undefined): string | null {
  const kind = beat?.attachment?.kind;
  return kind ? (SCAN_NOTES[kind] ?? null) : null;
}

/** VeriFox can cross-check claims the sender supplies (proof, badges, official-sounding claims, attachments). */
export function canCrossCheck(clue: Clue | undefined, beat: LiveBeat | undefined): boolean {
  return Boolean(clue?.tactic === 'fake-proof' || clue?.tactic === 'authority' || beat?.attachment);
}

export const CROSS_CHECK_RESULT = "Can't verify from here. Check with an official source you find yourself.";

// ---------------------------------------------------------------------------------------------
// Pressure Surge (teen and young-adult only; never changes any timer)

export const SURGE_AFTER_SEC = 20;

export interface SurgeLine {
  from: string;
  name: string;
  text: string;
}

/** The surge reuses the pusher's own pressure line from the live phase, so it stays in mission data. */
export function surgeLine(mission: Mission): SurgeLine | null {
  const beats = sortedBeats(mission);
  const pusher = beats.filter((b) => b.from === mission.influence.from);
  const pick =
    [...pusher].reverse().find((b) => b.tactic) ??
    [...beats].reverse().find((b) => b.tactic && b.from !== 'narrator' && b.from !== mission.resident) ??
    pusher[pusher.length - 1];
  return pick ? { from: pick.from, name: castName(mission, pick.from), text: pick.text } : null;
}

export const surgeEnabled = (band: BandId | null): boolean => band !== 'junior';

// ---------------------------------------------------------------------------------------------
// Exits (letters + neutral patterns; never status shapes, so the safe exit is not given away)

export const EXIT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export const EXIT_PATTERNS = ['dots', 'stripes', 'grid', 'waves'] as const;
export type ExitPattern = (typeof EXIT_PATTERNS)[number];

export interface ExitView {
  choice: Choice;
  letter: string;
  pattern: ExitPattern;
}

export function exitOrder(mission: Mission, seed: number): ExitView[] {
  return seededShuffle(mission.choices, seed, `${mission.id}:exits`).map((choice, i) => ({
    choice,
    letter: EXIT_LETTERS[i] ?? String(i + 1),
    pattern: EXIT_PATTERNS[i % EXIT_PATTERNS.length]!,
  }));
}

export const exitFor = (exits: readonly ExitView[], choiceId: string | null): ExitView | undefined =>
  exits.find((e) => e.choice.id === choiceId);

// ---------------------------------------------------------------------------------------------
// Explain: the Echo Council

export const ECHO_COUNCIL_LABEL = 'Perspectives written by the ShieldQuest team — not real players';

export const REASON_CHIPS = [
  'Too urgent',
  "Can't verify it",
  'Too good to be true',
  'Who gains?',
  "Friend says it's fine",
  'Easy money',
  'Need the money',
] as const;

export const MAX_REASONS = 2;

/** Agreement among the council, in "Mood" words (used for the junior band instead of dots). */
export function councilMood(perspectives: readonly Perspective[]): 'United' | 'Mostly agree' | 'Split' {
  if (perspectives.length === 0) return 'Split';
  const counts = new Map<string, number>();
  for (const p of perspectives) counts.set(p.leaning, (counts.get(p.leaning) ?? 0) + 1);
  const top = Math.max(...counts.values());
  if (counts.size === 1) return 'United';
  return top / perspectives.length >= 0.6 ? 'Mostly agree' : 'Split';
}

export interface CounterView {
  choice: Choice;
  perspective: Perspective | null;
  argument: string;
  /** A short reflection task that goes with the card. */
  prompt: string;
}

/**
 * Echo's counter-view: the strongest case for an exit other than your seal. If you leaned risky or unsure, it argues
 * for the safest exit; if you already chose safe, it steelmans another exit so you can test your reasoning.
 * The safe case is built from the tactic's counter and the safer move, so it adds something the council cards
 * (already on screen) do not say.
 */
export function counterView(mission: Mission, firstVote: string | null): CounterView | null {
  const mine = mission.choices.find((c) => c.id === firstVote);
  const others = mission.choices.filter((c) => c.id !== firstVote);
  if (others.length === 0) return null;
  const leanedBy = (c: Choice) => mission.perspectives.some((p) => p.leaning === c.id);
  const target =
    mine && mine.safety !== 'safe'
      ? (others.find((c) => c.safety === 'safe') ?? others[0]!)
      : (others.find((c) => leanedBy(c) && c.safety !== 'safe') ?? others.find((c) => c.safety === 'unsure') ?? others[0]!);
  const perspective = mission.perspectives.find((p) => p.leaning === target.id) ?? null;
  const who = residentName(mission);
  if (target.safety === 'safe') {
    const move = target.feedback.saferMove.trim().replace(/[.!?]+$/, '');
    return {
      choice: target,
      perspective,
      argument: `${tacticById(target.feedback.tactic).counter} The safer move is ${move}.`,
      prompt: `What would make it easier for ${who} to choose this, even with the pressure on?`,
    };
  }
  return {
    choice: target,
    perspective,
    argument: target.detail ?? perspective?.text ?? `Think about why someone in ${who}'s place might pick this. What would they be hoping for?`,
    prompt: 'Make the best case for it in your own words. Then test it against the pins on your board.',
  };
}

// ---------------------------------------------------------------------------------------------
// Release

/** The one detail that flips a confident risky seal: the red flag that matches the exit's tactic. */
export function hypercorrectionClue(mission: Mission, firstVote: string | null): Clue | null {
  const choice = mission.choices.find((c) => c.id === firstVote);
  const red = mission.clues.filter((c) => c.redFlag);
  if (!choice) return red[0] ?? null;
  return red.find((c) => c.tactic === choice.feedback.tactic) ?? red[0] ?? null;
}

export const isConfidentRisk = (mission: Mission, firstVote: string | null, confidence: number | null): boolean =>
  confidence === 3 && mission.choices.some((c) => c.id === firstVote && c.safety === 'risky');

// ---------------------------------------------------------------------------------------------
// Peer Shield

export const SHIELD_SLOT_ORDER: readonly ShieldSlot[] = ['opener', 'reason', 'offer', 'channel'];

export const SHIELD_SLOT_LABEL: Record<ShieldSlot, { title: string; hint: string }> = {
  opener: { title: 'Opener', hint: 'How you start' },
  reason: { title: 'Reason', hint: 'Why it matters' },
  offer: { title: 'Offer', hint: 'What you will do' },
  channel: { title: 'Channel', hint: 'Who can help' },
};

/**
 * Junior players build a three-part message (Opener, Offer, Channel), but only when the authored tiles can still
 * reach success without a Reason; otherwise the full four slots are used so the D letter stays reachable.
 */
export function shieldSlotsFor(shield: PeerShield, band: BandId | null): ShieldSlot[] {
  if (band !== 'junior') return [...SHIELD_SLOT_ORDER];
  const three: ShieldSlot[] = ['opener', 'offer', 'channel'];
  const best: Partial<Record<ShieldSlot, string>> = {};
  for (const slot of three) {
    const tiles = [...shield.slots[slot]].sort((a, b) => b.doubt - b.guard - (a.doubt - a.guard));
    const great = tiles.find((t) => t.quality === 'great') ?? tiles[0];
    if (great) best[slot] = great.id;
  }
  return evaluateShield(shield, best).outcome === 'success' ? three : [...SHIELD_SLOT_ORDER];
}

/** Live GUARD / DOUBT values for the tiles picked so far. */
export function shieldPreview(shield: PeerShield, picks: Partial<Record<ShieldSlot, string>>): { guard: number; doubt: number } {
  const r = evaluateShield(shield, picks);
  return { guard: r.guard, doubt: r.doubt };
}

// ---------------------------------------------------------------------------------------------
// Bond (S.H.I.E.L.D. rules in plain words — these mirror evaluateRun in @shieldquest/shared)

export const SKILL_RULE: Record<SkillId, string> = {
  S: 'Pin most of the red flags (6 in 10 or more) with no more than one false alarm.',
  H: 'Press HOLD yourself, before the last part of the live moment.',
  I: 'Pull the thread and name who really gains on your first answer.',
  E: 'Seal a forecast that matches what is most likely to happen.',
  L: 'Make your final seal on the safer exit.',
  D: 'Help the friend open up in Peer Shield.',
};

export const SKILL_PROMPT: Record<SkillId, string> = {
  S: 'What looks off? Tap anything that catches your eye.',
  H: 'Feeling rushed? That is the moment to Hold.',
  I: 'Who is pushing, and what do they gain?',
  E: 'What could happen tonight, next week, next month?',
  L: 'Which exit is safest, and why?',
  D: 'How can you help a friend facing the same pressure?',
};

/**
 * Guided-scaffold prompt line for each phase (GAME_DESIGN.md §5.5). Keyed by phase rather than by letter because
 * one letter spans several phases (H is both the press and the investigation that follows it).
 */
export const PHASE_PROMPT: Partial<Record<MissionPhase, string>> = {
  live: 'Tap what looks off. Feeling rushed? Hold.',
  freeze: 'Time is yours now. Check each detail and pin the warning signs.',
  trace: SKILL_PROMPT.I,
  forecast: SKILL_PROMPT.E,
  think: SKILL_PROMPT.L,
  explain: 'Hear the other views. Would anything change your mind?',
  release: 'What did the trick want? What could still come back later?',
  shield: SKILL_PROMPT.D,
};

export const SKILL_ORDER: readonly SkillId[] = SKILLS.map((s) => s.id);

/** Next mission in the same district for this band, or null when the district is finished. */
export function nextMissionId(mission: Mission, band: BandId | null): string | null {
  const list = missionsInDistrict(mission.district, band ?? undefined);
  const i = list.findIndex((m) => m.id === mission.id);
  if (i < 0) return list.find((m) => m.id !== mission.id)?.id ?? null;
  return list[i + 1]?.id ?? null;
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatMoney(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}S$${Math.abs(n).toLocaleString('en-SG')}`;
}

// ---------------------------------------------------------------------------------------------
// Always-on-screen state and the 3D stage

/** S.H.I.E.L.D. rail for a phase: the letter practised now and the letters already passed. */
export function railLetters(mission: Mission, phase: MissionPhase): { current: SkillId | null; done: SkillId[] } {
  const idx = MISSION_PHASES.indexOf(phase);
  const current = PHASE_SKILL[phase];
  const done = new Set<SkillId>();
  MISSION_PHASES.forEach((p, i) => {
    const s = PHASE_SKILL[p];
    if (!s || s === current) return;
    if (p === 'shield' && !mission.peerShield) return;
    if (i < idx) done.add(s);
  });
  return { current, done: SKILL_ORDER.filter((s) => done.has(s)) };
}

export type StageView = 'live' | 'frozen' | 'after';

/**
 * Clue hotspots for the 3D stage, one per anchor (place clues win, since quiet clues are only findable in the scene).
 * live: clues that have landed; frozen: every clue with its call; after: only pinned clues stay marked.
 */
export function stageHotspots(
  mission: Mission,
  view: StageView,
  t: number,
  looks: readonly string[],
  calls: Readonly<Record<string, Call>>,
): Hotspot[] {
  const byAnchor = new Map<string, Hotspot>();
  const ordered = [...mission.clues].sort((a, b) => (a.target.kind === 'anchor' ? 0 : 1) - (b.target.kind === 'anchor' ? 0 : 1));
  for (const clue of ordered) {
    const anchor = hotspotAnchor(mission, clue);
    if (!anchor || byAnchor.has(anchor)) continue;
    if (view === 'live' && clue.target.kind === 'beat') {
      const beat = beatById(mission, clue.target.beatId);
      if (!beat || beat.at > t) continue;
    }
    const call = calls[clue.id];
    const looked = looks.includes(clue.id);
    let state: HotspotState;
    if (view === 'live') state = looked ? 'found-flag' : 'available';
    else if (call === 'flag' || (call === undefined && looked)) state = 'found-flag';
    else if (call === 'fine') state = 'found-ok';
    else state = view === 'frozen' ? 'available' : 'hidden';
    byAnchor.set(anchor, { clueId: clue.id, anchor, state });
  }
  return [...byAnchor.values()];
}

/** Scene mood for the outcome of a choice. */
export function moodForChoice(choice: Choice | undefined): SceneMood {
  switch (choice?.outcome.mood) {
    case 'shiny':
      return 'shiny';
    case 'warm':
      return 'warm';
    case 'sober':
      return 'sober';
    default:
      return 'neutral';
  }
}
