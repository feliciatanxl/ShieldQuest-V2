// Moving set props (fans, a clock's second hand, chat bubbles, steam, a prize wheel, a lift car): many copies of
// one kit geometry in ONE instanced draw call, each placed by a pure function of mission time (GAME_DESIGN.md
// §4.6). Time stops while frozen, so everything holds in place during the Hold; under reduced motion the caller
// passes a fixed time and nothing moves at all. 3D chunk only.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Object3D, type BufferGeometry, type ColorRepresentation, type InstancedMesh } from 'three';
import { useKit, useKitMaterial, useReducedMotion, type KitMaterialOptions } from '../../../kit';
import { useSmoothTime } from '../../core/sets3d/common';

/** Writes instance `i`'s transform at mission time `time` into `o` (it arrives reset to the identity). */
export type InstanceLayout = (i: number, time: number, o: Object3D) => void;

export interface AnimatedInstancesProps extends Omit<KitMaterialOptions, 'uniforms' | 'variant'> {
  geometry: BufferGeometry;
  count: number;
  /** Must be stable (module level or memoised): it is called for every instance whenever time moves. */
  layout: InstanceLayout;
  /** Mission time (seconds). */
  t: number;
  /** False while frozen or under reduced motion: time holds. */
  running: boolean;
  /** Per-instance colour multipliers (cycled). */
  colors?: readonly ColorRepresentation[];
  visible?: boolean;
}

export function AnimatedInstances({ geometry, count, layout, t, running, colors, visible, ...materialOptions }: AnimatedInstancesProps) {
  const material = useKitMaterial(materialOptions);
  const ref = useRef<InstancedMesh>(null);
  const time = useSmoothTime(t, running);
  const written = useRef(Number.NaN);
  const dummy = useMemo(() => new Object3D(), []);
  const { requestFrame } = useKit();

  const write = (mesh: InstancedMesh, at: number) => {
    for (let i = 0; i < count; i++) {
      dummy.position.set(0, 0, 0);
      dummy.rotation.set(0, 0, 0, 'YXZ');
      dummy.scale.set(1, 1, 1);
      layout(i, at, dummy);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    written.current = at;
  };

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    if (colors && colors.length > 0) {
      const c = new Color();
      for (let i = 0; i < count; i++) mesh.setColorAt(i, c.set(colors[i % colors.length]!));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    write(mesh, time.current);
    requestFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, colors, layout, geometry, material]);

  // A new mission time arrives about ten times a second: ask for a frame so the smoothed clock can follow it.
  useEffect(() => {
    if (running) requestFrame();
  }, [t, running, requestFrame]);

  useFrame(() => {
    const mesh = ref.current;
    if (mesh && time.current !== written.current) write(mesh, time.current);
  });

  return (
    <instancedMesh
      key={count}
      ref={ref}
      args={[geometry, material, Math.max(1, count)]}
      count={count}
      visible={visible}
      // Instances move around the whole set: skip per-frame bounding-sphere work and never cull them.
      frustumCulled={false}
      raycast={() => null}
    />
  );
}

/**
 * Ambient motion clock for a set: mission time while it runs, a fixed rest time under reduced motion (fans
 * stand still, bubbles stop bobbing). `running` is false while frozen or reduced.
 */
export function useAmbient(t: number, frozen: boolean): { time: number; running: boolean; reduced: boolean } {
  const reduced = useReducedMotion();
  return { time: reduced ? 0 : t, running: !frozen && !reduced, reduced };
}
