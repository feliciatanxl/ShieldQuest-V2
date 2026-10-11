import type { SetPiece } from './types';

// PLACEHOLDER set — replaced by the 3D scenes build.
export const canteen: SetPiece = {
  id: 'canteen',
  name: 'canteen',
  anchors: {
    'table': { position: [-3, 0, -1], label: 'Table' },
    'drinks-stall': { position: [-1, 0, -1], label: 'Drinks stall' },
    'lockers': { position: [1, 0, -1], label: 'Lockers' },
    'corridor': { position: [3, 0, -1], label: 'Corridor' },
    'noticeboard': { position: [-3, 0, 1], label: 'Noticeboard' },
    'bench': { position: [-1, 0, 1], label: 'Bench' },
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
      'table': { x: 40, y: 60 },
      'drinks-stall': { x: 120, y: 60 },
      'lockers': { x: 200, y: 60 },
      'corridor': { x: 280, y: 60 },
      'noticeboard': { x: 40, y: 140 },
      'bench': { x: 120, y: 140 },
    },
  },
};
