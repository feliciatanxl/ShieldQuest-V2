import { describe, expect, it } from 'vitest';
import { GUARDIANS } from '@shieldquest/shared';
import { buildGuardianGeometry, guardianFacets, GUARDIAN_TRIANGLE_BUDGET, SHEET } from './models';

const finite = (arr: ArrayLike<number>) => {
  for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i]!)) return false;
  return true;
};

describe('origami Guardians (GAME_DESIGN.md §4.4)', () => {
  for (const g of GUARDIANS) {
    for (const level of [1, 2, 3]) {
      it(`${g.name} level ${level} stays within ${GUARDIAN_TRIANGLE_BUDGET} triangles, padding included`, () => {
        const facets = guardianFacets(g.id, level);
        expect(facets.length).toBeGreaterThan(80);
        const geo = buildGuardianGeometry(g.id, level);
        const drawn = geo.getAttribute('position').count / 3;
        expect(drawn).toBeGreaterThanOrEqual(facets.length);
        expect(drawn).toBeLessThanOrEqual(GUARDIAN_TRIANGLE_BUDGET);
        for (const name of ['position', 'aSheet', 'aSheetCentre', 'aCentre', 'aFold', 'aSheetColor', 'color', 'glow']) {
          expect(finite(geo.getAttribute(name).array as ArrayLike<number>), name).toBe(true);
        }
        geo.dispose();
      });
    }
  }

  it('adds second-colour folds from bond mark II', () => {
    for (const g of GUARDIANS) {
      expect(guardianFacets(g.id, 1).some((f) => f.accent)).toBe(false);
      expect(guardianFacets(g.id, 2).some((f) => f.accent)).toBe(true);
      expect(guardianFacets(g.id, 3).filter((f) => f.accent).length).toBeGreaterThanOrEqual(
        guardianFacets(g.id, 2).filter((f) => f.accent).length,
      );
    }
  });

  it('lays the level-0 sheet out as one folded square that ripples open within the timeline', () => {
    const geo = buildGuardianGeometry('verifox', 1);
    const sheet = geo.getAttribute('aSheet');
    const half = SHEET.size / 2 + 0.01;
    for (let i = 0; i < sheet.count; i++) {
      expect(Math.abs(sheet.getX(i))).toBeLessThanOrEqual(half);
      expect(sheet.getY(i)).toBeGreaterThan(0);
    }
    const fold = geo.getAttribute('aFold');
    for (let i = 0; i < fold.count; i++) {
      const delay = fold.getW(i);
      // The shader takes 0.55 of the timeline per facet: every facet must land by uUnfold = 1.
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay + 0.55).toBeLessThanOrEqual(1.0001);
      const len = Math.hypot(fold.getX(i), fold.getY(i), fold.getZ(i));
      expect(len).toBeCloseTo(1, 3);
    }
    geo.dispose();
  });

  it('stands on (or hovers just above) the ground and fits the figure frame', () => {
    for (const g of GUARDIANS) {
      const facets = guardianFacets(g.id, 3);
      let minY = Infinity;
      let maxY = -Infinity;
      let maxR = 0;
      for (const f of facets) {
        for (const p of f.v) {
          minY = Math.min(minY, p[1]);
          maxY = Math.max(maxY, p[1]);
          maxR = Math.max(maxR, Math.abs(p[0]));
        }
      }
      expect(minY, g.name).toBeGreaterThanOrEqual(-0.01);
      expect(maxY, g.name).toBeLessThan(1.15);
      expect(maxR, g.name).toBeLessThan(0.75);
    }
  });
});
