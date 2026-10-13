import { describe, expect, it } from 'vitest';
import {
  BANDS,
  MONEY_TRAIL_SCENARIOS,
  REAL_OR_FAKE_CARDS,
  REAL_OR_FAKE_DECK_SIZE,
  WORDSEARCH_GRID,
  WORDSEARCH_PUZZLES,
  dealRealOrFake,
  itemsForBand,
  mulberry32,
  pickMoneyTrail,
  pickRound,
  pickWordsearch,
  roundIds,
  type MiniGameItem,
} from '../src';

const ALL: MiniGameItem[] = [...WORDSEARCH_PUZZLES, ...REAL_OR_FAKE_CARDS, ...MONEY_TRAIL_SCENARIOS];

// A whole word that is not part of a web or email address (those are not highlighted in the message).
const wholeWord = (word: string) => new RegExp(`(?<![A-Za-z0-9.@-])${word}(?![A-Za-z0-9@-]|\\.[A-Za-z])`, 'i');

/** Every piece of player-facing text in an item, for the safety checks below. */
function texts(item: unknown): string[] {
  if (typeof item === 'string') return [item];
  if (Array.isArray(item)) return item.flatMap(texts);
  if (item && typeof item === 'object') return Object.values(item).flatMap(texts);
  return [];
}

describe('mini-game content: shared rules', () => {
  it('has unique ids across all three games', () => {
    const ids = ALL.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is tagged with real bands and marked draft until reviewed', () => {
    const bandIds = BANDS.map((b) => b.id);
    for (const item of ALL) {
      expect(item.bands.length, item.id).toBeGreaterThan(0);
      for (const b of item.bands) expect(bandIds, item.id).toContain(b);
      expect(['draft', 'reviewed'], item.id).toContain(item.status);
    }
    // Nothing has been signed off yet: flip these to 'reviewed' only after educator review.
    expect(ALL.every((i) => i.status === 'draft')).toBe(true);
  });

  it('meets the minimum counts', () => {
    expect(WORDSEARCH_PUZZLES.length).toBeGreaterThanOrEqual(8);
    expect(REAL_OR_FAKE_CARDS.length).toBeGreaterThanOrEqual(30);
    expect(MONEY_TRAIL_SCENARIOS.length).toBeGreaterThanOrEqual(6);
  });

  it('every band has enough of each game', () => {
    for (const { id } of BANDS) {
      expect(itemsForBand(WORDSEARCH_PUZZLES, id).length, id).toBeGreaterThanOrEqual(4);
      expect(itemsForBand(REAL_OR_FAKE_CARDS, id).length, id).toBeGreaterThanOrEqual(REAL_OR_FAKE_DECK_SIZE + 4);
      expect(itemsForBand(MONEY_TRAIL_SCENARIOS, id).length, id).toBeGreaterThanOrEqual(2);
    }
  });

  it('uses only fictional links and no phone numbers', () => {
    for (const item of ALL) {
      for (const t of texts(item)) {
        expect(t, item.id).not.toMatch(/https?:|www\./i);
        // Any domain-looking token must end in .test
        for (const m of t.matchAll(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/gi)) {
          const token = m[0];
          if (/^\d+(\.\d+)*(am|pm)?$/i.test(token)) continue; // amounts like 1.50, times like 6.02pm, versions like 2.4
          if (/^S\$/i.test(token)) continue;
          expect(token, `${item.id}: ${token}`).toMatch(/\.test$/i);
        }
        // 8-digit (Singapore) phone numbers, with or without a space
        expect(t, item.id).not.toMatch(/\b[3689]\d{3}\s?\d{4}\b/);
      }
    }
  });
});

describe('Red-Flag Wordsearch content', () => {
  it.each(WORDSEARCH_PUZZLES.map((p) => [p.id, p] as const))('%s: words are valid, in the message and fit the grid', (_, p) => {
    expect(p.flags.length).toBeGreaterThanOrEqual(5);
    expect(p.flags.length).toBeLessThanOrEqual(6);
    const words = p.flags.map((f) => f.word);
    expect(new Set(words).size).toBe(words.length);
    for (const f of p.flags) {
      expect(f.word).toMatch(/^[A-Z]{3,}$/);
      expect(p.message, f.word).toMatch(wholeWord(f.word));
      if (p.plainMessage) expect(p.plainMessage, f.word).toMatch(wholeWord(f.word));
      expect(f.why.length).toBeGreaterThan(10);
      for (const b of p.bands) expect(f.word.length, `${f.word} in ${b}`).toBeLessThanOrEqual(WORDSEARCH_GRID[b].size);
      // No word hides inside another (a selection must map to exactly one word).
      for (const other of words) if (other !== f.word) expect(other.includes(f.word), `${f.word} in ${other}`).toBe(false);
    }
    // Letters to place must leave room in the grid.
    const letters = words.join('').length;
    for (const b of p.bands) expect(letters).toBeLessThanOrEqual(WORDSEARCH_GRID[b].size ** 2 * 0.6);
  });

  it('juniors never get backwards or diagonal words', () => {
    expect([...WORDSEARCH_GRID.junior.directions].sort()).toEqual(['E', 'S']);
  });
});

describe('Real or Fake? content', () => {
  it.each(REAL_OR_FAKE_CARDS.map((c) => [c.id, c] as const))('%s: clue is in the card and a tip is given', (_, c) => {
    const field = c.clue.field === 'body' ? c.body : c[c.clue.field];
    expect(field, c.clue.field).toBeDefined();
    expect(field).toContain(c.clue.text);
    if (c.clue.field === 'body' && c.plainBody) expect(c.plainBody).toContain(c.clue.text);
    expect(c.tip.length).toBeGreaterThan(10);
  });

  it('every band has both real and scam cards, enough for a balanced deck', () => {
    for (const { id } of BANDS) {
      const pool = itemsForBand(REAL_OR_FAKE_CARDS, id);
      expect(pool.filter((c) => c.verdict === 'real').length, id).toBeGreaterThanOrEqual(4);
      expect(pool.filter((c) => c.verdict === 'scam').length, id).toBeGreaterThanOrEqual(5);
    }
  });

  it('deals a balanced deck of unique cards for the band', () => {
    for (const { id } of BANDS) {
      for (let seed = 1; seed <= 30; seed++) {
        const deck = dealRealOrFake(id, mulberry32(seed));
        expect(deck).toHaveLength(REAL_OR_FAKE_DECK_SIZE);
        expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length);
        expect(deck.every((c) => c.bands.includes(id))).toBe(true);
        const real = deck.filter((c) => c.verdict === 'real').length;
        expect(real).toBeGreaterThanOrEqual(3);
        expect(real).toBeLessThanOrEqual(4);
      }
    }
  });

  it('prefers cards not seen recently', () => {
    const first = dealRealOrFake('junior', mulberry32(7));
    const second = dealRealOrFake('junior', mulberry32(8), first.map((c) => c.id));
    const repeats = second.filter((c) => first.some((f) => f.id === c.id)).length;
    // Junior has more than two decks' worth of scams but only ~7 real cards, so a little overlap is fine.
    expect(repeats).toBeLessThanOrEqual(2);
  });
});

describe('Money Trail content', () => {
  it.each(MONEY_TRAIL_SCENARIOS.map((s) => [s.id, s] as const))('%s: every step has exactly one correct option', (_, s) => {
    expect(s.steps.length).toBeGreaterThanOrEqual(3);
    expect(s.steps.length).toBeLessThanOrEqual(6);
    expect(new Set(s.steps.map((st) => st.id)).size).toBe(s.steps.length);
    for (const step of s.steps) {
      expect(step.options.length, step.id).toBeGreaterThanOrEqual(2);
      expect(step.options.length, step.id).toBeLessThanOrEqual(3);
      expect(step.options.filter((o) => o.correct).length, step.id).toBe(1);
      expect(new Set(step.options.map((o) => o.id)).size, step.id).toBe(step.options.length);
      for (const o of step.options) expect(o.explain.length, `${step.id}/${o.id}`).toBeGreaterThan(10);
    }
    // The trail always ends with "what should you do".
    expect(s.steps[s.steps.length - 1]!.node.kind).toBe('choice');
  });

  it('juniors get two clear choices per step', () => {
    for (const s of itemsForBand(MONEY_TRAIL_SCENARIOS, 'junior')) {
      for (const step of s.steps) expect(step.options.length, `${s.id}/${step.id}`).toBe(2);
    }
  });

  it('every safe final answer points to a trusted adult or a report', () => {
    for (const s of MONEY_TRAIL_SCENARIOS) {
      const last = s.steps[s.steps.length - 1]!;
      const right = last.options.find((o) => o.correct)!;
      expect(right.text, s.id).toMatch(/trusted adult|report|police|someone you trust/i);
    }
  });
});

describe('dealing rounds', () => {
  it('picks content for the band, deterministically from the seed', () => {
    for (const { id } of BANDS) {
      expect(pickWordsearch(id, mulberry32(3)).bands).toContain(id);
      expect(pickMoneyTrail(id, mulberry32(3)).bands).toContain(id);
      expect(pickRound('wordsearch', id, mulberry32(42))).toEqual(pickRound('wordsearch', id, mulberry32(42)));
    }
  });

  it('avoids the most recent puzzle when there is another one', () => {
    for (const { id } of BANDS) {
      for (let seed = 1; seed <= 10; seed++) {
        const a = pickWordsearch(id, mulberry32(seed));
        const b = pickWordsearch(id, mulberry32(seed + 100), [a.id]);
        expect(b.id).not.toBe(a.id);
      }
    }
  });

  it('shuffles money-trail options without losing the right answer', () => {
    const s = pickMoneyTrail('teen', mulberry32(9));
    const original = MONEY_TRAIL_SCENARIOS.find((x) => x.id === s.id)!;
    s.steps.forEach((step, i) => {
      expect(step.options.map((o) => o.id).sort()).toEqual(original.steps[i]!.options.map((o) => o.id).sort());
      expect(step.options.filter((o) => o.correct)).toHaveLength(1);
    });
  });

  it('reports the content ids used in a round', () => {
    const r = pickRound('real-or-fake', 'young-adult', mulberry32(1));
    expect(roundIds(r)).toHaveLength(REAL_OR_FAKE_DECK_SIZE);
  });
});
