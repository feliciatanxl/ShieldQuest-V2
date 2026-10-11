import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { BEAN_HAIRS, BEAN_HEIGHT, buildBeanGeometry } from './beanGeometry';
import {
  bench,
  coveredWalkway,
  facelessFigure,
  facelessWindow,
  fence,
  ground,
  hdbBlock,
  hexPlate,
  kiosk,
  lampPost,
  lantern,
  road,
  shophouse,
  signboard,
  tableSet,
  tree,
} from './geometry';
import { isKitGeometry, mergeKit, triangleCount } from './paint';

function finite(geo: BufferGeometry, name: string): boolean {
  const arr = geo.getAttribute(name).array as ArrayLike<number>;
  for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i]!)) return false;
  return true;
}

describe('bean geometry (GAME_DESIGN.md §4.4)', () => {
  it('stays within 300 triangles for every hair silhouette, with and without glasses', () => {
    for (const hair of BEAN_HAIRS) {
      for (const glasses of [false, true]) {
        const geo = buildBeanGeometry({ body: '#2bb3a3', accent: '#1d2440', hair, glasses, outfit: 'school' }, `t-${hair}`);
        expect(triangleCount(geo), `${hair}${glasses ? '+glasses' : ''}`).toBeLessThanOrEqual(300);
        expect(finite(geo, 'position')).toBe(true);
        const parts = geo.getAttribute('part').array as ArrayLike<number>;
        for (let i = 0; i < parts.length; i++) expect(parts[i]).toBeGreaterThanOrEqual(0);
        for (let i = 0; i < parts.length; i++) expect(parts[i]).toBeLessThanOrEqual(7);
        expect(geo.getAttribute('uv').count).toBe(geo.getAttribute('position').count);
        geo.dispose();
      }
    }
  });

  it('is about 1.5 m tall with feet on the ground', () => {
    const geo = buildBeanGeometry({ body: '#f26b5b', accent: '#2a2f6b', hair: 'none' }, 'height');
    const pos = geo.getAttribute('position');
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      minY = Math.min(minY, pos.getY(i));
      maxY = Math.max(maxY, pos.getY(i));
    }
    expect(minY).toBeCloseTo(0, 2);
    expect(maxY).toBeGreaterThan(BEAN_HEIGHT - 0.1);
    expect(maxY).toBeLessThan(BEAN_HEIGHT + 0.1);
  });
});

describe('kit props', () => {
  const builders: [string, () => BufferGeometry][] = [
    ['hdbBlock', () => hdbBlock({ floors: 6, litWindows: 12, seed: 'a' })],
    ['shophouse', () => shophouse({ storeys: 3, shutter: true })],
    ['coveredWalkway', () => coveredWalkway()],
    ['tree round', () => tree({ kind: 'round' })],
    ['tree cone', () => tree({ kind: 'cone' })],
    ['tree rain', () => tree({ kind: 'rain' })],
    ['lampPost', () => lampPost()],
    ['bench', () => bench()],
    ['tableSet round', () => tableSet({ round: true, stools: 4 })],
    ['tableSet canteen', () => tableSet({ round: false, stools: 6 })],
    ['kiosk', () => kiosk({ lit: true })],
    ['fence', () => fence()],
    ['signboard', () => signboard({ lit: true })],
    ['road', () => road({ crossingAt: 0 })],
    ['ground', () => ground({ tile: 1 })],
    ['hexPlate', () => hexPlate()],
    ['facelessFigure', () => facelessFigure('phone')],
    ['facelessWindow', () => facelessWindow()],
    ['lantern', () => lantern()],
  ];

  it.each(builders)('%s builds a finite kit geometry', (_name, build) => {
    const geo = build();
    expect(isKitGeometry(geo)).toBe(true);
    expect(triangleCount(geo)).toBeGreaterThan(0);
    expect(finite(geo, 'position')).toBe(true);
    expect(finite(geo, 'normal')).toBe(true);
    geo.dispose();
  });

  it('lights the requested number of HDB windows (glowing faces)', () => {
    const geo = hdbBlock({ floors: 4, columns: 5, litWindows: 7, seed: 'lit' });
    const glow = geo.getAttribute('glow');
    let glowingTris = 0;
    for (let i = 0; i < glow.count; i += 3) if (glow.getX(i) > 0.5) glowingTris++;
    expect(glowingTris).toBe(7 * 2);
    geo.dispose();
  });

  it('merges a set into one geometry with every triangle kept', () => {
    const parts = [bench(), lampPost(), tree()];
    const expected = parts.reduce((n, g) => n + triangleCount(g), 0);
    const merged = mergeKit(parts);
    expect(triangleCount(merged)).toBe(expected);
    expect(isKitGeometry(merged)).toBe(true);
    merged.dispose();
  });

  it('keeps a whole low-tier set inside the triangle budget', () => {
    const set = mergeKit([
      ground({ width: 14, depth: 10, tile: 1 }),
      hdbBlock({ floors: 8 }),
      bench(),
      tableSet(),
      lampPost(),
      tree(),
      tree({ kind: 'cone', seed: 2 }),
      signboard(),
      coveredWalkway(),
    ]);
    // §10.2: low tier <= 60k triangles for the whole frame; a set should use a small fraction of it.
    expect(triangleCount(set)).toBeLessThan(15000);
    set.dispose();
  });
});
