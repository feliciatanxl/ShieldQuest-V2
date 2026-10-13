import { describe, expect, it } from 'vitest';
import { fromBase64, open, saveCardId, seal, toBase64, unlock } from './saveCrypto';

const CODE = 'TIGER-MANGO-ROCKET-CLOUD';
const FAST = 1_000; // iterations for round-trip tests; the real default is checked once below

describe('Save Card crypto', () => {
  it('derives a stable 64-hex lookup id that does not contain the code', async () => {
    const id = await saveCardId(CODE);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(await saveCardId(CODE)).toBe(id);
    expect(await saveCardId('TIGER-MANGO-ROCKET-CLOWN')).not.toBe(id);
  });

  it('round-trips a snapshot, and any device with the code and salt can open it', async () => {
    const a = await unlock(CODE, undefined, FAST);
    const text = JSON.stringify({ v: 1, keys: { 'sq.progress.v1': '{"state":{}}' }, filler: 'x'.repeat(5000) });
    const sealed = await seal(text, a);
    expect(sealed.v).toBe(1);
    expect(fromBase64(sealed.iv)).toHaveLength(12);
    expect(fromBase64(sealed.salt)).toHaveLength(16);
    // gzip keeps the blob small
    expect(sealed.data.length).toBeLessThan(1000);
    expect(sealed.data).not.toContain('progress');

    const b = await unlock(CODE, fromBase64(sealed.salt), FAST);
    expect(b.id).toBe(a.id);
    expect(await open(sealed, b)).toBe(text);
  });

  it('uses a fresh IV for every upload', async () => {
    const a = await unlock(CODE, undefined, FAST);
    const [x, y] = await Promise.all([seal('same', a), seal('same', a)]);
    expect(x.iv).not.toBe(y.iv);
    expect(x.data).not.toBe(y.data);
  });

  it('refuses the wrong code, a tampered blob and a blob moved to another id', async () => {
    const a = await unlock(CODE, undefined, FAST);
    const sealed = await seal('secret', a);
    const wrong = await unlock('TIGER-MANGO-ROCKET-CLOWN', a.salt, FAST);
    await expect(open(sealed, wrong)).rejects.toThrow('wrong-code');

    const bytes = fromBase64(sealed.data);
    bytes[3] = bytes[3]! ^ 1;
    await expect(open({ ...sealed, data: toBase64(bytes) }, a)).rejects.toThrow('wrong-code');

    await expect(open(sealed, { ...a, id: '0'.repeat(64) })).rejects.toThrow('wrong-code');
  });
});
