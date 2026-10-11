import type { SetPiece } from './types';

// PLACEHOLDER set — replaced by the 3D scenes build.
export const digiSky: SetPiece = {
  id: 'digi-sky',
  name: 'digi-sky',
  anchors: {
    'barang-booth': { position: [-3, 0, -1], label: 'Barang booth' },
    'review-lanterns': { position: [-1, 0, -1], label: 'Review lanterns' },
    'chatlah-plaza': { position: [1, 0, -1], label: 'Chatlah plaza' },
    'quikgig-tower': { position: [3, 0, -1], label: 'Quikgig tower' },
    'arcade': { position: [-3, 0, 1], label: 'Arcade' },
    'link-portal': { position: [-1, 0, 1], label: 'Link portal' },
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
      'barang-booth': { x: 40, y: 60 },
      'review-lanterns': { x: 120, y: 60 },
      'chatlah-plaza': { x: 200, y: 60 },
      'quikgig-tower': { x: 280, y: 60 },
      'arcade': { x: 40, y: 140 },
      'link-portal': { x: 120, y: 140 },
    },
  },
};
