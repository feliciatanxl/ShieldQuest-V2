// Minimal document store. Development and small pilots use JSON files under apps/server/data/
// (gitignored). The interface is deliberately tiny so a Postgres implementation can replace it
// (see docs/GAME_DESIGN.md §12) without touching route code.
//
// Privacy rule: never store names, NRIC, phone numbers, emails, IP addresses or per-player
// gameplay histories. Store aggregates, pseudonymous assessment codes and moderated content only.
//
// One narrow exception: Save Cards ('save-cards', save/routes.ts). A player who opts in may park their own
// progress here as an opaque blob encrypted on their device (AES-GCM, key derived from four random words that
// never leave the device). Each record is { id, blob, updatedAt (day only), size, rev (an upload counter) }: the
// id is a one-way PBKDF2 hash of the words, so it is not an identifier of anyone, and nothing else is stored with
// it (no IP address, no device or account data). The server cannot read the blob. Records not updated for 180 days are deleted, and
// the player can delete theirs at any time.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Collection<T extends { id: string }> {
  get(id: string): Promise<T | undefined>;
  list(filter?: (item: T) => boolean): Promise<T[]>;
  put(item: T): Promise<T>;
  remove(id: string): Promise<boolean>;
}

const DATA_DIR = process.env.SHIELDQUEST_DATA_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

class FileCollection<T extends { id: string }> implements Collection<T> {
  private cache: Map<string, T> | null = null;
  private writing: Promise<void> = Promise.resolve();
  constructor(private readonly file: string) {}

  private async load(): Promise<Map<string, T>> {
    if (this.cache) return this.cache;
    try {
      const raw = JSON.parse(await readFile(this.file, 'utf8')) as T[];
      this.cache = new Map(raw.map((x) => [x.id, x]));
    } catch {
      this.cache = new Map();
    }
    return this.cache;
  }

  private persist(): Promise<void> {
    // Serialise writes and write atomically (tmp file + rename) so a crash never corrupts data.
    this.writing = this.writing.then(async () => {
      const items = [...(this.cache ?? new Map()).values()];
      await mkdir(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, JSON.stringify(items, null, 1));
      await rename(tmp, this.file);
    });
    return this.writing;
  }

  async get(id: string) {
    return (await this.load()).get(id);
  }
  async list(filter?: (item: T) => boolean) {
    const all = [...(await this.load()).values()];
    return filter ? all.filter(filter) : all;
  }
  async put(item: T) {
    (await this.load()).set(item.id, item);
    await this.persist();
    return item;
  }
  async remove(id: string) {
    const removed = (await this.load()).delete(id);
    if (removed) await this.persist();
    return removed;
  }
}

const collections = new Map<string, Collection<{ id: string }>>();

/** Returns a named collection, e.g. collection<Submission>('submissions'). */
export function collection<T extends { id: string }>(name: string): Collection<T> {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Invalid collection name: ${name}`);
  let c = collections.get(name);
  if (!c) {
    c = new FileCollection(join(DATA_DIR, `${name}.json`));
    collections.set(name, c);
  }
  return c as unknown as Collection<T>;
}
