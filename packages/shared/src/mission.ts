// The Mission data model. Missions are plain data: the DOM mission player, the 3D set pieces,
// squad sessions and the Scenario Portal all read this one shape.
//
// Design rules every mission must follow (enforced by lintMission in ./lint.ts):
// - Third-person framing: players advise a fictional resident, they never disclose about themselves.
// - All names, brands, links and numbers are fictional (.example/.test domains, visibly fake numbers).
// - Feedback blames the manipulator's tactic, never the target. Every risky path has a recovery.
// - Facts (laws, helplines, statistics) cite a source with an as-of date.

import type { BandId, DistrictId, SkillId, TacticId } from './framework';
import type { HelpChannelId } from './help';

/** Reusable code-built 3D set pieces. Each exposes named anchors that content can reference. */
export const SCENES = {
  /** S1 School Gate and Bus Stop (poly-campus variant via props). */
  'school-gate': ['gate', 'guard-post', 'bus-stop', 'bench', 'crossing', 'kiosk', 'tree', 'car-park'],
  /** S2 Canteen and Locker Corridor. */
  canteen: ['table', 'drinks-stall', 'lockers', 'corridor', 'noticeboard', 'bench'],
  /** S3 Mall Atrium and MiniMart 24 (phone-accessory shop variant). */
  minimart: ['aisle-snacks', 'aisle-beauty', 'counter', 'self-checkout', 'cctv', 'door', 'atrium-booth', 'phone-shop'],
  /** S4 Food Court and Pop-up Booth. */
  'food-court': ['stall', 'table', 'qr-sticker', 'tray-return', 'popup-booth', 'pillar'],
  /** S5 Neon Void Deck and Phone Kiosk. */
  'void-deck': ['bench', 'stone-table', 'letterboxes', 'notice-board', 'lift-lobby', 'phone-kiosk', 'pillar'],
  /** S6 Digi Sky: the online city (Barang Market, ChatLah plaza, QuikGig tower, the Arcade). */
  'digi-sky': ['barang-booth', 'review-lanterns', 'chatlah-plaza', 'quikgig-tower', 'arcade', 'link-portal'],
  /** S7 Bedroom Cutaway (night Peer Shield scenes). */
  bedroom: ['desk', 'bed', 'window', 'laptop', 'door', 'shelf'],
} as const;

export type SceneId = keyof typeof SCENES;
export type SceneAnchor = (typeof SCENES)[SceneId][number];

export const SCENE_IDS = Object.keys(SCENES) as SceneId[];

export type CastRole = 'resident' | 'friend' | 'pressurer' | 'stranger' | 'trusted' | 'bystander';

export interface CastMember {
  id: string;
  /** Fictional first name or handle. Remote strangers use handles, e.g. "HR_Jessie". */
  name: string;
  role: CastRole;
  /** Present in the 3D scene at an anchor. Remote contacts (online only) omit this. */
  anchor?: SceneAnchor;
  pose?: 'stand' | 'sit' | 'phone' | 'lean' | 'walk';
  /** Code-built figure styling. Strangers/offenders are faceless silhouettes with no ethnic or gender coding. */
  look: { body: string; accent: string; hair?: 'short' | 'long' | 'bun' | 'cap' | 'hijab' | 'none' };
  faceless?: boolean;
}

export type BeatChannel = 'chat' | 'speech' | 'notification' | 'scene';

export interface BeatAttachment {
  kind: 'link' | 'image' | 'payment' | 'screenshot' | 'listing' | 'job' | 'code';
  label: string;
  detail?: string;
}

/** One thing that happens during the live (real-time) phase. */
export interface LiveBeat {
  id: string;
  /** Seconds after the live phase starts. */
  at: number;
  /** Cast id, or 'narrator' for scene description. */
  from: string;
  channel: BeatChannel;
  text: string;
  /** The Pressure Ring lights this tactic label when the beat lands. */
  tactic?: TacticId;
  attachment?: BeatAttachment;
}

export type ClueTarget = { kind: 'beat'; beatId: string } | { kind: 'anchor'; anchor: SceneAnchor };

export interface Clue {
  id: string;
  /** Short label shown once found, e.g. "S$200 for ten minutes of 'work'". */
  label: string;
  target: ClueTarget;
  /**
   * true = a genuine warning sign. false = a normal detail (decoy) — included so players
   * learn to tell real red flags from ordinary details instead of distrusting everything.
   */
  redFlag: boolean;
  explain: string;
  tactic?: TacticId;
}

/** Identify the Influence: pull the thread from the visible pressurer to whoever really gains. */
export interface InfluenceThread {
  from: string;
  hidden: { label: string; description: string };
  question: string;
  options: { id: string; text: string; correct: boolean; explain: string }[];
}

export type Horizon = 'tonight' | 'next-week' | 'next-month';

/** Evaluate the Consequences: a sealed forecast that the Aftershock later opens. */
export interface Forecast {
  question: string;
  horizon: Horizon;
  options: { id: string; text: string; likely: boolean }[];
  explain: string;
}

export interface Effects {
  /** In-game wallet change (fictional S$). */
  wallet?: number;
  /** City trust/light for this district, -3..+3. */
  trust?: number;
  /** Resident's risk level change, -3..+3. */
  risk?: number;
}

/** Fixed, offender-focused feedback template:
 *  "[Tactic] is designed to [designedTo]. A safer move is [saferMove]. If it already happened, [ifItHappened]." */
export interface FeedbackCard {
  tactic: TacticId;
  /** Overrides the tactic's default "designed to" text when needed. */
  designedTo?: string;
  saferMove: string;
  ifItHappened: string;
}

/** A Late Hold: after an Aftershock lands there is always a recovery path and coming forward is rewarded. */
export interface Recovery {
  prompt: string;
  options: { id: string; text: string; good: boolean; response: string; help?: HelpChannelId[] }[];
}

export interface AftershockSpec {
  id: string;
  /** risk = a delayed cost (needs a recovery path). protective = an Afterglow: a delayed good result. */
  polarity: 'risk' | 'protective';
  /** Lands after this many more completed missions (or at the end of a session, whichever first). */
  afterMissions: number;
  /** Shown big on screen, e.g. "3 WEEKS LATER". */
  timeLabel: string;
  title: string;
  text: string;
  /** Sober, plain description. No fear-appeal spectacle (no chains, cuffs, caning imagery). */
  effects: Effects;
  /** Late Hold recovery. Required when polarity is 'risk'. */
  recovery?: Recovery;
  /** Optional cited fact shown in the Aftershock card. */
  fact?: { text: string; source: string; asOf: string };
}

export type Safety = 'risky' | 'unsure' | 'safe';

export interface Choice {
  id: string;
  label: string;
  detail?: string;
  safety: Safety;
  outcome: {
    title: string;
    text: string;
    /** shiny = tempting immediate reward (sober later), warm = protective, sober = honest cost. */
    mood: 'shiny' | 'sober' | 'warm' | 'mixed';
    effects: Effects;
  };
  feedback: FeedbackCard;
  aftershock?: AftershockSpec;
}

/** Explain step (solo): authored perspectives from fictional squadmates, clearly labelled as such. */
export interface Perspective {
  id: string;
  role: 'Safety Lead' | 'Evidence Checker' | 'Peer Supporter';
  leaning: string; // choice id
  text: string;
}

export type ShieldSlot = 'opener' | 'reason' | 'offer' | 'channel';

export interface ShieldTile {
  id: string;
  text: string;
  quality: 'great' | 'ok' | 'harmful';
  why: string;
  /** Change to the friend's GUARD (defensiveness, lower is better) and DOUBT (doubt about the risky plan, higher is better). */
  guard: number;
  doubt: number;
}

/** Peer Shield Mode: help a friend facing the same pressure. Players build a message from four tile slots. */
export interface PeerShield {
  friend: string;
  timeLabel: string;
  setup: string;
  messages: { from: string; text: string }[];
  slots: Record<ShieldSlot, ShieldTile[]>;
  start: { guard: number; doubt: number };
  outcomes: { success: string; partial: string; fail: string };
}

export interface Source {
  label: string;
  publisher: string;
  asOf: string;
  url?: string;
}

export interface Mission {
  id: string;
  version: number;
  title: string;
  district: DistrictId;
  scene: SceneId;
  bands: BandId[];
  theme: string;
  premise: string;
  skillFocus: SkillId[];
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  /** Scaffold fading across a session: guided -> light -> wildcard (unfamiliar surface, same deep structure). */
  scaffold: 'guided' | 'light' | 'wildcard';
  /** Cast id of the fictional resident the player advises. */
  resident: string;
  cast: CastMember[];
  intro: string;
  live: { durationSec: number; beats: LiveBeat[]; decisionPrompt: string };
  clues: Clue[];
  influence: InfluenceThread;
  forecast: Forecast;
  choices: Choice[];
  perspectives: Perspective[];
  peerShield?: PeerShield;
  /** Private If-Then plan offered at the end: "If ..., then I will ...". */
  ifThen: { if: string; then: string };
  help: HelpChannelId[];
  sources: Source[];
  review: { status: 'draft' | 'reviewed'; reviewers: string[]; reviewBy: string; notes?: string };
}

/** Mission player phases, in order. Aftershocks due from earlier missions play before 'intro'. */
export const MISSION_PHASES = [
  'intro',
  'live',
  'freeze',
  'trace',
  'forecast',
  'think',
  'explain',
  'release',
  'shield',
  'saved',
] as const;

export type MissionPhase = (typeof MISSION_PHASES)[number];

export const PHASE_SKILL: Record<MissionPhase, SkillId | null> = {
  intro: null,
  live: 'S',
  freeze: 'H',
  trace: 'I',
  forecast: 'E',
  think: 'L',
  explain: 'L',
  release: 'E',
  shield: 'D',
  saved: null,
};

export const HORIZON_LABEL: Record<Horizon, string> = {
  tonight: 'Tonight',
  'next-week': 'Next week',
  'next-month': 'Next month',
};
