// Save Cards: carry solo progress to another device with no account, password, email or social login.
//
// The player's device turns four random words (the Save Card) into two independent values with PBKDF2:
// a lookup id and an AES-GCM key. It encrypts its progress, settings and rewards with that key and stores the
// result here under the id. The server therefore holds only:
//   { id: 64 hex chars, blob: { v, salt, iv, data } (ciphertext), updatedAt: day only, size: bytes, rev: counter }
// It never receives the words, cannot decrypt the blob, and cannot tell whose it is.
//
// Privacy and abuse rules enforced here:
// - Routes log at 'warn' only, so ids never reach the access log. IP addresses are used only as keys of short-lived
//   in-memory rate limiters (never stored, never logged) to make guessing codes pointless.
// - Blobs are capped (48 KB of base64), cards are capped in number and total size, and a card not updated for
//   180 days is deleted (purgeStaleSaveCards, swept from index.ts).
//
// Two devices can share one card. Every accepted upload bumps an integer `rev`, and an upload names the rev it was
// based on (`baseRev`, 0 for a new card). If another device uploaded in between, the PUT is refused with 409 and the
// current rev, so the device can download the newer save and let the player choose instead of silently overwriting
// it. The rev is a plain counter and reveals nothing about the save. Cards stored before revs existed count as rev 1,
// and uploads without baseRev (older app versions) are still accepted as before.

import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { collection } from '../store';

export const SAVE_COLLECTION = 'save-cards';

/** Largest accepted ciphertext, as base64 characters (about 36 KB of binary). */
export const SAVE_MAX_DATA_CHARS = 48 * 1024;
/** Cards untouched for this long are deleted. */
export const SAVE_RETENTION_DAYS = 180;

export interface SaveBlob {
  v: 1;
  /** Per-card PBKDF2 salt, base64 (16 bytes). */
  salt: string;
  /** AES-GCM nonce, base64 (12 bytes). */
  iv: string;
  /** AES-GCM ciphertext + tag, base64. */
  data: string;
}

export interface SaveCardRecord {
  id: string;
  blob: SaveBlob;
  /** 'YYYY-MM-DD' (UTC). Day precision is all the 180-day expiry needs. */
  updatedAt: string;
  /** Size of blob.data in characters, for the storage cap. */
  size: number;
  /** Bumped by every accepted upload. Absent on cards stored before revs existed: read as 1 (see revOf). */
  rev?: number;
}

/** A stored card's rev (cards from before revs existed are rev 1). */
export const revOf = (card: Pick<SaveCardRecord, 'rev'>): number =>
  typeof card.rev === 'number' && Number.isInteger(card.rev) && card.rev > 0 ? card.rev : 1;

const ID = /^[0-9a-f]{64}$/;
const b64 = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/);

const SaveBody = z
  .object({
    v: z.literal(1),
    salt: b64(22, 24),
    iv: b64(16, 16),
    data: b64(24, SAVE_MAX_DATA_CHARS),
    /** The rev this upload was based on: 0 for a new card. Absent from older app versions (no check). */
    baseRev: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  })
  .strict();

const cards = () => collection<SaveCardRecord>(SAVE_COLLECTION);

const dayOf = (ts: number) => new Date(ts).toISOString().slice(0, 10);

/** Retention: deletes cards whose last update is more than `days` before `now`. Returns how many were removed. */
export async function purgeStaleSaveCards(now: Date, days = SAVE_RETENTION_DAYS): Promise<number> {
  const cutoff = now.getTime() - days * 86_400_000;
  const store = cards();
  const stale = await store.list((c) => Date.parse(`${c.updatedAt}T00:00:00Z`) < cutoff);
  for (const c of stale) await store.remove(c.id);
  return stale.length;
}

/**
 * In-memory token buckets keyed by client address. Unlike squad/limits.ts's TokenBucket it can be checked without
 * spending, so only failed lookups cost a token. Addresses live here for minutes at most and are never logged.
 */
export class AddressBuckets {
  private readonly buckets = new Map<string, { tokens: number; last: number }>();
  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {}

  private refill(key: string, now: number) {
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: this.capacity, last: now };
      this.buckets.set(key, b);
    }
    b.tokens = Math.min(this.capacity, b.tokens + (Math.max(0, now - b.last) / 1000) * this.refillPerSec);
    b.last = now;
    return b;
  }

  /** True when the address has no tokens left. */
  empty(key: string, now: number): boolean {
    return this.refill(key, now).tokens < 1;
  }

  spend(key: string, now: number): void {
    const b = this.refill(key, now);
    b.tokens = Math.max(0, b.tokens - 1);
    if (this.buckets.size > 10_000) this.prune(now);
  }

  /** Drops buckets that have refilled completely (they hold nothing worth remembering). */
  prune(now: number): void {
    for (const [key, b] of this.buckets) {
      if (b.tokens + ((now - b.last) / 1000) * this.refillPerSec >= this.capacity) this.buckets.delete(key);
    }
  }

  get size() {
    return this.buckets.size;
  }
}

export interface SaveRouteOptions {
  now?: () => number;
  /** Most cards stored at once (env SAVE_CARD_LIMIT, default 5000). */
  maxCards?: number;
  /** Most base64 characters stored across all cards (env SAVE_CARD_MAX_MB, default 64 MB). */
  maxTotalChars?: number;
  /** Failed lookups per address: burst and refill per second. Default 40 burst, 1 every 10 s. */
  missBurst?: number;
  missRefillPerSec?: number;
  /** New cards per address: burst and refill per second. Default 120 burst, 120 an hour. */
  createBurst?: number;
  createRefillPerSec?: number;
}

export async function registerSaveRoutes(app: FastifyInstance, opts: SaveRouteOptions = {}): Promise<void> {
  const now = opts.now ?? Date.now;
  const maxCards = opts.maxCards ?? (Number(process.env.SAVE_CARD_LIMIT) || 5000);
  const maxTotalChars = opts.maxTotalChars ?? (Number(process.env.SAVE_CARD_MAX_MB) || 64) * 1024 * 1024;
  // A whole class usually shares one school address, so these allow a room of typos while making 2^40 codes
  // impossible to search (at 1 miss every 10 s, one address tries about 8,600 codes a day).
  const misses = new AddressBuckets(opts.missBurst ?? 40, opts.missRefillPerSec ?? 0.1);
  const creates = new AddressBuckets(opts.createBurst ?? 120, opts.createRefillPerSec ?? 120 / 3600);
  const pruner = setInterval(() => {
    misses.prune(now());
    creates.prune(now());
  }, 10 * 60_000);
  pruner.unref();
  app.addHook('onClose', async () => clearInterval(pruner));

  const idOf = (req: FastifyRequest): string | null => {
    const id = (req.params as { id?: unknown }).id;
    return typeof id === 'string' && ID.test(id) ? id : null;
  };
  const badId = (reply: FastifyReply) =>
    reply.code(400).send({ error: 'bad-id', message: 'That is not a Save Card id.' });

  // Uploads to one card run one at a time, so two devices cannot both pass the rev check before either is stored.
  const locks = new Map<string, Promise<unknown>>();
  const withLock = <T>(id: string, fn: () => Promise<T>): Promise<T> => {
    const prev = locks.get(id) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    const tail = run.catch(() => undefined);
    locks.set(id, tail);
    void tail.then(() => {
      if (locks.get(id) === tail) locks.delete(id);
    });
    return run;
  };

  await app.register(async (scope) => {
    if (!scope.hasDecorator('rateLimit')) await scope.register(rateLimit, { global: false });

    scope.get(
      '/api/save/:id',
      {
        logLevel: 'warn',
        config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      },
      async (req, reply) => {
        void reply.header('cache-control', 'no-store');
        const id = idOf(req);
        if (!id) return badId(reply);
        const t = now();
        if (misses.empty(req.ip, t)) {
          void reply.header('retry-after', '60');
          return reply.code(429).send({
            error: 'slow-down',
            message: 'Too many tries. Wait a minute and try again.',
          });
        }
        const card = await cards().get(id);
        if (!card) {
          misses.spend(req.ip, t);
          return reply.code(404).send({
            error: 'not-found',
            message: 'No Save Card with that code.',
          });
        }
        return { ...card.blob, updatedAt: card.updatedAt, rev: revOf(card) };
      },
    );

    scope.put(
      '/api/save/:id',
      {
        logLevel: 'warn',
        bodyLimit: SAVE_MAX_DATA_CHARS + 1024,
        config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
      },
      async (req, reply) => {
        void reply.header('cache-control', 'no-store');
        const id = idOf(req);
        if (!id) return badId(reply);
        const parsed = SaveBody.safeParse(req.body);
        if (!parsed.success) {
          const tooBig =
            typeof (req.body as { data?: unknown })?.data === 'string' &&
            (req.body as { data: string }).data.length > SAVE_MAX_DATA_CHARS;
          return tooBig
            ? reply.code(413).send({ error: 'too-big', message: 'This save is too big.' })
            : reply.code(400).send({
                error: 'bad-request',
                message: 'That save could not be read.',
              });
        }
        const { baseRev, ...blob } = parsed.data;
        return withLock(id, async () => {
          const store = cards();
          const existing = await store.get(id);
          const t = now();
          if (existing && baseRev !== undefined && baseRev !== revOf(existing)) {
            return reply.code(409).send({
              error: 'conflict',
              message: 'This Save Card has newer progress from another device.',
              rev: revOf(existing),
            });
          }
          if (!existing) {
            if (creates.empty(req.ip, t)) {
              void reply.header('retry-after', '600');
              return reply.code(429).send({
                error: 'slow-down',
                message: 'Too many new Save Cards from here. Try again later.',
              });
            }
            const all = await store.list();
            const total = all.reduce((n, c) => n + c.size, 0);
            if (all.length >= maxCards || total + blob.data.length > maxTotalChars) {
              return reply.code(507).send({
                error: 'full',
                message: 'Save Cards are full right now. Your progress is still on this device.',
              });
            }
            creates.spend(req.ip, t);
          }
          // A card that is gone (removed elsewhere, or expired) is simply stored again, starting over at rev 1.
          const rev = existing ? revOf(existing) + 1 : 1;
          const stored: SaveBlob = blob;
          await store.put({
            id,
            blob: stored,
            updatedAt: dayOf(t),
            size: stored.data.length,
            rev,
          });
          return reply.code(existing ? 200 : 201).send({ ok: true, rev });
        });
      },
    );

    scope.delete(
      '/api/save/:id',
      {
        logLevel: 'warn',
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      },
      async (req, reply) => {
        void reply.header('cache-control', 'no-store');
        const id = idOf(req);
        if (!id) return badId(reply);
        const removed = await cards().remove(id);
        return { ok: true, removed };
      },
    );
  });
}
