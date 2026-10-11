import type { MissionSceneProps } from '../contracts';

// PLACEHOLDER — replaced by the 3D world build (SVG snapshot of the set + hotspots).
export function MissionScene2D(_props: Omit<MissionSceneProps, 'quality'>) {
  return <div style={{ width: '100%', height: '100%', background: 'var(--bg-2)' }} />;
}
