import { describe, expect, it } from 'vitest';
import { MISSIONS, emptyProgress, type Mission, type Progress } from '@shieldquest/shared';
import {
  TUTORIAL_ID,
  bandMissions,
  buildMarkers,
  districtSummary,
  formatWallet,
  lanternSummary,
  missionState,
  nextMission,
} from './hubData';
import { bondState, holdInsight, nextStepText, seenTactics } from '../guardians/bondData';

// Only the fields the hub reads; the rest of the schema is irrelevant to these pure helpers.
const mk = (id: string, patch: Partial<Mission>): Mission =>
  ({ id, title: id, district: 'school-street', bands: ['teen'], scaffold: 'guided', ...patch }) as unknown as Mission;

const played = (p: Progress, id: string, bestSafety: 'safe' | 'unsure' | 'risky' = 'safe'): Progress => ({
  ...p,
  runs: { ...p.runs, [id]: { bestSafety, plays: 1, lastAt: 0, lastChoice: 'x' } },
});

describe('hub mission state', () => {
  it('ranks a pending Aftershock above "played"', () => {
    let p = played(emptyProgress(), 'a');
    expect(missionState(p, 'a')).toBe('done');
    p = { ...p, pending: [{ key: 'a:x', missionId: 'a', choiceId: 'c', aftershockId: 'x', dueAt: 3, forecastLikely: false }] };
    expect(missionState(p, 'a')).toBe('aftershock');
    expect(missionState(p, 'b')).toBe('new');
  });

  it('never puts markers on fogged districts', () => {
    const missions = [mk('a', {}), mk('b', { district: 'interchange' })];
    expect(buildMarkers(missions, emptyProgress()).map((m) => m.missionId)).toEqual(['a']);
  });
});

describe('Continue suggestion', () => {
  it('suggests the tutorial first when it exists', () => {
    if (!MISSIONS.some((m) => m.id === TUTORIAL_ID)) return;
    expect(nextMission('teen', emptyProgress())?.id).toBe(TUTORIAL_ID);
    expect(nextMission('teen', played(emptyProgress(), TUTORIAL_ID))?.id).not.toBe(TUTORIAL_ID);
  });

  it('fades prompts: Guided before Light before Wildcard, registry order breaks ties', () => {
    const missions = [mk('w', { scaffold: 'wildcard' }), mk('l', { scaffold: 'light' }), mk('g1', {}), mk('g2', {})];
    expect(nextMission('teen', emptyProgress(), missions)?.id).toBe('g1');
    expect(nextMission('teen', played(emptyProgress(), 'g1'), missions)?.id).toBe('g2');
    const most = played(played(played(emptyProgress(), 'g1'), 'g2'), 'l');
    expect(nextMission('teen', most, missions)?.id).toBe('w');
    expect(nextMission('teen', played(most, 'w'), missions)).toBeNull();
  });

  it('only suggests missions written for the band', () => {
    const missions = [mk('junior-only', { bands: ['junior'] }), mk('teen', {})];
    expect(nextMission('teen', emptyProgress(), missions)?.id).toBe('teen');
    expect(bandMissions('junior', missions).map((m) => m.id)).toEqual(['junior-only']);
  });
});

describe('district summary', () => {
  it('falls back to every band when the band has nothing here', () => {
    const missions = [mk('ya', { bands: ['young-adult'] })];
    const s = districtSummary('school-street', 'junior', emptyProgress(), missions);
    expect(s.otherBands).toBe(true);
    expect(s.missions.map((m) => m.id)).toEqual(['ya']);
    expect(s.fresh).toBe(1);
  });

  it('lists nothing in a fogged district', () => {
    const s = districtSummary('interchange', 'teen', emptyProgress(), [mk('x', { district: 'interchange' })]);
    expect(s.comingSoon).toBe(true);
    expect(s.missions).toHaveLength(0);
  });
});

describe('hub chips', () => {
  it('counts lit lanterns and dimmed districts', () => {
    const l = lanternSummary({ 'school-street': 2, 'digi-district': -1, 'retail-district': 0 });
    expect(l.lit).toBe(2);
    expect(l.dimmed).toBe(1);
    expect(l.max).toBeGreaterThan(0);
  });

  it('formats the fictional wallet, including a negative balance', () => {
    expect(formatWallet(1200)).toBe('S$1,200');
    expect(formatWallet(-40)).toBe('−S$40');
  });
});

describe('Bond Book helpers', () => {
  it('reports the next Bond mark target', () => {
    const p = emptyProgress();
    expect(bondState(p, 'echo')).toMatchObject({ level: 0, nextAt: 1 });
    const s = bondState({ ...p, guardianBond: { ...p.guardianBond, echo: 4 } }, 'echo');
    expect(s.level).toBe(2);
    expect(nextStepText(s, 'Echo')).toBe('2 more times to fold in Bond mark III.');
    const done = bondState({ ...p, guardianBond: { ...p.guardianBond, echo: 9 } }, 'echo');
    expect(done.nextAt).toBeNull();
  });

  it('credits holding in the LIVE vs HELD line, never blaming the player', () => {
    expect(holdInsight({ liveFlags: 3, heldFlags: 11, holds: 1, missions: 1 }).line).toContain('3.7× more red flags after holding');
    expect(holdInsight({ liveFlags: 0, heldFlags: 0, holds: 0, missions: 0 }).line).toMatch(/^Play a mission/);
  });

  it('ignores unknown tactic ids from older saves', () => {
    const p = { ...emptyProgress(), tacticsSeen: ['urgency', 'not-a-tactic'] } as unknown as Progress;
    expect([...seenTactics(p)]).toEqual(['urgency']);
  });
});
