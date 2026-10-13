import { describe, expect, it } from 'vitest';
import { decideSync, summarize, type LocalSide } from './saveSync';

const local = (over: Partial<LocalSide> = {}): LocalSide => ({ rev: 3, lastHash: 'A', currentHash: 'A', ...over });

describe('decideSync', () => {
  it('uploads changes when nobody else saved since this device last synced', () => {
    expect(decideSync(local({ currentHash: 'B' }), { rev: 3, hash: 'A' })).toEqual({ action: 'push', baseRev: 3 });
  });

  it('just catches up when both sides already match', () => {
    expect(decideSync(local(), { rev: 3, hash: 'A' })).toEqual({ action: 'in-sync', rev: 3 });
    // Same progress reached on both devices (or the same save loaded twice): adopt the newer rev, no prompt.
    expect(decideSync(local({ currentHash: 'C' }), { rev: 7, hash: 'C' })).toEqual({ action: 'in-sync', rev: 7 });
  });

  it('asks when another device saved newer progress, even if this device has not changed', () => {
    // The school tablet opened again a week later: unchanged, but the phone saved twice since.
    expect(decideSync(local(), { rev: 5, hash: 'P' })).toEqual({ action: 'ask', rev: 5 });
    // Both devices played.
    expect(decideSync(local({ currentHash: 'T' }), { rev: 5, hash: 'P' })).toEqual({ action: 'ask', rev: 5 });
  });

  it('uploads over a newer rev that still holds what this device last synced', () => {
    // e.g. an upload whose reply was lost: the server moved on with exactly this device's last save.
    expect(decideSync(local({ currentHash: 'B' }), { rev: 4, hash: 'A' })).toEqual({ action: 'push', baseRev: 4 });
  });

  it('makes the card again when the server no longer has it', () => {
    expect(decideSync(local(), null)).toEqual({ action: 'push', baseRev: 0 });
  });

  it('handles cards from before revs existed', () => {
    const old = local({ rev: undefined });
    expect(decideSync(old, { rev: 1, hash: 'A' })).toEqual({ action: 'in-sync', rev: 1 });
    expect(decideSync({ ...old, currentHash: 'B' }, { rev: 1, hash: 'A' })).toEqual({ action: 'push', baseRev: 1 });
    expect(decideSync({ ...old, currentHash: 'B' }, { rev: 1, hash: 'Z' })).toEqual({ action: 'ask', rev: 1 });
    // Never synced at all (no hash either): anything different on the server is worth asking about.
    expect(decideSync({ rev: undefined, lastHash: undefined, currentHash: 'B' }, { rev: 2, hash: 'Z' })).toEqual({
      action: 'ask',
      rev: 2,
    });
  });

  it('asks rather than overwrite a card that was made again elsewhere with a lower rev', () => {
    expect(decideSync(local({ rev: 9 }), { rev: 1, hash: 'Z' })).toEqual({ action: 'ask', rev: 1 });
  });
});

describe('summarize', () => {
  const keys = (rewards: unknown, progress: unknown) => ({
    'sq.rewards.v1': JSON.stringify({ state: { rewards }, version: 1 }),
    'sq.progress.v1': JSON.stringify({ state: { progress }, version: 1 }),
  });

  it('reads lifetime Stars, missions and the handle', () => {
    expect(summarize(keys({ handle: 'BraveOtter12', stars: 4, starsEarned: 30 }, { completedCount: 6 }))).toEqual({
      handle: 'BraveOtter12',
      stars: 30,
      missions: 6,
    });
  });

  it('falls back to current Stars on older saves and copes with missing or broken values', () => {
    expect(summarize(keys({ stars: 4 }, {})).stars).toBe(4);
    expect(summarize({})).toEqual({ handle: null, stars: null, missions: null });
    expect(summarize({ 'sq.rewards.v1': 'not json', 'sq.progress.v1': '{}' })).toEqual({
      handle: null,
      stars: null,
      missions: null,
    });
  });
});
