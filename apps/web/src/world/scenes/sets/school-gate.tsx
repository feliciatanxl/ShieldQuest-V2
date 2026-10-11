import type { SetPiece } from './types';

// PLACEHOLDER set — replaced by the 3D scenes build.
export const schoolGate: SetPiece = {
  id: 'school-gate',
  name: 'school-gate',
  anchors: {
    'gate': { position: [-3, 0, -1], label: 'Gate' },
    'guard-post': { position: [-1, 0, -1], label: 'Guard post' },
    'bus-stop': { position: [1, 0, -1], label: 'Bus stop' },
    'bench': { position: [3, 0, -1], label: 'Bench' },
    'crossing': { position: [-3, 0, 1], label: 'Crossing' },
    'kiosk': { position: [-1, 0, 1], label: 'Kiosk' },
    'tree': { position: [1, 0, 1], label: 'Tree' },
    'car-park': { position: [3, 0, 1], label: 'Car park' },
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
      'gate': { x: 40, y: 60 },
      'guard-post': { x: 120, y: 60 },
      'bus-stop': { x: 200, y: 60 },
      'bench': { x: 280, y: 60 },
      'crossing': { x: 40, y: 140 },
      'kiosk': { x: 120, y: 140 },
      'tree': { x: 200, y: 140 },
      'car-park': { x: 280, y: 140 },
    },
  },
};
