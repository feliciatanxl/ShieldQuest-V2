// Vertex-colour painting and geometry plumbing for the kit (pure three.js, no React/DOM).
// Kit geometry layout: non-indexed (flat shading), with `position`, `normal`, `color` (rgb) and `glow` (0..1).
import { BufferAttribute, BufferGeometry, Color, Euler, Matrix4, Quaternion, Vector3, type ColorRepresentation } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, type Vec3 } from './math';

export interface FaceInfo {
  /** Triangle index. */
  index: number;
  centroid: Vector3;
  normal: Vector3;
}

const KIT_ATTRIBUTES = new Set(['position', 'normal', 'color', 'glow']);

/** Converts any geometry to kit layout: non-indexed, flat normals, `color` (rgb) and `glow` attributes, no uv. */
export function toKitGeometry(geometry: BufferGeometry, color: ColorRepresentation = '#ffffff'): BufferGeometry {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const name of Object.keys(geo.attributes)) {
    if (!KIT_ATTRIBUTES.has(name)) geo.deleteAttribute(name);
  }
  geo.morphAttributes = {};
  geo.clearGroups();
  const count = geo.getAttribute('position').count;
  const existing = geo.getAttribute('color');
  if (!existing || existing.itemSize !== 3) {
    const c = new Color(color);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) arr.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute('color', new BufferAttribute(arr, 3));
  }
  if (!geo.getAttribute('glow')) geo.setAttribute('glow', new BufferAttribute(new Float32Array(count), 1));
  geo.computeVertexNormals();
  return geo;
}

/** True when the geometry already has the kit layout. */
export function isKitGeometry(geometry: BufferGeometry): boolean {
  return !geometry.index && Boolean(geometry.getAttribute('color')) && Boolean(geometry.getAttribute('glow'));
}

const ensureKit = (g: BufferGeometry) => (isKitGeometry(g) ? g : toKitGeometry(g));

function forEachFace(geo: BufferGeometry, fn: (face: FaceInfo, firstVertex: number) => void): void {
  const pos = geo.getAttribute('position');
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const e = new Vector3();
  const face: FaceInfo = { index: 0, centroid: new Vector3(), normal: new Vector3() };
  for (let i = 0; i + 2 < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    face.index = i / 3;
    face.centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    face.normal.subVectors(c, b).cross(e.subVectors(a, b)).normalize();
    fn(face, i);
  }
}

/** Paints every triangle with a colour (or a function of the face). Converts to kit layout first if needed. */
export function paintFaces(
  geometry: BufferGeometry,
  paint: ColorRepresentation | ((face: FaceInfo) => ColorRepresentation),
): BufferGeometry {
  const geo = ensureKit(geometry);
  const col = geo.getAttribute('color') as BufferAttribute;
  const tmp = new Color();
  if (typeof paint !== 'function') tmp.set(paint);
  forEachFace(geo, (face, i) => {
    if (typeof paint === 'function') tmp.set(paint(face));
    for (let k = 0; k < 3; k++) col.setXYZ(i + k, tmp.r, tmp.g, tmp.b);
  });
  col.needsUpdate = true;
  return geo;
}

/** Sets the glow attribute (0..1) per face; glowing faces emit their own colour and resist the freeze. */
export function setGlow(geometry: BufferGeometry, glow: number | ((face: FaceInfo) => number)): BufferGeometry {
  const geo = ensureKit(geometry);
  const g = geo.getAttribute('glow') as BufferAttribute;
  forEachFace(geo, (face, i) => {
    const v = typeof glow === 'number' ? glow : glow(face);
    for (let k = 0; k < 3; k++) g.setX(i + k, v);
  });
  g.needsUpdate = true;
  return geo;
}

export interface BakeAOOptions {
  /** Height (local y) at which occlusion fades out. Default: the geometry's height. */
  height?: number;
  /** Colour multiplier at the ground (y = minY). Default 0.6. */
  ground?: number;
  /** Extra darkening for downward-facing faces (0..1). Default 0.25. */
  underside?: number;
  minY?: number;
}

/**
 * Bakes a cheap ambient-occlusion gradient into vertex colours: darker near the ground and on undersides.
 * Replaces real AO and shadow maps on Low/Medium (GAME_DESIGN.md §4.2).
 */
export function bakeAO(geometry: BufferGeometry, options: BakeAOOptions = {}): BufferGeometry {
  const geo = ensureKit(geometry);
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const minY = options.minY ?? box.min.y;
  const height = options.height ?? Math.max(0.001, box.max.y - minY);
  const ground = options.ground ?? 0.6;
  const underside = options.underside ?? 0.25;
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const col = geo.getAttribute('color') as BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const h = clamp((pos.getY(i) - minY) / height);
    let k = ground + (1 - ground) * Math.sqrt(h);
    if (nor) k *= 1 - underside * clamp(-nor.getY(i));
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
  col.needsUpdate = true;
  return geo;
}

/** Mixes two colours and returns a hex string. Handy for tones of one hue. */
export function mixHex(a: ColorRepresentation, b: ColorRepresentation, t: number): string {
  return `#${new Color(a).lerp(new Color(b), t).getHexString()}`;
}

/** Lighter / darker tones of one colour (for folded-paper facets). */
export function tones(base: ColorRepresentation): { base: string; light: string; lighter: string; dark: string; darker: string } {
  return {
    base: mixHex(base, base, 0),
    light: mixHex(base, '#ffffff', 0.28),
    lighter: mixHex(base, '#ffffff', 0.55),
    dark: mixHex(base, '#1d2440', 0.22),
    darker: mixHex(base, '#1d2440', 0.42),
  };
}

export interface Placement {
  at?: Vec3;
  /** Euler rotation (radians, XYZ). */
  rotation?: Vec3;
  /** Yaw shortcut (radians), applied after `rotation`. */
  rotY?: number;
  scale?: number | Vec3;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();

/** Returns the geometry transformed in place (position, rotation, scale). */
export function place(geometry: BufferGeometry, { at, rotation, rotY, scale }: Placement): BufferGeometry {
  const s = scale === undefined ? [1, 1, 1] : typeof scale === 'number' ? [scale, scale, scale] : scale;
  const r = rotation ?? [0, 0, 0];
  _e.set(r[0], r[1] + (rotY ?? 0), r[2], 'YXZ');
  _q.setFromEuler(_e);
  _m.compose(new Vector3(...(at ?? [0, 0, 0])), _q, new Vector3(s[0], s[1], s[2]));
  geometry.applyMatrix4(_m);
  return geometry;
}

/**
 * Merges kit geometries into one (one draw call per set). Inputs are converted to kit layout and disposed.
 * Returns an empty kit geometry for an empty list.
 */
export function mergeKit(parts: BufferGeometry[]): BufferGeometry {
  const kits = parts.map(ensureKit);
  if (kits.length === 0) return toKitGeometry(new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(0), 3)));
  const merged = mergeGeometries(kits, false);
  for (const g of parts) g.dispose();
  for (const g of kits) g.dispose();
  if (!merged) throw new Error('mergeKit: incompatible geometries');
  return merged;
}

/** Number of triangles a geometry draws. */
export function triangleCount(geometry: BufferGeometry): number {
  const n = geometry.index ? geometry.index.count : geometry.getAttribute('position').count;
  return Math.floor(n / 3);
}

/**
 * Builds a kit geometry from raw triangles: `positions` is a flat xyz array (3 vertices per triangle),
 * `colors` one hex per triangle, `glows` optional per-triangle glow.
 */
export function geometryFromTriangles(positions: number[], colors: ColorRepresentation[], glows?: number[]): BufferGeometry {
  const triCount = Math.floor(positions.length / 9);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions.slice(0, triCount * 9)), 3));
  const col = new Float32Array(triCount * 9);
  const glow = new Float32Array(triCount * 3);
  const c = new Color();
  for (let t = 0; t < triCount; t++) {
    c.set(colors[t] ?? '#ffffff');
    for (let k = 0; k < 3; k++) {
      col.set([c.r, c.g, c.b], (t * 3 + k) * 3);
      glow[t * 3 + k] = glows?.[t] ?? 0;
    }
  }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.setAttribute('glow', new BufferAttribute(glow, 1));
  geo.computeVertexNormals();
  return geo;
}
