// Paper lanterns (GAME_DESIGN.md §4.2-4.3): trust gold by default, glowing paper that keeps its warmth while the
// world is frozen. <Lantern> is one lantern; <Lanterns> draws many in ONE instanced draw call (projector Seal Wall,
// district trust). Both can rise into place (staggered, eased) and bob gently; reduced motion = no rise, no bob.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Color, Euler, InstancedMesh, Matrix4, Quaternion, Vector3, type Group } from 'three';
import { useKit } from './context';
import { LANTERN_HEIGHT, lantern } from './geometry';
import { BlobShadow, KitMesh } from './KitMesh';
import { useKitMaterial } from './materials';
import { clamp, easeOutCubic, hashString, type Vec3 } from './math';
import { sharedResource, useShared } from './motion';
import { PALETTE } from './uniforms';

export { LANTERN_HEIGHT } from './geometry';

/** One shared lantern geometry for every lantern on the page. */
const lanternResource = sharedResource(lantern, (g) => g.dispose());

export interface LanternRise {
  /** Metres below the resting position the lantern starts from. Default 2.5. */
  from?: number;
  /** Seconds. Default 2.4. */
  duration?: number;
  /** Seconds before it starts (per lantern for <Lanterns>: added to index x stagger). Default 0. */
  delay?: number;
}

export interface LanternProps {
  /** Resting position of the lantern's bottom. */
  position?: Vec3;
  /** Paper colour. Default trust gold. */
  color?: string;
  scale?: number;
  /** Glow strength 0..1 (0 = unlit paper). Default 1. */
  lit?: number;
  /** Rise into place when mounted (true or options). */
  rise?: boolean | LanternRise;
  /** Gentle hover bob. Default true on Medium/High. */
  bob?: boolean;
  /** Mission time (s): when given, rise and bob are pure functions of it (rewind-safe). */
  t?: number;
  /** Soft blob shadow on the ground at y = 0 (for lanterns standing on a surface). Default false. */
  shadow?: boolean;
  visible?: boolean;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}

const riseOptions = (rise: boolean | LanternRise | undefined): Required<LanternRise> | null =>
  rise ? { from: 2.5, duration: 2.4, delay: 0, ...(rise === true ? {} : rise) } : null;

/** Rise offset (m, <= 0) and sway (rad) at `elapsed` seconds. */
function riseAt(r: Required<LanternRise> | null, elapsed: number): { dy: number; sway: number; done: boolean } {
  if (!r) return { dy: 0, sway: 0, done: true };
  const p = clamp((elapsed - r.delay) / Math.max(0.01, r.duration));
  const e = easeOutCubic(p);
  return { dy: -r.from * (1 - e), sway: Math.sin(elapsed * 2.2) * 0.12 * (1 - e), done: p >= 1 };
}

/** One paper lantern. */
export function Lantern({
  position = [0, 0, 0],
  color = PALETTE.gold,
  scale = 1,
  lit = 1,
  rise,
  bob,
  t,
  shadow = false,
  visible = true,
  onClick,
}: LanternProps) {
  const { tier, reducedMotion, requestFrame } = useKit();
  const geometry = useShared(lanternResource);
  const group = useRef<Group>(null);
  const start = useRef<number | null>(null);
  const posKey = position.join(',');
  const phase = useMemo(() => (hashString(posKey) % 628) / 100, [posKey]);
  const r = reducedMotion ? null : riseOptions(rise);
  const bobOn = (bob ?? tier !== 'low') && !reducedMotion;

  useEffect(() => {
    requestFrame();
  }, [t, requestFrame]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    if (start.current === null) start.current = state.clock.elapsedTime;
    const elapsed = t ?? state.clock.elapsedTime - start.current;
    const { dy, sway, done } = riseAt(r, elapsed);
    const hover = bobOn ? Math.sin(elapsed * 1.3 + phase) * 0.05 * scale : 0;
    g.position.set(position[0], position[1] + dy + hover, position[2]);
    g.rotation.set(0, elapsed * 0.15 * (bobOn ? 1 : 0), sway + (bobOn ? Math.sin(elapsed * 0.9 + phase) * 0.03 : 0));
    if (!done || bobOn) requestFrame();
  });

  return (
    <>
      <group ref={group} position={position} scale={scale} visible={visible}>
        <KitMesh geometry={geometry} color={color} warm glowBoost={lit} castShadow={false} onClick={onClick} />
      </group>
      {shadow && <BlobShadow position={[position[0], 0, position[2]]} radius={0.22 * scale} opacity={0.3} />}
    </>
  );
}

export interface LanternItem {
  position: Vec3;
  color?: string;
  scale?: number;
}

export interface LanternsProps {
  items: readonly LanternItem[];
  /** Newly added lanterns rise into place (each from the moment it appears). */
  rise?: boolean | LanternRise;
  /** Seconds between consecutive lanterns' rises. Default 0.15. */
  stagger?: number;
  /** Gentle hover bob. Default true on Medium/High. */
  bob?: boolean;
  /** Glow strength 0..1. Default 1. */
  lit?: number;
  visible?: boolean;
}

/** Many lanterns in one draw call (e.g. squad lanterns on the projector city). */
export function Lanterns({ items, rise, stagger = 0.15, bob, lit = 1, visible = true }: LanternsProps) {
  const { tier, reducedMotion, requestFrame } = useKit();
  const geometry = useShared(lanternResource);
  const material = useKitMaterial({ warm: true, glowBoost: lit });
  const mesh = useRef<InstancedMesh>(null);
  const born = useRef<number[]>([]);
  const r = reducedMotion ? null : riseOptions(rise);
  const bobOn = (bob ?? tier !== 'low') && !reducedMotion;
  const count = items.length;
  const capacity = Math.max(8, 2 ** Math.ceil(Math.log2(Math.max(1, count))));
  const work = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), e: new Euler(), s: new Vector3(), p: new Vector3(), c: new Color() }), []);

  // Remember when each lantern first appeared, so only new ones rise.
  useLayoutEffect(() => {
    const b = born.current;
    if (b.length > count) b.length = count;
    // NaN = "born on the next rendered frame" (the clock only advances while frames render).
    for (let i = b.length; i < count; i++) b.push(r ? Number.NaN : -1e6);
    const m = mesh.current;
    if (m) {
      items.forEach((item, i) => m.setColorAt(i, work.c.set(item.color ?? PALETTE.gold)));
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.count = count;
    }
    requestFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, count, requestFrame]);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const time = state.clock.elapsedTime;
    let busy = false;
    let pending = 0;
    born.current.forEach((b, i) => {
      if (Number.isNaN(b)) born.current[i] = time + pending++ * stagger;
    });
    const { m: mat, q, e, s, p } = work;
    items.forEach((item, i) => {
      const phase = i * 1.7;
      const elapsed = time - (born.current[i] ?? -1e6);
      const { dy, sway, done } = riseAt(r, elapsed);
      if (!done) busy = true;
      const sc = item.scale ?? 1;
      const hover = bobOn ? Math.sin(time * 1.3 + phase) * 0.05 * sc : 0;
      p.set(item.position[0], item.position[1] + dy + hover, item.position[2]);
      e.set(0, bobOn ? time * 0.15 + phase : phase, sway);
      q.setFromEuler(e);
      s.setScalar(sc);
      m.setMatrixAt(i, mat.compose(p, q, s));
    });
    m.instanceMatrix.needsUpdate = true;
    if (busy || bobOn) requestFrame();
  });

  return (
    <instancedMesh
      key={capacity}
      ref={mesh}
      args={[geometry, material, capacity]}
      count={count}
      visible={visible && count > 0}
      frustumCulled={false}
    />
  );
}

/** Lantern height in metres at scale 1. */
export const LANTERN_SIZE = LANTERN_HEIGHT;

export default Lantern;
