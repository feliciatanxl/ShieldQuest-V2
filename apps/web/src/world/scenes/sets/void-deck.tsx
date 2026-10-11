import type { SetPiece } from './types';

// PLACEHOLDER set — replaced by the 3D scenes build.
export const voidDeck: SetPiece = {
  id: 'void-deck',
  name: 'void-deck',
  anchors: {
    'bench': { position: [-3, 0, -1], label: 'Bench' },
    'stone-table': { position: [-1, 0, -1], label: 'Stone table' },
    'letterboxes': { position: [1, 0, -1], label: 'Letterboxes' },
    'notice-board': { position: [3, 0, -1], label: 'Notice board' },
    'lift-lobby': { position: [-3, 0, 1], label: 'Lift lobby' },
    'phone-kiosk': { position: [-1, 0, 1], label: 'Phone kiosk' },
    'pillar': { position: [1, 0, 1], label: 'Pillar' },
  },
  camera: { live: { position: [6, 5, 8], target: [0, 1, 0] }, orbit: { target: [0, 1, 0], minDistance: 5, maxDistance: 14 } },
  Component: () => (
    <mesh position={[0, -0.05, 0]}>
      <boxGeometry args={[10, 0.1, 6]} />
      <meshLambertMaterial color="#2a2f6b" />
    </mesh>
  ),
  flat: {
    viewBox: '0 0 360 240',
    Draw: () => <rect width={360} height={240} fill="#1a2a45" />,
    anchors: {
      'bench': { x: 40, y: 60 },
      'stone-table': { x: 120, y: 60 },
      'letterboxes': { x: 200, y: 60 },
      'notice-board': { x: 280, y: 60 },
      'lift-lobby': { x: 40, y: 140 },
      'phone-kiosk': { x: 120, y: 140 },
      'pillar': { x: 200, y: 140 },
    },
  },
};
