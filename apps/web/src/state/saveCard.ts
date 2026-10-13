// Save Card: keep progress across devices with no account, password, email or social login.
//
// A Save Card is four random words (shared/saveWords.ts). This device derives a lookup id and an AES key from them
// (saveCrypto.ts), encrypts a snapshot of the SAVE_KEYS below and uploads only the ciphertext. Any device that
// knows the words can download and decrypt it. The words stay on the device (in localStorage, so the card can be
// shown again) and are never sent anywhere.
//
// After a card exists, changes to progress, rewards and settings are uploaded a few seconds after they happen.
// Uploads that fail (offline, server busy) are retried when the device comes back online.
//
// Two devices can use the same card. Each upload names the server rev it is based on, so an older device (a school
// tablet opened again a week later) cannot silently overwrite newer progress made on a phone. Before its first upload
// after starting, and after the server refuses one (409), a device downloads the card, decrypts it here and decides
// (saveSync.ts) whether to upload, just catch up, or pause and ask the player which progress to keep.

import { create } from 'zustand';
import { makeSaveCode, parseSaveCode, type SaveCodeResult } from '@shieldquest/shared';
import { useProgress } from './progress';
import { useRewards } from './rewards';
import { useSettings } from './settings';
import {
  digest,
  fromBase64,
  open,
  saveCardId,
  saveCardKey,
  seal,
  toBase64,
  unlock,
  type SealedSave,
  type Unlocked,
} from './saveCrypto';
import { decideSync, MAX_CONFLICT_RETRIES, summarize } from './saveSync';

/** localStorage keys carried by a Save Card. Later features can add theirs here. */
export const SAVE_KEYS: readonly string[] = ['sq.progress.v1', 'sq.settings.v1', 'sq.rewards.v1'];

/** Where this device keeps its own Save Card (words + salt). App.tsx reads this key directly. */
export const SAVE_CARD_KEY = 'sq.savecard.v1';

/** Keep in step with the server's SAVE_MAX_DATA_CHARS. */
const MAX_DATA_CHARS = 48 * 1024;
const DEBOUNCE_MS = 4_000;

interface LocalCard {
  v: 1;
  code: string;
  /** Card salt, base64. */
  salt: string;
  /** Hash of the last snapshot the server accepted. */
  lastHash?: string;
  /** When the server last accepted an upload (ms). */
  savedAt?: number;
  /** A change is waiting to be uploaded. */
  pending?: boolean;
  /** When the waiting change was first noticed (ms). Shown if another device's save conflicts with it. */
  changedAt?: number;
  /** Server rev this device last synced from or to (0 = never uploaded). Absent on cards from before revs. */
  rev?: number;
}

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'full' | 'error' | 'conflict';

/** The card on the server has progress this device has not seen. Uploads pause until the player chooses. */
export interface SaveConflict {
  /** The server's save, decrypted on this device and ready for applySaveCard(). */
  server: Extract<LoadResult, { ok: true }>;
  /** When this device's own progress last changed or was saved (ms), if known. */
  localAt: number | null;
}

interface SaveCardState {
  code: string | null;
  status: SyncStatus;
  savedAt: number | null;
  conflict: SaveConflict | null;
}

/** UI state: the card's code and how the last upload went. */
export const useSaveCard = create<SaveCardState>(() => {
  const card = readCard();
  return {
    code: card?.code ?? null,
    status: card ? (card.pending ? 'offline' : 'saved') : 'idle',
    savedAt: card?.savedAt ?? null,
    conflict: null,
  };
});

// ---------------------------------------------------------------------------------------------
// Local storage (can throw on locked-down devices: then a card just cannot be made)

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to do */
  }
}

function readCard(): LocalCard | null {
  try {
    const raw = lsGet(SAVE_CARD_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as LocalCard;
    return c && c.v === 1 && typeof c.code === 'string' && typeof c.salt === 'string' ? c : null;
  } catch {
    return null;
  }
}

function writeCard(card: LocalCard): boolean {
  return lsSet(SAVE_CARD_KEY, JSON.stringify(card));
}

export function hasSaveCard(): boolean {
  return readCard() !== null;
}

// ---------------------------------------------------------------------------------------------
// Snapshot

export interface Snapshot {
  v: 1;
  savedAt: number;
  keys: Record<string, string>;
}

// zustand's persist writes a store only after its first change, so a new player's state (handle included) may
// not be in storage yet. An empty setState makes persist write it. Listeners ignore these writes.
const STORE_KEYS = ['sq.progress.v1', 'sq.settings.v1', 'sq.rewards.v1'];
let flushing = false;

function flushStores(): void {
  if (!STORE_KEYS.some((k) => lsGet(k) === null)) return;
  flushing = true;
  try {
    useProgress.setState({});
    useRewards.setState({});
    useSettings.setState({});
  } finally {
    flushing = false;
  }
}

function takeSnapshot(): { text: string; keysJson: string } {
  flushStores();
  const keys: Record<string, string> = {};
  for (const k of SAVE_KEYS) {
    const v = lsGet(k);
    if (v !== null) keys[k] = v;
  }
  const snap: Snapshot = { v: 1, savedAt: Date.now(), keys };
  return { text: JSON.stringify(snap), keysJson: JSON.stringify(keys) };
}

/** This device's saved values as they are in storage right now (no store writes, so safe during render). */
function currentKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const k of SAVE_KEYS) {
    const v = lsGet(k);
    if (v !== null) keys[k] = v;
  }
  return keys;
}

function readSnapshot(text: string): Snapshot | null {
  try {
    const s = JSON.parse(text) as Snapshot;
    if (!s || s.v !== 1 || typeof s.keys !== 'object' || s.keys === null) return null;
    const keys: Record<string, string> = {};
    for (const k of SAVE_KEYS) {
      const v = s.keys[k];
      if (typeof v !== 'string') continue;
      JSON.parse(v); // each value must be the JSON a store wrote
      keys[k] = v;
    }
    return { v: 1, savedAt: Number(s.savedAt) || 0, keys };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Keys (derived once per code and kept in memory: PBKDF2 is slow on purpose)

let unlocked: { code: string; salt: string; u: Promise<Unlocked> } | null = null;

function unlockCard(card: LocalCard): Promise<Unlocked> {
  if (!unlocked || unlocked.code !== card.code || unlocked.salt !== card.salt) {
    const u = unlock(card.code, fromBase64(card.salt));
    unlocked = { code: card.code, salt: card.salt, u };
    u.catch(() => {
      if (unlocked?.u === u) unlocked = null;
    });
  }
  return unlocked.u;
}

// ---------------------------------------------------------------------------------------------
// Upload

const api = (id: string) => `/api/save/${id}`;

let syncing: Promise<void> | null = null;
let again = false;
let restoring = false;
/** The server copy has been checked since this page started (reset by a 409, so the next upload checks again). */
let verified = false;
/** 409s in a row; caps automatic re-checks so two devices can never ping-pong forever. */
let conflicts = 0;

function setStatus(status: SyncStatus, savedAt?: number) {
  useSaveCard.setState(savedAt === undefined ? { status } : { status, savedAt });
}

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Updates the stored card if it is still the one `code` names (it may be removed or replaced mid-request). */
function updateCard(code: string, patch: Partial<LocalCard>): void {
  const latest = readCard();
  if (latest && latest.code === code) writeCard({ ...latest, ...patch });
}

type Downloaded =
  | { ok: true; snapshot: Snapshot; salt: string; rev: number }
  | { ok: false; reason: 'not-found' | 'wrong-code' | 'offline' | 'slow-down' | 'unsupported' | 'error' };

/** Downloads and decrypts the card stored under `id`. `known` skips the slow key derivation when the salt matches. */
async function download(id: string, code: string, known?: Unlocked): Promise<Downloaded> {
  let res: Response;
  try {
    res = await fetch(api(id), { cache: 'no-store', credentials: 'omit', headers: { accept: 'application/json' } });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (res.status === 404) return { ok: false, reason: 'not-found' };
  if (res.status === 429) return { ok: false, reason: 'slow-down' };
  if (!res.ok) return { ok: false, reason: 'error' };
  try {
    const sealed = (await res.json()) as SealedSave & { rev?: unknown };
    const salt = fromBase64(sealed.salt);
    const key = known && toBase64(known.salt) === sealed.salt ? known.key : await saveCardKey(code, salt);
    const snapshot = readSnapshot(await open(sealed, { id, key, salt }));
    if (!snapshot) return { ok: false, reason: 'unsupported' };
    // Servers from before revs send none: their cards count as rev 1.
    const rev = typeof sealed.rev === 'number' && Number.isInteger(sealed.rev) && sealed.rev > 0 ? sealed.rev : 1;
    return { ok: true, snapshot, salt: sealed.salt, rev };
  } catch (err) {
    const m = err instanceof Error ? err.message : '';
    return { ok: false, reason: m === 'wrong-code' || m === 'unsupported' ? m : 'error' };
  }
}

async function upload(keepalive: boolean): Promise<void> {
  const card = readCard();
  if (!card || restoring) return;
  // Waiting for the player to choose between this device's progress and a newer save: upload nothing.
  if (useSaveCard.getState().conflict) {
    setStatus('conflict');
    return;
  }
  const { text, keysJson } = takeSnapshot();
  const hash = await digest(keysJson);
  const changed = hash !== card.lastHash || card.pending === true;
  if (!changed && verified) {
    setStatus('saved');
    return;
  }
  if (changed) writeCard({ ...card, pending: true, changedAt: card.changedAt ?? Date.now() });
  if (offline()) {
    setStatus(changed ? 'offline' : 'saved'); // the 'online' listener retries
    return;
  }
  if (changed) setStatus('saving');
  try {
    const u = await unlockCard(card);
    let baseRev = card.rev;

    if (!verified) {
      // First upload since the app started, or the server refused the last one: look at the server copy first.
      const server = await download(u.id, card.code, u);
      if (!server.ok && server.reason !== 'not-found') throw new Error(server.reason);
      const decision = decideSync(
        { rev: card.rev, lastHash: card.lastHash, currentHash: hash },
        server.ok ? { rev: server.rev, hash: await digest(JSON.stringify(server.snapshot.keys)) } : null,
      );
      if (decision.action === 'ask' && server.ok) {
        conflicts = 0;
        const latest = readCard();
        useSaveCard.setState({
          status: 'conflict',
          conflict: {
            server: {
              ok: true,
              code: card.code,
              preview: previewOf(server.snapshot),
              snapshot: server.snapshot,
              salt: server.salt,
              rev: server.rev,
            },
            localAt: (changed ? latest?.changedAt : latest?.savedAt) ?? card.savedAt ?? null,
          },
        });
        return;
      }
      verified = true;
      if (decision.action === 'in-sync') {
        updateCard(card.code, { rev: decision.rev, lastHash: hash, pending: false, changedAt: undefined });
        conflicts = 0;
        failures = 0;
        setStatus('saved');
        return;
      }
      if (decision.action === 'push') {
        baseRev = decision.baseRev;
        // The server holds nothing this device lacks, so its rev is now this device's rev too.
        updateCard(card.code, { rev: baseRev });
      }
    }

    const body = await seal(text, u);
    if (body.data.length > MAX_DATA_CHARS) {
      setStatus('full');
      return;
    }
    const res = await fetch(api(u.id), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(baseRev === undefined ? body : { ...body, baseRev }),
      cache: 'no-store',
      credentials: 'omit',
      keepalive,
    });
    if (res.ok) {
      const now = Date.now();
      const reply = (await res.json().catch(() => null)) as { rev?: unknown } | null;
      const rev = typeof reply?.rev === 'number' ? reply.rev : undefined;
      // Re-read: the card may have been removed or replaced while this upload was in flight.
      const latest = readCard();
      if (latest && latest.code === card.code) {
        writeCard({
          ...latest,
          lastHash: hash,
          savedAt: now,
          pending: false,
          changedAt: undefined,
          rev: rev ?? latest.rev,
        });
      }
      failures = 0;
      conflicts = 0;
      setStatus('saved', now);
    } else if (res.status === 409) {
      // Another device uploaded since this one last synced: check the server copy, then try again.
      verified = false;
      conflicts++;
      if (conflicts <= MAX_CONFLICT_RETRIES) {
        again = true; // syncNow() runs once more as soon as this upload ends
      } else {
        setStatus('error');
        retryLater();
      }
    } else {
      setStatus(res.status === 507 || res.status === 413 ? 'full' : 'error');
      retryLater();
    }
  } catch {
    if (offline()) {
      setStatus(changed ? 'offline' : 'saved'); // the 'online' listener retries
    } else {
      setStatus('error');
      retryLater();
    }
  }
}

/** Server busy, restarting or full: try again after 15 s, 30 s, 1 min ... up to every 5 minutes. */
let failures = 0;
function retryLater(): void {
  failures++;
  if (stopSync) schedule(Math.min(5 * 60_000, 15_000 * 2 ** (failures - 1)));
}

/** Uploads the current snapshot now (one upload at a time; a change during an upload queues one more). */
export function syncNow(keepalive = false): Promise<void> {
  if (syncing) {
    again = true;
    return syncing;
  }
  syncing = upload(keepalive).finally(() => {
    syncing = null;
    if (again) {
      again = false;
      void syncNow();
    }
  });
  return syncing;
}

// ---------------------------------------------------------------------------------------------
// Auto-sync

let timer: ReturnType<typeof setTimeout> | null = null;
let stopSync: (() => void) | null = null;

function schedule(delay = DEBOUNCE_MS) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, delay);
}

/** Starts uploading changes (idempotent). Does nothing until this device has a Save Card. */
export function startAutoSync(): void {
  if (stopSync || typeof window === 'undefined' || !hasSaveCard()) return;
  const changed = () => {
    if (!flushing && hasSaveCard()) schedule();
  };
  const unsubs = [useProgress.subscribe(changed), useRewards.subscribe(changed), useSettings.subscribe(changed)];
  const online = () => {
    if (readCard()?.pending || !verified) schedule(500);
  };
  const hidden = () => {
    // Leaving or backgrounding the app: send a waiting change now (keepalive lets it finish after the page goes).
    if (document.visibilityState === 'hidden' && timer) {
      clearTimeout(timer);
      timer = null;
      void syncNow(true);
    }
  };
  window.addEventListener('online', online);
  document.addEventListener('visibilitychange', hidden);
  stopSync = () => {
    for (const u of unsubs) u();
    window.removeEventListener('online', online);
    document.removeEventListener('visibilitychange', hidden);
    if (timer) clearTimeout(timer);
    timer = null;
    stopSync = null;
  };
  // Check the server copy (another device may have saved newer progress), then catch up on anything that
  // changed while the app was closed or offline.
  schedule(1_500);
}

// ---------------------------------------------------------------------------------------------
// Make, show, remove

/** Makes a new Save Card for this device and uploads the first snapshot. Returns the code. */
export async function makeSaveCard(): Promise<string> {
  const code = makeSaveCode();
  const u = await unlock(code);
  const card: LocalCard = { v: 1, code, salt: toBase64(u.salt), pending: true, changedAt: Date.now(), rev: 0 };
  if (!writeCard(card)) throw new Error('storage');
  unlocked = { code, salt: card.salt, u: Promise.resolve(u) };
  // A brand-new card has nothing on the server to check: the first upload creates it (baseRev 0).
  verified = true;
  conflicts = 0;
  useSaveCard.setState({ code, status: 'saving', savedAt: null, conflict: null });
  startAutoSync();
  await syncNow();
  return code;
}

/** Deletes the card from the server and forgets it on this device. Progress stays. Throws 'offline' or 'error'. */
export async function removeSaveCard(): Promise<void> {
  const card = readCard();
  if (!card) return;
  const u = await unlockCard(card);
  let res: Response;
  try {
    res = await fetch(api(u.id), { method: 'DELETE', cache: 'no-store', credentials: 'omit' });
  } catch {
    throw new Error(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error');
  }
  if (!res.ok) throw new Error('error');
  stopSync?.();
  lsRemove(SAVE_CARD_KEY);
  unlocked = null;
  verified = false;
  conflicts = 0;
  useSaveCard.setState({ code: null, status: 'idle', savedAt: null, conflict: null });
}

/** The link a QR code carries. The code is in the #fragment, which browsers never send to a server. */
export function restoreLink(code: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/play/restore#code=${code}`;
}

// ---------------------------------------------------------------------------------------------
// Load (restore)

export interface SavePreview {
  handle: string | null;
  stars: number | null;
  missions: number | null;
  savedAt: number;
}

export type LoadError =
  | Exclude<SaveCodeResult, { ok: true }>
  | { ok: false; reason: 'not-found' | 'wrong-code' | 'offline' | 'slow-down' | 'unsupported' | 'error' };

export type LoadResult =
  | {
      ok: true;
      code: string;
      preview: SavePreview;
      snapshot: Snapshot;
      salt: string;
      /** Server rev of this save: becomes this device's synced rev when applied. */
      rev: number;
    }
  | LoadError;

function previewOf(s: Snapshot): SavePreview {
  return { ...summarize(s.keys), savedAt: s.savedAt };
}

/** Stars, missions and handle of this device's own progress (read from storage only; nothing is sent). */
export function thisDevicePreview(): Omit<SavePreview, 'savedAt'> {
  return summarize(currentKeys());
}

/** Downloads and decrypts a Save Card. Nothing on this device changes until applySaveCard(). */
export async function loadSaveCard(input: string): Promise<LoadResult> {
  const parsed = parseSaveCode(input);
  if (!parsed.ok) return parsed;
  const code = parsed.code;
  if (offline()) return { ok: false, reason: 'offline' };
  try {
    // The id needs no salt; the key needs the card's salt, which comes with the blob.
    const got = await download(await saveCardId(code), code);
    if (!got.ok) return got;
    return { ok: true, code, preview: previewOf(got.snapshot), snapshot: got.snapshot, salt: got.salt, rev: got.rev };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/**
 * Replaces this device's progress with a loaded card, makes it this device's Save Card (so changes keep syncing
 * to it) and reloads the app. Keys the card does not have are cleared, so nothing from the old progress mixes in.
 */
export async function applySaveCard(loaded: Extract<LoadResult, { ok: true }>): Promise<void> {
  restoring = true;
  stopSync?.();
  try {
    for (const k of SAVE_KEYS) {
      const v = loaded.snapshot.keys[k];
      if (v === undefined) lsRemove(k);
      else if (!lsSet(k, v)) throw new Error('storage');
    }
    // Same shape and key order as takeSnapshot(), which is not called here: it could write live (old) state back.
    const lastHash = await digest(JSON.stringify(loaded.snapshot.keys));
    writeCard({
      v: 1,
      code: loaded.code,
      salt: loaded.salt,
      lastHash,
      savedAt: loaded.preview.savedAt,
      pending: false,
      rev: loaded.rev,
    });
    // Pull the restored values into the live stores so nothing still running writes the old ones back before reload.
    await Promise.all([
      useProgress.persist.rehydrate(),
      useRewards.persist.rehydrate(),
      useSettings.persist.rehydrate(),
    ]);
  } catch (err) {
    restoring = false;
    throw err;
  }
  // From the QR landing page, go straight into the city; from anywhere else, reload where the player is.
  if (window.location.pathname === '/play/restore') window.location.replace('/play');
  else window.location.reload();
}

// ---------------------------------------------------------------------------------------------
// Two devices, one card: the player's choice when the server has newer progress

/** Replaces this device's progress with the newer save from the card, then reloads the app. */
export async function loadNewerSave(): Promise<void> {
  const c = useSaveCard.getState().conflict;
  if (c) await applySaveCard(c.server);
}

/** Keeps this device's progress and uploads it over the newer save on the card. */
export function keepThisDeviceSave(): Promise<void> {
  const c = useSaveCard.getState().conflict;
  if (!c) return Promise.resolve();
  const card = readCard();
  // Based on the rev just seen, so the server accepts it unless yet another device saved in the meantime
  // (then the player is asked again).
  if (card) writeCard({ ...card, rev: c.server.rev, pending: true, changedAt: card.changedAt ?? Date.now() });
  verified = true;
  conflicts = 0;
  useSaveCard.setState({ conflict: null, status: 'saving' });
  return syncNow();
}
