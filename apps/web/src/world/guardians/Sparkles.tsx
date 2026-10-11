// Guardian sparkles: the trail that bond marks II and III add (GAME_DESIGN.md §6.2 "a second colour, a trail")
// and the little burst when a Guardian finishes unfolding. One instanced draw call. Reduced motion: the trail
// rests as a still ring of glints and there is no burst.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  OctahedronGeometry,
  Quaternion,
  Vector3,
} from 'three';
import { useKit } from '../kit/context';
import { clamp, easeOutCubic } from '../kit/math';
import { sharedResource, useShared } from '../kit/motion';

const BURST = 12;
const BURST_S = 0.9;

const glintResource = sharedResource(
  () => new OctahedronGeometry(1, 0),
  (g) => g.dispose(),
);

export interface GuardianSparklesProps {
  /** Glints in the orbiting trail (0 = none). Bond mark II: 7, III: 14. */
  trail: number;
  /** Trail colour (the Guardian's second colour). */
  color: string;
  /** Burst colour. Default warm paper gold. */
  burstColor?: string;
  /** Increment to play one burst. */
  burstKey?: number;
  /** Centre of the orbit (model space). Default [0, 0.5, 0]. */
  centre?: [number, number, number];
  /** Orbit radius. Default 0.6. */
  radius?: number;
  /** Mission time: when given, the trail is a pure function of it. */
  t?: number;
}

export function GuardianSparkles({
  trail,
  color,
  burstColor = '#ffe7a8',
  burstKey = 0,
  centre = [0, 0.5, 0],
  radius = 0.6,
  t,
}: GuardianSparklesProps) {
  const { reducedMotion, requestFrame } = useKit();
  const geometry = useShared(glintResource);
  const material = useMemo(
    () => new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, fog: false, blending: AdditiveBlending }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  const mesh = useRef<InstancedMesh>(null);
  const capacity = trail + BURST;
  const work = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), e: new Euler(), s: new Vector3(), p: new Vector3() }), []);
  // Starts from key 0, so a sparkle layer mounted together with its first burst still plays it.
  const burst = useRef({ key: 0, time: BURST_S });
  const [cx, cy, cz] = centre;

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new Color();
    for (let i = 0; i < capacity; i++) m.setColorAt(i, c.set(i < trail ? color : burstColor));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    requestFrame();
  }, [capacity, trail, color, burstColor, requestFrame]);

  useEffect(() => {
    const b = burst.current;
    if (burstKey !== b.key) {
      b.key = burstKey;
      b.time = reducedMotion ? BURST_S : 0;
      requestFrame();
    }
  }, [burstKey, reducedMotion, requestFrame]);

  useFrame((state, delta) => {
    const m = mesh.current;
    if (!m) return;
    const { m: mat, q, e, s, p } = work;
    const time = reducedMotion ? 0 : t ?? state.clock.elapsedTime;
    let busy = false;
    for (let i = 0; i < trail; i++) {
      const ang = time * 1.1 - i * (reducedMotion ? (Math.PI * 2) / Math.max(1, trail) : 0.17);
      p.set(cx + Math.sin(ang) * radius, cy + 0.2 * Math.sin(ang * 1.5 + 0.6), cz + Math.cos(ang) * radius * 0.55);
      const fade = 1 - i / Math.max(1, trail);
      const twinkle = reducedMotion ? 1 : 0.7 + 0.3 * Math.sin(time * 6 + i * 1.7);
      s.setScalar(0.03 * (0.35 + 0.65 * fade) * twinkle);
      e.set(time * 2 + i, time * 3 + i, 0);
      m.setMatrixAt(i, mat.compose(p, q.setFromEuler(e), s));
    }
    const b = burst.current;
    if (b.time < BURST_S) {
      b.time += Math.min(delta, 0.1);
      busy = true;
    }
    const k = clamp(b.time / BURST_S);
    for (let i = 0; i < BURST; i++) {
      const ang = (i / BURST) * Math.PI * 2;
      const r = easeOutCubic(k) * (0.55 + 0.15 * (i % 3));
      p.set(cx + Math.sin(ang) * r, cy + 0.1 + Math.cos(ang) * r * 0.8, cz + 0.15);
      s.setScalar(k >= 1 ? 0 : 0.045 * (1 - k));
      e.set(0, 0, ang + k * 3);
      m.setMatrixAt(trail + i, mat.compose(p, q.setFromEuler(e), s));
    }
    m.instanceMatrix.needsUpdate = true;
    if (busy || (trail > 0 && !reducedMotion)) requestFrame();
  });

  return (
    <instancedMesh
      key={capacity}
      ref={mesh}
      args={[geometry, material, capacity]}
      frustumCulled={false}
      renderOrder={4}
      raycast={() => null}
    />
  );
}

export default GuardianSparkles;
