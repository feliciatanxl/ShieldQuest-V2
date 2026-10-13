import { describe, expect, it } from 'vitest';
import { MINI_GAMES, MISSIONS, dayKey, emptyRewards, recordShard, type Progress } from '@shieldquest/shared';
import { EXPLORE_WORLD, KIOSKS, PLACES, SHARDS } from '../../world/explore/exploreMap';
import { isClear } from '../../world/explore/movement';
import { AREA_VIEWS, CITY_VIEW, arrivalPoint, placesIn, project, viewById } from './mapView';
import {
  arcadeHref,
  availableShards,
  beaconMission,
  distanceWords,
  placeTitle,
  shardCountToday,
  shardsFoundToday,
} from './places';

const NOW = Date.parse('2026-10-13T04:00:00Z');
const progress = (runs: Record<string, unknown> = {}): Progress => ({ runs, pending: [] }) as unknown as Progress;

describe('shards today', () => {
  it('shows every shard on a new day', () => {
    expect(availableShards(emptyRewards(() => 0.5), NOW)).toHaveLength(10);
  });

  it('hides shards found today and brings them back tomorrow', () => {
    let r = emptyRewards(() => 0.5);
    r = recordShard(r, SHARDS[0]!.id, NOW)!.state;
    r = recordShard(r, SHARDS[3]!.id, NOW)!.state;
    expect(shardsFoundToday(r, NOW)).toEqual([SHARDS[0]!.id, SHARDS[3]!.id]);
    expect(shardCountToday(r, NOW)).toBe(2);
    expect(availableShards(r, NOW).map((s) => s.id)).not.toContain(SHARDS[0]!.id);
    const tomorrow = NOW + 86_400_000;
    expect(dayKey(tomorrow)).not.toBe(dayKey(NOW));
    expect(availableShards(r, tomorrow)).toHaveLength(10);
    expect(shardCountToday(r, tomorrow)).toBe(0);
  });

  it('awards Stars once per shard per day (shared rewards rules)', () => {
    const r = emptyRewards(() => 0.5);
    const first = recordShard(r, SHARDS[1]!.id, NOW);
    expect(first?.event.stars).toBeGreaterThan(0);
    expect(recordShard(first!.state, SHARDS[1]!.id, NOW)).toBeNull();
  });
});

describe('places', () => {
  it('links each kiosk to a real mini-game in the arcade', () => {
    const ids = MINI_GAMES.map((g) => g.id);
    for (const k of KIOSKS) {
      expect(ids).toContain(k.game);
      expect(arcadeHref(k.game)).toBe(`/play/arcade/${k.game}?from=explore`);
      expect(placeTitle(k)).toMatch(/^Arcade: /);
    }
  });

  it('suggests an unplayed mission in the beacon’s district, or none when all are played', () => {
    const district = MISSIONS[0]!.district;
    const m = beaconMission(district, null, progress());
    expect(m?.district).toBe(district);
    const allRuns = Object.fromEntries(MISSIONS.map((x) => [x.id, { best: 'safe' }]));
    expect(beaconMission(district, null, progress(allRuns))).toBeNull();
  });

  it('names every place', () => {
    for (const p of PLACES) expect(placeTitle(p).length).toBeGreaterThan(3);
  });

  it('words distances', () => {
    expect(distanceWords(1)).toBe('here');
    expect(distanceWords(12.4)).toBe('12 m');
  });
});

describe('map views', () => {
  it('fits the whole city in the city view', () => {
    for (const p of PLACES) {
      const { u, v } = project(CITY_VIEW, p.x, p.z);
      expect(u).toBeGreaterThan(0);
      expect(u).toBeLessThan(1);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('puts every place in exactly one area view, inside it, with room for 44 px buttons at 360 px', () => {
    const seen = new Set<string>();
    for (const view of AREA_VIEWS) {
      const list = placesIn(view.id);
      for (const p of list) {
        seen.add(p.id);
        const { u, v } = project(view, p.x, p.z);
        expect(u, `${p.id} in ${view.id}`).toBeGreaterThan(0.03);
        expect(u, `${p.id} in ${view.id}`).toBeLessThan(0.97);
        expect(v, `${p.id} in ${view.id}`).toBeGreaterThan(0.03);
        expect(v, `${p.id} in ${view.id}`).toBeLessThan(0.97);
      }
      // Buttons are 44 px on a 340 px map: centres at least 44 px apart.
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = project(view, list[i]!.x, list[i]!.z);
          const b = project(view, list[j]!.x, list[j]!.z);
          const px = Math.hypot(a.u - b.u, a.v - b.v) * 340;
          expect(px, `${list[i]!.id} vs ${list[j]!.id}`).toBeGreaterThanOrEqual(44);
        }
      }
    }
    expect(seen.size).toBe(PLACES.length);
  });

  it('shows a district with its front (outer edge) facing down', () => {
    const school = viewById('school-street');
    const s = school.frame;
    const out = project(school, s.x + Math.sin(s.rotY) * 10, s.z + Math.cos(s.rotY) * 10);
    expect(out.u).toBeCloseTo(0.5, 5);
    expect(out.v).toBeGreaterThan(0.5);
  });

  it('arrives on a clear spot in every area', () => {
    for (const view of AREA_VIEWS) {
      const p = arrivalPoint(view.id);
      expect(isClear(EXPLORE_WORLD, p.x, p.z), view.id).toBe(true);
    }
  });
});
