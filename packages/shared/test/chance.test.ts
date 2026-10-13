import { describe, expect, it } from 'vitest';
import { BANDS, CHANCE_QUESTIONS, chanceFor, pickChance, pickChanceSet } from '../src';

describe('chance questions', () => {
  it('has at least 30 questions with unique ids', () => {
    expect(CHANCE_QUESTIONS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(CHANCE_QUESTIONS.map((q) => q.id)).size).toBe(CHANCE_QUESTIONS.length);
  });

  it('every question has 2-4 options, unique option ids and a valid answer', () => {
    for (const q of CHANCE_QUESTIONS) {
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(2);
      expect(q.options.length, q.id).toBeLessThanOrEqual(4);
      expect(new Set(q.options.map((o) => o.id)).size, q.id).toBe(q.options.length);
      expect(q.options.some((o) => o.id === q.answer), q.id).toBe(true);
      expect(q.bands.length, q.id).toBeGreaterThan(0);
    }
  });

  it('keeps every "why" to 25 words or fewer', () => {
    for (const q of CHANCE_QUESTIONS) expect(q.why.split(/\s+/).filter(Boolean).length, q.id).toBeLessThanOrEqual(25);
  });

  it('gives every band at least 10 questions', () => {
    for (const b of BANDS) expect(chanceFor(b.id).length, b.id).toBeGreaterThanOrEqual(10);
  });

  it('uses only fictional links and no phone numbers', () => {
    for (const q of CHANCE_QUESTIONS) {
      const text = [q.prompt, q.why, ...q.options.map((o) => o.text)].join(' ');
      expect(text, q.id).not.toMatch(/https?:|www\./i);
      for (const domain of text.match(/\b[a-z0-9-]+\.[a-z]{2,}\b/gi) ?? []) expect(domain, q.id).toMatch(/\.test$/);
      expect(text, q.id).not.toMatch(/\d{4}\s?\d{4}/);
    }
  });

  it('picks band questions and avoids recent ones', () => {
    const q = pickChance('junior', () => 0);
    expect(q.bands).toContain('junior');
    const avoid = chanceFor('junior')
      .slice(0, -1)
      .map((x) => x.id);
    expect(avoid).not.toContain(pickChance('junior', () => 0.5, avoid).id);
  });

  it('picks a seeded set of unique band questions, preferred kinds first (Squad Dash)', () => {
    const seeded = (seed: number) => {
      let a = seed;
      return () => ((a = (a * 1103515245 + 12345) % 2147483648) / 2147483648);
    };
    for (const b of BANDS) {
      const set = pickChanceSet(b.id, 8, seeded(7), { kinds: ['scam-or-safe'] });
      expect(set, b.id).toHaveLength(8);
      expect(new Set(set.map((q) => q.id)).size, b.id).toBe(8);
      for (const q of set) expect(q.bands, q.id).toContain(b.id);
      const preferred = chanceFor(b.id).filter((q) => q.kind === 'scam-or-safe').length;
      // Preferred kinds fill the set before any other kind is used.
      const firstOther = set.findIndex((q) => q.kind !== 'scam-or-safe');
      if (firstOther >= 0) expect(firstOther, b.id).toBe(Math.min(8, preferred));
    }
    // Same seed, same set; a different seed usually differs.
    const ids = (s: number) => pickChanceSet('teen', 6, seeded(s)).map((q) => q.id);
    expect(ids(42)).toEqual(ids(42));
    // Avoided ids come last, and only when nothing fresh is left.
    const all = chanceFor('teen');
    const avoid = all.slice(0, all.length - 3).map((q) => q.id);
    const set = pickChanceSet('teen', 5, seeded(3), { avoid });
    expect(set.slice(0, 3).every((q) => !avoid.includes(q.id))).toBe(true);
    expect(set).toHaveLength(5);
    expect(pickChanceSet('teen', 0)).toEqual([]);
    expect(pickChanceSet('junior', 500).length).toBe(chanceFor('junior').length);
  });
});
