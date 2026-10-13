// Save Card API: validation, size caps, round trips, revs and conflicts, deletion, guessing limits and the
// 180-day purge.
// Uses Fastify's inject (same routes, hooks and rate limits) against a temporary data folder.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The store reads SHIELDQUEST_DATA_DIR when it loads, so the routes are imported only after this is set.
const dataDir = mkdtempSync(join(tmpdir(), 'shieldquest-save-'));
process.env.SHIELDQUEST_DATA_DIR = dataDir;

type Routes = typeof import('../src/save/routes');

const id = (n: number) => n.toString(16).padStart(64, '0');
const blob = (data = 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldY') => ({
  v: 1,
  salt: 'AAECAwQFBgcICQoLDA0ODw==',
  iv: 'AAECAwQFBgcICQoL',
  data,
});

describe('save card API', () => {
  let app: FastifyInstance;
  let routes: Routes;
  let clock = Date.UTC(2026, 9, 13, 10, 0, 0);

  beforeAll(async () => {
    routes = await import('../src/save/routes');
    app = Fastify();
    await routes.registerSaveRoutes(app, {
      now: () => clock,
      maxCards: 5,
      missBurst: 3,
      missRefillPerSec: 0.01,
      createBurst: 5,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  const put = (key: string, payload: unknown, ip = '10.0.0.1') =>
    app.inject({
      method: 'PUT',
      url: `/api/save/${key}`,
      payload: payload as Record<string, unknown>,
      remoteAddress: ip,
    });
  const get = (key: string, ip = '10.0.0.1') =>
    app.inject({ method: 'GET', url: `/api/save/${key}`, remoteAddress: ip });
  // The rev tests delete their cards again so the card-count limits below see the same totals.
  const del = (key: string) => app.inject({ method: 'DELETE', url: `/api/save/${key}` });

  it('stores, returns and overwrites an encrypted blob', async () => {
    expect((await put(id(1), blob())).statusCode).toBe(201);
    const res = await get(id(1));
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.json()).toEqual({ ...blob(), updatedAt: '2026-10-13', rev: 1 });

    const again = await put(id(1), blob('WFlaWFlaWFlaWFlaWFlaWFlaWFla'));
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual({ ok: true, rev: 2 });
    expect((await get(id(1))).json()).toMatchObject({
      data: 'WFlaWFlaWFlaWFlaWFlaWFlaWFla',
      rev: 2,
    });
  });

  it('stores nothing but the id, the blob, a day, a size and a rev', async () => {
    const stored = JSON.parse(readFileSync(join(dataDir, `${routes.SAVE_COLLECTION}.json`), 'utf8')) as Record<
      string,
      unknown
    >[];
    expect(Object.keys(stored[0]!).sort()).toEqual(['blob', 'id', 'rev', 'size', 'updatedAt']);
    expect(Object.keys(stored[0]!.blob as object).sort()).toEqual(['data', 'iv', 'salt', 'v']);
    expect(JSON.stringify(stored)).not.toContain('10.0.0.1');
  });

  it('refuses an upload based on an old rev, so an older device cannot overwrite newer progress', async () => {
    const key = id(7);
    const first = await put(key, { ...blob(), baseRev: 0 });
    expect(first.statusCode).toBe(201);
    expect(first.json()).toEqual({ ok: true, rev: 1 });
    // Phone uploads twice, each based on the rev it last saw.
    expect((await put(key, { ...blob('UEhPTkVQSE9ORVBIT05FUEhPTkUx'), baseRev: 1 })).json()).toEqual({
      ok: true,
      rev: 2,
    });
    expect((await put(key, { ...blob('UEhPTkVQSE9ORVBIT05FUEhPTkUy'), baseRev: 2 })).json()).toEqual({
      ok: true,
      rev: 3,
    });
    // Tablet still thinks the card is at rev 1: refused, told the current rev, and nothing changes.
    const stale = await put(key, {
      ...blob('VEFCTEVUVEFCTEVUVEFCTEVUVEFC'),
      baseRev: 1,
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ error: 'conflict', rev: 3 });
    expect(stale.json()).not.toHaveProperty('data');
    expect((await get(key)).json()).toMatchObject({
      data: 'UEhPTkVQSE9ORVBIT05FUEhPTkUy',
      rev: 3,
    });
    // "Create" on an existing card is a conflict too.
    expect((await put(key, { ...blob(), baseRev: 0 })).statusCode).toBe(409);
    // After choosing to keep its own progress, the tablet uploads based on the server's rev.
    const keep = await put(key, {
      ...blob('VEFCTEVUVEFCTEVUVEFCTEVUVEFC'),
      baseRev: 3,
    });
    expect(keep.json()).toEqual({ ok: true, rev: 4 });
    expect((await get(key)).json()).toMatchObject({
      data: 'VEFCTEVUVEFCTEVUVEFCTEVUVEFC',
      rev: 4,
    });
    await del(key);
  });

  it('lets only one of two simultaneous uploads from the same rev win', async () => {
    const key = id(8);
    await put(key, { ...blob(), baseRev: 0 });
    const [a, b] = await Promise.all([
      put(key, { ...blob('QUFBQUFBQUFBQUFBQUFBQUFBQUFB'), baseRev: 1 }),
      put(key, { ...blob('QkJCQkJCQkJCQkJCQkJCQkJCQkJC'), baseRev: 1 }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    expect((await get(key)).json()).toMatchObject({ rev: 2 });
    await del(key);
  });

  it('keeps working with cards stored before revs and with older app versions', async () => {
    const key = id(9);
    // A card written by the previous server version has no rev.
    const { collection } = await import('../src/store');
    await collection<Record<string, unknown> & { id: string }>(routes.SAVE_COLLECTION).put({
      id: key,
      blob: blob(),
      updatedAt: '2026-10-01',
      size: blob().data.length,
    });
    expect((await get(key)).json()).toMatchObject({ rev: 1 });
    expect((await put(key, { ...blob(), baseRev: 2 })).statusCode).toBe(409);
    expect((await put(key, { ...blob(), baseRev: 1 })).json()).toEqual({
      ok: true,
      rev: 2,
    });
    // An older app sends no baseRev: accepted (last upload wins, as before), and the rev still moves on.
    expect((await put(key, blob())).json()).toEqual({ ok: true, rev: 3 });
    expect((await put(key, { ...blob(), baseRev: 2 })).statusCode).toBe(409);
    expect(routes.revOf({})).toBe(1);
    expect(routes.revOf({ rev: 0 })).toBe(1);
    expect(routes.revOf({ rev: 5 })).toBe(5);
    await del(key);
  });

  it('rejects bad ids and bad bodies', async () => {
    expect((await get('nope')).statusCode).toBe(400);
    expect((await get(id(1).toUpperCase().replace(/0/g, 'A'))).statusCode).toBe(400);
    expect((await put(id(2), { ...blob(), v: 2 })).statusCode).toBe(400);
    expect((await put(id(2), { ...blob(), extra: 'hello' })).statusCode).toBe(400);
    expect((await put(id(2), { ...blob(), data: 'not base64!' })).statusCode).toBe(400);
    expect((await put(id(2), { ...blob(), iv: 'AAEC' })).statusCode).toBe(400);
    expect((await put(id(2), { ...blob(), baseRev: -1 })).statusCode).toBe(400);
    expect((await put(id(2), { ...blob(), baseRev: 1.5 })).statusCode).toBe(400);
    expect((await put(id(2), { ...blob(), baseRev: '1' })).statusCode).toBe(400);
  });

  it('caps the blob size', async () => {
    const tooBig = 'A'.repeat(routes.SAVE_MAX_DATA_CHARS + 4);
    expect((await put(id(3), blob(tooBig))).statusCode).toBe(413);
    expect((await put(id(3), blob('A'.repeat(routes.SAVE_MAX_DATA_CHARS)))).statusCode).toBe(201);
  });

  it('deletes a card', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/save/${id(3)}`,
    });
    expect(del.json()).toEqual({ ok: true, removed: true });
    expect((await get(id(3))).statusCode).toBe(404);
  });

  it('slows down an address that keeps missing, without blocking other addresses', async () => {
    const ip = '10.9.9.9';
    let codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await get(id(1000 + i), ip)).statusCode);
    expect(codes).toEqual([404, 404, 404, 429, 429]);
    // Even a real card is refused while the address is cooling down.
    expect((await get(id(1), ip)).statusCode).toBe(429);
    expect((await get(id(1), '10.0.0.2')).statusCode).toBe(200);
    clock += 200_000; // refills 2 tokens at 0.01/s
    codes = [];
    for (let i = 0; i < 3; i++) codes.push((await get(id(2000 + i), ip)).statusCode);
    expect(codes).toEqual([404, 404, 429]);
  });

  it('limits new cards per address and in total', async () => {
    const ip = '10.5.5.5';
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await put(id(500 + i), blob(), ip)).statusCode);
    // createBurst 5 per address, but only 5 cards fit in total (1 already stored).
    expect(codes).toEqual([201, 201, 201, 201, 507, 507]);
    // Updating an existing card is always allowed.
    expect((await put(id(500), blob(), ip)).statusCode).toBe(200);
  });

  it('purges cards not updated for 180 days', async () => {
    clock += 100 * 86_400_000;
    expect((await put(id(1), blob())).statusCode).toBe(200);
    expect(await routes.purgeStaleSaveCards(new Date(clock + 179 * 86_400_000))).toBe(4);
    expect((await get(id(1), '10.1.1.1')).statusCode).toBe(200);
    expect(await routes.purgeStaleSaveCards(new Date(clock + 181 * 86_400_000))).toBe(1);
    expect((await get(id(1), '10.1.1.1')).statusCode).toBe(404);
  });
});

describe('AddressBuckets', () => {
  it('forgets addresses once they have refilled', async () => {
    const { AddressBuckets } = await import('../src/save/routes');
    const b = new AddressBuckets(2, 1);
    b.spend('a', 0);
    b.spend('b', 0);
    expect(b.size).toBe(2);
    b.prune(500);
    expect(b.size).toBe(2);
    b.prune(1500);
    expect(b.size).toBe(0);
  });
});
