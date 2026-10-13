import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { DISTRICTS, type DistrictId } from '@shieldquest/shared';
import { isKitGeometry, triangleCount } from '../kit/paint';
import type { MissionMarker } from '../contracts';
import { MARKER_ART, MARKER_CELL } from './markerArt';
import {
  buildDigiSky,
  buildDistrict,
  buildFog,
  buildFrame,
  buildSea,
  buildTrain,
  cityLamp,
  scatter,
  squadTower,
  trainSpin,
  treeCone,
  treeRound,
} from './builders';
import {
  HOME_AZIMUTH,
  HOME_ELEVATION,
  OVERVIEW_POINTS,
  OVERVIEW_TARGET,
  basis,
  districtPoints,
  districtTarget,
  facingAzimuth,
  fitView,
  nearestAngle,
  mapPoints,
  rayCylinder,
  regionWithPins,
  viewRegion,
  viewUV,
} from './camera';
import {
  CITY,
  DISTRICT_SPOTS,
  PIN,
  describeCity,
  districtLabel,
  districtRipple,
  hexEdgeDistance,
  inradius,
  litWindowCount,
  markerAnchor,
  markerGrid,
  pinLabel,
  pinLayout,
  pinRows,
  sortMarkers,
  spotById,
  squadLanternCeiling,
  toWorld,
  trustOf,
  trustWord,
} from './layout';

function finite(geo: BufferGeometry): boolean {
  const arr = geo.getAttribute('position').array as ArrayLike<number>;
  for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i]!)) return false;
  return true;
}

const LAUNCH: DistrictId[] = ['school-street', 'retail-district', 'digi-district'];

describe('City layout (GAME_DESIGN.md §4.1)', () => {
  it('places every district on the ring with its local +z facing outwards', () => {
    expect(DISTRICT_SPOTS).toHaveLength(DISTRICTS.length);
    for (const s of DISTRICT_SPOTS) {
      expect(Math.hypot(s.x, s.z)).toBeCloseTo(CITY.ring, 5);
      const out = toWorld(s, [0, 0, 1]);
      expect(out[0] - s.x).toBeCloseTo(Math.cos(s.angle), 5);
      expect(out[2] - s.z).toBeCloseTo(Math.sin(s.angle), 5);
    }
    expect(DISTRICT_SPOTS.filter((s) => s.fogged).map((s) => s.id).sort()).toEqual(['interchange', 'void-deck-commons']);
  });

  it('keeps plates apart from each other and from the Stillpoint plaza', () => {
    for (const a of DISTRICT_SPOTS) {
      expect(Math.hypot(a.x, a.z) - CITY.plate - CITY.hub).toBeGreaterThan(8);
      for (const b of DISTRICT_SPOTS) {
        if (a === b) continue;
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(2 * inradius(CITY.plate) + 8);
      }
    }
    expect(CITY.rim).toBeGreaterThan(CITY.ring + CITY.plate);
  });

  it('measures hexagon edges between the inradius and the circumradius', () => {
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      const d = hexEdgeDistance(10, a);
      expect(d).toBeGreaterThanOrEqual(inradius(10) - 1e-9);
      expect(d).toBeLessThanOrEqual(10 + 1e-9);
    }
    expect(hexEdgeDistance(10, 0)).toBeCloseTo(10, 5);
    expect(hexEdgeDistance(10, Math.PI / 6)).toBeCloseTo(inradius(10), 5);
  });

  it('maps trust to lit windows and words monotonically', () => {
    let prev = -1;
    for (let t = -3; t <= 3; t++) {
      const n = litWindowCount(t);
      expect(n).toBeGreaterThan(prev);
      prev = n;
    }
    expect(trustOf({ 'school-street': 9 }, 'school-street')).toBe(3);
    expect(trustOf({ 'school-street': -9 }, 'school-street')).toBe(-3);
    expect(trustOf({}, 'school-street')).toBe(0);
    expect(trustWord(-1)).toMatch(/Dimmed/);
    expect(trustWord(3)).toBe('Shining');
  });

  it('orders markers most urgent first and lays them out in a centred grid', () => {
    const markers = [
      { missionId: 'b', district: 'digi-district' as const, state: 'done' as const },
      { missionId: 'a', district: 'digi-district' as const, state: 'new' as const },
      { missionId: 'c', district: 'digi-district' as const, state: 'aftershock' as const },
    ];
    expect(sortMarkers(markers).map((m) => m.state)).toEqual(['aftershock', 'new', 'done']);
    expect(districtRipple(markers, 'digi-district')).toBe('aftershock');
    expect(districtRipple(markers, 'school-street')).toBeNull();
    const grid = markerGrid(5, 40, 3);
    expect(grid).toHaveLength(5);
    expect(grid[0]![0] + grid[2]![0]).toBeCloseTo(0, 5);
    expect(grid[3]![1]).toBeGreaterThan(0);
    expect(grid[3]![0] + grid[4]![0]).toBeCloseTo(0, 5);
  });

  it('describes the city in words (no decision needs the 3D view)', () => {
    const text = describeCity({ focus: 'digi-district', districtTrust: { 'retail-district': -1 }, markers: [], freezeAmount: 1, lanterns: [{ squadId: 'a', color: '#fff', count: 3 }] });
    expect(text).toMatch(/11:59/);
    expect(text).toMatch(/Retail District: dimmed/);
    expect(text).toMatch(/coming soon/);
    expect(text).toMatch(/frozen/);
    expect(text).toMatch(/3 paper lanterns/);
    expect(text).toMatch(/Zoomed in on Digi-District/);
  });
});

describe('City Hub camera (GAME_DESIGN.md §4.5)', () => {
  it('fits the whole city on a 360x800 phone and a 1920x1080 projector', () => {
    for (const [w, h] of [[360, 800], [1920, 1080], [768, 1024], [1280, 720]] as const) {
      const region = viewRegion(w / h, 'overview');
      for (const az of [HOME_AZIMUTH, 1, 2.5, 4]) {
        const b = basis(az, HOME_ELEVATION);
        const f = fitView(OVERVIEW_POINTS, OVERVIEW_TARGET, b, w, h, region);
        // Every envelope point lands inside the region (with a pixel of slack).
        for (const p of OVERVIEW_POINTS) {
          const d = [p[0] - OVERVIEW_TARGET[0], p[1] - OVERVIEW_TARGET[1], p[2] - OVERVIEW_TARGET[2]] as const;
          const u = d[0] * b.right[0] + d[1] * b.right[1] + d[2] * b.right[2];
          const v = d[0] * b.up[0] + d[1] * b.up[1] + d[2] * b.up[2];
          const x = w / 2 + (u - f.shiftU) * f.zoom;
          const y = h / 2 - (v - f.shiftV) * f.zoom;
          expect(x).toBeGreaterThanOrEqual(region.x0 * w - 1);
          expect(x).toBeLessThanOrEqual(region.x1 * w + 1);
          expect(y).toBeGreaterThanOrEqual(region.y0 * h - 1);
          expect(y).toBeLessThanOrEqual(region.y1 * h + 1);
        }
      }
    }
  });

  it('zooms the same whichever way the turntable faces (no breathing)', () => {
    const zooms = [0, 0.7, 1.9, 3.3, 5.1].map((az) => fitView(OVERVIEW_POINTS, OVERVIEW_TARGET, basis(az, HOME_ELEVATION), 1280, 720, viewRegion(16 / 9, 'overview')).zoom);
    for (const z of zooms) expect(z).toBeCloseTo(zooms[0]!, 1);
  });

  it('frames a focused district closer than the overview', () => {
    for (const id of LAUNCH) {
      const b = basis(facingAzimuth(id), HOME_ELEVATION);
      const near = fitView(districtPoints(id), districtTarget(id), b, 360, 800, viewRegion(0.45, 'focus'));
      const far = fitView(OVERVIEW_POINTS, OVERVIEW_TARGET, basis(HOME_AZIMUTH, HOME_ELEVATION), 360, 800, viewRegion(0.45, 'overview'));
      expect(near.zoom).toBeGreaterThan(far.zoom * 1.4);
    }
  });

  it('spins the shortest way round', () => {
    expect(nearestAngle(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.1, 5);
    expect(nearestAngle(10, 0)).toBeCloseTo(Math.PI * 4, 5);
  });

  it('hits district cylinders along a ray and misses beside them', () => {
    expect(rayCylinder([0, 50, 0], [0, -1, 0], 0, 0, 5, -5, 20)).toBeCloseTo(30, 5);
    expect(rayCylinder([20, 50, 0], [0, -1, 0], 0, 0, 5, -5, 20)).toBeNull();
    expect(rayCylinder([-30, 5, 0], [1, 0, 0], 0, 0, 5, -5, 20)).toBeCloseTo(25, 5);
  });
});

describe('City geometry budgets (GAME_DESIGN.md §10.2)', () => {
  it('builds finite kit geometry for every piece', () => {
    const pieces = [buildFrame('medium'), buildTrain(), cityLamp(), squadTower(), treeRound(), treeCone(), buildDigiSky('medium').fill];
    for (const g of pieces) {
      expect(isKitGeometry(g)).toBe(true);
      expect(finite(g)).toBe(true);
    }
    const lines = buildDigiSky('medium').lines;
    expect(lines.getAttribute('position').count % 2).toBe(0);
    expect(lines.getAttribute('aColor').count).toBe(lines.getAttribute('position').count);
  });

  it('keeps every district plate within 8k triangles at any trust', () => {
    for (const d of DISTRICTS) {
      for (const t of [-3, 0, 3]) {
        const g = buildDistrict(d.id, t);
        expect(isKitGeometry(g)).toBe(true);
        expect(finite(g)).toBe(true);
        expect(triangleCount(g), `${d.id} @ ${t}`).toBeLessThanOrEqual(8000);
      }
    }
  });

  it('lights more windows as trust rises', () => {
    const glowing = (g: BufferGeometry) => {
      const glow = g.getAttribute('glow').array as ArrayLike<number>;
      let n = 0;
      for (let i = 0; i < glow.length; i += 3) if (glow[i]! > 0.5) n++;
      return n;
    };
    for (const id of LAUNCH) expect(glowing(buildDistrict(id, 3))).toBeGreaterThan(glowing(buildDistrict(id, -3)));
  });

  it('keeps the whole overview inside the per-tier triangle budget', () => {
    for (const [tier, budget] of [['low', 40000], ['medium', 60000]] as const) {
      const s = scatter(tier);
      let total = triangleCount(buildFrame(tier)) + triangleCount(buildTrain()) + triangleCount(buildDigiSky(tier).fill);
      total += triangleCount(buildSea(tier === 'low' ? 40 : 64));
      for (const d of DISTRICTS) total += triangleCount(buildDistrict(d.id, 3));
      for (const id of ['void-deck-commons', 'interchange'] as const) total += triangleCount(buildFog(id, tier));
      total += s.round.length * triangleCount(treeRound()) + s.cone.length * triangleCount(treeCone());
      total += s.lamps.length * triangleCount(cityLamp()) + 6 * triangleCount(squadTower());
      expect(total, tier).toBeLessThanOrEqual(budget);
    }
  });

  it('runs the train one lap per 40 s', () => {
    expect(trainSpin(0)).toBeCloseTo(0, 5);
    expect(trainSpin(CITY.trainPeriod / 2)).toBeCloseTo(-Math.PI, 5);
  });
});

const SAMPLE: MissionMarker[] = [
  { missionId: 'easy-money', district: 'digi-district', state: 'new' },
  { missionId: 'behind-the-stall', district: 'digi-district', state: 'done' },
  { missionId: 'first-hold', district: 'digi-district', state: 'aftershock' },
  { missionId: 'like-for-cash', district: 'digi-district', state: 'new' },
  { missionId: 'free-skins', district: 'school-street', state: 'done' },
];

describe('Mission pins (shared by the 3D city and the 2D map)', () => {
  it('shows one lead pin per district in the overview and every mission in focus', () => {
    const overview = pinLayout(SAMPLE, null);
    expect(overview.map((p) => p.marker.district).sort()).toEqual(['digi-district', 'school-street']);
    const digi = overview.find((p) => p.marker.district === 'digi-district')!;
    expect(digi.marker.state).toBe('aftershock');
    expect(digi.more).toBe(3);
    expect(pinLabel(digi)).toMatch(/3 more missions in Digi-District/);

    const focused = pinLayout(SAMPLE, 'digi-district');
    expect(focused.filter((p) => p.marker.district === 'digi-district')).toHaveLength(4);
    expect(focused.filter((p) => p.marker.district === 'school-street')).toHaveLength(1);
    expect(pinRows(SAMPLE, 'digi-district')).toBe(2);
    // Pins in a grid never overlap: centres at least one icon apart.
    const grid = focused.filter((p) => p.marker.district === 'digi-district');
    for (const a of grid) {
      for (const b of grid) {
        if (a !== b) expect(Math.hypot(a.offset[0] - b.offset[0], a.offset[1] - b.offset[1])).toBeGreaterThanOrEqual(PIN.focus);
      }
    }
  });

  it('keeps every pin hit area at 48 px or more', () => {
    for (const size of [PIN.overview, PIN.focus]) expect(2 * (Math.max(24, size / 2) + 3)).toBeGreaterThanOrEqual(48);
  });

  it('floats Digi-District pins above its sky layer', () => {
    expect(markerAnchor(spotById('digi-district'))[1]).toBeGreaterThan(CITY.skyTop);
    expect(markerAnchor(spotById('school-street'))[1]).toBe(CITY.markerHeight);
  });

  it('draws each state with its own shape (never colour alone)', () => {
    const shapes = (['new', 'done', 'aftershock'] as const).map((s) => MARKER_ART[s][0]!.d);
    expect(new Set(shapes).size).toBe(3);
    expect(new Set(Object.values(MARKER_CELL)).size).toBe(3);
  });

  it('names districts in one line with trust as lit windows and a word', () => {
    expect(districtLabel('school-street', { 'school-street': 2 }, SAMPLE)).toBe(
      'School Street: Glowing, 8 of 12 windows lit. 1 mission (1 completed).',
    );
    expect(districtLabel('void-deck-commons', {}, [])).toBe('Void Deck Commons: coming soon');
  });
});

describe('Framing extras', () => {
  it('fits the fixed-angle 2D map on a phone and a projector', () => {
    const b = basis(HOME_AZIMUTH, HOME_ELEVATION);
    const points = mapPoints();
    for (const [w, h] of [[360, 800], [1920, 1080]] as const) {
      const region = viewRegion(w / h, 'overview');
      const f = fitView(points, [0, 0, 0], b, w, h, region);
      for (const p of points) {
        const [u, v] = viewUV(p, b);
        const x = w / 2 + (u - f.shiftU) * f.zoom;
        const y = h / 2 - (v - f.shiftV) * f.zoom;
        expect(x).toBeGreaterThanOrEqual(region.x0 * w - 1);
        expect(x).toBeLessThanOrEqual(region.x1 * w + 1);
        expect(y).toBeGreaterThanOrEqual(region.y0 * h - 1);
        expect(y).toBeLessThanOrEqual(region.y1 * h + 1);
      }
    }
  });

  it('leaves room above a focused district for its pin rows', () => {
    const r = viewRegion(0.45, 'focus');
    const roomy = regionWithPins(r, 2, 800, PIN.spacing);
    expect(roomy.y0).toBeGreaterThan(r.y0);
    expect(roomy.y1).toBe(r.y1);
    expect(roomy.y0).toBeLessThan(roomy.y1);
  });

  it('raises the projector ceiling with the tallest squad lantern stack', () => {
    expect(squadLanternCeiling([])).toBe(0);
    expect(squadLanternCeiling([0, 0])).toBe(0);
    expect(squadLanternCeiling([3])).toBeLessThan(squadLanternCeiling([9]));
    expect(squadLanternCeiling([500])).toBe(squadLanternCeiling([18]));
  });
});

describe('The bay', () => {
  it('builds an upward-facing kit disc below the plates', () => {
    const sea = buildSea(32);
    expect(isKitGeometry(sea)).toBe(true);
    expect(finite(sea)).toBe(true);
    const pos = sea.getAttribute('position');
    for (let i = 0; i < pos.count; i += 3) {
      const ax = pos.getX(i);
      const az = pos.getZ(i);
      const bx = pos.getX(i + 1);
      const bz = pos.getZ(i + 1);
      const cx = pos.getX(i + 2);
      const cz = pos.getZ(i + 2);
      // y of (b - a) x (c - a) > 0: the face points up.
      expect((bz - az) * (cx - ax) - (bx - ax) * (cz - az)).toBeGreaterThan(0);
      expect(pos.getY(i)).toBe(CITY.sea);
    }
  });
});
