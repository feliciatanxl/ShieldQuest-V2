// Live squad session connection: one Socket.IO client per page (phone seat, Conductor or Big Screen).
// The server is authoritative; every audience renders from its latest versioned snapshot (GDD §12.5).
// - Same origin: Vite proxies /socket.io in dev; production serves both from one host.
// - Seat tokens live in localStorage per room code (the same token always rejoins the same seat).
// - The Conductor key lives in sessionStorage only (it never leaves this browser tab's session).

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import {
  SEAT_TOKEN_RE,
  SOCKET_PATH,
  clockOffset,
  encodeSeatToken,
  type AckResult,
  type ClientToServerEvents,
  type ErrorCode,
  type GuardianEvent,
  type HandshakeAuth,
  type HostCommand,
  type HostSnapshot,
  type Notice,
  type ScreenSnapshot,
  type SeatSnapshot,
  type ServerToClientEvents,
  type Snapshot,
  type SquadTotemId,
  type SteelmanEvent,
  type SurgeEvent,
  type SyncResult,
} from '@shieldquest/shared';

export type SquadSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type Audience = 'seat' | 'host' | 'screen';

/** online: connected. reconnecting: socket.io is retrying. offline: the browser reports no network. failed: fatal handshake error. */
export type ConnStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline' | 'failed';

export type ConnectOptions =
  | { audience: 'seat'; code: string; squad?: SquadTotemId; reclaimSeatId?: string }
  | { audience: 'host'; code: string; hostKey: string }
  | { audience: 'screen'; code: string };

/** A one-off server event, numbered so effects can react to repeats of the same payload. */
export interface Pulse<T> {
  n: number;
  value: T;
  at: number;
}

export interface SquadState {
  audience: Audience | null;
  code: string | null;
  status: ConnStatus;
  /** Fatal handshake error, or the reason this device was turned away (no automatic retry). */
  error: ErrorCode | null;
  /** 'polling' or 'websocket'. */
  transport: string | null;
  /** Add to Date.now() for server time. */
  offset: number;
  /** Best clockPing round trip (ms), null before the first ping. */
  rtt: number | null;
  snapshot: Snapshot | null;
  roomFreeze: { amount: number; peak: number } | null;
  surge: Pulse<SurgeEvent> | null;
  guardian: Pulse<GuardianEvent> | null;
  steelman: Pulse<SteelmanEvent> | null;
  notice: Pulse<Notice> | null;
  /** Acknowledged events still in flight (shows "Sending…"). */
  pending: number;
}

const INITIAL: SquadState = {
  audience: null,
  code: null,
  status: 'idle',
  error: null,
  transport: null,
  offset: 0,
  rtt: null,
  snapshot: null,
  roomFreeze: null,
  surge: null,
  guardian: null,
  steelman: null,
  notice: null,
  pending: 0,
};

export const useSquad = create<SquadState>(() => ({ ...INITIAL }));

/** Handshake errors that retrying cannot fix. */
const FATAL: ReadonlySet<string> = new Set<ErrorCode>([
  'bad-request',
  'not-found',
  'unauthorized',
  'forbidden',
  'joins-locked',
  'session-full',
  'squad-full',
  'seat-taken',
  'ended',
]);

const RETRYABLE: ReadonlySet<ErrorCode> = new Set<ErrorCode>(['rate-limited', 'busy', 'internal']);

let socket: SquadSocket | null = null;
let lastV = -1;
let acceptAny = true;
let pulseN = 0;
let retryTimer: number | undefined;
let clockTimer: number | undefined;
let cleanupWindow: (() => void) | null = null;

const pulse = <T,>(value: T): Pulse<T> => ({ n: ++pulseN, value, at: Date.now() });

// ---------------------------------------------------------------------------------------------
// Device storage (wrapped: private mode and managed school devices can throw)

const SEAT_KEY = 'sq.seat.v1:';
const HOST_KEY = 'sq.host.v1:';
const SEAT_TTL_MS = 24 * 60 * 60 * 1000;

function readStore(store: 'local' | 'session', key: string): string | null {
  try {
    return (store === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function writeStore(store: 'local' | 'session', key: string, value: string | null): void {
  try {
    const s = store === 'local' ? localStorage : sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    // Storage blocked: the session still works, a reload just cannot rejoin the same seat.
  }
}

/** Drops seat tokens for rooms older than a day, so a shared school device does not pile them up. */
function pruneSeatTokens(now: number): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith(SEAT_KEY)) continue;
      const parsed = parseSeat(localStorage.getItem(key));
      if (!parsed || now - parsed.at > SEAT_TTL_MS) localStorage.removeItem(key);
    }
  } catch {
    // Ignore.
  }
}

function parseSeat(raw: string | null): { t: string; at: number } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { t?: unknown; at?: unknown };
    return typeof v.t === 'string' && SEAT_TOKEN_RE.test(v.t) && typeof v.at === 'number' ? { t: v.t, at: v.at } : null;
  } catch {
    return null;
  }
}

/** True when this device already holds a seat for the room (a rejoin skips the notice screen). */
export function hasSeatToken(code: string): boolean {
  return parseSeat(readStore('local', SEAT_KEY + code)) !== null;
}

/** The seat token for a room, generated once with crypto.getRandomValues (128 bits). */
export function seatTokenFor(code: string): string {
  const now = Date.now();
  const existing = parseSeat(readStore('local', SEAT_KEY + code));
  if (existing && now - existing.at <= SEAT_TTL_MS) {
    writeStore('local', SEAT_KEY + code, JSON.stringify({ t: existing.t, at: now }));
    return existing.t;
  }
  pruneSeatTokens(now);
  const token = encodeSeatToken(crypto.getRandomValues(new Uint8Array(16)));
  writeStore('local', SEAT_KEY + code, JSON.stringify({ t: token, at: now }));
  return token;
}

/** Forget this device's seat (after the seat was removed or the session ended). */
export function forgetSeat(code: string): void {
  writeStore('local', SEAT_KEY + code, null);
}

export function saveHostKey(code: string, hostKey: string): void {
  writeStore('session', HOST_KEY + code, hostKey);
}

export function loadHostKey(code: string): string | null {
  return readStore('session', HOST_KEY + code);
}

export function forgetHostKey(code: string): void {
  writeStore('session', HOST_KEY + code, null);
}

// ---------------------------------------------------------------------------------------------
// Clock

/** Server time now (ms epoch), from the measured offset. */
export const serverNow = (): number => Date.now() + useSquad.getState().offset;

/** Re-renders every `intervalMs` with the current server time. Pass enabled=false to stop ticking. */
export function useServerNow(intervalMs = 250, enabled = true): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    setNow(serverNow());
    if (!enabled) return;
    const id = window.setInterval(() => setNow(serverNow()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}

/** Five round trips; the fastest one gives the most honest offset. */
async function syncClock(s: SquadSocket): Promise<void> {
  let best: { rtt: number; offset: number } | null = null;
  for (let i = 0; i < 5 && s.connected; i++) {
    const c = Date.now();
    try {
      const res = await s.timeout(4000).emitWithAck('clockPing', { c });
      const received = Date.now();
      const rtt = received - c;
      if (res.c === c && (!best || rtt < best.rtt)) best = { rtt, offset: clockOffset(c, res.s, received) };
    } catch {
      // A lost ping is fine; the snapshot's serverNow still gives a rough offset.
    }
  }
  if (best && socket === s) useSquad.setState({ offset: best.offset, rtt: best.rtt });
}

// ---------------------------------------------------------------------------------------------
// Snapshots

function applySnapshot(snap: Snapshot): void {
  if (!acceptAny && snap.v < lastV) return;
  acceptAny = false;
  lastV = snap.v;
  const st = useSquad.getState();
  // Until a clock ping lands, the snapshot's own timestamp is a decent first guess.
  const patch: Partial<SquadState> = { snapshot: snap };
  if (st.rtt === null) patch.offset = snap.serverNow - Date.now();
  useSquad.setState(patch);
}

/** Asks for a fresh snapshot (after the tab comes back into view). */
export async function requestSync(): Promise<void> {
  const s = socket;
  if (!s?.connected) return;
  try {
    const res: SyncResult = await s.timeout(5000).emitWithAck('sync', {});
    if (res.ok && socket === s) {
      acceptAny = true;
      applySnapshot(res.snapshot);
    }
  } catch {
    // The next snapshot or reconnect will catch up.
  }
}

// ---------------------------------------------------------------------------------------------
// Connect / disconnect

function authFor(opts: ConnectOptions): HandshakeAuth {
  switch (opts.audience) {
    case 'host':
      return { role: 'host', code: opts.code, hostKey: opts.hostKey };
    case 'screen':
      return { role: 'screen', code: opts.code };
    default: {
      const auth: HandshakeAuth = { role: 'seat', code: opts.code, seatToken: seatTokenFor(opts.code) };
      if (opts.squad) auth.squad = opts.squad;
      if (opts.reclaimSeatId) auth.reclaimSeatId = opts.reclaimSeatId;
      return auth;
    }
  }
}

/** Opens the page's squad connection (closing any previous one). Returns a disconnect function. */
export function connectSquad(opts: ConnectOptions): () => void {
  disconnectSquad();
  lastV = -1;
  acceptAny = true;
  useSquad.setState({ ...INITIAL, audience: opts.audience, code: opts.code, status: 'connecting' });

  const s: SquadSocket = io({
    path: SOCKET_PATH,
    auth: authFor(opts),
    transports: ['polling', 'websocket'],
    reconnectionDelay: 800,
    reconnectionDelayMax: 6000,
    randomizationFactor: 0.5,
    timeout: 12000,
  });
  socket = s;

  s.on('connect', () => {
    if (!s.recovered) acceptAny = true;
    // Tent-card totem and Reclaim Seat apply to the first join only; afterwards the token finds the seat.
    if (opts.audience === 'seat') s.auth = { role: 'seat', code: opts.code, seatToken: seatTokenFor(opts.code) };
    useSquad.setState({ status: 'online', error: null, transport: s.io.engine?.transport.name ?? null });
    s.io.engine?.once('upgrade', () => {
      if (socket === s) useSquad.setState({ transport: s.io.engine?.transport.name ?? null });
    });
    window.clearInterval(clockTimer);
    void syncClock(s);
    // Phones drift; a fresh offset every two minutes keeps the shared t0 honest.
    clockTimer = window.setInterval(() => void syncClock(s), 120_000);
  });

  s.on('disconnect', (reason) => {
    if (socket !== s) return;
    if (reason === 'io client disconnect') return;
    useSquad.setState({ status: navigator.onLine === false ? 'offline' : 'reconnecting', transport: null });
  });

  s.on('connect_error', (err) => {
    if (socket !== s) return;
    const code = err.message as ErrorCode;
    if (FATAL.has(code)) {
      useSquad.setState({ status: 'failed', error: code });
      s.disconnect();
      return;
    }
    useSquad.setState({ status: navigator.onLine === false ? 'offline' : 'reconnecting' });
    // A middleware rejection ('busy', 'internal') stops socket.io's own retries: retry by hand.
    if (!s.active) {
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => {
        if (socket === s) s.connect();
      }, 3000);
    }
  });

  s.on('snapshot', applySnapshot);
  s.on('roomFreeze', (p) => useSquad.setState({ roomFreeze: p }));
  s.on('surge', (p) => useSquad.setState({ surge: pulse(p) }));
  s.on('guardian', (p) => useSquad.setState({ guardian: pulse(p) }));
  s.on('steelman', (p) => useSquad.setState({ steelman: pulse(p) }));
  s.on('notice', (p) => {
    useSquad.setState({ notice: pulse(p) });
    if (p.kind === 'seat-reclaimed') {
      // Another phone took this seat over: step aside quietly.
      useSquad.setState({ status: 'failed', error: 'seat-taken' });
      s.disconnect();
    } else if (p.kind === 'seat-removed') {
      forgetSeat(opts.code);
      useSquad.setState({ status: 'failed', error: 'not-found' });
      s.disconnect();
    } else if (p.kind === 'session-ended') {
      if (opts.audience === 'seat') forgetSeat(opts.code);
    }
  });

  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      if (s.connected) void requestSync();
      else if (!s.active && useSquad.getState().status !== 'failed') s.connect();
    }
  };
  const onOnline = () => {
    if (useSquad.getState().status === 'offline') useSquad.setState({ status: 'reconnecting' });
    if (!s.connected && !s.active && useSquad.getState().status !== 'failed') s.connect();
  };
  const onOffline = () => {
    if (!s.connected) useSquad.setState({ status: 'offline' });
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  cleanupWindow = () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };

  return () => {
    if (socket === s) disconnectSquad();
  };
}

export function disconnectSquad(): void {
  window.clearTimeout(retryTimer);
  window.clearInterval(clockTimer);
  cleanupWindow?.();
  cleanupWindow = null;
  const s = socket;
  socket = null;
  if (s) {
    s.removeAllListeners();
    s.disconnect();
  }
  useSquad.setState({ ...INITIAL });
}

/** Retry after a fatal error the person can fix (e.g. joins reopened). */
export function reconnectSquad(): void {
  const s = socket;
  if (!s || s.connected) return;
  useSquad.setState({ status: 'connecting', error: null });
  s.connect();
}

// ---------------------------------------------------------------------------------------------
// Acknowledged events

type AckEventName = Exclude<keyof ClientToServerEvents, 'sync' | 'clockPing'>;
export type PayloadOf<E extends AckEventName> = Parameters<ClientToServerEvents[E]>[0];
/** 'offline' = the network never came back within the retry window (the client's own code). */
export type SendError = ErrorCode | 'offline';
export type SendResult = { ok: true; dup?: boolean } | { ok: false; error: SendError };

interface LooseEmitter {
  emitWithAck: (ev: string, payload: unknown) => Promise<unknown>;
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

function waitForConnect(s: SquadSocket, ms: number): Promise<boolean> {
  if (s.connected) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      window.clearTimeout(t);
      s.off('connect', onConnect);
      resolve(ok);
    };
    const onConnect = () => done(true);
    const t = window.setTimeout(() => done(false), ms);
    s.on('connect', onConnect);
  });
}

function isAck(v: unknown): v is AckResult {
  return typeof v === 'object' && v !== null && typeof (v as { ok?: unknown }).ok === 'boolean';
}

/**
 * Emits an acknowledged event, waiting out short disconnects and retrying timeouts. Seals carry a client
 * voteId, so a retried seal that already landed comes back as { ok: true, dup: true }.
 */
export async function send<E extends AckEventName>(
  ev: E,
  payload: PayloadOf<E>,
  opts: { retries?: number; timeoutMs?: number } = {},
): Promise<SendResult> {
  const retries = opts.retries ?? 5;
  const timeoutMs = opts.timeoutMs ?? 6000;
  useSquad.setState((st) => ({ pending: st.pending + 1 }));
  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const s = socket;
      if (!s) return { ok: false, error: 'offline' };
      if (!s.connected && !(await waitForConnect(s, 20_000))) continue;
      try {
        const res = await (s.timeout(timeoutMs) as unknown as LooseEmitter).emitWithAck(ev, payload);
        if (!isAck(res)) return { ok: false, error: 'internal' };
        if (!res.ok && RETRYABLE.has(res.error) && attempt < retries) {
          await sleep(400 * 2 ** attempt);
          continue;
        }
        return res;
      } catch {
        // Ack timeout: the event may or may not have landed. Retrying is safe (the server de-duplicates).
        await sleep(300 * 2 ** Math.min(attempt, 4));
      }
    }
    return { ok: false, error: 'offline' };
  } finally {
    useSquad.setState((st) => ({ pending: Math.max(0, st.pending - 1) }));
  }
}

/** Conductor command (the one big Next button, +30 s, pause...). */
export const hostCommand = (cmd: HostCommand): Promise<SendResult> => send('command', cmd, { retries: 3 });

/** A fresh client id for an idempotent seal. */
export function newVoteId(): string {
  return encodeSeatToken(crypto.getRandomValues(new Uint8Array(12)));
}

// ---------------------------------------------------------------------------------------------
// Typed selectors

export const useSeatSnapshot = (): SeatSnapshot | null =>
  useSquad((s) => (s.snapshot?.kind === 'seat' ? s.snapshot : null));
export const useHostSnapshot = (): HostSnapshot | null =>
  useSquad((s) => (s.snapshot?.kind === 'host' ? s.snapshot : null));
export const useScreenSnapshot = (): ScreenSnapshot | null =>
  useSquad((s) => (s.snapshot?.kind === 'screen' ? s.snapshot : null));

/** Plain-language words for an error code (shown to players and the Conductor). */
export const ERROR_TEXT: Record<SendError, string> = {
  'bad-request': 'That did not work. Please try again.',
  'not-found': 'We could not find that session. Check the code on the big screen.',
  unauthorized: 'This console is not signed in for that session.',
  forbidden: 'That is another role’s job.',
  'joins-locked': 'This session is not taking new players right now. Ask your facilitator.',
  'session-full': 'This session is full. Ask your facilitator to make room.',
  'squad-full': 'That squad is full. Pick another totem, or let the game choose.',
  'seat-taken': 'This seat is open on another phone or tab.',
  'wrong-phase': 'The squad has moved on.',
  locked: 'Not yet: that unlocks in a moment.',
  'already-sealed': 'Already sealed.',
  'unknown-choice': 'That exit is not in this moment.',
  'not-your-slot': 'Another role holds those tiles.',
  'not-tie-breaker': 'Only the Safety Lead breaks ties.',
  used: 'Already used this mission.',
  'not-bonded': 'That Guardian has not unfolded for your squad yet.',
  paused: 'The facilitator has paused all phones. Eyes up.',
  'rate-limited': 'Slow down a little and try again.',
  ended: 'This session has ended.',
  busy: 'The server is busy. Trying again…',
  internal: 'Something went wrong on the server. Please try again.',
  offline: 'No connection right now. It will send when you are back online.',
};
