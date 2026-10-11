import type { SetPiece } from './types';

// PLACEHOLDER set — replaced by the 3D scenes build.
export const foodCourt: SetPiece = {
  id: 'food-court',
  name: 'food-court',
  anchors: {
    'stall': { position: [-3, 0, -1], label: 'Stall' },
    'table': { position: [-1, 0, -1], label: 'Table' },
    'qr-sticker': { position: [1, 0, -1], label: 'Qr sticker' },
    'tray-return': { position: [3, 0, -1], label: 'Tray return' },
    'popup-booth': { position: [-3, 0, 1], label: 'Popup booth' },
    'pillar': { position: [-1, 0, 1], label: 'Pillar' },
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
      'stall': { x: 40, y: 60 },
      'table': { x: 120, y: 60 },
      'qr-sticker': { x: 200, y: 60 },
      'tray-return': { x: 280, y: 60 },
      'popup-booth': { x: 40, y: 140 },
      'pillar': { x: 120, y: 140 },
    },
  },
};
