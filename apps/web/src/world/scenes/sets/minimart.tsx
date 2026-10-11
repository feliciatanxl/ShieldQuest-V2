import type { SetPiece } from './types';

// PLACEHOLDER set — replaced by the 3D scenes build.
export const minimart: SetPiece = {
  id: 'minimart',
  name: 'minimart',
  anchors: {
    'aisle-snacks': { position: [-3, 0, -1], label: 'Aisle snacks' },
    'aisle-beauty': { position: [-1, 0, -1], label: 'Aisle beauty' },
    'counter': { position: [1, 0, -1], label: 'Counter' },
    'self-checkout': { position: [3, 0, -1], label: 'Self checkout' },
    'cctv': { position: [-3, 0, 1], label: 'Cctv' },
    'door': { position: [-1, 0, 1], label: 'Door' },
    'atrium-booth': { position: [1, 0, 1], label: 'Atrium booth' },
    'phone-shop': { position: [3, 0, 1], label: 'Phone shop' },
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
      'aisle-snacks': { x: 40, y: 60 },
      'aisle-beauty': { x: 120, y: 60 },
      'counter': { x: 200, y: 60 },
      'self-checkout': { x: 280, y: 60 },
      'cctv': { x: 40, y: 140 },
      'door': { x: 120, y: 140 },
      'atrium-booth': { x: 200, y: 140 },
      'phone-shop': { x: 280, y: 140 },
    },
  },
};
