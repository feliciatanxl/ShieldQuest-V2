import type { CitySceneProps } from '../contracts';

// PLACEHOLDER — replaced by the 3D world build (SVG twin of the city).
export function CityMap2D(_props: Omit<CitySceneProps, 'quality'>) {
  return <div style={{ width: '100%', height: '100%', background: 'var(--bg-2)' }} />;
}
