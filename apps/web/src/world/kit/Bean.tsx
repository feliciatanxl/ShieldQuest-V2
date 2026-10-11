// <Bean>: the NPC figure (GAME_DESIGN.md §4.4). One draw call per bean: an 8-part rigid figure posed by uniform
// matrices, a face from the shared expression atlas, hair/headwear silhouettes, pose presets that tween, and an
// idle layer that is a pure function of time (off when frozen, under reduced motion, or on Low without `t`).
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { MeshBasicMaterial, RingGeometry, type Matrix4 } from 'three';
import { buildBeanGeometry, BEAN_HEIGHT, type BeanLook } from './beanGeometry';
import { addMotionLayers, blendPose, clonePose, composeBean, POSE_PRESETS, type BeanPose } from './beanPoses';
import { useKit } from './context';
import { expressionOffset, faceAtlas, type BeanExpression } from './faceAtlas';
import { BlobShadow } from './KitMesh';
import { useKitMaterial } from './materials';
import { clamp, damp, easeInOutCubic, hashString, type Vec3 } from './math';
import { sharedResource, useShared } from './motion';
import { PALETTE } from './uniforms';

export type { BeanLook, BeanHair, BeanOutfit } from './beanGeometry';
export type { BeanPose } from './beanPoses';
export type { BeanExpression } from './faceAtlas';

export interface BeanProps {
  /** Styling (CastMember.look is a valid BeanLook). */
  look: BeanLook;
  pose?: BeanPose;
  expression?: BeanExpression;
  position?: Vec3;
  /** Yaw in radians (0 faces +z). */
  facing?: number;
  scale?: number;
  /** Gold ring at the feet + rim glow (paired with DOM text; never the only cue). */
  highlighted?: boolean;
  /** Time is held: keep the pose, no idle sway, no blinking. */
  frozen?: boolean;
  /** Keeps full colour while the world is frozen (e.g. the resident being advised). */
  warm?: boolean;
  /** Stable id (e.g. cast id): picks skin/hair tone when not given and the idle phase. */
  seed?: string;
  /** Mission time in seconds; when given, idle motion is a pure function of it (rewind-safe). */
  t?: number;
  /** World-space point to turn the head (and a little of the torso) towards. */
  lookAt?: Vec3 | null;
  /** Soft blob shadow (default: on Medium/High). */
  shadow?: boolean;
  visible?: boolean;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}

const POSE_MS = 450;

const ringResource = sharedResource(
  () => ({
    outer: new RingGeometry(0.44, 0.52, 40).rotateX(-Math.PI / 2),
    inner: new RingGeometry(0.33, 0.36, 40).rotateX(-Math.PI / 2),
  }),
  (r) => {
    r.outer.dispose();
    r.inner.dispose();
  },
);

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** NPC bean. Place it at an AnchorSpot: `<Bean look={cast.look} pose="sit" position={spot.position} facing={spot.facing} />`. */
export function Bean({
  look,
  pose = 'stand',
  expression = 'neutral',
  position = [0, 0, 0],
  facing = 0,
  scale = 1,
  highlighted = false,
  frozen = false,
  warm = false,
  seed,
  t,
  lookAt = null,
  shadow,
  visible = true,
  onClick,
}: BeanProps) {
  const { tier, reducedMotion, requestFrame } = useKit();
  const seedKey = seed ?? `${look.body}${look.accent}${look.hair ?? ''}`;
  const geometry = useMemo(
    () => buildBeanGeometry(look, seedKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [look.body, look.accent, look.hair, look.skin, look.hairColor, look.glasses, look.outfit, seedKey],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  const atlas = useShared(faceAtlas);
  const material = useKitMaterial({ variant: 'bean', map: atlas, warm });
  const rings = useShared(ringResource);
  const ringMaterial = useMemo(
    () => new MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false, fog: false }),
    [],
  );
  useEffect(() => () => ringMaterial.dispose(), [ringMaterial]);
  const ringGroup = useRef<import('three').Group>(null);
  const phase = useMemo(() => ((hashString(seedKey) % 1000) / 1000) * Math.PI * 2, [seedKey]);

  const anim = useRef({
    from: clonePose(POSE_PRESETS[pose]),
    to: POSE_PRESETS[pose],
    p: 1,
    current: clonePose(POSE_PRESETS[pose]),
    work: clonePose(POSE_PRESETS[pose]),
    look: 0,
  });

  useEffect(() => {
    const a = anim.current;
    if (a.to === POSE_PRESETS[pose]) return;
    a.from = clonePose(a.current);
    a.to = POSE_PRESETS[pose];
    a.p = reducedMotion ? 1 : 0;
    requestFrame();
  }, [pose, reducedMotion, requestFrame]);

  useEffect(() => {
    requestFrame();
  }, [t, expression, highlighted, frozen, lookAt, facing, requestFrame]);

  const [px, , pz] = position;
  useFrame((state, delta) => {
    const a = anim.current;
    const dt = Math.min(delta, 0.1);
    let busy = false;
    if (a.p < 1) {
      a.p = Math.min(1, a.p + (dt * 1000) / POSE_MS);
      busy = true;
    }
    blendPose(a.from, a.to, easeInOutCubic(a.p), a.current);
    blendPose(a.current, a.current, 0, a.work);
    const time = t ?? state.clock.elapsedTime;
    const idleOn = !frozen && !reducedMotion && (tier !== 'low' || t !== undefined);
    const walk = pose === 'walk' && !frozen && !reducedMotion ? easeInOutCubic(a.p) : 0;
    addMotionLayers(a.work, time, phase, idleOn ? 1 : 0, walk);

    // Turn towards a point: 65% head, 35% torso, limited so the neck stays believable.
    let lookTarget = 0;
    if (lookAt) lookTarget = clamp(wrapAngle(Math.atan2(lookAt[0] - px, lookAt[2] - pz) - facing), -1.3, 1.3);
    if (frozen || reducedMotion) a.look = lookTarget;
    else if (Math.abs(a.look - lookTarget) > 1e-3) {
      a.look += (lookTarget - a.look) * damp(5, dt);
      busy = true;
    }
    a.work.head[1] += a.look * 0.65;
    a.work.torso[1] += a.look * 0.35;

    const bean = material.userData.bean;
    if (bean) {
      composeBean(a.work, bean.uParts.value as Matrix4[]);
      // Idle blink (neutral face only): deterministic from time so rewinds look identical.
      const blink = expression === 'neutral' && idleOn && (time + phase) % 4.3 < 0.12;
      const [ox, oy] = expressionOffset(blink ? 'blink' : expression);
      bean.uFaceOffset.value.set(ox, oy);
    }
    const pulse = highlighted && !reducedMotion && !frozen ? 0.5 + 0.5 * Math.sin(time * 4) : 1;
    material.userData.kit.uHighlight.value = highlighted ? 0.55 + 0.35 * pulse : 0;
    if (ringGroup.current) {
      const s = highlighted && !reducedMotion && !frozen ? 1 + 0.06 * Math.sin(time * 4) : 1;
      ringGroup.current.scale.setScalar(s);
    }
    if (busy || idleOn || walk > 0 || (highlighted && !reducedMotion && !frozen)) requestFrame();
  });

  const showShadow = shadow ?? tier !== 'low';
  return (
    <group position={position} rotation={[0, facing, 0]} scale={scale} visible={visible}>
      <mesh
        geometry={geometry}
        material={material}
        frustumCulled
        onClick={onClick}
        onPointerOver={onClick ? () => (document.body.style.cursor = 'pointer') : undefined}
        onPointerOut={onClick ? () => (document.body.style.cursor = '') : undefined}
      />
      {showShadow && <BlobShadow radius={[0.36, 0.3]} opacity={0.38} />}
      {highlighted && (
        <group ref={ringGroup} position={[0, 0.03, 0]}>
          <mesh geometry={rings.outer} material={ringMaterial} renderOrder={2} raycast={() => null} />
          <mesh geometry={rings.inner} material={ringMaterial} renderOrder={2} raycast={() => null} />
        </group>
      )}
    </group>
  );
}

/** Bean height in metres at scale 1 (for camera framing). */
export const BEAN_SIZE = BEAN_HEIGHT;

export default Bean;
