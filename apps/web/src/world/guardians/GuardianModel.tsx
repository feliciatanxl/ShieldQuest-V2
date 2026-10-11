// <GuardianModel>: a Guardian as a scene-graph component, for use inside any AdaptiveCanvas (City towers,
// projector reveals, the Bond screen). The fold state is driven from outside through `unfold` (0 = folded
// sheet, 1 = origami animal), so callers can tween it or derive it from mission time.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Group } from 'three';
import type { GuardianId } from '@shieldquest/shared';
import { useKit } from '../kit/context';
import { useKitMaterial, type KitMaterial } from '../kit/materials';
import { clamp, hashString, type Vec3 } from '../kit/math';
import { buildGuardianGeometry, geometryLevel, UNFOLD_LIFT } from './models';
import { GUARDIAN_ACCENT } from './palette';
import { GuardianSparkles } from './Sparkles';

/** Geometry + guardian kit material for one Guardian (both disposed on unmount). */
export function useGuardianMesh(guardian: GuardianId, level: number, options: { transparent?: boolean } = {}) {
  const lv = geometryLevel(level);
  const geometry = useMemo(() => buildGuardianGeometry(guardian, lv), [guardian, lv]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // Guardians keep their colour while time is held ("warm"); paper is double-sided.
  const material: KitMaterial = useKitMaterial({
    variant: 'guardian',
    warm: true,
    side: 'double',
    transparent: options.transparent ?? false,
  });
  if (material.userData.guardian) material.userData.guardian.uLift.value = UNFOLD_LIFT;
  return { geometry, material };
}

/** Trail glints for a bond level (mark II: 7, mark III: 14). */
export const sparkleCount = (level: number) => (level >= 3 ? 14 : level >= 2 ? 7 : 0);

export interface GuardianModelProps {
  guardian: GuardianId;
  /** Bond level 0..3 (0 = not yet earned: shown as the folded sheet unless `unfold` says otherwise). */
  level: number;
  /** 0 = folded paper sheet, 1 = origami animal. Default: 1 when level >= 1, else 0. */
  unfold?: number;
  position?: Vec3;
  /** Yaw in radians (0 faces +z). */
  rotationY?: number;
  /** Uniform scale (the model is ~1 m tall). Default 1. */
  scale?: number;
  /** Gentle idle hover and sway (off under reduced motion). Default true. */
  hover?: boolean;
  /** Orbiting trail for bond levels 2-3. Default true. */
  sparkle?: boolean;
  /** Increment to play a sparkle burst (e.g. when an unfold completes). */
  burstKey?: number;
  /** Mission time (s): when given, hover and sparkles are pure functions of it. */
  t?: number;
  visible?: boolean;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}

/** One Guardian inside an existing canvas. Its origin is the ground point under the figure. */
export function GuardianModel({
  guardian,
  level,
  unfold,
  position,
  rotationY = 0,
  scale = 1,
  hover = true,
  sparkle = true,
  burstKey = 0,
  t,
  visible = true,
  onClick,
}: GuardianModelProps) {
  const { reducedMotion, requestFrame } = useKit();
  const { geometry, material } = useGuardianMesh(guardian, level);
  const u = clamp(unfold ?? (level > 0 ? 1 : 0));
  if (material.userData.guardian) material.userData.guardian.uUnfold.value = u;
  const body = useRef<Group>(null);
  const phase = useMemo(() => (hashString(guardian) % 628) / 100, [guardian]);

  useEffect(() => {
    requestFrame();
  }, [u, level, t, requestFrame]);

  useFrame((state) => {
    const g = body.current;
    if (!g) return;
    const on = hover && !reducedMotion;
    const time = t ?? state.clock.elapsedTime;
    g.position.y = on ? 0.035 * Math.sin(time * 1.6 + phase) : 0;
    g.rotation.y = on ? 0.2 * Math.sin(time * 0.5 + phase) : 0;
    if (on && visible) requestFrame();
  });

  const trail = sparkle && u > 0.99 ? sparkleCount(level) : 0;
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale} visible={visible}>
      <group ref={body}>
        <mesh
          geometry={geometry}
          material={material}
          onClick={onClick}
          onPointerOver={onClick ? () => (document.body.style.cursor = 'pointer') : undefined}
          onPointerOut={onClick ? () => (document.body.style.cursor = '') : undefined}
        />
        {(trail > 0 || burstKey > 0) && (
          <GuardianSparkles trail={trail} color={GUARDIAN_ACCENT[guardian]} burstKey={burstKey} t={t} />
        )}
      </group>
    </group>
  );
}

export default GuardianModel;
