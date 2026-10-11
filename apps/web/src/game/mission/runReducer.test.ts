import { describe, expect, it } from 'vitest';
import { evaluateRun, missionById, type Mission, type ShieldSlot } from '@shieldquest/shared';
import { SHIELD_MAX_TRIES, buildRunInput, canAdvance, createRunState, runReducer, type RunAction, type RunState } from './runReducer';
import { MAX_REASONS, sniffTarget } from './runLogic';

const mission = missionById('easy-money') as Mission;
const red = mission.clues.filter((c) => c.redFlag);
const decoys = mission.clues.filter((c) => !c.redFlag);
const safe = mission.choices.find((c) => c.safety === 'safe')!;
const risky = mission.choices.find((c) => c.safety === 'risky')!;
const traceRight = mission.influence.options.find((o) => o.correct)!;
const traceWrong = mission.influence.options.find((o) => !o.correct)!;
const likely = mission.forecast.options.find((o) => o.likely)!;

const run = (s: RunState, ...actions: RunAction[]): RunState => actions.reduce(runReducer, s);
const fresh = (band: RunState['band'] = 'young-adult') => createRunState(mission, 1234, band);

/** Best tile per slot, so Peer Shield succeeds. */
function bestPicks(): Partial<Record<ShieldSlot, string>> {
  const shield = mission.peerShield!;
  const picks: Partial<Record<ShieldSlot, string>> = {};
  for (const slot of ['opener', 'reason', 'offer', 'channel'] as const) picks[slot] = shield.slots[slot].find((t) => t.quality === 'great')!.id;
  return picks;
}

function playToShield(s: RunState): RunState {
  return run(
    s,
    { type: 'start' },
    { type: 'look', clueId: red[0]!.id },
    { type: 'freeze', heldAtSec: 12, t: 12.1 },
    ...red.slice(1).map((c): RunAction => ({ type: 'call', clueId: c.id, call: 'flag' })),
    ...decoys.map((c): RunAction => ({ type: 'call', clueId: c.id, call: 'fine' })),
    { type: 'freezeDone' },
    { type: 'next' },
    { type: 'pullThread' },
    { type: 'trace', optionId: traceRight.id },
    { type: 'next' },
    { type: 'forecast', optionId: likely.id },
    { type: 'sealForecast' },
    { type: 'next' },
    { type: 'seal', choiceId: risky.id, confidence: 2 },
    { type: 'next' },
    { type: 'reason', chip: 'Too urgent' },
    { type: 'reseal', choiceId: safe.id },
    { type: 'next' },
    { type: 'next' },
  );
}

describe('runReducer: a full solo run', () => {
  it('walks every phase and builds the RunInput the engine expects', () => {
    let s = playToShield(fresh());
    expect(s.phase).toBe('shield');
    for (const [slot, tileId] of Object.entries(bestPicks())) s = runReducer(s, { type: 'shieldPick', slot: slot as ShieldSlot, tileId });
    s = run(s, { type: 'shieldSend' });
    expect(s.shieldResult?.outcome).toBe('success');
    s = run(s, { type: 'next' });
    expect(s.phase).toBe('saved');

    const input = buildRunInput(s);
    expect(input).toMatchObject({
      missionId: mission.id,
      heldAtSec: 12,
      liveFound: [red[0]!.id],
      traceOptionId: traceRight.id,
      forecastOptionId: likely.id,
      firstVote: risky.id,
      confidence: 2,
      finalChoice: safe.id,
      guardiansUsed: [],
    });
    expect(input.frozenFound.sort()).toEqual(red.slice(1).map((c) => c.id).sort());
    expect(evaluateRun(mission, input).skills).toEqual(['S', 'H', 'I', 'E', 'L', 'D']);
  });

  it('records the late auto-freeze as heldAtSec null, with no other penalty', () => {
    const s = run(fresh(), { type: 'start' }, { type: 'freeze', heldAtSec: null, t: mission.live.durationSec });
    expect(s.phase).toBe('freeze');
    expect(s.autoFrozen).toBe(true);
    expect(buildRunInput(s).heldAtSec).toBeNull();
  });
});

describe('runReducer: guards', () => {
  it('does not move on until the phase is done', () => {
    let s = run(fresh(), { type: 'start' }, { type: 'next' });
    expect(s.phase).toBe('live'); // only HOLD or the auto-freeze ends Live
    s = run(s, { type: 'freeze', heldAtSec: 5, t: 5 }, { type: 'next' });
    expect(s.phase).toBe('freeze');
    expect(canAdvance(s)).toBe(false);
    s = run(s, { type: 'freezeDone' }, { type: 'next' }, { type: 'trace', optionId: traceRight.id });
    expect(s.traceAnswers).toEqual([]); // the thread must be pulled first
  });

  it('allows a second Trace answer as practice, and counts only the first', () => {
    const s = run(
      fresh(),
      { type: 'start' },
      { type: 'freeze', heldAtSec: 5, t: 5 },
      { type: 'freezeDone' },
      { type: 'next' },
      { type: 'pullThread' },
      { type: 'trace', optionId: traceWrong.id },
      { type: 'trace', optionId: traceRight.id },
      { type: 'trace', optionId: traceWrong.id },
    );
    expect(s.traceAnswers).toEqual([traceWrong.id, traceRight.id]);
    expect(buildRunInput(s).traceOptionId).toBe(traceWrong.id);
  });

  it('caps reason chips and toggles them off again', () => {
    let s = run(playToShield(fresh()));
    s = { ...s, phase: 'explain', reasons: [] };
    s = run(s, { type: 'reason', chip: 'a' }, { type: 'reason', chip: 'b' }, { type: 'reason', chip: 'c' });
    expect(s.reasons).toHaveLength(MAX_REASONS);
    s = run(s, { type: 'reason', chip: 'a' });
    expect(s.reasons).toEqual(['b']);
  });

  it('seals the first vote once only', () => {
    let s: RunState = { ...fresh(), phase: 'think' };
    s = run(s, { type: 'seal', choiceId: risky.id, confidence: 3 }, { type: 'seal', choiceId: safe.id, confidence: 1 });
    expect([s.firstVote, s.confidence]).toEqual([risky.id, 3]);
  });

  it('allows one Peer Shield retry after a failed message', () => {
    let s = playToShield(fresh());
    const shield = mission.peerShield!;
    for (const slot of ['opener', 'reason', 'offer', 'channel'] as const) {
      s = runReducer(s, { type: 'shieldPick', slot, tileId: shield.slots[slot].find((t) => t.quality === 'harmful')!.id });
    }
    s = run(s, { type: 'shieldSend' });
    expect(s.shieldResult?.outcome).not.toBe('success');
    s = run(s, { type: 'shieldRetry' });
    expect(s.shieldResult).toBeNull();
    s = run(s, { type: 'shieldSend' }, { type: 'shieldRetry' });
    expect(s.shieldTries).toBe(SHIELD_MAX_TRIES);
    expect(s.shieldResult).not.toBeNull(); // no third try; Continue is still open
    expect(canAdvance(s)).toBe(true);
  });
});

describe('runReducer: surges and Guardians', () => {
  it('never surges for juniors', () => {
    const s = run(fresh('junior'), { type: 'start' }, { type: 'freeze', heldAtSec: 5, t: 5 }, { type: 'surge', to: 'showing' });
    expect(s.surge).toBe('off');
  });

  it('clears a surge by holding again or with Shieldfin, without touching the clock', () => {
    const base = run(fresh(), { type: 'start' }, { type: 'freeze', heldAtSec: 5, t: 5 }, { type: 'surge', to: 'showing' });
    expect(base.surge).toBe('showing');
    const held = run(base, { type: 'surge', to: 'held' });
    expect(held.surge).toBe('held');
    expect(held.frozenAt).toBe(base.frozenAt);
    const fin = run(base, { type: 'guardian', guardian: 'shieldfin' });
    expect(fin.surge).toBe('shieldfin');
    expect(fin.guardiansUsed).toEqual(['shieldfin']);
  });

  it('lets each Guardian act once per mission', () => {
    const s0 = run(fresh(), { type: 'start' }, { type: 'freeze', heldAtSec: 5, t: 5 });
    const target = sniffTarget(mission, s0.looks, s0.calls)!;
    const s = run(
      s0,
      { type: 'guardian', guardian: 'cluepaw', target: target.id },
      { type: 'guardian', guardian: 'cluepaw', target: red[0]!.id },
      { type: 'guardian', guardian: 'bytebuddy' },
    );
    expect(s.sniffed).toBe(target.id);
    expect(s.scanned).toBe(true);
    expect(s.guardiansUsed).toEqual(['cluepaw', 'bytebuddy']);
    expect(buildRunInput(s).guardiansUsed).toEqual(['cluepaw', 'bytebuddy']);
  });
});
