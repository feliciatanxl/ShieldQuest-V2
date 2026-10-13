// Seat actions: emit, wait for the ack, and explain anything that did not go through.

import { ERROR_TEXT, newVoteId, send, serverNow, type PayloadOf, type SendResult } from '../socket';
import type { SeatCtx } from './context';
import { sealKey, useSeatLocal } from './local';

type SeatEvent = Exclude<Parameters<typeof send>[0], 'command'>;

/** Sends a seat event; quietly ignores harmless repeats and flashes a plain message for real problems. */
export async function act<E extends SeatEvent>(ctx: Pick<SeatCtx, 'flash'>, ev: E, payload: PayloadOf<E>): Promise<SendResult> {
  const res = await send(ev, payload);
  if (!res.ok && res.error !== 'already-sealed' && res.error !== 'used') ctx.flash(ERROR_TEXT[res.error]);
  return res;
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/**
 * Seals a vote. The phone shows it sealed at once (the envelope folds), keeps one voteId for every retry
 * (the server de-duplicates), and only un-seals if the server says the round is over.
 */
export async function sealVote(
  ctx: Pick<SeatCtx, 'flash' | 'view'>,
  round: 1 | 2,
  player: number,
  choiceId: string,
  confidence?: 1 | 2 | 3,
): Promise<void> {
  const key = sealKey(round, player);
  const store = useSeatLocal.getState();
  const voteId = store.pendingSeal[key]?.voteId ?? newVoteId();
  store.patch((s) => ({ pendingSeal: { ...s.pendingSeal, [key]: { voteId, choiceId, confidence } } }));
  const payload = { voteId, round, choiceId, player, ...(confidence ? { confidence } : {}) };
  let res = await send('seal', payload);
  if (!res.ok && res.error === 'locked' && round === 1 && ctx.view.sealLockUntil !== null) {
    // Our clock ran a little ahead of the breathing ring: wait for the server's unlock, then try once more.
    await sleep(Math.max(250, ctx.view.sealLockUntil - serverNow() + 300));
    res = await send('seal', payload);
  }
  if (res.ok || res.error === 'already-sealed' || res.error === 'offline') {
    // 'offline': keep it sealed on the phone; the next snapshot shows whether it landed.
    if (!res.ok && res.error === 'offline') ctx.flash(ERROR_TEXT.offline);
    return;
  }
  useSeatLocal.getState().patch((s) => {
    const next = { ...s.pendingSeal };
    delete next[key];
    return { pendingSeal: next };
  });
  ctx.flash(ERROR_TEXT[res.error]);
}
