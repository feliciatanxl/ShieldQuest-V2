import { describe, expect, it } from 'vitest';
import {
  SAVE_CODE_WORDS,
  SAVE_WORDS,
  makeSaveCode,
  normalizeSaveCode,
  parseSaveCode,
  suggestSaveWords,
} from '@shieldquest/shared';

describe('Save Card words', () => {
  it('is exactly 1024 unique, short, letters-only words', () => {
    expect(SAVE_WORDS.length).toBe(1024);
    expect(new Set(SAVE_WORDS).size).toBe(SAVE_WORDS.length);
    for (const w of SAVE_WORDS) expect(w).toMatch(/^[A-Z]{3,7}$/);
  });

  it('leaves out words that would be confusing or unsafe on a card', () => {
    for (const w of [
      'BEAR',
      'SEA',
      'SUN',
      'PEA',
      'COLOR',
      'COLOUR',
      'CASH',
      'PRIZE',
      'CODE',
      'LINK',
      'MULE',
      'SHARK',
      'GUN',
      'KILL',
    ]) {
      expect(SAVE_WORDS).not.toContain(w);
    }
  });

  it('makes four list words from the random source', () => {
    let i = 0;
    const seq = [0xffff_ffff, 5, 1024 + 3, 0];
    const fill = (a: Uint32Array) => {
      a[0] = seq[i++ % seq.length]!;
      return a;
    };
    const code = makeSaveCode(fill);
    expect(code.split('-')).toHaveLength(SAVE_CODE_WORDS);
    expect(code).toBe([SAVE_WORDS[1023], SAVE_WORDS[5], SAVE_WORDS[3], SAVE_WORDS[0]].join('-'));
    for (let n = 0; n < 50; n++) expect(normalizeSaveCode(makeSaveCode())).not.toBeNull();
  });

  it('reads codes in any case and with any separators', () => {
    const code = 'TIGER-MANGO-ROCKET-CLOUD';
    for (const typed of [
      'tiger mango rocket cloud',
      ' Tiger-Mango-Rocket-Cloud ',
      'TIGER.MANGO_ROCKET  CLOUD',
      'tigermangorocketcloud',
      'tiger mangorocket cloud',
    ]) {
      expect(parseSaveCode(typed)).toEqual({ ok: true, code });
    }
  });

  it('explains what is wrong', () => {
    expect(parseSaveCode('  ')).toEqual({ ok: false, reason: 'empty' });
    expect(parseSaveCode('tiger mango rocket')).toMatchObject({ ok: false, reason: 'count', count: 3 });
    expect(parseSaveCode('tiger mango rocket cloud lemon')).toMatchObject({ ok: false, reason: 'count', count: 5 });
    expect(parseSaveCode('tyger mango rocket cloud')).toEqual({
      ok: false,
      reason: 'unknown',
      word: 'TYGER',
      suggestions: ['TIGER'],
    });
    expect(parseSaveCode('tiger mnago rocket cloud')).toMatchObject({
      reason: 'unknown',
      word: 'MNAGO',
      suggestions: ['MANGO'],
    });
    expect(parseSaveCode('kind eal radio durian')).toMatchObject({ word: 'EAL', suggestions: ['EEL', 'SEAL', 'TEAL'] });
    expect(suggestSaveWords('QQQQ')).toEqual([]);
  });
});
