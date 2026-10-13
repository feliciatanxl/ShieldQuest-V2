// Code-built props for Explore mode (one merged geometry for every kiosk and beacon, one shard crystal for the
// instanced Shield Shards). Same kit material and paper-diorama palette as the city; no text in 3D.
import { CylinderGeometry, OctahedronGeometry, type BufferGeometry } from 'three';
import { GeoBuilder } from '../kit/geometry';
import { mergeKit, mixHex, place } from '../kit/paint';
import { PALETTE } from '../kit/uniforms';
import { spotById } from '../city/layout';
import { BEACONS, CABINET, KIOSKS } from './exploreMap';

/** Arcade cabinet (local, facing +z): body in the district colour, glowing screen and marquee. */
function cabinet(color: string): BufferGeometry {
  const b = new GeoBuilder();
  const hw = CABINET.w / 2;
  const hd = CABINET.d / 2;
  const dark = mixHex(color, PALETTE.ink, 0.45);
  // Base and the upper body set back behind the control panel.
  b.box([-hw, 0, -hd], [hw, 1.05, hd], { side: dark, top: '#2a2f55', front: mixHex(color, PALETTE.ink, 0.2) });
  b.box([-hw, 1.05, -hd], [hw, 2.45, -0.05], { side: color, top: color, front: dark });
  // Control panel sloping up to the screen, with three glowing buttons.
  b.quad([-hw, 1.05, hd], [hw, 1.05, hd], [hw, 1.25, -0.05], [-hw, 1.25, -0.05], '#3a3f6e');
  for (const [x, c] of [[-0.45, '#ff6f9f'], [0, '#f2c14e'], [0.45, '#5cc4f2']] as const) {
    b.box([x - 0.09, 1.12, 0.22], [x + 0.09, 1.2, 0.36], c, 1);
  }
  // Screen and marquee (glow; the words live in the DOM prompt).
  b.quad([-hw + 0.14, 1.32, -0.04], [hw - 0.14, 1.32, -0.04], [hw - 0.14, 2.3, -0.04], [-hw + 0.14, 2.3, -0.04], '#7fd6ff', 1);
  b.box([-hw - 0.08, 2.45, -hd - 0.05], [hw + 0.08, 2.95, 0.15], { side: dark, front: mixHex(color, '#ffffff', 0.35) }, 0.9);
  // A floating "play" triangle prism above the marquee.
  const t = new GeoBuilder();
  const y0 = 3.35;
  const tri: [number, number][] = [[-0.3, -0.35], [-0.3, 0.35], [0.35, 0]];
  const v = (i: number, z: number): [number, number, number] => [tri[i]![0], y0 + tri[i]![1], z];
  // Both faces, both windings: visible from any side whatever the material's culling.
  for (const z of [0.08, -0.08]) {
    t.tri(v(0, z), v(2, z), v(1, z), '#ffe2a6', 1);
    t.tri(v(0, z), v(1, z), v(2, z), '#ffe2a6', 1);
  }
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    t.quad(v(i, 0.08), v(i, -0.08), v(j, -0.08), v(j, 0.08), PALETTE.gold, 0.8);
    t.quad(v(j, 0.08), v(j, -0.08), v(i, -0.08), v(i, 0.08), PALETTE.gold, 0.8);
  }
  b.add(t.build());
  return b.build();
}

/** Mission beacon: a hex plinth, a tall glowing column and a floating diamond in the district colour. */
function beacon(color: string): BufferGeometry {
  const b = new GeoBuilder();
  b.cylinder([0, 0, 0], 0.95, 0.35, 6, '#d9cfe0', { top: mixHex(color, '#ffffff', 0.45) });
  b.cylinder([0, 0.35, 0], 0.55, 0.25, 6, PALETTE.gold, { glow: 0.6 });
  b.cylinder([0, 0.6, 0], 0.14, 7.5, 6, mixHex(color, '#ffffff', 0.35), { glow: 1, radiusTop: 0.04 });
  b.addPainted(new OctahedronGeometry(0.75, 0), (f) => (f.normal.y > 0 ? mixHex(color, '#ffffff', 0.4) : color), { at: [0, 3.2, 0], scale: [1, 1.4, 1] }, 0.9);
  b.addPainted(new CylinderGeometry(1.3, 1.3, 0.08, 18, 1, true), color, { at: [0, 3.2, 0] }, 1);
  return b.build();
}

/** Every Explore kiosk and beacon, in world coordinates: ONE draw call. */
export function buildExploreProps(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (const k of KIOSKS) {
    const s = spotById(k.district);
    // Cabinets face local +z on their plate (outwards, towards where you walk up).
    parts.push(place(cabinet(s.color), { at: [k.x, 0, k.z], rotY: s.rotY }));
  }
  for (const b of BEACONS) parts.push(place(beacon(spotById(b.district).color), { at: [b.x, 0, b.z] }));
  return mergeKit(parts);
}

/** A Shield Shard: a faceted shield-blue crystal with a gold band (glows; drawn instanced). */
export function buildShard(): BufferGeometry {
  const b = new GeoBuilder();
  b.addPainted(new OctahedronGeometry(0.42, 0), (f) => (f.normal.y > 0 ? '#bfe9ff' : '#5cc4f2'), { scale: [1, 1.45, 1] }, 0.85);
  b.addPainted(new CylinderGeometry(0.36, 0.36, 0.09, 8, 1, true), PALETTE.gold, {}, 1);
  return b.build();
}
