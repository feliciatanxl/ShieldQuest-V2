// <Thread>: "Pull the String" (GAME_DESIGN.md §4.2, §4.5). A glowing string along a Catmull-Rom curve from a cast
// member to the hidden influence (e.g. a faceless figure in a lit window), with icon beads for the tactics:
// coin = gain, clock = urgency, crowd = social proof, badge = fake authority, link = referral.
// `progress` draws the string out from `from`; `revealed` pulls it tight (a short snap) and sends a shimmer
// along it. Geometry is rewritten in place only while the string moves. Reduced motion: no sway, no shimmer,
// state changes are cuts.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  MeshBasicMaterial,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
  type Group,
} from 'three';
import { useKit } from './context';
import { iconAtlas, type ThreadBead } from './icons';
import { clamp, damp, easeOutBack, type Vec3 } from './math';
import { useShared } from './motion';
import { PALETTE } from './uniforms';

export type { ThreadBead } from './icons';

export interface ThreadProps {
  /** Start of the string (e.g. a bean's chest: position + [0, 0.8, 0]). */
  from: Vec3;
  /** End anchor (e.g. facelessAnchor(...) or a lit window in the skyline). */
  to: Vec3;
  /** Tactic icons threaded along the string, evenly spaced. */
  beads?: readonly ThreadBead[];
  /** 0..1: how much of the string has been pulled out from `from`. Eased towards the value (1 s feel). Default 1. */
  progress?: number;
  /** Drawn tight and bright: the influence is identified. Default false. */
  revealed?: boolean;
  /** String colour. Default trust gold. */
  color?: string;
  /** Slack sag (m) at the middle while not revealed. Default 0.55. */
  sag?: number;
  /** Core radius (m). Default 0.022. */
  radius?: number;
  /** Bead diameter (m). Default 0.3. */
  beadSize?: number;
  visible?: boolean;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float along;
uniform float uInflate;
varying float vAlong;
varying vec3 vNormalV;
void main() {
  vAlong = along;
  vec3 p = position + normal * uInflate;
  vNormalV = normalize( normalMatrix * normal );
  vec4 mvPosition = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform float uOpacity;
uniform float uProgress;
uniform float uTime;
uniform float uShimmer;
uniform float uGlow;
uniform float uHalo;
varying float vAlong;
varying vec3 vNormalV;
void main() {
  if ( vAlong > uProgress ) discard;
  float facing = abs( vNormalV.z );
  // Core: bright centre line; halo: soft falloff towards the silhouette.
  float shape = mix( 0.55 + 0.45 * facing, facing * facing, uHalo );
  float wave = fract( vAlong * 1.4 - uTime * 0.55 );
  float shimmer = uShimmer * smoothstep( 0.16, 0.0, abs( wave - 0.5 ) );
  vec3 c = uColor * shape * uGlow + vec3( 1.0, 0.95, 0.8 ) * shimmer * 0.8;
  float tip = smoothstep( uProgress, uProgress - 0.015, vAlong );
  gl_FragColor = vec4( c, uOpacity * shape * tip );
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

interface TubeBuffers {
  geometry: BufferGeometry;
  rings: number;
  sides: number;
}

function createTube(rings: number, sides: number): TubeBuffers {
  const geometry = new BufferGeometry();
  const verts = (rings + 1) * (sides + 1);
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(verts * 3), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(verts * 3), 3));
  const along = new Float32Array(verts);
  for (let i = 0; i <= rings; i++) for (let j = 0; j <= sides; j++) along[i * (sides + 1) + j] = i / rings;
  geometry.setAttribute('along', new BufferAttribute(along, 1));
  const index: number[] = [];
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j;
      const b = (i + 1) * (sides + 1) + j;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geometry.setIndex(index);
  return { geometry, rings, sides };
}

const _p = new Vector3();
const _t = new Vector3();
const _n = new Vector3();
const _b = new Vector3();
const _up = new Vector3(0, 1, 0);
const _side = new Vector3(1, 0, 0);

/** Rewrites the tube vertices around `curve` (parallel-ish frames from a fixed up vector). */
function writeTube(tube: TubeBuffers, curve: CatmullRomCurve3, radius: number): void {
  const pos = tube.geometry.getAttribute('position') as BufferAttribute;
  const nor = tube.geometry.getAttribute('normal') as BufferAttribute;
  const { rings, sides } = tube;
  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    curve.getPointAt(u, _p);
    curve.getTangentAt(u, _t);
    _n.copy(Math.abs(_t.dot(_up)) > 0.95 ? _side : _up);
    _n.addScaledVector(_t, -_t.dot(_n)).normalize();
    _b.crossVectors(_t, _n).normalize();
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const nx = _n.x * c + _b.x * s;
      const ny = _n.y * c + _b.y * s;
      const nz = _n.z * c + _b.z * s;
      const k = i * (sides + 1) + j;
      nor.setXYZ(k, nx, ny, nz);
      pos.setXYZ(k, _p.x + nx * radius, _p.y + ny * radius, _p.z + nz * radius);
    }
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  tube.geometry.computeBoundingSphere();
}

function threadMaterial(halo: boolean): ShaderMaterial {
  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uColor: { value: new Color() },
        uOpacity: { value: halo ? 0.28 : 1 },
        uProgress: { value: 1 },
        uTime: { value: 0 },
        uShimmer: { value: 0 },
        uGlow: { value: 1 },
        uHalo: { value: halo ? 1 : 0 },
        uInflate: { value: 0 },
      },
    ]),
    transparent: true,
    depthWrite: !halo,
    fog: true,
  });
  if (halo) material.blending = AdditiveBlending;
  return material;
}

/** The influence string. Pair it with DOM text naming the tactics (beads are icons only). */
export function Thread({
  from,
  to,
  beads = [],
  progress = 1,
  revealed = false,
  color = PALETTE.gold,
  sag = 0.55,
  radius = 0.022,
  beadSize = 0.3,
  visible = true,
  onClick,
}: ThreadProps) {
  const { tier, reducedMotion, requestFrame } = useKit();
  const camera = useThree((s) => s.camera);
  const atlas = useShared(iconAtlas);
  const tube = useMemo(() => (tier === 'low' ? createTube(32, 4) : createTube(56, 6)), [tier]);
  useEffect(() => () => tube.geometry.dispose(), [tube]);
  const core = useMemo(() => threadMaterial(false), []);
  const halo = useMemo(() => threadMaterial(true), []);
  const beadMaterial = useMemo(
    () => new MeshBasicMaterial({ map: atlas.texture, transparent: true, depthWrite: false, toneMapped: false, alphaTest: 0.02 }),
    [atlas.texture],
  );
  useEffect(
    () => () => {
      core.dispose();
      halo.dispose();
      beadMaterial.dispose();
    },
    [core, halo, beadMaterial],
  );

  const curve = useMemo(() => new CatmullRomCurve3([new Vector3(), new Vector3(), new Vector3(), new Vector3()], false, 'centripetal'), []);
  const beadGroups = useRef<(Group | null)[]>([]);
  const anim = useRef({ progress: reducedMotion ? progress : 0, tight: revealed ? 1 : 0, snap: 1, dirty: true, shown: [] as number[] });

  useEffect(() => {
    for (const m of [core, halo]) {
      (m.uniforms.uColor!.value as Color).set(color);
      m.uniforms.uInflate!.value = m === halo ? radius * 2.6 : 0;
    }
    anim.current.dirty = true;
    requestFrame();
  }, [core, halo, color, radius, requestFrame]);

  const [fx, fy, fz] = from;
  const [tx, ty, tz] = to;
  useEffect(() => {
    anim.current.dirty = true;
    requestFrame();
  }, [fx, fy, fz, tx, ty, tz, sag, revealed, progress, beads.length, requestFrame]);

  useEffect(() => {
    // Snapping tight: a short overshoot as the string is pulled.
    if (revealed && !reducedMotion) anim.current.snap = 0;
  }, [revealed, reducedMotion]);

  useFrame((state, delta) => {
    if (!visible) return;
    const a = anim.current;
    const dt = Math.min(delta, 0.1);
    let busy = false;
    const goalP = clamp(progress);
    if (reducedMotion) a.progress = goalP;
    else if (Math.abs(a.progress - goalP) > 1e-3) {
      a.progress += (goalP - a.progress) * damp(4, dt);
      busy = true;
    } else a.progress = goalP;
    const goalT = revealed ? 1 : 0;
    if (reducedMotion) a.tight = goalT;
    else if (Math.abs(a.tight - goalT) > 1e-3) {
      a.tight += (goalT - a.tight) * damp(6, dt);
      busy = true;
    } else a.tight = goalT;
    if (a.snap < 1) {
      a.snap = Math.min(1, a.snap + dt / 0.5);
      busy = true;
    }
    const time = state.clock.elapsedTime;
    // Slack strings sway a little (not under reduced motion); tight strings are still.
    const swayOn = !reducedMotion && a.tight < 0.99;
    const sway = swayOn ? Math.sin(time * 1.3) * 0.06 * (1 - a.tight) : 0;
    if (busy || swayOn || a.dirty) {
      const overshoot = a.snap < 1 ? (1 - easeOutBack(a.snap)) * 0.6 : 0;
      const slack = sag * (1 - a.tight) + overshoot * sag * 0.25;
      const pts = curve.points;
      pts[0]!.set(fx, fy, fz);
      pts[3]!.set(tx, ty, tz);
      for (const [k, f] of [
        [1, 1 / 3],
        [2, 2 / 3],
      ] as const) {
        pts[k]!.set(fx + (tx - fx) * f, fy + (ty - fy) * f - slack * (k === 1 ? 0.9 : 0.75), fz + (tz - fz) * f + sway * (k === 1 ? 1 : -0.6));
      }
      curve.updateArcLengths();
      writeTube(tube, curve, radius);
      a.dirty = false;
      if (swayOn) busy = true;
    }
    for (const m of [core, halo]) {
      m.uniforms.uProgress!.value = a.progress;
      m.uniforms.uTime!.value = time;
      m.uniforms.uShimmer!.value = revealed && !reducedMotion ? 1 : 0;
      m.uniforms.uGlow!.value = 0.8 + 0.5 * a.tight;
    }
    if (revealed && !reducedMotion) busy = true;
    // Beads: billboarded, shown once the string has passed them (with a little pop).
    beads.forEach((_, i) => {
      const g = beadGroups.current[i];
      if (!g) return;
      const at = (i + 1) / (beads.length + 1);
      curve.getPointAt(at, _p);
      g.position.copy(_p);
      g.quaternion.copy(camera.quaternion);
      const shown = a.progress >= at - 0.01;
      const prev = a.shown[i] ?? 0;
      const next = shown ? (reducedMotion ? 1 : Math.min(1, prev + dt / 0.3)) : 0;
      a.shown[i] = next;
      if (next > 0 && next < 1) busy = true;
      const s = next <= 0 ? 0.0001 : beadSize * (next < 1 ? easeOutBack(next) : 1) * (1 + 0.12 * a.tight);
      g.scale.setScalar(s);
      g.visible = next > 0;
    });
    if (busy) requestFrame();
  });

  return (
    <group visible={visible}>
      <mesh geometry={tube.geometry} material={core} onClick={onClick} frustumCulled={false} renderOrder={6} />
      {tier !== 'low' && (
        <mesh geometry={tube.geometry} material={halo} frustumCulled={false} renderOrder={7} raycast={() => null} />
      )}
      {beads.map((bead, i) => (
        <group
          key={`${bead}-${i}`}
          ref={(g) => {
            beadGroups.current[i] = g;
          }}
          visible={false}
        >
          <mesh geometry={atlas.planes[bead]} material={beadMaterial} renderOrder={8} raycast={() => null} />
        </group>
      ))}
    </group>
  );
}

export default Thread;
