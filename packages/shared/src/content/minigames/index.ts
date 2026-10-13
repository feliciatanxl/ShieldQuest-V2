// Mini-game content (Red-Flag Wordsearch, Real or Fake?, Money Trail) and the helpers that deal a round.
// All content is fictional and marked draft until educators sign it off (same bar as missions).
import type { BandId } from '../../framework';
import type { MiniGameId } from '../../rewards';
import { MONEY_TRAIL_SCENARIOS } from './moneyTrail';
import { REAL_OR_FAKE_CARDS } from './realOrFake';
import type { MiniGameItem, MoneyTrailScenario, RealOrFakeCard, WordsearchPuzzle } from './types';
import { WORDSEARCH_GRID, WORDSEARCH_PUZZLES } from './wordsearch';

export * from './types';
export { WORDSEARCH_GRID, WORDSEARCH_PUZZLES, REAL_OR_FAKE_CARDS, MONEY_TRAIL_SCENARIOS };

/** Cards dealt in one Real or Fake? round. */
export const REAL_OR_FAKE_DECK_SIZE = 8;

export const itemsForBand = <T extends MiniGameItem>(items: readonly T[], band: BandId): T[] =>
  items.filter((i) => i.bands.includes(band));

/** Fisher-Yates on a copy. */
export function shuffled<T>(xs: readonly T[], rng: () => number): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Fresh items first (not in `recent`), then the rest, each group shuffled. */
function freshFirst<T extends MiniGameItem>(items: readonly T[], rng: () => number, recent: readonly string[]): T[] {
  const fresh = items.filter((i) => !recent.includes(i.id));
  const seen = items.filter((i) => recent.includes(i.id));
  return [...shuffled(fresh, rng), ...shuffled(seen, rng)];
}

export function pickWordsearch(band: BandId, rng: () => number, recent: readonly string[] = []): WordsearchPuzzle {
  return freshFirst(itemsForBand(WORDSEARCH_PUZZLES, band), rng, recent)[0]!;
}

/** A balanced deck: 3 or 4 real cards, the rest scams, in random order. Prefers cards not seen recently. */
export function dealRealOrFake(
  band: BandId,
  rng: () => number,
  recent: readonly string[] = [],
  size = REAL_OR_FAKE_DECK_SIZE,
): RealOrFakeCard[] {
  const pool = itemsForBand(REAL_OR_FAKE_CARDS, band);
  const real = freshFirst(
    pool.filter((c) => c.verdict === 'real'),
    rng,
    recent,
  );
  const scam = freshFirst(
    pool.filter((c) => c.verdict === 'scam'),
    rng,
    recent,
  );
  const wantReal = Math.min(real.length, 3 + Math.floor(rng() * 2));
  const wantScam = Math.min(scam.length, size - wantReal);
  return shuffled([...real.slice(0, wantReal), ...scam.slice(0, wantScam)], rng);
}

/** One scenario, with each step's options shuffled so the right answer is not always in the same place. */
export function pickMoneyTrail(band: BandId, rng: () => number, recent: readonly string[] = []): MoneyTrailScenario {
  const s = freshFirst(itemsForBand(MONEY_TRAIL_SCENARIOS, band), rng, recent)[0]!;
  return { ...s, steps: s.steps.map((step) => ({ ...step, options: shuffled(step.options, rng) })) };
}

export type MiniGameRound =
  | { game: 'wordsearch'; puzzle: WordsearchPuzzle }
  | { game: 'real-or-fake'; cards: RealOrFakeCard[] }
  | { game: 'money-trail'; scenario: MoneyTrailScenario };

/** Deals one round of a mini-game for a band. `recent` holds content ids to avoid repeating if possible. */
export function pickRound(game: MiniGameId, band: BandId, rng: () => number, recent: readonly string[] = []): MiniGameRound {
  switch (game) {
    case 'wordsearch':
      return { game, puzzle: pickWordsearch(band, rng, recent) };
    case 'real-or-fake':
      return { game, cards: dealRealOrFake(band, rng, recent) };
    case 'money-trail':
      return { game, scenario: pickMoneyTrail(band, rng, recent) };
  }
}

/** Content ids used in a round (to remember as recent). */
export function roundIds(round: MiniGameRound): string[] {
  switch (round.game) {
    case 'wordsearch':
      return [round.puzzle.id];
    case 'real-or-fake':
      return round.cards.map((c) => c.id);
    case 'money-trail':
      return [round.scenario.id];
  }
}

/** Message text respecting the Plain Language setting. */
export const messageFor = (m: { message: string; plainMessage?: string }, plain: boolean): string =>
  plain && m.plainMessage ? m.plainMessage : m.message;

/** Card body respecting the Plain Language setting. */
export const cardBodyFor = (c: Pick<RealOrFakeCard, 'body' | 'plainBody'>, plain: boolean): string =>
  plain && c.plainBody ? c.plainBody : c.body;
