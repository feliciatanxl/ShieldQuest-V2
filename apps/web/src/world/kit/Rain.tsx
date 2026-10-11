// <Rain>: instanced rain (GAME_DESIGN.md §4.2, §10.2) in ONE draw call. Drop count follows the tier's particle
// budget. `freezeAmount` freezes the rain drop by drop (the projector "Room Freeze": in proportion to the
// holds); a frozen drop decelerates over 400 ms and hangs as a glowing bead of light. Fully frozen rain stops
// requesting frames, so a long Hold costs no battery.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  NormalBlending,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three';
import { QUALITY_BUDGET } from '../quality';
import { useKit } from './context';
import { clamp, seededRandom, type Vec3 } from './math';

export interface RainProps {
  /**
   * 0 = falling, 1 = every drop hangs as a glowing bead; in between, that share of drops is frozen.
   * Defaults to the canvas's shared freeze (see useFreeze), so mission scenes need not pass it.
   */
  freezeAmount?: number;
  /** Overrides the tier budget (QUALITY_BUDGET[tier].particles). */
  count?: number;
  /** 0..1 multiplier on the drop count (drizzle to downpour). Default 1. */
  intensity?: number;
  /** Size of the rain volume [width x, height y, depth z] in metres. Default [18, 10, 14]. */
  area?: Vec3;
  /** Centre of the rain volume's floor. Default [0, 0, 0]. */
  position?: Vec3;
  /** Fall speed in m/s. Default 9. */
  speed?: number;
  /** Sideways slant (metres of drift per metre of fall). Default 0.12. */
  wind?: number;
  /** Falling streak colour. */
  color?: string;
  /** Frozen bead colour. */
  beadColor?: string;
  visible?: boolean;
  /** Seed for drop placement (same seed = same rain on every device). */
  seed?: string;
}

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
uniform vec3 uArea;
uniform vec3 uOrigin;
uniform float uWind;
uniform float uTime;
uniform float uTwinkle;
attribute vec4 aDrop;   // x01, z01, fall 0..1, freeze 0..1
attribute float aPhase;
varying float vF;
varying float vAlpha;
varying float vTw;
void main() {
  float f = aDrop.w;
  f = f * f * ( 3.0 - 2.0 * f );
  float fall = aDrop.z;
  vec3 local = position;
  float len = mix( 0.46, 0.075, f );
  float rad = mix( 0.012, 0.04, f );
  local.xz *= rad;
  local.y *= len;
  local.x -= local.y * uWind * ( 1.0 - f );
  vec3 world = uOrigin + vec3(
    ( aDrop.x - 0.5 ) * uArea.x + uWind * uArea.y * fall,
    uArea.y * ( 1.0 - fall ),
    ( aDrop.y - 0.5 ) * uArea.z
  ) + local;
  // Fade in at the top and out at the floor so drops never pop.
  vAlpha = smoothstep( 0.0, 0.05, fall ) * smoothstep( 1.0, 0.93, fall );
  vF = f;
  vTw = uTwinkle * f * sin( uTime * 2.3 + aPhase * 6.2831 );
  vec4 mvPosition = modelViewMatrix * vec4( world, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform vec3 uBead;
uniform float uOpacity;
varying float vF;
varying float vAlpha;
varying float vTw;
void main() {
  vec3 c = mix( uColor, uBead * ( 1.0 + 0.3 * vTw ), vF );
  float a = mix( 0.38, 0.95, vF ) * vAlpha * uOpacity;
  if ( a < 0.01 ) discard;
  gl_FragColor = vec4( c, a );
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

/** Triangular bipyramid (6 triangles), unit height and radius; scaled per drop in the shader. */
function dropGeometry(count: number, seed: string): { geometry: InstancedBufferGeometry; drops: Float32Array; thresholds: Float32Array; speeds: Float32Array } {
  const g = new InstancedBufferGeometry();
  const ring = [0, 1, 2].map((i) => [Math.sin((i / 3) * Math.PI * 2), 0, Math.cos((i / 3) * Math.PI * 2)] as const);
  const top = [0, 0.5, 0] as const;
  const bottom = [0, -0.5, 0] as const;
  const pos: number[] = [];
  for (let i = 0; i < 3; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % 3]!;
    pos.push(...a, ...b, ...top, ...b, ...a, ...bottom);
  }
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  const rand = seededRandom(seed);
  const drops = new Float32Array(count * 4);
  const phases = new Float32Array(count);
  const thresholds = new Float32Array(count);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    drops[i * 4] = rand();
    drops[i * 4 + 1] = rand();
    drops[i * 4 + 2] = rand();
    drops[i * 4 + 3] = 0;
    phases[i] = rand();
    // Freeze order: spread over 0..1 so drops freeze one by one as freezeAmount rises.
    thresholds[i] = 0.02 + 0.96 * rand();
    speeds[i] = 0.8 + 0.4 * rand();
  }
  const dropAttr = new InstancedBufferAttribute(drops, 4);
  dropAttr.setUsage(DynamicDrawUsage);
  g.setAttribute('aDrop', dropAttr);
  g.setAttribute('aPhase', new InstancedBufferAttribute(phases, 1));
  g.instanceCount = count;
  return { geometry: g, drops, thresholds, speeds };
}

/** Instanced rain volume. Put it inside the scene (one per canvas is plenty). */
export function Rain({
  freezeAmount,
  count,
  intensity = 1,
  area = [18, 10, 14],
  position = [0, 0, 0],
  speed = 9,
  wind = 0.12,
  color = '#b9cdf0',
  beadColor = '#e6f4ff',
  visible = true,
  seed = 'rain',
}: RainProps) {
  const { tier, uniforms, reducedMotion, requestFrame } = useKit();
  const budget = QUALITY_BUDGET[tier].particles;
  // Reduced motion: a lighter, slower drizzle (large fields of fast motion can be uncomfortable).
  const n = Math.max(0, Math.round((count ?? budget) * clamp(intensity) * (reducedMotion ? 0.5 : 1)));
  const sim = useMemo(() => dropGeometry(Math.max(1, n), seed), [n, seed]);
  useEffect(() => () => sim.geometry.dispose(), [sim]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: UniformsUtils.merge([
          UniformsLib.fog,
          {
            uArea: { value: new Vector3() },
            uOrigin: { value: new Vector3() },
            uWind: { value: 0 },
            uTime: { value: 0 },
            uTwinkle: { value: 0 },
            uColor: { value: new Color() },
            uBead: { value: new Color() },
            uOpacity: { value: 1 },
          },
        ]),
        transparent: true,
        depthWrite: false,
        fog: true,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  const [ax, ay, az] = area;
  const [px, py, pz] = position;
  useEffect(() => {
    const u = material.uniforms;
    (u.uArea!.value as Vector3).set(ax, ay, az);
    (u.uOrigin!.value as Vector3).set(px, py, pz);
    u.uWind!.value = wind;
    (u.uColor!.value as Color).set(color);
    (u.uBead!.value as Color).set(beadColor);
    // Twinkling beads only where frames are cheap (and never under reduced motion).
    u.uTwinkle!.value = tier === 'high' && !reducedMotion ? 1 : 0;
    // Additive beads glow on the dark Blue Hour sky; normal blending keeps streaks subtle.
    material.blending = tier === 'low' ? NormalBlending : AdditiveBlending;
    material.needsUpdate = true;
    requestFrame();
  }, [material, ax, ay, az, px, py, pz, wind, color, beadColor, tier, reducedMotion, requestFrame]);

  const freezeRef = useRef(freezeAmount);
  freezeRef.current = freezeAmount;
  useEffect(() => {
    requestFrame();
  }, [freezeAmount, requestFrame]);

  useFrame((state, delta) => {
    if (!visible || n === 0) return;
    const dt = Math.min(delta, 0.1);
    const target = clamp(freezeRef.current ?? uniforms.uFreeze.value);
    const { drops, thresholds, speeds, geometry } = sim;
    const fallRate = (speed * (reducedMotion ? 0.6 : 1)) / Math.max(0.1, ay);
    const fStep = reducedMotion ? 1 : dt / 0.4;
    let moving = false;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const goal = target >= thresholds[i]! ? 1 : 0;
      let f = drops[o + 3]!;
      if (f !== goal) {
        f = goal > f ? Math.min(goal, f + fStep) : Math.max(goal, f - fStep);
        drops[o + 3] = f;
        moving = true;
      }
      if (f < 1) {
        const slow = (1 - f) * (1 - f);
        let fall = drops[o + 2]! + dt * fallRate * speeds[i]! * slow;
        if (fall >= 1) {
          fall -= Math.floor(fall);
          // A fresh column each time round, so the pattern never visibly repeats.
          drops[o] = (drops[o]! + 0.6180339) % 1;
          drops[o + 1] = (drops[o + 1]! + 0.3819660) % 1;
        }
        drops[o + 2] = fall;
        moving = true;
      }
    }
    const attr = geometry.getAttribute('aDrop') as InstancedBufferAttribute;
    attr.needsUpdate = true;
    const u = material.uniforms;
    u.uTime!.value = state.clock.elapsedTime;
    if (moving || u.uTwinkle!.value > 0) requestFrame();
  });

  if (n === 0) return null;
  return (
    <mesh
      geometry={sim.geometry}
      material={material}
      visible={visible}
      frustumCulled={false}
      renderOrder={5}
      raycast={() => null}
    />
  );
}

export default Rain;
