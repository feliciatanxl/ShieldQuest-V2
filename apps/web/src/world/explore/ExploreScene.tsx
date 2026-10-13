// Explore mode in 3D: walk round ShieldQuest City (the same diorama as the hub) as a small bean in your colour,
// with a third-person camera that follows smoothly (no head bob; cuts instead of easing under reduced motion).
// All readable text and every action live in the DOM (ExplorePage); this view only draws and reports what
// you are near. Budget: about 25 draw calls (merged plates and props, instanced trees and shards).
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Euler,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PerspectiveCamera,
  Plane,
  Quaternion,
  Raycaster,
  RingGeometry,
  Vector2,
  Vector3,
  type Group,
  type Mesh,
} from 'three';
import type { QualityTier } from '../quality';
import { AdaptiveCanvas, Bean, KitMesh, Lighting, PALETTE, damp, mixHex, useKit, useKitGeometry, useKitMaterial, type Grade } from '../kit';
import type { BeanLook } from '../kit/beanGeometry';
import { scatter } from '../city/builders';
import { DISTRICT_SPOTS, trustOf } from '../city/layout';
import { DigiSky, DistrictPlate, FogShroud, Frame, Greenery, Sea, Train } from '../city/CityScene';
import { inputOf, type ExploreController } from './controller';
import { EXPLORE_WORLD, PLACES, SHARDS, TOWNIE_PLACES, withObstacles, type AreaId, type ExploreWorld, type Obstacle } from './exploreMap';
import {
  CAMERA,
  PICKUP_RADIUS,
  PROMPT_RADIUS,
  areaAt,
  cameraDistance,
  clearYaw,
  findPath,
  hitsObstacle,
  nearestClear,
  nearestPlace,
  pushOut,
  tickWalker,
} from './movement';
import { buildExploreProps, buildShard } from './props';

export interface ExploreSceneProps {
  quality: QualityTier;
  controller: ExploreController;
  /** Body colour of the player's bean (equipped Colour cosmetic). */
  playerColor: string;
  /** Shards already found today (not drawn, not collectable). */
  hiddenShards: readonly string[];
  /** Place whose prompt is open (gold ring, townie turns to you). */
  active: string | null;
  districtTrust: Record<string, number>;
  grade: Grade;
  ariaLabel: string;
  onNear: (placeId: string | null) => void;
  onShard: (shardId: string) => void;
  onArea: (area: AreaId | null) => void;
  /** WebGL unavailable or lost twice: switch to the 2D explore map. */
  onFallback2D: () => void;
  fallback: ReactNode;
}

const NO_SHADOW = { castShadow: false, receiveShadow: false } as const;
const PLAYER_SCALE = 1.25;
const TOWNIE_SCALE = 1.2;
const CAMERA_START = { position: [0, 8, 20] as [number, number, number], fov: 55, near: 0.3, far: 900 };
const AMBIENT_MS: Record<QualityTier, number> = { high: 0, medium: 33, low: 50 };
const PROMPT_PLACES = PLACES.filter((p) => p.kind !== 'shard');

/** Tree trunks and lamp posts at the current tier, as obstacles (low tier draws fewer trees). */
function sceneryObstacles(tier: QualityTier): Obstacle[] {
  const s = scatter(tier);
  const out: Obstacle[] = [];
  for (const t of s.round) {
    const sc = typeof t.scale === 'number' ? t.scale : 1;
    out.push({ kind: 'circle', x: t.position[0], z: t.position[2], r: 0.42 * sc, h: 7 * sc, canopy: { r: 2.6 * sc, y0: 2 * sc } });
  }
  for (const t of s.cone) {
    const sc = typeof t.scale === 'number' ? t.scale : 1;
    out.push({ kind: 'circle', x: t.position[0], z: t.position[2], r: 0.42 * sc, h: 8.5 * sc, canopy: { r: 1.9 * sc, y0: 1.8 * sc } });
  }
  for (const l of s.lamps) out.push({ kind: 'circle', x: l.position[0], z: l.position[2], r: 0.22, h: 6 });
  return out;
}

/** Idle animation (spinning shards, drifting fog) asks for frames through a throttle: ~30 fps when nobody moves. */
function useAmbient(): () => void {
  const { tier, requestFrame } = useKit();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  return useCallback(() => {
    const wait = AMBIENT_MS[tier];
    if (wait === 0) {
      requestFrame();
      return;
    }
    if (timer.current !== null) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      requestFrame();
    }, wait);
  }, [tier, requestFrame]);
}

// ---------------------------------------------------------------------------------------------------------
// Shards (instanced, gently spinning) and props
// ---------------------------------------------------------------------------------------------------------

function Shards({ hidden, still, onAnimate }: { hidden: readonly string[]; still: boolean; onAnimate: () => void }) {
  const geometry = useKitGeometry(buildShard, []);
  const material = useKitMaterial({ warm: true, glowBoost: 1.2 });
  const ref = useRef<InstancedMesh>(null);
  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), e: new Euler(), p: new Vector3(), s: new Vector3() }), []);
  const { requestFrame } = useKit();
  const write = useCallback(
    (time: number) => {
      const mesh = ref.current;
      if (!mesh) return;
      SHARDS.forEach((shard, i) => {
        const gone = hiddenSet.has(shard.id);
        tmp.e.set(0, still ? i * 0.7 : time * 1.3 + i * 0.7, 0);
        tmp.q.setFromEuler(tmp.e);
        tmp.p.set(shard.x, 1.15 + (still ? 0 : Math.sin(time * 1.8 + i) * 0.12), shard.z);
        tmp.s.setScalar(gone ? 0 : 1);
        mesh.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    [hiddenSet, still, tmp],
  );
  useEffect(() => {
    write(0);
    ref.current?.computeBoundingSphere();
    requestFrame();
  }, [write, requestFrame]);
  useFrame((state) => {
    if (still) return;
    write(state.clock.elapsedTime);
    if (hiddenSet.size < SHARDS.length) onAnimate();
  });
  return <instancedMesh ref={ref} args={[geometry, material, SHARDS.length]} frustumCulled={false} raycast={() => null} />;
}

function Props() {
  const geometry = useKitGeometry(buildExploreProps, []);
  return <KitMesh geometry={geometry} warm {...NO_SHADOW} />;
}

const ringMaterial = (color: string, opacity: number) =>
  new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, fog: false });

// ---------------------------------------------------------------------------------------------------------
// The player, camera and proximity: one frame loop over the shared controller
// ---------------------------------------------------------------------------------------------------------

interface DriverProps {
  controller: ExploreController;
  world: ExploreWorld;
  look: BeanLook;
  hidden: readonly string[];
  onNear: (id: string | null) => void;
  onShard: (id: string) => void;
  onArea: (area: AreaId | null) => void;
  onAnimate: () => void;
}

function Driver({ controller, world, look, hidden, onNear, onShard, onArea, onAnimate }: DriverProps) {
  const { reducedMotion, requestFrame } = useKit();
  const camera = useThree((s) => s.camera);
  // Tall phone screens: shift the view so the player sits above the prompt card and joystick.
  const size = useThree((s) => s.size);
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const { width: w, height: h } = size;
    if (h > w * 1.25) camera.setViewOffset(w, h, 0, h * 0.12, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    requestFrame();
  }, [camera, size, requestFrame]);
  const player = useRef<Group>(null);
  const marker = useRef<Mesh>(null);
  const [walking, setWalking] = useState(false);
  const walkingRef = useRef(false);
  const near = useRef<string | null>(null);
  const area = useRef<AreaId | null | undefined>(undefined);
  const cam = useRef({ ready: false, dist: CAMERA.distance as number, look: new Vector3() });
  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const callbacks = useRef({ onNear, onShard, onArea });
  callbacks.current = { onNear, onShard, onArea };
  const markerGeo = useMemo(() => new RingGeometry(0.35, 0.55, 28).rotateX(-Math.PI / 2), []);
  const markerMat = useMemo(() => ringMaterial('#ffffff', 0.85), []);
  useEffect(
    () => () => {
      markerGeo.dispose();
      markerMat.dispose();
    },
    [markerGeo, markerMat],
  );

  // Tap-to-walk and wake-up hooks for the DOM.
  useEffect(() => {
    const ray = new Raycaster();
    const ground = new Plane(new Vector3(0, 1, 0), 0);
    const hit = new Vector3();
    const ndc = new Vector2();
    controller.tapTo = (nx, ny) => {
      ndc.set(nx, ny);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(ground, hit)) return false;
      const goal = nearestClear(world, hit.x, hit.z, 2.5);
      if (!goal) return false;
      const path = findPath(world, { x: controller.x, z: controller.z }, goal);
      if (!path) return false;
      controller.path = path;
      controller.stuck = 0;
      requestFrame();
      return true;
    };
    controller.wake = requestFrame;
    // Build the route graph while the player looks around, not on the first tap.
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const warm = () => findPath(world, { x: controller.x, z: controller.z }, { x: 0, z: 9.5 });
    const handle = idle ? idle(warm) : window.setTimeout(warm, 400);
    return () => {
      controller.tapTo = null;
      controller.wake = null;
      if (!idle) window.clearTimeout(handle);
    };
  }, [controller, camera, world, requestFrame]);

  const eye = CAMERA.eye;
  useFrame((_, delta) => {
    const c = controller;
    const dt = Math.min(Math.max(delta, 0), 0.1);
    if (c.snap) {
      if (hitsObstacle(world, c.x, c.z)) {
        const p = pushOut(world, c.x, c.z);
        c.x = p.x;
        c.z = p.z;
      }
      // After a jump, turn the camera to the nearest angle with a clear view of you.
      c.yaw = clearYaw(world, c.x, c.z, c.yaw, eye);
    }
    // E turns the view right (camera orbits clockwise seen from above), Q left.
    if (c.turn !== 0) c.yaw -= c.turn * 1.9 * dt;
    const moved = tickWalker(world, c, inputOf(c), dt, reducedMotion);
    const isWalking = moved > 0.002;
    if (isWalking !== walkingRef.current) {
      walkingRef.current = isWalking;
      setWalking(isWalking);
    }
    const g = player.current;
    if (g) {
      g.position.set(c.x, 0, c.z);
      g.rotation.y = c.heading;
    }
    const m = marker.current;
    if (m) {
      const goal = c.path[c.path.length - 1];
      m.visible = Boolean(goal);
      if (goal) m.position.set(goal.x, 0.06, goal.z);
    }

    // Camera: follow point eases after the player (cut when reduced or snapping); yaw is the player's own.
    const k = cam.current;
    const want = cameraDistance(world, c.x, c.z, c.yaw, CAMERA.distance, eye);
    const cut = !k.ready || c.snap || reducedMotion;
    if (cut) k.dist = want;
    else k.dist += (want - k.dist) * damp(want < k.dist ? 14 : 2.5, dt);
    const lookX = c.x;
    const lookY = eye;
    const lookZ = c.z;
    if (cut) k.look.set(lookX, lookY, lookZ);
    else {
      const f = damp(9, dt);
      k.look.x += (lookX - k.look.x) * f;
      k.look.y = lookY;
      k.look.z += (lookZ - k.look.z) * f;
    }
    const cosP = Math.cos(CAMERA.pitch);
    camera.position.set(
      k.look.x + Math.sin(c.yaw) * cosP * k.dist,
      k.look.y + Math.sin(CAMERA.pitch) * k.dist,
      k.look.z + Math.cos(c.yaw) * cosP * k.dist,
    );
    camera.lookAt(k.look);
    const settling = Math.abs(want - k.dist) > 0.02 || Math.hypot(lookX - k.look.x, lookZ - k.look.z) > 0.01;
    k.ready = true;
    c.snap = false;

    // What is near: prompts, shard pick-ups, area changes.
    const place = nearestPlace(PROMPT_PLACES, c.x, c.z, PROMPT_RADIUS);
    const id = place?.id ?? null;
    if (id !== near.current) {
      near.current = id;
      callbacks.current.onNear(id);
    }
    for (const s of SHARDS) {
      if (hiddenSet.has(s.id)) continue;
      if (Math.hypot(s.x - c.x, s.z - c.z) <= PICKUP_RADIUS) {
        hiddenSet.add(s.id);
        callbacks.current.onShard(s.id);
      }
    }
    const a = areaAt(world, c.x, c.z);
    if (a !== area.current) {
      area.current = a;
      callbacks.current.onArea(a);
    }

    const input = inputOf(c);
    const busy = isWalking || c.path.length > 0 || c.turn !== 0 || Math.hypot(input.x, input.y) > 0.08 || settling;
    if (busy) requestFrame();
    else onAnimate();
  });

  return (
    <>
      <group ref={player}>
        <Bean look={look} pose={walking ? 'walk' : 'stand'} scale={PLAYER_SCALE} seed="explore-player" warm />
      </group>
      <mesh ref={marker} geometry={markerGeo} material={markerMat} visible={false} renderOrder={3} raycast={() => null} />
    </>
  );
}

/** Gold ring under the place whose prompt is open. */
function ActiveRing({ active }: { active: string | null }) {
  const geo = useMemo(() => new RingGeometry(1.45, 1.7, 40).rotateX(-Math.PI / 2), []);
  const mat = useMemo(() => ringMaterial(PALETTE.gold, 0.9), []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  const place = active ? PLACES.find((p) => p.id === active) : undefined;
  if (!place) return null;
  return <mesh geometry={geo} material={mat} position={[place.x, 0.05, place.z]} renderOrder={3} raycast={() => null} />;
}

function Townies({ active, controller }: { active: string | null; controller: ExploreController }) {
  return (
    <>
      {TOWNIE_PLACES.map((t) => {
        const on = active === t.id;
        return (
          <Bean
            key={t.id}
            look={t.look}
            seed={t.id}
            position={[t.x, 0, t.z]}
            facing={t.facing}
            scale={TOWNIE_SCALE}
            highlighted={on}
            expression={on ? 'happy' : 'neutral'}
            lookAt={on ? [controller.x, 1.4, controller.z] : null}
            warm
          />
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------
// The world inside the canvas
// ---------------------------------------------------------------------------------------------------------

const ExploreWorld3D = memo(function ExploreWorld3D(props: Omit<ExploreSceneProps, 'quality' | 'ariaLabel' | 'onFallback2D' | 'fallback'>) {
  const { controller, playerColor, hiddenShards, active, districtTrust, grade, onNear, onShard, onArea } = props;
  const { tier, reducedMotion } = useKit();
  const ambient = useAmbient();
  const world = useMemo(() => withObstacles(EXPLORE_WORLD, sceneryObstacles(tier)), [tier]);
  const look = useMemo<BeanLook>(
    () => ({ body: playerColor, accent: mixHex(playerColor, '#1d2440', 0.55), hair: 'short', outfit: 'casual', skin: '#d9a077' }),
    [playerColor],
  );
  return (
    <>
      <Lighting grade={grade} timeOfDay="evening" fog={{ near: 45, far: 190 }} background />
      <Sea tier={tier} />
      <Frame tier={tier} />
      {DISTRICT_SPOTS.map((spot) => (
        <DistrictPlate key={spot.id} spot={spot} trust={trustOf(districtTrust, spot.id)} highlight={0} />
      ))}
      <Greenery tier={tier} />
      <DigiSky tier={tier} still={reducedMotion} onAnimate={ambient} />
      {DISTRICT_SPOTS.filter((s) => s.fogged).map((spot) => (
        <FogShroud key={spot.id} spot={spot} tier={tier} still={reducedMotion} onAnimate={ambient} />
      ))}
      {tier !== 'low' && <Train still={reducedMotion} onAnimate={ambient} />}
      <Props />
      <Shards hidden={hiddenShards} still={reducedMotion} onAnimate={ambient} />
      <ActiveRing active={active} />
      <Townies active={active} controller={controller} />
      <Driver
        controller={controller}
        world={world}
        look={look}
        hidden={hiddenShards}
        onNear={onNear}
        onShard={onShard}
        onArea={onArea}
        onAnimate={ambient}
      />
    </>
  );
});

/** Calls `onReady` on the first rendered frame. */
function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    onReady();
  });
  return null;
}

/** The 3D walk-around. Fills its parent (give the parent a size). */
export default function ExploreScene({ quality, ariaLabel, onFallback2D, fallback, ...rest }: ExploreSceneProps) {
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  return (
    <>
      <AdaptiveCanvas quality={quality} ariaLabel={ariaLabel} camera={CAMERA_START} fallback={fallback} onFallback2D={onFallback2D} className="ex-canvas">
        <FirstFrame onReady={markReady} />
        <ExploreWorld3D {...rest} />
      </AdaptiveCanvas>
      {!ready && (
        <p className="ex-loading ex-loading--text" role="status">
          Building the city…
        </p>
      )}
    </>
  );
}
