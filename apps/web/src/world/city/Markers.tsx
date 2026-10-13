// Mission markers over Lumen's districts (GAME_DESIGN.md §4.2, §4.5): ripple rings round each district plate and
// billboarded mission pins above it. Each layer is ONE draw call whatever the number of markers, and both keep a
// constant on-screen size (pins never shrink below the 48 px tap target). State is shape + icon, never colour
// alone: new = expanding gold circles + spark pin; done = calm still hexagon + shield pin; Aftershock = jagged
// frost ripple + diamond "!" pin. Reduced motion: rings hold still, pins do not bob.
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearMipmapLinearFilter,
  PlaneGeometry,
  SRGBColorSpace,
  ShaderMaterial,
  type OrthographicCamera,
} from 'three';
import type { MissionMarker } from '../contracts';
import { useKit } from '../kit/context';
import { sharedResource, useShared } from '../kit/motion';
import { DISTRICT_SPOTS, districtRipple, markerAnchor, spotById, type MarkerState, type Pin } from './layout';
import { MARKER_ART, MARKER_BOX, MARKER_CELL, MARKER_COLORS } from './markerArt';

// ---------------------------------------------------------------------------------------------------------
// Ripples
// ---------------------------------------------------------------------------------------------------------

type RingShape = 'circle' | 'hex' | 'jag';

interface RingSpec {
  shape: RingShape;
  /** Start and end radius (m); equal for a still ring. */
  r0: number;
  r1: number;
  /** 0..1 phase offset (a still ring ignores it). */
  phase: number;
  /** Seconds per ripple; 0 = still. */
  period: number;
  color: string;
  alpha: number;
}

const RIPPLES: Record<MarkerState, readonly RingSpec[]> = {
  new: [
    { shape: 'circle', r0: 18, r1: 31, phase: 0, period: 2.8, color: MARKER_COLORS.gold, alpha: 0.95 },
    { shape: 'circle', r0: 18, r1: 31, phase: 0.5, period: 2.8, color: MARKER_COLORS.gold, alpha: 0.95 },
  ],
  done: [
    { shape: 'hex', r0: 24.2, r1: 24.2, phase: 0, period: 0, color: MARKER_COLORS.safe, alpha: 0.75 },
    { shape: 'hex', r0: 26.4, r1: 26.4, phase: 0, period: 0, color: MARKER_COLORS.safe, alpha: 0.3 },
  ],
  aftershock: [
    { shape: 'jag', r0: 18, r1: 30, phase: 0, period: 3.8, color: '#bcd6f5', alpha: 0.95 },
    { shape: 'jag', r0: 23.6, r1: 23.6, phase: 0, period: 0, color: '#4d64a3', alpha: 0.85 },
  ],
};

/** Unit outline (plate-local xz) for a ring shape; hexagon corners on local ±x like the plates. */
function outline(shape: RingShape): [number, number][] {
  if (shape === 'hex') return Array.from({ length: 7 }, (_, i) => [Math.cos((i * Math.PI) / 3), Math.sin((i * Math.PI) / 3)]);
  if (shape === 'jag') {
    const n = 22;
    return Array.from({ length: n + 1 }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const r = i % 2 === 0 ? 1 : 0.87;
      return [Math.cos(a) * r, Math.sin(a) * r];
    });
  }
  const n = 72;
  return Array.from({ length: n + 1 }, (_, i) => [Math.cos((i / n) * Math.PI * 2), Math.sin((i / n) * Math.PI * 2)]);
}

/** One geometry for every ring of every district: `position` carries (dir.x, side, dir.z), the rest is per vertex. */
function buildRipples(markers: readonly MissionMarker[]): { geometry: BufferGeometry; animated: boolean } {
  const pos: number[] = [];
  const centre: number[] = [];
  const ring: number[] = [];
  const color: number[] = [];
  const c = new Color();
  let animated = false;
  for (const spot of DISTRICT_SPOTS) {
    if (spot.fogged) continue;
    const state = districtRipple(markers, spot.id);
    if (!state) continue;
    const cos = Math.cos(spot.rotY);
    const sin = Math.sin(spot.rotY);
    for (const spec of RIPPLES[state]) {
      if (spec.period > 0) animated = true;
      c.set(spec.color);
      // Plate-local outline turned into the world (same mapping as layout.toWorld).
      const pts = outline(spec.shape).map(([x, z]) => [x * cos + z * sin, -x * sin + z * cos] as const);
      const vert = (p: readonly [number, number], side: number) => {
        pos.push(p[0], side, p[1]);
        centre.push(spot.x, spot.z);
        ring.push(spec.r0, spec.r1, spec.phase, spec.period);
        color.push(c.r, c.g, c.b, spec.alpha);
      };
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i]!;
        const b = pts[i + 1]!;
        vert(a, 0);
        vert(b, 0);
        vert(b, 1);
        vert(a, 0);
        vert(b, 1);
        vert(a, 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geometry.setAttribute('aCentre', new BufferAttribute(new Float32Array(centre), 2));
  geometry.setAttribute('aRing', new BufferAttribute(new Float32Array(ring), 4));
  geometry.setAttribute('aColor', new BufferAttribute(new Float32Array(color), 4));
  return { geometry, animated };
}

const RIPPLE_VERT = /* glsl */ `
attribute vec2 aCentre;
attribute vec4 aRing;   // r0, r1, phase, period (0 = still)
attribute vec4 aColor;  // linear rgb + alpha
uniform float uTime;
uniform float uWidth;
uniform float uStatic;
uniform float uY;
varying vec4 vColor;
void main() {
  vec2 dir = position.xz;
  float side = position.y;
  bool moving = aRing.w > 0.0;
  float k = 0.0;
  if (moving) k = uStatic > 0.5 ? 0.22 + aRing.z * 0.56 : fract( uTime / aRing.w + aRing.z );
  float r = mix( aRing.x, aRing.y, k );
  vec2 p = aCentre + dir * r + normalize( dir ) * ( side - 0.5 ) * uWidth;
  float a = aColor.a;
  if (moving) a *= uStatic > 0.5 ? 0.85 - 0.35 * k : smoothstep( 0.0, 0.1, k ) * ( 1.0 - k ) * ( 1.0 - k ) * 1.3;
  vColor = vec4( aColor.rgb, clamp( a, 0.0, 1.0 ) );
  gl_Position = projectionMatrix * modelViewMatrix * vec4( p.x, uY, p.y, 1.0 );
}
`;

const FLAT_FRAG = /* glsl */ `
varying vec4 vColor;
void main() {
  gl_FragColor = vColor;
  #include <colorspace_fragment>
}
`;

export interface RipplesProps {
  markers: readonly MissionMarker[];
  /** Ambient frame request (throttled); called while the rings move. */
  onAnimate: () => void;
  /** Rings hold still (reduced motion, or the view is off-screen). */
  still: boolean;
}

/** Ripple rings round every district with missions: one draw call. */
export function Ripples({ markers, onAnimate, still }: RipplesProps) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const { reducedMotion, requestFrame } = useKit();
  const { geometry, animated } = useMemo(() => buildRipples(markers), [markers]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uWidth: { value: 1 }, uStatic: { value: 0 }, uY: { value: 0.45 } },
        vertexShader: RIPPLE_VERT,
        fragmentShader: FLAT_FRAG,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  const frozen = reducedMotion || still;
  useEffect(() => {
    requestFrame();
  }, [geometry, frozen, requestFrame]);

  useFrame((state) => {
    const u = material.uniforms;
    u.uStatic!.value = frozen ? 1 : 0;
    u.uTime!.value = state.clock.elapsedTime;
    // Constant ~3.5 px line width whatever the zoom.
    u.uWidth!.value = Math.max(0.25, 3.5 / Math.max(0.05, camera.zoom));
    if (animated && !frozen) onAnimate();
  });

  if (geometry.getAttribute('position').count === 0) return null;
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={10} raycast={() => null} />;
}

// ---------------------------------------------------------------------------------------------------------
// Pins
// ---------------------------------------------------------------------------------------------------------

const CELL = 256;
const STATES: readonly MarkerState[] = ['new', 'done', 'aftershock'];

/** The three pin icons drawn once into a canvas strip (no image files). */
const pinAtlas = sharedResource(
  () => {
    const canvas = document.createElement('canvas');
    canvas.width = CELL * STATES.length;
    canvas.height = CELL;
    const ctx = canvas.getContext('2d');
    if (ctx && typeof Path2D !== 'undefined') {
      const k = (CELL * 0.86) / MARKER_BOX;
      for (const state of STATES) {
        ctx.save();
        ctx.translate(MARKER_CELL[state] * CELL + CELL * 0.07, CELL * 0.07);
        ctx.scale(k, k);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // A soft drop shadow lifts the pin off busy scenery.
        ctx.shadowColor = 'rgba(8, 12, 36, 0.6)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 1.2;
        MARKER_ART[state].forEach((op, i) => {
          if (i > 0) ctx.shadowColor = 'transparent';
          const path = new Path2D(op.d);
          if (op.fill) {
            ctx.fillStyle = op.fill;
            ctx.fill(path);
          }
          if (op.stroke) {
            ctx.strokeStyle = op.stroke;
            ctx.lineWidth = op.width ?? 2;
            ctx.setLineDash(op.dash ? [...op.dash] : []);
            ctx.stroke(path);
          }
        });
        ctx.restore();
      }
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
    return { texture };
  },
  ({ texture }) => texture.dispose(),
);

const PIN_VERT = /* glsl */ `
attribute vec3 aAnchor;
attribute vec2 aOffset;  // CSS px, x right, y up
attribute float aSize;   // CSS px
attribute float aCell;
attribute float aHover;
attribute float aBob;
uniform float uPx;       // world units per CSS px (orthographic: 1 / zoom)
uniform float uTime;
uniform float uCells;
varying vec2 vUv;
varying float vHover;
void main() {
  vec4 mv = modelViewMatrix * vec4( aAnchor, 1.0 );
  float s = aSize * ( 1.0 + 0.16 * aHover );
  vec2 bob = vec2( 0.0, sin( uTime * 2.1 + aAnchor.x * 0.37 + aOffset.x * 0.05 ) * 2.5 * aBob );
  mv.xy += ( aOffset + bob + position.xy * s ) * uPx;
  vUv = vec2( ( uv.x + aCell ) / uCells, uv.y );
  vHover = aHover;
  gl_Position = projectionMatrix * mv;
}
`;

const PIN_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying float vHover;
void main() {
  vec4 c = texture2D( uMap, vUv );
  if ( c.a < 0.02 ) discard;
  c.rgb *= 1.0 + 0.22 * vHover;
  gl_FragColor = c;
  #include <colorspace_fragment>
}
`;

const _plane = new PlaneGeometry(1, 1);

export interface PinsProps {
  pins: readonly Pin[];
  /** missionId under the pointer (grows and brightens). */
  hover: string | null;
  onAnimate: () => void;
  still: boolean;
}

/** Billboarded mission pins: one instanced draw call, always on top, constant pixel size. */
export function Pins({ pins, hover, onAnimate, still }: PinsProps) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const { reducedMotion, requestFrame } = useKit();
  const { texture } = useShared(pinAtlas);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uMap: { value: texture }, uPx: { value: 1 }, uTime: { value: 0 }, uCells: { value: STATES.length } },
        vertexShader: PIN_VERT,
        fragmentShader: PIN_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    [texture],
  );
  useEffect(() => () => material.dispose(), [material]);
  const frozen = reducedMotion || still;

  const geometry = useMemo(() => {
    // Own copies of the 4-vertex quad, so disposing this geometry never frees buffers another one still uses.
    const g = new InstancedBufferGeometry();
    if (_plane.index) g.setIndex(_plane.index.clone());
    g.setAttribute('position', _plane.getAttribute('position').clone());
    g.setAttribute('uv', _plane.getAttribute('uv').clone());
    const n = Math.max(1, pins.length);
    const anchor = new Float32Array(n * 3);
    const offset = new Float32Array(n * 2);
    const size = new Float32Array(n);
    const cell = new Float32Array(n);
    const hot = new Float32Array(n);
    const bob = new Float32Array(n);
    pins.forEach((pin, i) => {
      anchor.set(markerAnchor(spotById(pin.marker.district)), i * 3);
      offset.set(pin.offset, i * 2);
      size[i] = pin.size;
      cell[i] = MARKER_CELL[pin.marker.state];
      hot[i] = pin.marker.missionId === hover ? 1 : 0;
      // Only new missions bob: the calm and frosted pins hold still.
      bob[i] = pin.marker.state === 'new' ? 1 : 0;
    });
    g.setAttribute('aAnchor', new InstancedBufferAttribute(anchor, 3));
    g.setAttribute('aOffset', new InstancedBufferAttribute(offset, 2));
    g.setAttribute('aSize', new InstancedBufferAttribute(size, 1));
    g.setAttribute('aCell', new InstancedBufferAttribute(cell, 1));
    g.setAttribute('aHover', new InstancedBufferAttribute(hot, 1));
    g.setAttribute('aBob', new InstancedBufferAttribute(bob, 1));
    g.instanceCount = pins.length;
    return g;
  }, [pins, hover]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    requestFrame();
  }, [geometry, frozen, requestFrame]);

  const bobbing = !frozen && pins.some((p) => p.marker.state === 'new');
  useFrame((state) => {
    const u = material.uniforms;
    u.uPx!.value = 1 / Math.max(0.05, camera.zoom);
    u.uTime!.value = bobbing ? state.clock.elapsedTime : 0;
    if (bobbing) onAnimate();
  });

  if (pins.length === 0) return null;
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={40} raycast={() => null} />;
}
