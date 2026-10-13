// Live squad sessions: REST routes to create and look up sessions, and the Socket.IO server that runs
// them (GDD §7.2-7.3, §12.5). registerSquad(app) must be called before app.listen().
//
// Audiences (Socket.IO rooms):  s:{code} everyone · conduct:{code} the Conductor · screen:{code} the Big Screen
// · q:{code}:{totem} one squad's seats · p:{code}:{seatId} one seat's devices.
// Privacy: room codes never reach the logs, seat tokens and the host key are kept only as hashes, and every
// payload is validated with zod and capped at 16 KB.

import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { Server, type Socket } from 'socket.io';
import type { z } from 'zod';
import {
  MAX_PAYLOAD_BYTES,
  SESSION_IDLE_TTL_MS,
  SOCKET_PATH,
  defaultSessionOptions,
  hostPath,
  isRoomCode,
  joinPath,
  missionById,
  normalizeRoomCode,
  screenPath,
  totemById,
  type AckResult,
  type ApiError,
  type ClientToServerEvents,
  type CreateSessionResponse,
  type ErrorCode,
  type InterServerEvents,
  type OpenSeatsResponse,
  type ServerToClientEvents,
  type SessionAggregate,
  type SessionConfig,
  type SessionInfoResponse,
  type Snapshot,
  type SocketData,
  type SyncResult,
} from '@shieldquest/shared';
import { collection } from '../store';
import { HOST_BUCKET, SEAT_BUCKET, TokenBucket } from './limits';
import { fromDoc, toDoc, type SessionDoc } from './persist';
import { ClockPingSchema, CodeParams, CreateSessionBody, EmptySchema, HandshakeAuthSchema, HostCommandSchema, SeatSchemas } from './schemas';
import { SquadSession, type SessionHooks } from './session';
import { hostSnapshot, screenSnapshot, seatSnapshot, squadsInOrder } from './views';
import { hashSecret, newRoomCode, newSecret } from './words';

type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type Payload<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>[0];

export interface SquadServerOptions {
  /** Clock in epoch ms (tests pass a controllable one). */
  now?: () => number;
  /** Deadline ticker period (ms). */
  tickMs?: number;
  /** Snapshot broadcast coalescing delay (ms). */
  flushMs?: number;
  /** POST /api/sessions allowed per client per minute. */
  createPerMinute?: number;
}

/** Live sessions on one small instance (GDD §12.7); a pilot room is one session. */
const MAX_SESSIONS = 300;
/** An ended session stays readable (the "session ended" screen on rejoin) for this long. */
const ENDED_LINGER_MS = 10 * 60 * 1000;
const PERSIST_DEBOUNCE_MS = 200;

const rooms = {
  all: (code: string) => `s:${code}`,
  host: (code: string) => `conduct:${code}`,
  screen: (code: string) => `screen:${code}`,
  squad: (code: string, squadId: string) => `q:${code}:${squadId}`,
  seat: (code: string, seatId: string) => `p:${code}:${seatId}`,
};

const fail = (error: ErrorCode): AckResult => ({ ok: false, error });

function connectError(code: ErrorCode): Error {
  // The client reads err.message as an ErrorCode.
  return new Error(code);
}

export async function registerSquad(app: FastifyInstance, opts: SquadServerOptions = {}): Promise<void> {
  const now = opts.now ?? Date.now;
  const tickMs = opts.tickMs ?? 250;
  const flushMs = opts.flushMs ?? 40;
  const sessions = new Map<string, SquadSession>();
  const snapshots = collection<SessionDoc>('session-snapshots');
  const aggregates = collection<SessionAggregate>('session-aggregates');
  const flushTimers = new Map<string, NodeJS.Timeout>();
  const persistTimers = new Map<string, NodeJS.Timeout>();
  /** Set once the server starts shutting down: no new broadcasts or debounced writes after that. */
  let closing = false;

  const io: IO = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(app.server, {
    path: SOCKET_PATH,
    serveClient: false,
    maxHttpBufferSize: MAX_PAYLOAD_BYTES,
    pingInterval: 20_000,
    pingTimeout: 20_000,
    // Long-polling first, then upgrade: works on school Wi-Fi that blocks WebSockets.
    transports: ['polling', 'websocket'],
    connectionStateRecovery: { maxDisconnectionDuration: 180_000, skipMiddlewares: true },
    cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? true },
  });

  function emitTo<E extends keyof ServerToClientEvents>(room: string, event: E, payload: Payload<E>): void {
    // Generic event names defeat Socket.IO's tuple typing; the payload type is still checked by Payload<E>.
    const op = io.to(room) as unknown as { emit(ev: string, ...args: unknown[]): boolean };
    op.emit(event, payload);
  }

  const hasMembers = (room: string): boolean => (io.sockets.adapter.rooms.get(room)?.size ?? 0) > 0;

  // -------------------------------------------------------------------------------------------
  // Broadcast and persistence

  function flush(code: string): void {
    const sess = sessions.get(code);
    if (!sess) return;
    const s = sess.s;
    const t = now();
    if (hasMembers(rooms.host(code))) io.to(rooms.host(code)).emit('snapshot', hostSnapshot(s, t));
    if (hasMembers(rooms.screen(code))) io.to(rooms.screen(code)).emit('snapshot', screenSnapshot(s, t));
    for (const seat of s.seats.values()) {
      if (seat.sockets.size === 0) continue;
      const snap = seatSnapshot(s, seat, t);
      if (snap) io.to(rooms.seat(code, seat.id)).emit('snapshot', snap);
    }
  }

  function scheduleFlush(code: string): void {
    if (closing || flushTimers.has(code)) return;
    flushTimers.set(
      code,
      setTimeout(() => {
        flushTimers.delete(code);
        flush(code);
      }, flushMs),
    );
  }

  async function writeSnapshot(code: string): Promise<void> {
    const sess = sessions.get(code);
    if (!sess || sess.s.phase === 'ended') return;
    try {
      await snapshots.put(toDoc(sess.s, now()));
    } catch (err) {
      app.log.warn({ err }, 'squad snapshot write failed');
    }
  }

  function schedulePersist(code: string): void {
    if (closing || persistTimers.has(code)) return;
    persistTimers.set(
      code,
      setTimeout(() => {
        persistTimers.delete(code);
        void writeSnapshot(code);
      }, PERSIST_DEBOUNCE_MS),
    );
  }

  // Aggregate writes still in flight; a graceful shutdown waits for them so no session's counts are lost.
  const aggregateWrites = new Set<Promise<unknown>>();

  function saveAggregate(agg: SessionAggregate): void {
    const write = aggregates
      .put(agg)
      .catch((err: unknown) => app.log.warn({ err }, 'session aggregate write failed'))
      .finally(() => aggregateWrites.delete(write));
    aggregateWrites.add(write);
  }

  function forget(code: string): void {
    const ft = flushTimers.get(code);
    if (ft) clearTimeout(ft);
    flushTimers.delete(code);
    const pt = persistTimers.get(code);
    if (pt) clearTimeout(pt);
    persistTimers.delete(code);
    snapshots.remove(code).catch((err: unknown) => app.log.warn({ err }, 'squad snapshot delete failed'));
  }

  function hooksFor(code: string): SessionHooks {
    return {
      changed: () => scheduleFlush(code),
      boundary: () => schedulePersist(code),
      emitSquad: (squadId, event, payload) => emitTo(rooms.squad(code, squadId), event, payload),
      emitSeat: (seatId, event, payload) => emitTo(rooms.seat(code, seatId), event, payload),
      emitAll: (event, payload) => emitTo(rooms.all(code), event, payload),
      seatMoved: (seatId, from, to) => {
        io.in(rooms.seat(code, seatId)).socketsLeave(rooms.squad(code, from));
        io.in(rooms.seat(code, seatId)).socketsJoin(rooms.squad(code, to));
      },
      aggregate: saveAggregate,
      // Send the final 'ended' snapshots now (forget() cancels the pending flush), then drop the crash
      // snapshot. The in-memory session lingers briefly so rejoining phones see "session ended".
      ended: () => {
        flush(code);
        forget(code);
      },
    };
  }

  function closeOut(code: string, notify: boolean): void {
    if (notify) io.to(rooms.all(code)).emit('notice', { kind: 'session-ended' });
    io.in(rooms.all(code)).disconnectSockets(true);
    sessions.delete(code);
    forget(code);
  }

  // Restore sessions from crash snapshots (a restart mid-session); drop stale ones.
  for (const doc of await snapshots.list()) {
    const t = now();
    const stale = t - doc.lastActivity > SESSION_IDLE_TTL_MS;
    const state = stale ? null : fromDoc(doc, t);
    if (!state || state.phase === 'ended') {
      if (doc.phase !== 'ended' && doc.aggregate) saveAggregate({ ...doc.aggregate, complete: false });
      await snapshots.remove(doc.id).catch(() => undefined);
      continue;
    }
    sessions.set(state.code, new SquadSession(state, hooksFor(state.code)));
  }

  function snapshotFor(sess: SquadSession, data: SocketData, t: number): Snapshot | null {
    if (data.audience === 'host') return hostSnapshot(sess.s, t);
    if (data.audience === 'screen') return screenSnapshot(sess.s, t);
    const seat = data.seatId ? sess.s.seats.get(data.seatId) : undefined;
    return seat ? seatSnapshot(sess.s, seat, t) : null;
  }

  // -------------------------------------------------------------------------------------------
  // REST

  await app.register(async (scope) => {
    if (!scope.hasDecorator('rateLimit')) await scope.register(rateLimit, { global: false });

    scope.post(
      '/api/sessions',
      { config: { rateLimit: { max: opts.createPerMinute ?? 10, timeWindow: '1 minute' } } },
      async (req, reply) => {
        const parsed = CreateSessionBody.safeParse(req.body);
        const bad = (message: string) => reply.code(400).send({ error: 'bad-request', message } satisfies ApiError);
        if (!parsed.success) return bad('Choose a band and 1-3 missions.');
        const body = parsed.data;
        if (new Set(body.missionIds).size !== body.missionIds.length) return bad('Each mission can be played once per session.');
        for (const id of body.missionIds) {
          const mission = missionById(id);
          if (!mission) return bad(`Unknown mission: ${id}`);
          if (!mission.bands.includes(body.band)) return bad(`"${mission.title}" is not written for this age band.`);
        }
        if (sessions.size >= MAX_SESSIONS) {
          return reply.code(503).send({ error: 'busy', message: 'Too many live sessions. Try again shortly.' } satisfies ApiError);
        }
        let code = newRoomCode();
        while (sessions.has(code)) code = newRoomCode();
        const hostKey = newSecret();
        const defaults = defaultSessionOptions(body.band);
        const config: SessionConfig = {
          band: body.band,
          missionIds: body.missionIds,
          squadCount: body.squadCount ?? null,
          gentle: body.gentle ?? defaults.gentle,
          discreet: body.discreet ?? defaults.discreet,
          calm: body.calm ?? defaults.calm,
          relaxed: body.relaxed ?? defaults.relaxed,
          autoAdvance: body.autoAdvance ?? defaults.autoAdvance,
        };
        const sess = SquadSession.create({ code, hostKeyHash: hashSecret(hostKey), config, now: now() }, hooksFor(code));
        sessions.set(code, sess);
        await writeSnapshot(code);
        void reply.header('cache-control', 'no-store');
        const res: CreateSessionResponse = {
          code,
          hostKey,
          joinPath: joinPath(code),
          hostPath: hostPath(code),
          screenPath: screenPath(code),
        };
        return reply.code(201).send(res);
      },
    );

    // Routes carrying a room code log at warn only, so codes never reach the access log (GDD §11.5).
    // Limits are per client address, and a whole class usually shares one school NAT address: they are
    // sized for 40 phones joining and refreshing, while still making code guessing pointless.
    scope.get(
      '/api/sessions/:code',
      { logLevel: 'warn', config: { rateLimit: { max: 600, timeWindow: '1 minute' } } },
      async (req, reply) => {
        const params = CodeParams.safeParse(req.params);
        const code = params.success ? normalizeRoomCode(params.data.code) : '';
        const sess = isRoomCode(code) ? sessions.get(code) : undefined;
        void reply.header('cache-control', 'no-store');
        if (!sess || sess.s.phase === 'ended') return { exists: false } satisfies SessionInfoResponse;
        const s = sess.s;
        const info: SessionInfoResponse = {
          exists: true,
          band: s.config.band,
          phase: s.phase,
          acceptingJoins: s.acceptingJoins,
          squads: squadsInOrder(s).map((sq) => {
            const t = totemById(sq.id);
            return { id: t.id, name: t.name, shape: t.shape };
          }),
        };
        return info;
      },
    );

    scope.get(
      '/api/sessions/:code/open-seats',
      { logLevel: 'warn', config: { rateLimit: { max: 240, timeWindow: '1 minute' } } },
      async (req, reply) => {
        const params = CodeParams.safeParse(req.params);
        const code = params.success ? normalizeRoomCode(params.data.code) : '';
        const sess = isRoomCode(code) ? sessions.get(code) : undefined;
        void reply.header('cache-control', 'no-store');
        return { seats: sess ? sess.openSeats(now()) : [] } satisfies OpenSeatsResponse;
      },
    );
  });

  // -------------------------------------------------------------------------------------------
  // Socket.IO

  io.use((socket: IOSocket, next) => {
    const parsed = HandshakeAuthSchema.safeParse(socket.handshake.auth);
    if (!parsed.success) return next(connectError('bad-request'));
    const auth = parsed.data;
    if (auth.role === 'probe') {
      socket.data = { audience: 'probe', code: '', seatId: null, epoch: 0 };
      return next();
    }
    const code = normalizeRoomCode(auth.code);
    const sess = isRoomCode(code) ? sessions.get(code) : undefined;
    if (!sess) return next(connectError('not-found'));
    if (auth.role === 'host') {
      if (!sess.checkHostKey(auth.hostKey)) return next(connectError('unauthorized'));
      socket.data = { audience: 'host', code, seatId: null, epoch: 0 };
      return next();
    }
    if (auth.role === 'screen') {
      socket.data = { audience: 'screen', code, seatId: null, epoch: 0 };
      return next();
    }
    const res = sess.admitSeat({ seatToken: auth.seatToken, squad: auth.squad, reclaimSeatId: auth.reclaimSeatId }, now());
    if (!res.ok) return next(connectError(res.error));
    const seat = sess.s.seats.get(res.seatId);
    socket.data = { audience: 'seat', code, seatId: res.seatId, epoch: seat?.epoch ?? 0 };
    return next();
  });

  io.on('connection', (socket: IOSocket) => {
    const data = socket.data;
    if (data.audience === 'probe') {
      // Conductor pre-flight: reports polling vs websocket, and again after an upgrade.
      const report = () => socket.emit('probe', { serverNow: now(), transport: socket.conn.transport.name });
      report();
      socket.conn.once('upgrade', report);
      return;
    }
    const code = data.code;
    const sess = sessions.get(code);
    if (!sess) {
      // A recovered connection to a session that no longer exists.
      socket.emit('notice', { kind: 'session-ended' });
      socket.disconnect(true);
      return;
    }
    void socket.join(rooms.all(code));
    if (data.audience === 'host') void socket.join(rooms.host(code));
    else if (data.audience === 'screen') void socket.join(rooms.screen(code));
    else {
      const seat = data.seatId ? sess.s.seats.get(data.seatId) : undefined;
      if (!seat) {
        socket.emit('notice', { kind: 'seat-removed' });
        socket.disconnect(true);
        return;
      }
      if (seat.epoch !== data.epoch) {
        socket.emit('notice', { kind: 'seat-reclaimed' });
        socket.disconnect(true);
        return;
      }
      // Recovered sockets come back with their old rooms; the seat may have changed squad meanwhile.
      for (const r of socket.rooms) if (r.startsWith('q:')) void socket.leave(r);
      void socket.join(rooms.seat(code, seat.id));
      void socket.join(rooms.squad(code, seat.squadId));
      const seatId = seat.id;
      sess.connectSeat(seatId, socket.id, now());
      socket.on('disconnect', () => sessions.get(code)?.disconnectSeat(seatId, socket.id, now()));
    }
    const first = snapshotFor(sess, data, now());
    if (first) socket.emit('snapshot', first);

    const bucket = new TokenBucket(data.audience === 'host' ? HOST_BUCKET : SEAT_BUCKET, now());
    const raw = socket as unknown as { on(ev: string, fn: (...args: unknown[]) => void): unknown };

    function listen<S extends z.ZodType>(
      event: keyof ClientToServerEvents,
      schema: S,
      audience: 'seat' | 'host' | 'any',
      run: (p: z.infer<S>, sess: SquadSession, t: number) => unknown,
    ): void {
      raw.on(event, (...args: unknown[]) => {
        const last = args[args.length - 1];
        const ack = typeof last === 'function' ? (last as (res: unknown) => void) : null;
        const reply = (res: unknown) => ack?.(res);
        const t = now();
        if (!bucket.take(t)) return reply(fail('rate-limited'));
        if (audience !== 'any' && socket.data.audience !== audience) return reply(fail('forbidden'));
        const current = sessions.get(socket.data.code);
        if (!current) return reply(fail('ended'));
        const parsed = schema.safeParse(typeof args[0] === 'function' ? undefined : args[0]);
        if (!parsed.success) return reply(fail('bad-request'));
        try {
          reply(run(parsed.data, current, t));
        } catch (err) {
          app.log.error({ err }, 'squad event failed');
          reply(fail('internal'));
        }
      });
    }

    const seatId = (): string => socket.data.seatId ?? '';

    listen('sync', EmptySchema, 'any', (_p, s, t): SyncResult => {
      const snap = snapshotFor(s, socket.data, t);
      return snap ? { ok: true, snapshot: snap } : { ok: false, error: 'not-found' };
    });
    listen('clockPing', ClockPingSchema, 'any', (p, _s, t) => ({ c: p.c, s: t }));

    listen('hold', SeatSchemas.hold, 'seat', (p, s, t) => s.hold(seatId(), p, t));
    listen('pin', SeatSchemas.pin, 'seat', (p, s, t) => s.pin(seatId(), p, t));
    listen('unpin', SeatSchemas.unpin, 'seat', (p, s, t) => s.unpin(seatId(), p, t));
    listen('trace', SeatSchemas.trace, 'seat', (p, s, t) => s.trace(seatId(), p, t));
    listen('forecast', SeatSchemas.forecast, 'seat', (p, s, t) => s.forecast(seatId(), p, t));
    listen('seal', SeatSchemas.seal, 'seat', (p, s, t) => s.seal(seatId(), p, t));
    listen('reasons', SeatSchemas.reasons, 'seat', (p, s, t) => s.reasons(seatId(), p, t));
    listen('tiebreak', SeatSchemas.tiebreak, 'seat', (p, s, t) => s.tiebreak(seatId(), p, t));
    listen('shieldTile', SeatSchemas.shieldTile, 'seat', (p, s, t) => s.shieldTile(seatId(), p, t));
    listen('shieldSend', SeatSchemas.shieldSend, 'seat', (_p, s, t) => s.shieldSend(seatId(), t));
    listen('shieldRetry', SeatSchemas.shieldRetry, 'seat', (_p, s, t) => s.shieldRetry(seatId(), t));
    listen('share', SeatSchemas.share, 'seat', (p, s, t) => s.share(seatId(), p.on, t));
    listen('guardian', SeatSchemas.guardian, 'seat', (p, s, t) => s.guardian(seatId(), p.guardian, t));
    listen('extendExplain', SeatSchemas.extendExplain, 'seat', (_p, s, t) => s.extendExplain(seatId(), t));
    listen('ready', SeatSchemas.ready, 'seat', (p, s, t) => s.ready(seatId(), p, t));
    listen('needHelp', SeatSchemas.needHelp, 'seat', (p, s, t) => s.needHelp(seatId(), p.on, t));
    listen('takeBreak', SeatSchemas.takeBreak, 'seat', (p, s, t) => s.takeBreak(seatId(), p.on, t));
    listen('roomHold', SeatSchemas.roomHold, 'seat', (p, s, t) => s.roomHold(seatId(), p.on, t));
    listen('lateHold', SeatSchemas.lateHold, 'seat', (p, s, t) => s.lateHold(seatId(), p, t));
    listen('signal', SeatSchemas.signal, 'seat', (_p, s, t) => s.signal(seatId(), t));
    listen('command', HostCommandSchema, 'host', (cmd, s, t) => s.command(cmd, t));
  });

  // -------------------------------------------------------------------------------------------
  // Clock and housekeeping

  const ticker = setInterval(() => {
    const t = now();
    for (const sess of sessions.values()) {
      try {
        sess.tick(t);
      } catch (err) {
        app.log.error({ err }, 'squad tick failed');
      }
    }
  }, tickMs);
  ticker.unref();

  const sweeper = setInterval(() => {
    const t = now();
    for (const [code, sess] of sessions) {
      const s = sess.s;
      if (s.phase === 'ended') {
        if (s.endedAt !== null && t - s.endedAt > ENDED_LINGER_MS) closeOut(code, false);
      } else if (t - s.lastActivity > SESSION_IDLE_TTL_MS) {
        saveAggregate(sess.expire());
        closeOut(code, true);
      }
    }
  }, 60_000);
  sweeper.unref();

  app.addHook('preClose', async () => {
    closing = true;
    clearInterval(ticker);
    clearInterval(sweeper);
    for (const t of flushTimers.values()) clearTimeout(t);
    flushTimers.clear();
    for (const t of persistTimers.values()) clearTimeout(t);
    persistTimers.clear();
    io.disconnectSockets(true);
    // A final crash snapshot of every live session (pins and joins since the last boundary included), so a
    // restart resumes where each room was. Phones reconnect on their own and rejoin their seats.
    await Promise.all([...sessions.keys()].map((code) => writeSnapshot(code)));
    await Promise.all([...aggregateWrites]);
    io.engine.close();
  });
}
