import { describe, expect, it } from 'vitest';
import {
  applyRun,
  dueAftershocks,
  emptyProgress,
  evaluateRun,
  evaluateShield,
  findPersonalData,
  guardianLevel,
  missionById,
  resolveAftershock,
  MISSIONS,
  type RunInput,
} from '../src';

const mission = missionById('easy-money')!;

const baseRun: RunInput = {
  missionId: 'easy-money',
  heldAtSec: 20,
  liveFound: ['c-reward'],
  frozenFound: ['c-account', 'c-proof', 'c-deadline', 'c-secret'],
  traceOptionId: 'i-bonus',
  forecastOptionId: 'f-restricted',
  firstVote: 'ask-proof',
  confidence: 2,
  finalChoice: 'refuse-tell',
  shieldPicks: { opener: 'o-glad', reason: 'r-target', offer: 'f-come', channel: 'c-bank' },
  guardiansUsed: [],
};

describe('evaluateRun', () => {
  it('awards every skill for a strong, safe run', () => {
    const s = evaluateRun(mission, baseRun);
    expect(s.live).toBe(1);
    expect(s.held).toBe(4);
    expect(s.skills).toEqual(['S', 'H', 'I', 'E', 'L', 'D']);
    expect(s.changedMind).toBe(true);
    expect(s.confidentRisk).toBe(false);
  });

  it('does not award Hold when time auto-froze', () => {
    const s = evaluateRun(mission, { ...baseRun, heldAtSec: null });
    expect(s.skills).not.toContain('H');
  });

  it('flags confident risky first votes for a private hypercorrection note', () => {
    const s = evaluateRun(mission, { ...baseRun, firstVote: 'accept', confidence: 3 });
    expect(s.confidentRisk).toBe(true);
  });

  it('counts ordinary details flagged as red flags as false alarms', () => {
    const s = evaluateRun(mission, { ...baseRun, frozenFound: [...baseRun.frozenFound, 'c-poster', 'c-question'] });
    expect(s.falseAlarms).toBe(2);
    expect(s.skills).not.toContain('S');
  });
});

describe('Peer Shield', () => {
  it('succeeds with supportive, non-blaming tiles', () => {
    expect(evaluateShield(mission.peerShield!, baseRun.shieldPicks!).outcome).toBe('success');
  });
  it('fails when the message blames the friend', () => {
    const r = evaluateShield(mission.peerShield!, { opener: 'o-told', reason: 'r-two', offer: 'f-secret', channel: 'c-kel' });
    expect(r.outcome).toBe('fail');
  });
});

describe('Delayed Consequence Engine', () => {
  it('schedules an Aftershock for a risky choice and lands it after the next mission', () => {
    const risky = evaluateRun(mission, { ...baseRun, finalChoice: 'accept' });
    let { progress } = applyRun(emptyProgress(), mission, risky, 1000);
    expect(progress.wallet).toBe(200);
    expect(dueAftershocks(progress)).toHaveLength(0);
    expect(dueAftershocks(progress, true)).toHaveLength(1);

    progress = { ...progress, completedCount: progress.completedCount + 1 };
    const due = dueAftershocks(progress);
    expect(due).toHaveLength(1);

    const after = resolveAftershock(progress, MISSIONS, due[0]!.key, 'r-tell', 2000);
    expect(after.wallet).toBe(0);
    expect(after.pending).toHaveLength(0);
    expect(after.resolved[0]!.recoveredWell).toBe(true);
    expect(after.guardianBond.beacon).toBeGreaterThan(progress.guardianBond.beacon);
  });

  it('unfolds Guardians as skills are demonstrated', () => {
    const { progress, guardianLevelUps } = applyRun(emptyProgress(), mission, evaluateRun(mission, baseRun), 1);
    expect(guardianLevelUps).toHaveLength(6);
    expect(guardianLevel(progress.guardianBond.cluepaw)).toBe(1);
  });
});

describe('personal data guard', () => {
  it('detects NRIC numbers, phone numbers and emails', () => {
    expect(findPersonalData('my ic is S1234567D')).toContain('NRIC/FIN number');
    expect(findPersonalData('call me 9123 4567')).toContain('Singapore phone number');
    expect(findPersonalData('mail a@b.com')).toContain('email address');
    expect(findPersonalData('A stranger offered me money for my account')).toEqual([]);
  });
});
