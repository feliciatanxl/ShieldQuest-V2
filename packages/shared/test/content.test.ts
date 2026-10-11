import { describe, expect, it } from 'vitest';
import { MISSIONS, lintMission } from '../src';

describe('mission content', () => {
  it('has unique mission ids', () => {
    const ids = MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const mission of MISSIONS) {
    it(`${mission.id} passes the content safety lint`, () => {
      const errors = lintMission(mission).filter((i) => i.level === 'error');
      expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);
    });
  }
});
