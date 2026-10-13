// Shared shapes for mini-game content (Red-Flag Wordsearch, Real or Fake?, Money Trail).
// Everything here is fictional: in-world brands (MetroPay, MetroPost, MetroPoly, Harbour Bank, ChatLah...),
// domains ending in .test, no real phone numbers, people, companies or apps.
import type { BandId } from '../../framework';

/** Mini-game content needs the same human sign-off as missions before a pilot. */
export type ContentStatus = 'draft' | 'reviewed';

export interface MiniGameItem {
  id: string;
  bands: BandId[];
  status: ContentStatus;
}

// ---------------------------------------------------------------------------------------------
// Red-Flag Wordsearch
// ---------------------------------------------------------------------------------------------

export type MiniMessageChannel = 'sms' | 'chat' | 'dm' | 'email' | 'popup';

export interface RedFlagWord {
  /** Upper-case A-Z only. Must appear as a whole word in the message (any case). */
  word: string;
  /** One line: why this word is a warning sign. */
  why: string;
}

export interface WordsearchPuzzle extends MiniGameItem {
  channel: MiniMessageChannel;
  /** Who it looks like it is from (as shown on screen). */
  from: string;
  /** Small grey line under the sender, e.g. "Unknown number" or a .test address. */
  meta?: string;
  message: string;
  /** Same message without Singlish or slang, for the Plain Language setting. Must contain every word too. */
  plainMessage?: string;
  /** 5-6 red-flag words hidden in the grid. */
  flags: RedFlagWord[];
  /** What to remember, one or two short lines. */
  lesson: string;
}

export type GridDirection = 'E' | 'S' | 'SE' | 'NE' | 'W' | 'N' | 'NW' | 'SW';

export interface WordsearchGridSpec {
  size: number;
  /** Directions words may run in. Junior: left-to-right and top-to-bottom only (never backwards). */
  directions: readonly GridDirection[];
  /** Junior players see the word list; older players see blanks with the first letter. */
  showWords: boolean;
}

// ---------------------------------------------------------------------------------------------
// Real or Fake?
// ---------------------------------------------------------------------------------------------

export type CardKind = 'sms' | 'chat' | 'popup' | 'email' | 'shop' | 'job' | 'notice' | 'app';

export type CardField = 'from' | 'meta' | 'body' | 'cta';

export interface RealOrFakeCard extends MiniGameItem {
  kind: CardKind;
  verdict: 'real' | 'scam';
  /** Sender, shop or app name as shown on the mock screen. */
  from: string;
  /** Address bar, sender address, subject line or "Unknown number". */
  meta?: string;
  body: string;
  plainBody?: string;
  /** Button text on the mock screen, if any. */
  cta?: string;
  /** The giveaway: an exact piece of text inside `field` that gets highlighted after the call. */
  clue: { field: CardField; text: string };
  /** One-line tip shown after the call. */
  tip: string;
}

// ---------------------------------------------------------------------------------------------
// Money Trail
// ---------------------------------------------------------------------------------------------

export type TrailNodeKind = 'offer' | 'victim' | 'you' | 'account' | 'transfer' | 'scammer' | 'bank' | 'police' | 'friends' | 'choice';

export interface TrailOption {
  id: string;
  text: string;
  correct: boolean;
  /** Shown after picking this option. */
  explain: string;
}

export interface TrailStep {
  id: string;
  node: { kind: TrailNodeKind; label: string };
  /** What the player sees when the money arrives here. */
  scene: string;
  prompt: string;
  /** Exactly one option is correct. */
  options: TrailOption[];
}

export interface MoneyTrailScenario extends MiniGameItem {
  title: string;
  /** The offer that starts the trail. */
  hook: { from: string; channel: MiniMessageChannel; message: string; plainMessage?: string };
  steps: TrailStep[];
  lesson: string;
}
