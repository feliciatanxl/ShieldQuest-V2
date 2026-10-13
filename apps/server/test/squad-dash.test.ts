// Squad Dash: the optional team quiz between missions. The session state machine is driven directly with a
// fake clock and no-op hooks, so every step (start, taps, majority, reveal, skip, end) is deterministic.

import { describe, expect, it } from 'vitest';
import {
  DASH_ALL_IN_SEC,
  MISSIONS,
  SQUAD_TOTEMS,
  chanceById,
  dashQuestionSec,
  dashSquadPick,
  type ChanceQuestion,
  type SessionAggregate,
  type SquadTotemId,
} from '@shieldquest/shared';
import { fromDoc, toDoc, type SessionDoc } from '../src/squad/persist';
import { HostCommandSchema, SeatSchemas } from '../src/squad/schemas';
import { SquadSession, type SessionHooks } from '../src/squad/session';
import { hostSnapshot, screenSnapshot, seatSnapshot } from '../src/squad/views';

const T0 = Date.UTC(2026, 9, 14, 9, 0, 0);
const SEC = 1000;
const teenMission = MISSIONS.find((m) => m.bands.includes('teen'))!;
const [A, B] = [SQUAD_TOTEMS[0]!.id, SQUAD_TOTEMS[1]!.id] as [SquadTotemId, SquadTotemId];

function makeSession(opts: { calm?: boolean } = {}) {
  const aggregates: SessionAggregate[] = [];
  const hooks: SessionHooks = {
    changed: () => undefined,
    boundary: () => undefined,
    emitSquad: () => undefined,
    emitSeat: () => undefined,
    emitAll: () => undefined,
    seatMoved: () => undefined,
    aggregate: (a) => void aggregates.push(a),
    ended: () => undefined,
  };
  const sess = SquadSession.create(
    {
      code: 'H7KQ2M',
      hostKeyHash: 'x',
      now: T0,
      config: {
        band: 'teen',
        missionIds: [teenMission.id],
        squadCount: 2,
        gentle: false,
        discreet: true,
        calm: opts.calm ?? false,
        relaxed: false,
        autoAdvance: true,
      },
    },
    hooks,
  );
  // Three seats per squad, all connected.
  const seats: Record<SquadTotemId, string[]> = { [A]: [], [B]: [] } as Record<SquadTotemId, string[]>;
  for (const squad of [A, B, A, B, A, B]) {
    const res = sess.admitSeat({ seatToken: `token-${squad}-${seats[squad].length}-xxxxxxxxxxxxxxxx`, squad }, T0);
    if (!res.ok) throw new Error(res.error);
    sess.connectSeat(res.seatId, `sock-${res.seatId}`, T0);
    seats[squad].push(res.seatId);
  }
  return { sess, seats, aggregates };
}

const seatSnap = (sess: SquadSession, seatId: string, now = T0) => seatSnapshot(sess.s, sess.s.seats.get(seatId)!, now)!;
const current = (sess: SquadSession): ChanceQuestion => chanceById(sess.s.dash!.questionIds[sess.s.dash!.index]!)!;
const wrongOf = (q: ChanceQuestion) => q.options.find((o) => o.id !== q.answer)!.id;

describe('Squad Dash', () => {
  it('picks the squad majority, and a tied top is a split that does not score', () => {
    expect(dashSquadPick([{ choiceId: 'scam', n: 2 }, { choiceId: 'safe', n: 1 }])).toBe('scam');
    expect(dashSquadPick([{ choiceId: 'scam', n: 1 }, { choiceId: 'safe', n: 1 }])).toBeNull();
    expect(dashSquadPick([{ choiceId: 'scam', n: 0 }, { choiceId: 'safe', n: 0 }])).toBeNull();
    expect(dashQuestionSec({ band: 'junior' })).toBeGreaterThan(dashQuestionSec({ band: 'teen' }));
    expect(dashQuestionSec({ band: 'teen', relaxed: true })).toBeGreaterThan(dashQuestionSec({ band: 'teen' }));
  });

  it('validates the Conductor commands and the tap payload', () => {
    expect(HostCommandSchema.safeParse({ type: 'dashStart', questions: 6 }).success).toBe(true);
    expect(HostCommandSchema.safeParse({ type: 'dashStart', questions: 5 }).success).toBe(false);
    expect(HostCommandSchema.safeParse({ type: 'dashSkip' }).success).toBe(true);
    expect(SeatSchemas.dashAnswer.safeParse({ questionId: 'otp-friend', optionId: 'scam' }).success).toBe(true);
    expect(SeatSchemas.dashAnswer.safeParse({ questionId: 'otp friend!', optionId: 'scam' }).success).toBe(false);
  });

  it('runs a round: taps, live squad tally, majority reveal, skip, results and close', () => {
    const { sess, seats, aggregates } = makeSession();
    const t = T0 + 1000;
    expect(sess.command({ type: 'dashStart', questions: 6 }, t)).toEqual({ ok: true });
    expect(sess.command({ type: 'dashStart', questions: 6 }, t)).toEqual({ ok: false, error: 'wrong-phase' });
    const d = sess.s.dash!;
    expect(d.questionIds).toHaveLength(6);
    expect(new Set(d.questionIds).size).toBe(6);
    for (const id of d.questionIds) expect(chanceById(id)?.bands).toContain('teen');
    expect(d.endsAt).toBe(t + dashQuestionSec({ band: 'teen' }) * SEC);

    const q = current(sess);
    const right = q.answer;
    const wrong = wrongOf(q);
    const [a0, a1, a2] = seats[A] as [string, string, string];
    const [b0, b1, b2] = seats[B] as [string, string, string];

    // Bad taps never reach the state.
    expect(sess.dashAnswer(a0, { questionId: 'not-this-one', optionId: right }, t)).toEqual({ ok: false, error: 'wrong-phase' });
    expect(sess.dashAnswer(a0, { questionId: q.id, optionId: 'nope' }, t)).toEqual({ ok: false, error: 'unknown-choice' });
    expect(sess.dashAnswer(a0, { questionId: q.id, optionId: right, player: 3 }, t)).toEqual({ ok: false, error: 'bad-request' });

    // Squad A: two right, one wrong (after changing their mind). Squad B: one each, one silent = split.
    expect(sess.dashAnswer(a0, { questionId: q.id, optionId: right }, t)).toEqual({ ok: true });
    expect(sess.dashAnswer(a0, { questionId: q.id, optionId: right }, t)).toEqual({ ok: true, dup: true });
    expect(sess.dashAnswer(a1, { questionId: q.id, optionId: wrong }, t)).toEqual({ ok: true });
    expect(sess.dashAnswer(a1, { questionId: q.id, optionId: right }, t)).toEqual({ ok: true });
    expect(sess.dashAnswer(a2, { questionId: q.id, optionId: wrong }, t)).toEqual({ ok: true });
    expect(sess.dashAnswer(b0, { questionId: q.id, optionId: right }, t)).toEqual({ ok: true });
    expect(sess.dashAnswer(b1, { questionId: q.id, optionId: wrong }, t)).toEqual({ ok: true });

    // Phones see their own squad's live counts and their own tap, nothing else.
    const sa = seatSnap(sess, a2, t).dash!;
    const n = (counts: { choiceId: string; n: number }[], id: string) => counts.find((c) => c.choiceId === id)?.n;
    expect(sa.tally).toMatchObject({ answered: 3, total: 3 });
    expect([n(sa.tally!.counts, right), n(sa.tally!.counts, wrong)]).toEqual([2, 1]);
    expect(sa.mine).toEqual([{ player: 0, optionId: wrong }]);
    const sb = seatSnap(sess, b2, t).dash!;
    expect([n(sb.tally!.counts, right), n(sb.tally!.counts, wrong)]).toEqual([1, 1]);
    expect(sb.mine).toEqual([{ player: 0 }]);
    // No seat id or pseudonym in any phone's Dash view.
    for (const id of [...seats[A], ...seats[B]]) expect(JSON.stringify(sb)).not.toContain(id);

    // The Conductor and the projector see progress counts, never options picked before the reveal.
    const host = hostSnapshot(sess.s, t).dash!;
    expect(host.squads.map((x) => [x.squadId, x.answered, x.total])).toEqual([
      [A, 3, 3],
      [B, 2, 3],
    ]);
    const hostJson = JSON.stringify(host);
    expect(hostJson).not.toContain('"counts"');
    expect(hostJson).not.toContain('"tally"');
    expect(hostJson).not.toContain('"mine"');
    const scr = screenSnapshot(sess.s, t).dash!;
    expect(Object.keys(scr.squads[0]!).sort()).toEqual(['answered', 'name', 'score', 'shape', 'squadId', 'total']);
    expect(JSON.stringify(scr)).not.toMatch(/"(counts|tally|mine|result|pick)"/);

    // Last tap: everyone is in, so the reveal comes a few seconds later.
    expect(sess.dashAnswer(b2, { questionId: q.id, optionId: wrong }, t + 2000)).toEqual({ ok: true });
    expect(sess.s.dash!.endsAt).toBe(t + 2000 + DASH_ALL_IN_SEC * SEC);
    // B is now 1 right vs 2 wrong: its pick is the wrong option.
    sess.tick(t + 2000 + DASH_ALL_IN_SEC * SEC - 1);
    expect(sess.s.dash!.stage).toBe('question');
    sess.tick(t + 2000 + DASH_ALL_IN_SEC * SEC);
    expect(sess.s.dash!.stage).toBe('reveal');
    expect(sess.s.dash!.answers.size).toBe(0);

    const ra = seatSnap(sess, a0, t + 8000).dash!;
    expect(ra.result).toEqual({ pick: right, correct: true, split: false, answered: 3 });
    expect(ra.room).toEqual({ correct: 1, squads: 2 });
    expect(ra.score).toEqual({ correct: 1, played: 1 });
    const rb = seatSnap(sess, b0, t + 8000).dash!;
    expect(rb.result).toEqual({ pick: wrong, correct: false, split: false, answered: 3 });
    // The room learns how many squads were right, not which.
    const scrReveal = screenSnapshot(sess.s, t + 8000).dash!;
    expect(scrReveal.room).toEqual({ correct: 1, squads: 2 });
    expect(JSON.stringify(scrReveal)).not.toMatch(/"(pick|result|counts)"/);
    expect(hostSnapshot(sess.s, t + 8000).dash!.squads.map((x) => x.result?.correct)).toEqual([true, false]);
    expect(sess.dashAnswer(a0, { questionId: q.id, optionId: wrong }, t + 8000)).toEqual({ ok: false, error: 'wrong-phase' });

    // Next question: a split this time (one each in B, A silent but present = scored as no pick).
    expect(sess.command({ type: 'next' }, t + 9000)).toEqual({ ok: true });
    expect(sess.s.dash).toMatchObject({ stage: 'question', index: 1 });
    const q2 = current(sess);
    sess.dashAnswer(b0, { questionId: q2.id, optionId: q2.answer }, t + 9500);
    sess.dashAnswer(b1, { questionId: q2.id, optionId: wrongOf(q2) }, t + 9500);
    expect(sess.command({ type: 'dashNext' }, t + 10_000)).toEqual({ ok: true });
    const r2 = seatSnap(sess, b0, t + 10_000).dash!;
    expect(r2.result).toEqual({ pick: null, correct: false, split: true, answered: 2 });
    expect(seatSnap(sess, a0, t + 10_000).dash!.result).toEqual({ pick: null, correct: false, split: false, answered: 0 });

    // Skip question 3 (unscored), then end early: straight to the totals.
    expect(sess.command({ type: 'dashNext' }, t + 11_000)).toEqual({ ok: true });
    expect(sess.command({ type: 'dashSkip' }, t + 12_000)).toEqual({ ok: true });
    expect(sess.s.dash).toMatchObject({ stage: 'question', index: 3 });
    expect(sess.command({ type: 'dashEnd' }, t + 13_000)).toEqual({ ok: true });
    expect(sess.s.dash!.stage).toBe('results');
    const hostEnd = hostSnapshot(sess.s, t + 13_000).dash!;
    expect(hostEnd.rounds.map((r) => [r.skipped, r.correct, r.squads])).toEqual([
      [false, 1, 2],
      [false, 0, 2],
      [true, 0, 0],
    ]);
    expect(hostEnd.totals).toEqual({ correct: 1, played: 4 });
    expect(screenSnapshot(sess.s, t + 13_000).dash!.squads.map((x) => x.score)).toEqual([
      { correct: 1, played: 2 },
      { correct: 0, played: 2 },
    ]);
    expect(sess.command({ type: 'dashSkip' }, t + 13_000)).toEqual({ ok: false, error: 'wrong-phase' });

    // Close: counts-only analytics are handed to the store.
    expect(sess.command({ type: 'dashEnd' }, t + 14_000)).toEqual({ ok: true });
    expect(sess.s.dash).toBeNull();
    const agg = aggregates.at(-1)!.dash!;
    expect(agg).toMatchObject({ rounds: 1, questions: 2, squadAnswers: 4, squadCorrect: 1, splits: 1, none: 1 });
    expect(agg.byQuestion[q.id]).toEqual({ squads: 2, correct: 1 });
    const aggJson = JSON.stringify(aggregates.at(-1));
    for (const id of [...seats[A], ...seats[B]]) expect(aggJson).not.toContain(id);
    expect(aggJson).not.toContain('H7KQ2M');

    // A second round avoids the questions already used.
    expect(sess.command({ type: 'dashStart', questions: 8 }, t + 20_000)).toEqual({ ok: true });
    for (const id of sess.s.dash!.questionIds) expect(d.questionIds).not.toContain(id);
  });

  it('only opens when no mission is running; starting a mission closes an open Dash', () => {
    const { sess } = makeSession();
    expect(sess.command({ type: 'dashNext' }, T0)).toEqual({ ok: false, error: 'wrong-phase' });
    expect(sess.command({ type: 'dashStart', questions: 4 }, T0)).toEqual({ ok: true });
    expect(sess.command({ type: 'startMission', index: 0 }, T0 + 1000)).toEqual({ ok: true });
    expect(sess.s.dash).toBeNull();
    expect(sess.command({ type: 'dashStart', questions: 4 }, T0 + 2000)).toEqual({ ok: false, error: 'wrong-phase' });
    // At Look Up (mission complete) it may open again.
    expect(sess.command({ type: 'endMission' }, T0 + 3000)).toEqual({ ok: true });
    expect(sess.command({ type: 'dashStart', questions: 4 }, T0 + 4000)).toEqual({ ok: true });
    // The debrief closes it too, and no Dash opens there.
    expect(sess.command({ type: 'endSession' }, T0 + 5000)).toEqual({ ok: true });
    expect(sess.s.dash).toBeNull();
    expect(sess.command({ type: 'dashStart', questions: 4 }, T0 + 6000)).toEqual({ ok: false, error: 'wrong-phase' });
  });

  it('Calm Mode has no clock; pausing stops taps and shifts the clock', () => {
    const calm = makeSession({ calm: true });
    calm.sess.command({ type: 'dashStart', questions: 4 }, T0);
    expect(calm.sess.s.dash!.endsAt).toBeNull();
    expect(seatSnap(calm.sess, calm.seats[A]![0]!).dash!.quiet).toBe(true);
    calm.sess.tick(T0 + 3600 * SEC);
    expect(calm.sess.s.dash!.stage).toBe('question');
    // Turning Calm off starts a fresh clock.
    calm.sess.command({ type: 'setOption', key: 'calm', value: false }, T0 + 10 * SEC);
    expect(calm.sess.s.dash!.endsAt).toBe(T0 + 10 * SEC + dashQuestionSec({ band: 'teen' }) * SEC);

    const { sess, seats } = makeSession();
    sess.command({ type: 'dashStart', questions: 4 }, T0);
    const endsAt = sess.s.dash!.endsAt!;
    sess.command({ type: 'pause' }, T0 + 5 * SEC);
    const q = current(sess);
    expect(sess.dashAnswer(seats[A]![0]!, { questionId: q.id, optionId: q.answer }, T0 + 6 * SEC)).toEqual({ ok: false, error: 'paused' });
    sess.tick(endsAt + 60 * SEC);
    expect(sess.s.dash!.stage).toBe('question');
    sess.command({ type: 'resume' }, T0 + 65 * SEC);
    expect(sess.s.dash!.endsAt).toBe(endsAt + 60 * SEC);
  });

  it('persists question order and squad results, never taps, and resumes after a restart', () => {
    const { sess, seats } = makeSession();
    sess.command({ type: 'dashStart', questions: 6 }, T0);
    const q = current(sess);
    for (const id of seats[A]!) sess.dashAnswer(id, { questionId: q.id, optionId: q.answer }, T0 + SEC);
    sess.command({ type: 'dashNext' }, T0 + 2 * SEC);
    sess.command({ type: 'dashNext' }, T0 + 3 * SEC);
    const q2 = current(sess);
    sess.dashAnswer(seats[B]![0]!, { questionId: q2.id, optionId: q2.answer }, T0 + 4 * SEC);

    // Round trip through JSON, as the store does.
    const doc = JSON.parse(JSON.stringify(toDoc(sess.s, T0 + 5 * SEC))) as SessionDoc;
    const dashJson = JSON.stringify(doc.dash);
    for (const id of [...seats[A]!, ...seats[B]!]) expect(dashJson).not.toContain(id);
    expect(dashJson).not.toContain('answers');
    const restored = fromDoc(doc, T0 + 100 * SEC)!;
    const d = restored.dash!;
    expect(d.questionIds).toEqual(sess.s.dash!.questionIds);
    expect(d.rounds).toEqual(sess.s.dash!.rounds);
    expect(d).toMatchObject({ stage: 'question', index: 1, stageStartedAt: T0 + 100 * SEC });
    // The open question is asked again with a fresh clock; the lost tap is not carried over.
    expect(d.answers.size).toBe(0);
    expect(d.endsAt).toBe(T0 + 100 * SEC + dashQuestionSec({ band: 'teen' }) * SEC);
    expect(restored.dashRuns).toBe(1);
    expect(restored.dashUsed).toEqual(sess.s.dash!.questionIds);

    // Older snapshots (before Squad Dash) still load.
    const old = { ...doc } as Partial<SessionDoc>;
    delete old.dash;
    delete old.dashRuns;
    delete old.dashUsed;
    const legacy = fromDoc(old as SessionDoc, T0 + 100 * SEC)!;
    expect(legacy.dash).toBeNull();
    expect(legacy.dashRuns).toBe(0);
    expect(legacy.dashUsed).toEqual([]);
  });

  it('shared phones count each player but never show the previous player their tap', () => {
    const { sess, seats } = makeSession();
    const shared = seats[A]![0]!;
    sess.command({ type: 'setSeatPlayers', seatId: shared, players: 2 }, T0);
    sess.command({ type: 'dashStart', questions: 4 }, T0);
    const q = current(sess);
    expect(sess.dashAnswer(shared, { questionId: q.id, optionId: q.answer, player: 0 }, T0)).toEqual({ ok: true });
    expect(sess.dashAnswer(shared, { questionId: q.id, optionId: wrongOf(q), player: 1 }, T0)).toEqual({ ok: true });
    const view = seatSnap(sess, shared).dash!;
    expect(view.mine).toEqual([{ player: 0 }, { player: 1 }]);
    expect(view.tally).toMatchObject({ answered: 2, total: 4 });
  });
});
