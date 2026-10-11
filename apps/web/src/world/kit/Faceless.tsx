// <Faceless>: the manipulator is never embodied (GAME_DESIGN.md §4.4). During Identify the influence may appear
// as this featureless, neutral grey-violet, slightly translucent silhouette, optionally backlit in a lit window.
// No face, hair, clothing, accent or any gender or ethnic coding, by construction.
import { useEffect, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Euler, Vector3, type Group } from 'three';
import { useKit } from './context';
import { FACELESS_CHEST, facelessFigure, facelessWindow, type FacelessPose, type FacelessWindowOptions } from './geometry';
import { KitMesh, useKitGeometry } from './KitMesh';
import type { Vec3 } from './math';
import { PALETTE } from './uniforms';

export type { FacelessPose, FacelessWindowOptions } from './geometry';

export interface FacelessProps {
  position?: Vec3;
  /** Yaw in radians (0 faces +z). */
  facing?: number;
  scale?: number;
  /** 'stand' (arms down) or 'phone' (bent arms, dim screen glow). Default 'stand'. */
  pose?: FacelessPose;
  /** Backlit inside a lit window set into a wall (true or options). Default false. */
  window?: boolean | FacelessWindowOptions;
  /** Silhouette opacity (slightly translucent). Default 0.84. */
  opacity?: number;
  /** Gold rim when the thread reaches it (pair with DOM text). */
  highlighted?: boolean;
  /** Time is held: no breathing. */
  frozen?: boolean;
  /** Mission time (s); idle breathing is a pure function of it when given. */
  t?: number;
  color?: string;
  visible?: boolean;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}

/** World-space chest point of a Faceless figure, where a <Thread> should end. */
export function facelessAnchor(position: Vec3 = [0, 0, 0], facing = 0, scale = 1): Vec3 {
  const v = new Vector3(...FACELESS_CHEST).multiplyScalar(scale).applyEuler(new Euler(0, facing, 0));
  return [position[0] + v.x, position[1] + v.y, position[2] + v.z];
}

function WindowFrame({ options }: { options: FacelessWindowOptions }) {
  const key = JSON.stringify(options);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useKitGeometry(() => facelessWindow(options), [key]);
  return <KitMesh geometry={geometry} castShadow={false} />;
}

/** Faceless manipulator silhouette (optionally in a lit window). */
export function Faceless({
  position = [0, 0, 0],
  facing = 0,
  scale = 1,
  pose = 'stand',
  window: windowOption = false,
  opacity = 0.84,
  highlighted = false,
  frozen = false,
  t,
  color = PALETTE.faceless,
  visible = true,
  onClick,
}: FacelessProps) {
  const { reducedMotion, requestFrame, tier } = useKit();
  const figure = useKitGeometry(() => facelessFigure(pose, color), [pose, color]);
  const windowOpts = windowOption === true ? {} : windowOption || null;
  const body = useRef<Group>(null);

  useEffect(() => {
    requestFrame();
  }, [frozen, highlighted, t, requestFrame]);

  useFrame((state) => {
    const g = body.current;
    if (!g) return;
    const idle = !frozen && !reducedMotion && (tier !== 'low' || t !== undefined);
    const time = t ?? state.clock.elapsedTime;
    // Barely-there breathing: the figure is a presence, not a character.
    const s = idle ? 1 + 0.008 * Math.sin(time * 1.4) : 1;
    g.scale.set(1, s, 1);
    if (idle) requestFrame();
  });

  return (
    <group position={position} rotation={[0, facing, 0]} scale={scale} visible={visible}>
      <group ref={body}>
        <KitMesh
          geometry={figure}
          transparent={opacity < 1}
          opacity={opacity}
          highlight={highlighted ? 0.8 : 0}
          castShadow={false}
          onClick={onClick}
        />
      </group>
      {windowOpts && <WindowFrame options={windowOpts} />}
    </group>
  );
}

export default Faceless;
