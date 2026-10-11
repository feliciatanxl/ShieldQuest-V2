import type { SetPiece } from './types';

// PLACEHOLDER set — replaced by the 3D scenes build.
export const bedroom: SetPiece = {
  id: 'bedroom',
  name: 'bedroom',
  anchors: {
    'desk': { position: [-3, 0, -1], label: 'Desk' },
    'bed': { position: [-1, 0, -1], label: 'Bed' },
    'window': { position: [1, 0, -1], label: 'Window' },
    'laptop': { position: [3, 0, -1], label: 'Laptop' },
    'door': { position: [-3, 0, 1], label: 'Door' },
    'shelf': { position: [-1, 0, 1], label: 'Shelf' },
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
      'desk': { x: 40, y: 60 },
      'bed': { x: 120, y: 60 },
      'window': { x: 200, y: 60 },
      'laptop': { x: 280, y: 60 },
      'door': { x: 40, y: 140 },
      'shelf': { x: 120, y: 140 },
    },
  },
};
