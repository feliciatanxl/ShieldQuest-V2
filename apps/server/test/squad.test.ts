// Live squad sessions end to end: Fastify + registerSquad on a random port, real Socket.IO clients,
// and a controllable server clock so phases only move when the test says so.

import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MISSIONS,
  SOCKET_PATH,
  SQUAD_TOTEMS,
  encodeSeatToken,
  missionById,
  type AckResult,
  type ClientToServerEvents,
  type CreateSessionResponse,
  type HandshakeAuth,
  type HostSnapshot,
  type Mission,
  type ScreenSnapshot,
  type SeatSnapshot,
  type ServerToClientEvents,
  type SessionAggregate,
  type SessionInfoResponse,
  type Snapshot,
} from '@shieldquest/shared';

// The store reads SHIELDQUEST_DATA_DIR when it loads, so the server is imported only after this is set.
const dataDir = mkdtempSync(join(tmpdir(), 'shieldquest-squad-'));
process.env.SHIELDQUEST_DATA_DIR = dataDir;

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
type Kind = Snapshot['kind'];
type SnapOf<K extends Kind> = Extract<Snapshot, { kind: K }>;
type Store = typeof import('../src/store');

const WAIT_MS = 4000;

class Peer<K extends Kind> {
  last: SnapOf<K> | null = null;
  readonly events: { event: string; payload: unknown }[] = [];
  private waiters: { pred: (s: SnapOf<K>) => boolean; resolve: (s: SnapOf<K>) => void }[] = [];

  constructor(readonly socket: Client) {
    socket.on('snapshot', (raw) => {
      const snap = raw as SnapOf<K>;
      if (this.last && snap.v < this.last.v) return;
      this.last = snap;
      this.waiters = this.waiters.filter((w) => {
        if (!w.pred(snap)) return true;
        w.resolve(snap);
        return false;
      });
    });
    socket.onAny((event: string, payload: unknown) => {
      if (event !== 'snapshot') this.events.push({ event, payload });
    });
  }

  get snap(): SnapOf<K> {
    if (!this.last) throw new Error('no snapshot yet');
    return this.last;
  }

  waitFor(pred: (s: SnapOf<K>) => boolean, label: string): Promise<SnapOf<K>> {
    if (this.last && pred(this.last)) return Promise.resolve(this.last);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), WAIT_MS);
      this.waiters.push({
        pred,
        resolve: (s) => {
          clearTimeout(timer);
          resolve(s);
        },
      });
    });
  }

  /** Emits a client event and resolves with its acknowledgement. */
  send(event: keyof ClientToServerEvents, payload: unknown): Promise<AckResult> {
    const raw = this.socket as unknown as { timeout(ms: number): { emitWithAck(ev: string, p: unknown): Promise<unknown> } };
    return raw.timeout(WAIT_MS).emitWithAck(event, payload) as Promise<AckResult>;
  }
}

async function until<T>(read: () => Promise<T | undefined>, label: string): Promise<T> {
  const end = Date.now() + WAIT_MS;
  for (;;) {
    const v = await read();
    if (v !== undefined) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

const newToken = (): string => encodeSeatToken(randomBytes(16));

function pickYoungAdultMission(): Mission {
  const usable = (m: Mission) =>
    m.bands.includes('young-adult') &&
    ['risky', 'unsure', 'safe'].every((s) => m.choices.some((c) => c.safety === s)) &&
    m.clues.some((c) => c.redFlag);
  const m = missionById('easy-money') ?? MISSIONS.find(usable);
  if (!m || !usable(m)) throw new Error('no young-adult mission with risky, unsure and safe Exits');
  return m;
}

describe('squad session server', () => {
  let app: FastifyInstance;
  let base = '';
  let store: Store;
  let clock = Date.UTC(2026, 9, 12, 9, 17, 23, 456);
  const sockets: Client[] = [];

  beforeAll(async () => {
    const { registerSquad } = await import('../src/squad/server');
    store = await import('../src/store');
    app = Fastify();
    await registerSquad(app, { now: () => clock, tickMs: 15, flushMs: 5, createPerMinute: 50 });
    await app.listen({ port: 0, host: '127.0.0.1' });
    base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    for (const s of sockets) s.disconnect();
    await app?.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  // REST goes through Fastify's inject (same routes, hooks and rate limits, no extra HTTP client).
  async function post(body: unknown): Promise<{ status: number; json: unknown }> {
    const res = await app.inject({ method: 'POST', url: '/api/sessions', payload: body as Record<string, unknown> });
    return { status: res.statusCode, json: res.json() };
  }

  async function info(code: string): Promise<SessionInfoResponse> {
    const res = await app.inject({ method: 'GET', url: `/api/sessions/${code}` });
    expect(res.headers['cache-control']).toBe('no-store');
    return res.json<SessionInfoResponse>();
  }

  async function createSession(body: Record<string, unknown>): Promise<CreateSessionResponse> {
    const res = await post(body);
    expect(res.status).toBe(201);
    return res.json as CreateSessionResponse;
  }

  function connect<K extends Kind>(auth: HandshakeAuth, url = base): Promise<Peer<K>> {
    const socket: Client = io(url, { path: SOCKET_PATH, auth, transports: ['websocket'], reconnection: false, forceNew: true });
    sockets.push(socket);
    const peer = new Peer<K>(socket);
    return new Promise((resolve, reject) => {
      socket.once('connect_error', (err) => reject(new Error(err.message)));
      socket.once('snapshot', () => resolve(peer));
    });
  }

  const seat = (code: string, seatToken = newToken()) => connect<'seat'>({ role: 'seat', code, seatToken });
  const command = (host: Peer<'host'>, cmd: Parameters<ClientToServerEvents['command']>[0]) => host.send('command', cmd);

  // ---------------------------------------------------------------------------------------------
  // Shared state for the main (young-adult) session, built up test by test.

  const ya = pickYoungAdultMission();
  const risky = ya.choices.find((c) => c.safety === 'risky')!.id;
  const unsure = ya.choices.find((c) => c.safety === 'unsure')!.id;
  const safe = ya.choices.find((c) => c.safety === 'safe')!.id;
  const redClue = ya.clues.find((c) => c.redFlag)!.id;
  let main: CreateSessionResponse;
  let host: Peer<'host'>;
  let screen: Peer<'screen'>;
  const seats: Peer<'seat'>[] = [];
  const tokens: string[] = [];
  const voteIds: string[] = [];

  it('creates sessions over REST and validates band and missions', async () => {
    expect((await post({ band: 'adult', missionIds: [] })).status).toBe(400);
    expect((await post({ band: 'teen', missionIds: ['no-such-mission'] })).status).toBe(400);
    const notForBand = MISSIONS.find((m) => !m.bands.includes('young-adult'));
    if (notForBand) expect((await post({ band: 'young-adult', missionIds: [notForBand.id] })).status).toBe(400);
    expect((await post({ band: 'young-adult', missionIds: [ya.id, ya.id] })).status).toBe(400);
    expect((await post({ band: 'young-adult', missionIds: [ya.id], squadCount: 9 })).status).toBe(400);

    main = await createSession({ band: 'young-adult', missionIds: [ya.id] });
    expect(main.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(main.hostKey.length).toBeGreaterThanOrEqual(22);
    expect(main.joinPath).toBe(`/j/${main.code}`);
  });

  it('answers public lookups with no counts', async () => {
    const found = await info(main.code.toLowerCase());
    expect(found).toMatchObject({ exists: true, band: 'young-adult', phase: 'lobby', acceptingJoins: true });
    for (const key of Object.keys(found)) expect(['exists', 'band', 'phase', 'acceptingJoins', 'squads']).toContain(key);
    expect(await info('ZZZZZZ')).toEqual({ exists: false });
  });

  it('rejects bad host keys, unknown rooms and malformed handshakes', async () => {
    await expect(connect({ role: 'host', code: main.code, hostKey: 'x'.repeat(22) })).rejects.toThrow('unauthorized');
    await expect(connect({ role: 'screen', code: 'ZZZZZZ' })).rejects.toThrow('not-found');
    await expect(connect({ role: 'seat', code: main.code, seatToken: 'short' })).rejects.toThrow('bad-request');
  });

  it('seats join with generated pseudonyms and never a name', async () => {
    host = await connect<'host'>({ role: 'host', code: main.code, hostKey: main.hostKey });
    screen = await connect<'screen'>({ role: 'screen', code: main.code });
    for (let i = 0; i < 5; i++) {
      tokens.push(newToken());
      seats.push(await seat(main.code, tokens[i]));
    }
    const names = seats.map((p) => p.snap.me.pseudonym);
    expect(new Set(names).size).toBe(5);
    const totemNames = SQUAD_TOTEMS.map((t) => t.name);
    for (const n of names) {
      expect(n).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
      expect(totemNames.some((t) => n.includes(t))).toBe(false);
    }
    // Auto mode: five players make one squad of five.
    const h = await host.waitFor((s) => s.room.seats === 5 && s.room.connected === 5, '5 seats on the Conductor');
    expect(h.squads).toHaveLength(1);
    expect(h.squads[0]?.seats).toHaveLength(5);
    expect(new Set(seats.map((p) => p.snap.me.squadId)).size).toBe(1);
    // The Big Screen sees counts per squad, never pseudonyms.
    const sc = await screen.waitFor((s) => s.squads[0]?.connected === 5, 'screen shows 5 connected');
    for (const n of names) expect(JSON.stringify(sc)).not.toContain(n);
  });

  it('a seat that reconnects with the same seatToken keeps its seat', async () => {
    const before = seats[0]!.snap.me;
    seats[0]!.socket.disconnect();
    await host.waitFor((s) => s.room.connected === 4, 'seat 0 shown away');
    seats[0] = await seat(main.code, tokens[0]);
    expect(seats[0].snap.me.seatId).toBe(before.seatId);
    expect(seats[0].snap.me.pseudonym).toBe(before.pseudonym);
    expect(seats[0].snap.me.squadId).toBe(before.squadId);
    const h = await host.waitFor((s) => s.room.connected === 5, 'seat 0 back');
    expect(h.room.seats).toBe(5);
  });

  it('opens a mission with one role per seat, then counts holds and role-tagged pins', async () => {
    expect(await command(host, { type: 'startMission', index: 0 })).toEqual({ ok: true });
    for (const p of seats) await p.waitFor((s) => s.squad.mission?.phase === 'role-flip', 'role flip');
    const roles = seats.map((p) => p.snap.me.role?.role);
    expect(new Set(roles).size).toBe(5);
    expect(seats.every((p) => p.snap.session.timeline !== null && p.snap.serverNow === clock)).toBe(true);

    expect(await command(host, { type: 'next' })).toEqual({ ok: true });
    for (const p of seats) await p.waitFor((s) => s.squad.mission?.phase === 'live', 'live');

    for (const i of [0, 1, 2]) expect(await seats[i]!.send('hold', { missionId: ya.id, atSec: 3 })).toEqual({ ok: true });
    expect(await seats[0]!.send('hold', { missionId: ya.id, atSec: 4 })).toEqual({ ok: true, dup: true });
    await screen.waitFor((s) => s.squads[0]?.holding === 3, 'screen lantern 3 holding');
    const room = await host.waitFor((s) => s.room.holdBuckets['0-5'] === 3, 'host hold buckets');
    expect(room.room.holdsMade).toBe(3);

    // Seat 3 has not held, so its pin is a "first look" made while the moment is still live.
    expect(await seats[3]!.send('pin', { clueId: redClue, live: true })).toEqual({ ok: true });
    expect(await seats[3]!.send('pin', { clueId: redClue, live: true })).toEqual({ ok: true, dup: true });
    expect(await seats[3]!.send('pin', { clueId: 'not-a-clue', live: true })).toEqual({ ok: false, error: 'bad-request' });
    const board = (await seats[4]!.waitFor((s) => (s.squad.mission?.board.pins.length ?? 0) === 1, 'pin on board')).squad.mission!
      .board;
    // Pins carry the role icon only, never the seat or pseudonym.
    expect(board.pins[0]).toEqual({ clueId: redClue, roles: [seats[3]!.snap.me.role!.role], live: true });
    await seats[3]!.waitFor((s) => s.me.pins.length === 1, 'own pin');
    expect(seats[3]!.snap.me.pins).toEqual([redClue]);
    expect(seats[4]!.snap.me.pins).toEqual([]);
  });

  it('seals are locked while the breathing ring runs, then idempotent by voteId', async () => {
    expect(await command(host, { type: 'setPhase', phase: 'think' })).toEqual({ ok: true });
    for (const p of seats) await p.waitFor((s) => s.squad.mission?.phase === 'think', 'think');
    const locked = await seats[0]!.send('seal', { voteId: 'vote-locked-0', round: 1, choiceId: risky, confidence: 3 });
    expect(locked).toEqual({ ok: false, error: 'locked' });

    clock += 11_000;
    expect(await seats[0]!.send('forecast', { optionId: ya.forecast.options[0]!.id })).toEqual({ ok: true });
    expect(await seats[0]!.send('trace', { optionId: ya.influence.options[0]!.id })).toEqual({ ok: true });

    // Round 1: risky, risky, safe, safe, unsure.
    const firsts = [risky, risky, safe, safe, unsure];
    for (let i = 0; i < 4; i++) {
      voteIds[i] = `r1-seat${i}-${randomBytes(6).toString('hex')}`;
      expect(await seats[i]!.send('seal', { voteId: voteIds[i], round: 1, choiceId: firsts[i], confidence: 3 })).toEqual({ ok: true });
    }
    expect(await seats[0]!.send('seal', { voteId: voteIds[0], round: 1, choiceId: risky, confidence: 3 })).toEqual({ ok: true, dup: true });
    expect(await seats[0]!.send('seal', { voteId: 'r1-another-vote', round: 1, choiceId: safe })).toEqual({ ok: false, error: 'already-sealed' });
    expect(await seats[1]!.send('seal', { voteId: voteIds[0], round: 1, choiceId: safe })).toEqual({ ok: false, error: 'bad-request' });
    expect(await seats[4]!.send('seal', { voteId: 'r1-unknown-exit', round: 1, choiceId: 'nope' })).toEqual({ ok: false, error: 'unknown-choice' });

    const sealed = await screen.waitFor((s) => s.squads[0]?.sealed.count === 4, 'seal wall 4 of 5');
    expect(sealed.squads[0]?.sealed).toEqual({ count: 4, total: 5 });

    voteIds[4] = `r1-seat4-${randomBytes(6).toString('hex')}`;
    expect(await seats[4]!.send('seal', { voteId: voteIds[4], round: 1, choiceId: unsure, confidence: 1 })).toEqual({ ok: true });
  });

  it('reveals counts only to the squad, agreement only to the Conductor and nothing risky to the screen', async () => {
    for (const p of seats) await p.waitFor((s) => s.squad.mission?.phase === 'reveal', 'reveal (quorum)');
    const reveal = seats[2]!.snap.squad.mission!.reveal!;
    expect(Object.keys(reveal).sort()).toEqual(['counts', 'kind', 'mood', 'total']);
    expect(reveal.kind).toBe('dots');
    if (reveal.kind !== 'dots') throw new Error('expected dots');
    expect(reveal.total).toBe(5);
    expect(reveal.mood).toBe('split');
    for (const c of reveal.counts) expect(Object.keys(c).sort()).toEqual(['choiceId', 'n']);
    const n = (id: string) => reveal.counts.find((c) => c.choiceId === id)?.n;
    expect([n(risky), n(safe), n(unsure)]).toEqual([2, 2, 1]);

    // No seat sees another seat's Exit or vote id.
    const other = JSON.stringify(seats[1]!.snap);
    expect(other).not.toContain(voteIds[0]);
    for (const m of seats[1]!.snap.squad.members) {
      expect(Object.keys(m).sort()).toEqual(['connected', 'done', 'players', 'pseudonym', 'role', 'seatId', 'seatIndex', 'shadow']);
    }
    expect(seats[0]!.snap.me.votes[0]?.round1).toEqual({ choiceId: risky, confidence: 3 });

    const h = await host.waitFor((s) => s.squads[0]?.agreement === 'split', 'host agreement');
    expect(JSON.stringify(h.squads)).not.toContain('"counts":');
    expect(h.room.votes?.first ?? null).toBeNull();

    const sc = screen.snap;
    const screenJson = JSON.stringify(sc);
    // Keys, not values: the phase itself is called 'reveal'.
    expect(screenJson).not.toContain('"reveal":');
    expect(screenJson).not.toContain('"counts":');
    expect(screenJson).not.toContain('"agreement":');
    expect(Object.keys(sc.squads[0]!).sort()).toEqual(
      ['complete', 'connected', 'decided', 'guardians', 'holding', 'id', 'name', 'phase', 'phaseEndsAt', 'sealed', 'shape', 'trust'].sort(),
    );
  });

  it('shows reason chips only when two or more share them, and deals one Steelman card on a split', async () => {
    expect(await seats[0]!.send('reasons', { chips: ['too-urgent'] })).toEqual({ ok: true });
    expect(await seats[2]!.send('reasons', { chips: ['too-urgent'] })).toEqual({ ok: true });
    expect(await seats[1]!.send('reasons', { chips: ['cant-verify', 'too-good'] })).toEqual({ ok: true });
    expect(await seats[3]!.send('reasons', { chips: ['cant-verify', 'too-good', 'easy-money'] })).toEqual({
      ok: false,
      error: 'bad-request',
    });

    expect(await command(host, { type: 'next' })).toEqual({ ok: true });
    for (const p of seats) await p.waitFor((s) => s.squad.mission?.phase === 'explain', 'explain');
    expect(seats[4]!.snap.squad.mission!.chips).toEqual({ chips: [{ chipId: 'too-urgent', n: 2 }], other: 2, players: 3 });

    const dealt = seats.filter((p) => p.snap.me.steelman !== null);
    expect(dealt).toHaveLength(1);
    expect(dealt[0]!.snap.me.steelman).toEqual({ choiceId: unsure });
    const told = seats.filter((p) => p.events.some((e) => e.event === 'steelman'));
    expect(told).toEqual(dealt);
    expect(host.events.some((e) => e.event === 'steelman')).toBe(false);
    expect(screen.events.some((e) => e.event === 'steelman')).toBe(false);
  });

  it('breaks a re-seal tie through the Safety Lead, with a reason the squad sees', async () => {
    expect(await command(host, { type: 'next' })).toEqual({ ok: true });
    for (const p of seats) await p.waitFor((s) => s.squad.mission?.phase === 'reseal', 'reseal');

    // Round 2: seat 2 safe -> unsure (riskier), seat 4 unsure -> safe (safer). Risky 2, safe 2, unsure 1: a tie.
    const finals = [risky, risky, unsure, safe, safe];
    for (let i = 0; i < 5; i++) {
      const res = await seats[i]!.send('seal', { voteId: `r2-seat${i}-${randomBytes(6).toString('hex')}`, round: 2, choiceId: finals[i] });
      expect(res).toEqual({ ok: true });
    }
    const tied = await seats[0]!.waitFor((s) => s.squad.mission?.tie !== null, 'tie');
    const expected = ya.choices.map((c) => c.id).filter((id) => id === risky || id === safe);
    expect(tied.squad.mission!.tie!.options).toEqual(expected);

    const leads = seats.filter((p) => p.snap.me.tieBreaker);
    expect(leads).toHaveLength(1);
    const lead = leads[0]!;
    expect(lead.snap.me.role?.role).toBe('safety-lead');
    const notLead = seats.find((p) => p !== lead)!;
    expect(await notLead.send('tiebreak', { choiceId: safe, because: 'check-first' })).toEqual({ ok: false, error: 'not-tie-breaker' });
    expect(await lead.send('tiebreak', { choiceId: unsure, because: 'check-first' })).toEqual({ ok: false, error: 'unknown-choice' });
    expect(await lead.send('tiebreak', { choiceId: safe, because: 'check-first' })).toEqual({ ok: true });

    for (const p of seats) {
      const s = await p.waitFor((x) => x.squad.mission?.decision !== null, 'decision');
      expect(s.squad.mission!.decision).toEqual({
        choiceId: safe,
        mindsChanged: 2,
        tieBreak: { options: expected, choiceId: safe, because: 'check-first', by: 'safety-lead' },
      });
      expect(s.squad.mission!.phase).toBe('release');
    }
    const sc = await screen.waitFor((s) => s.squads[0]?.decided === true, 'lantern beam');
    expect(sc.room.mindsChangedSafer).toBe(1);
    expect(JSON.stringify(sc)).not.toContain('"decision":');
    const h = await host.waitFor((s) => s.squads[0]?.decided === true, 'host decided');
    expect(h.squads[0]?.agreement).toBe('split');
  });

  it('writes crash snapshots without any seat-to-vote link', async () => {
    const snapshots = store.collection<{ id: string } & Record<string, unknown>>('session-snapshots');
    const doc = await until(async () => {
      const d = await snapshots.get(main.code);
      const squads = (d?.squads ?? []) as { mission?: { decision?: unknown } }[];
      return squads[0]?.mission?.decision ? d : undefined;
    }, 'crash snapshot after the decision');
    const json = JSON.stringify(doc);
    for (const id of voteIds) expect(json).not.toContain(id);
    expect(json).not.toContain(main.hostKey);
    for (const t of tokens) expect(json).not.toContain(t);
    for (const s of doc.seats as Record<string, unknown>[]) {
      expect(Object.keys(s).sort()).toEqual(['epoch', 'id', 'lastSeenAt', 'players', 'pseudonym', 'role', 'squadId', 'tokenHash']);
    }
  });

  it('ends the session and persists a counts-only SessionAggregate', async () => {
    const seatIds = seats.map((p) => p.snap.me.seatId);
    const names = seats.map((p) => p.snap.me.pseudonym);

    expect(await command(host, { type: 'endSession' })).toEqual({ ok: true });
    await host.waitFor((s) => s.session.phase === 'debrief' && s.debrief !== null, 'debrief');
    expect(await seats[3]!.send('signal', { kind: 'see-differently' })).toEqual({ ok: true });
    await host.waitFor((s) => s.room.seeDifferently === 1, 'see differently');
    expect(await command(host, { type: 'endSession' })).toEqual({ ok: true });
    await host.waitFor((s) => s.session.phase === 'ended', 'ended snapshot');
    await until(async () => (seats[0]!.events.some((e) => e.event === 'notice') ? true : undefined), 'session-ended notice');

    const aggregates = store.collection<SessionAggregate>('session-aggregates');
    const agg = await until(
      async () => (await aggregates.list((a) => a.complete && a.missionIds.join() === ya.id && a.seatsTotal === 5))[0],
      'complete aggregate',
    );
    const json = JSON.stringify(agg);
    expect(json).not.toContain(main.code);
    for (const id of seatIds) expect(json).not.toContain(id);
    for (const n of names) expect(json).not.toContain(n);
    for (const t of SQUAD_TOTEMS) {
      expect(json).not.toContain(t.name);
      expect(json).not.toContain(`"${t.id}"`);
    }
    expect(agg.createdAt).toMatch(/T\d\d:00:00\.000Z$/);
    expect(agg).toMatchObject({ band: 'young-adult', missionIds: [ya.id], seatsTotal: 5, squadsTotal: 1, complete: true });

    const m = agg.perMission[0]!;
    expect(m.missionId).toBe(ya.id);
    expect(m.holdBuckets).toMatchObject({ '0-5': 3, late: 2 });
    expect(m.liveFlags).toBe(1);
    expect(m.firstTotal).toBe(5);
    expect(m.firstCounts).toEqual({ [risky]: 2, [safe]: 2, [unsure]: 1 });
    expect(m.firstSafe).toBe(2);
    expect(m.finalSafe).toBe(2);
    expect(m.shiftedSafer).toBe(1);
    expect(m.shiftedRiskier).toBe(1);
    expect(m.unchanged).toBe(3);
    expect(m.confidenceHist).toEqual([1, 0, 4]);
    expect(m.decisions).toEqual({ [safe]: 1 });
    expect(m.tieBreaks).toBe(1);
    expect(m.reasonChipCounts).toEqual({ 'too-urgent': 2, 'cant-verify': 1, 'too-good': 1 });
    expect(m.forecastTotal).toBe(1);
    expect(m.traceTotal).toBe(1);

    // The crash snapshot is gone and the room code no longer resolves.
    await until(async () => ((await store.collection('session-snapshots').get(main.code)) ? undefined : true), 'snapshot deleted');
    expect((await info(main.code)).exists).toBe(false);
  });

  it('junior band: the reveal is a Mood, never counts, and the majority decides', async () => {
    const jm = MISSIONS.find((m) => m.bands.includes('junior') && m.choices.length >= 2);
    if (!jm) throw new Error('no junior mission');
    const [a, b] = [jm.choices[0]!.id, jm.choices[1]!.id];
    const s = await createSession({ band: 'junior', missionIds: [jm.id] });
    const jhost = await connect<'host'>({ role: 'host', code: s.code, hostKey: s.hostKey });
    const js: Peer<'seat'>[] = [];
    for (let i = 0; i < 3; i++) js.push(await seat(s.code));
    expect(jhost.snap.session.options.discreet).toBe(true);

    expect(await command(jhost, { type: 'startMission', index: 0 })).toEqual({ ok: true });
    expect(await command(jhost, { type: 'setPhase', phase: 'think' })).toEqual({ ok: true });
    for (const p of js) await p.waitFor((x) => x.squad.mission?.phase === 'think', 'junior think');
    // 10-13: three lenses only (Clue, Heart, Path).
    expect(js.map((p) => p.snap.me.role?.role).sort()).toEqual(['evidence-checker', 'peer-supporter', 'safety-lead']);
    expect(js[0]!.snap.squad.mission!.surgeAt).toBeNull();

    clock += 11_000;
    const firsts = [a, a, b];
    for (let i = 0; i < 3; i++) {
      expect(await js[i]!.send('seal', { voteId: `junior-r1-${i}-${randomBytes(4).toString('hex')}`, round: 1, choiceId: firsts[i] })).toEqual({ ok: true });
    }
    for (const p of js) await p.waitFor((x) => x.squad.mission?.phase === 'reveal', 'junior reveal');
    expect(js[1]!.snap.squad.mission!.reveal).toEqual({ kind: 'mood', mood: 'mostly', total: 3 });
    expect(JSON.stringify(js[1]!.snap.squad)).not.toContain('"counts":');

    expect(await command(jhost, { type: 'setPhase', phase: 'reseal' })).toEqual({ ok: true });
    for (const p of js) await p.waitFor((x) => x.squad.mission?.phase === 'reseal', 'junior reseal');
    for (let i = 0; i < 3; i++) {
      expect(await js[i]!.send('seal', { voteId: `junior-r2-${i}-${randomBytes(4).toString('hex')}`, round: 2, choiceId: firsts[i] })).toEqual({ ok: true });
    }
    const decided = await js[0]!.waitFor((x) => x.squad.mission?.decision !== null, 'junior decision');
    expect(decided.squad.mission!.decision).toEqual({ choiceId: a, mindsChanged: 0, tieBreak: null });
    const h = await jhost.waitFor((x) => x.squads[0]?.decided === true, 'junior host');
    expect(h.squads[0]?.agreement).toBe('mostly');
  });

  it('balances fixed squads, and the Conductor can move seats, mark shared devices and lock joins', async () => {
    const s = await createSession({ band: 'teen', missionIds: [MISSIONS.find((m) => m.bands.includes('teen'))!.id], squadCount: 2 });
    const h = await connect<'host'>({ role: 'host', code: s.code, hostKey: s.hostKey });
    const ss: Peer<'seat'>[] = [];
    const tk: string[] = [];
    for (let i = 0; i < 5; i++) {
      tk.push(newToken());
      ss.push(await seat(s.code, tk[i]));
    }
    const sizes = (snap: HostSnapshot) => snap.squads.map((q) => q.seats.length).sort();
    let hs = await h.waitFor((x) => x.room.seats === 5, 'five seats');
    expect(sizes(hs)).toEqual([2, 3]);

    // Move a seat from the bigger squad to the smaller one.
    const big = hs.squads.find((q) => q.seats.length === 3)!;
    const small = hs.squads.find((q) => q.seats.length === 2)!;
    const moving = ss.find((p) => p.snap.me.seatId === big.seats[2]!.seatId)!;
    expect(await command(h, { type: 'moveSeat', seatId: moving.snap.me.seatId, squadId: small.id })).toEqual({ ok: true });
    await moving.waitFor((x) => x.me.squadId === small.id, 'moved seat snapshot');
    expect(moving.events.some((e) => e.event === 'notice' && (e.payload as { kind: string }).kind === 'moved')).toBe(true);
    hs = await h.waitFor((x) => x.squads.find((q) => q.id === small.id)?.seats.length === 3, 'host sees move');

    // Pass-and-play: two players share one phone.
    expect(await command(h, { type: 'setSeatPlayers', seatId: ss[0]!.snap.me.seatId, players: 2 })).toEqual({ ok: true });
    const shared = await ss[0]!.waitFor((x) => x.me.players === 2, 'shared seat');
    expect(shared.me.votes).toHaveLength(2);

    // Anonymous help flag reaches the Conductor as a count.
    expect(await ss[1]!.send('needHelp', { on: true })).toEqual({ ok: true });
    await h.waitFor((x) => x.room.needHelp === 1, 'help count');

    // Room Freeze: the share of connected seats holding is broadcast.
    const scr = await connect<'screen'>({ role: 'screen', code: s.code });
    expect(await command(h, { type: 'startRoomFreeze' })).toEqual({ ok: true });
    expect(await ss[2]!.send('roomHold', { on: true })).toEqual({ ok: true });
    expect(await ss[3]!.send('roomHold', { on: true })).toEqual({ ok: true });
    await until(
      async () => (scr.events.some((e) => e.event === 'roomFreeze' && (e.payload as { amount: number }).amount === 0.4) ? true : undefined),
      'room freeze 2 of 5',
    );
    expect(await command(h, { type: 'endRoomFreeze' })).toEqual({ ok: true });

    expect(await command(h, { type: 'lockJoins', locked: true })).toEqual({ ok: true });
    await expect(seat(s.code)).rejects.toThrow('joins-locked');
    // A known seat token still rejoins its own seat.
    const id = ss[4]!.snap.me.seatId;
    ss[4]!.socket.disconnect();
    const back = await seat(s.code, tk[4]);
    expect(back.snap.me.seatId).toBe(id);

    // Seats cannot send Conductor commands.
    expect(await ss[1]!.send('command', { type: 'endSession' })).toEqual({ ok: false, error: 'forbidden' });
    expect((await info(s.code)).acceptingJoins).toBe(false);
  });

  it('auto mode evens out a squad of one before roles are dealt', async () => {
    const s = await createSession({ band: 'teen', missionIds: [MISSIONS.find((m) => m.bands.includes('teen'))!.id] });
    const h = await connect<'host'>({ role: 'host', code: s.code, hostKey: s.hostKey });
    const ss: Peer<'seat'>[] = [];
    for (let i = 0; i < 6; i++) ss.push(await seat(s.code));
    const sizes = (snap: HostSnapshot) => snap.squads.map((q) => q.seats.length).sort();
    expect(sizes(await h.waitFor((x) => x.room.seats === 6, 'six seats'))).toEqual([1, 5]);
    expect(await command(h, { type: 'startRoomFreeze' })).toEqual({ ok: true });
    const balanced = await h.waitFor((x) => x.session.phase === 'room-freeze', 'room freeze');
    expect(sizes(balanced)).toEqual([3, 3]);
    const wasMoved = (p: Peer<'seat'>) => p.events.some((e) => e.event === 'notice' && (e.payload as { kind: string }).kind === 'moved');
    await until(async () => (ss.filter(wasMoved).length === 2 ? true : undefined), 'two seats told they moved');
    const squadsOfSeats = await Promise.all(ss.map((p) => p.waitFor((x) => x.session.phase === 'room-freeze', 'seat room freeze')));
    expect(new Set(squadsOfSeats.map((x) => x.me.squadId)).size).toBe(2);
  });

  it('rate-limits a spamming socket and drops payloads over 16 KB', async () => {
    const s = await createSession({ band: 'young-adult', missionIds: [ya.id] });
    const scr = await connect<'screen'>({ role: 'screen', code: s.code });
    const results = await Promise.all(Array.from({ length: 45 }, (_, i) => scr.send('clockPing', { c: i })));
    expect(results.some((r) => !r.ok && r.error === 'rate-limited')).toBe(true);
    expect((results[0] as unknown as { c: number; s: number }).s).toBe(clock);

    const closed = new Promise<string>((resolve) => scr.socket.once('disconnect', (reason) => resolve(reason)));
    scr.socket.emit('sync', { pad: 'x'.repeat(20 * 1024) } as unknown as Record<string, never>, () => undefined);
    expect(await closed).toBeTruthy();
  });

  it('a probe connection reports the transport for the Conductor pre-flight', async () => {
    const socket: Client = io(base, { path: SOCKET_PATH, auth: { role: 'probe' }, transports: ['websocket'], reconnection: false, forceNew: true });
    sockets.push(socket);
    const report = await new Promise<{ serverNow: number; transport: string }>((resolve) => socket.once('probe', resolve));
    expect(report).toEqual({ serverNow: clock, transport: 'websocket' });
  });

  it('restores a live session from its crash snapshot after a restart', async () => {
    const { registerSquad } = await import('../src/squad/server');
    const start = async () => {
      const a = Fastify();
      await registerSquad(a, { now: () => clock, tickMs: 15, flushMs: 5 });
      await a.listen({ port: 0, host: '127.0.0.1' });
      return { app: a, url: `http://127.0.0.1:${(a.server.address() as AddressInfo).port}` };
    };
    const first = await start();
    const created = await first.app.inject({ method: 'POST', url: '/api/sessions', payload: { band: 'young-adult', missionIds: [ya.id] } });
    const s = created.json<CreateSessionResponse>();
    const h = await connect<'host'>({ role: 'host', code: s.code, hostKey: s.hostKey }, first.url);
    const tk = [newToken(), newToken(), newToken()];
    const ps: Peer<'seat'>[] = [];
    for (const t of tk) ps.push(await connect<'seat'>({ role: 'seat', code: s.code, seatToken: t }, first.url));
    expect(await command(h, { type: 'startMission', index: 0 })).toEqual({ ok: true });
    expect(await command(h, { type: 'setPhase', phase: 'think' })).toEqual({ ok: true });
    await ps[0]!.waitFor((x) => x.squad.mission?.phase === 'think', 'think before restart');
    clock += 11_000;
    expect(await ps[0]!.send('seal', { voteId: 'restart-vote-0', round: 1, choiceId: safe })).toEqual({ ok: true });
    const before = ps.map((p) => p.snap.me);
    for (const p of [h, ...ps]) p.socket.disconnect();
    // preClose writes any pending crash snapshot before the process would exit.
    await first.app.close();

    const second = await start();
    try {
      const back = await connect<'seat'>({ role: 'seat', code: s.code, seatToken: tk[1]! }, second.url);
      expect(back.snap.me.seatId).toBe(before[1]!.seatId);
      expect(back.snap.me.pseudonym).toBe(before[1]!.pseudonym);
      expect(back.snap.me.role).toEqual(before[1]!.role);
      // A restored running mission waits, paused, for the Conductor.
      expect(back.snap.session.paused).toBe(true);
      expect(back.snap.squad.mission?.phase).toBe('think');
      const h2 = await connect<'host'>({ role: 'host', code: s.code, hostKey: s.hostKey }, second.url);
      expect(await command(h2, { type: 'resume' })).toEqual({ ok: true });
      await back.waitFor((x) => !x.session.paused, 'resumed');
      // Votes were never written to disk, so the squad seals again.
      const again = await connect<'seat'>({ role: 'seat', code: s.code, seatToken: tk[0]! }, second.url);
      expect(again.snap.me.seatId).toBe(before[0]!.seatId);
      expect(again.snap.me.votes[0]?.round1).toBeNull();
    } finally {
      await second.app.close();
    }
  });

  // Keeps ScreenSnapshot / SeatSnapshot imports meaningful for readers of the payload shapes above.
  it('snapshots are versioned and carry the server clock', () => {
    const all: (SeatSnapshot | ScreenSnapshot | HostSnapshot)[] = [seats[0]!.snap, screen.snap, host.snap];
    for (const s of all) {
      expect(s.protocol).toBe(1);
      expect(typeof s.v).toBe('number');
      expect(typeof s.serverNow).toBe('number');
    }
  });
});
