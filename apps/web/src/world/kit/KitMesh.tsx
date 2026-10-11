// Small React helpers so set and city builders write as little three.js plumbing as possible:
// useKitGeometry (memoise + dispose), <KitMesh> (one merged prop, one draw call), <KitInstances>
// (many copies of one prop, one draw call) and <BlobShadow> (the soft contact-shadow decal of §4.2).
import { useEffect, useLayoutEffect, useMemo, useRef, type DependencyList } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import {
  CanvasTexture,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Euler,
  Vector3,
  type BufferGeometry,
  type ColorRepresentation,
} from 'three';
import { useKit } from './context';
import { useKitMaterial, type KitMaterialOptions } from './materials';
import { sharedResource, useShared } from './motion';
import type { Vec3 } from './math';

/** Builds a geometry once per `deps` change and disposes it on change/unmount. */
export function useKitGeometry(build: () => BufferGeometry, deps: DependencyList): BufferGeometry {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(build, deps);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

export interface KitMeshProps extends Omit<KitMaterialOptions, 'uniforms' | 'variant'> {
  geometry: BufferGeometry;
  position?: Vec3;
  rotation?: Vec3;
  scale?: number | Vec3;
  castShadow?: boolean;
  receiveShadow?: boolean;
  visible?: boolean;
  /** 0..1 gold rim highlight. */
  highlight?: number;
  renderOrder?: number;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}

/**
 * One kit geometry with the shared kit material. You own (and dispose) the geometry: build it with
 * useKitGeometry(() => mergeKit([...]), deps).
 */
export function KitMesh({
  geometry,
  position,
  rotation,
  scale,
  castShadow,
  receiveShadow,
  visible,
  highlight = 0,
  renderOrder,
  onClick,
  ...materialOptions
}: KitMeshProps) {
  const material = useKitMaterial(materialOptions);
  material.userData.kit.uHighlight.value = highlight;
  const { tier } = useKit();
  const shadows = tier === 'high';
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow={shadows && (castShadow ?? true)}
      receiveShadow={shadows && (receiveShadow ?? true)}
      visible={visible}
      renderOrder={renderOrder}
      onClick={onClick}
      onPointerOver={onClick ? () => (document.body.style.cursor = 'pointer') : undefined}
      onPointerOut={onClick ? () => (document.body.style.cursor = '') : undefined}
    />
  );
}

export interface KitInstance {
  position: Vec3;
  /** Yaw (radians). */
  rotationY?: number;
  scale?: number | Vec3;
  /** Multiplies the vertex colours of this copy. */
  color?: ColorRepresentation;
}

export interface KitInstancesProps extends Omit<KitMaterialOptions, 'uniforms' | 'variant'> {
  geometry: BufferGeometry;
  items: readonly KitInstance[];
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/** Many copies of one kit geometry (trees, lamps, stools) in one draw call. */
export function KitInstances({ geometry, items, castShadow, receiveShadow, ...materialOptions }: KitInstancesProps) {
  const material = useKitMaterial(materialOptions);
  const ref = useRef<InstancedMesh>(null);
  const { tier, requestFrame } = useKit();
  const count = items.length;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const e = new Euler();
    const s = new Vector3();
    const p = new Vector3();
    const c = new Color();
    items.forEach((item, i) => {
      e.set(0, item.rotationY ?? 0, 0);
      q.setFromEuler(e);
      const sc = item.scale ?? 1;
      if (typeof sc === 'number') s.setScalar(sc);
      else s.set(sc[0], sc[1], sc[2]);
      p.set(...item.position);
      mesh.setMatrixAt(i, m.compose(p, q, s));
      if (item.color !== undefined || mesh.instanceColor) mesh.setColorAt(i, c.set(item.color ?? '#ffffff'));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    requestFrame();
  }, [items, requestFrame]);
  const shadows = tier === 'high';
  return (
    <instancedMesh
      // Remount when the count changes: InstancedMesh buffers are fixed-size.
      key={count}
      ref={ref}
      args={[geometry, material, Math.max(1, count)]}
      count={count}
      castShadow={shadows && (castShadow ?? true)}
      receiveShadow={shadows && (receiveShadow ?? false)}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------
// Blob shadow
// ---------------------------------------------------------------------------------------------------------

const blobResource = sharedResource(
  () => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(20,24,56,1)');
      g.addColorStop(0.45, 'rgba(20,24,56,0.6)');
      g.addColorStop(1, 'rgba(20,24,56,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    const texture = new CanvasTexture(canvas);
    const geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    return { texture, geometry };
  },
  ({ texture, geometry }) => {
    texture.dispose();
    geometry.dispose();
  },
);

export interface BlobShadowProps {
  position?: Vec3;
  /** Radius in metres (x and z); pass [rx, rz] for an oval. */
  radius?: number | [number, number];
  opacity?: number;
}

/** Soft contact shadow decal (one transparent quad). */
export function BlobShadow({ position = [0, 0, 0], radius = 0.5, opacity = 0.42 }: BlobShadowProps) {
  const { texture, geometry } = useShared(blobResource);
  const material = useMemo(
    () => new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, opacity, toneMapped: false }),
    [texture, opacity],
  );
  useEffect(() => () => material.dispose(), [material]);
  const [rx, rz] = typeof radius === 'number' ? [radius, radius] : radius;
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[position[0], position[1] + 0.015, position[2]]}
      scale={[rx * 2, 1, rz * 2]}
      renderOrder={-1}
      raycast={() => null}
    />
  );
}
