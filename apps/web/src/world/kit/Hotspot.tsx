// <Hotspot>: an interactive clue marker (GAME_DESIGN.md §4.2). Billboarded icon whose SHAPE carries the state
// (dotted ring + magnifier / jagged hatched burst / rounded shield), a pulsing ring while available, and a real
// focusable <button> in the canvas's DOM overlay, so keyboard and screen-reader players can use it. The marker
// never shrinks below a tappable size on screen. Reduced motion: no pulse, no pop.
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  MeshBasicMaterial,
  RingGeometry,
  Vector3,
  type Group,
  type Mesh,
  type OrthographicCamera,
  type PerspectiveCamera,
} from 'three';
import type { HotspotState } from '../contracts';
import { useKit } from './context';
import { iconAtlas } from './icons';
import { damp, easeOutBack, type Vec3 } from './math';
import { sharedResource, useShared } from './motion';
import { PALETTE } from './uniforms';

export interface HotspotProps {
  /** World position of the marker centre (anchor position + hotspotOffset). */
  position: Vec3;
  state: HotspotState;
  /** Plain-language name, e.g. "Notice board" (AnchorSpot.label). Used for the button's accessible name. */
  label: string;
  /** Called on tap, click, Enter or Space. */
  onSelect?: () => void;
  /** World size of the marker (m). Default 0.5. */
  size?: number;
  /** Minimum on-screen size in CSS pixels (tap target). Default 44. */
  minPixels?: number;
  /** Accepts taps (true while time is held). Default true. */
  interactive?: boolean;
  /** Renders a focusable DOM button over the marker. Default true; turn off only if the screen lists clues itself. */
  domButton?: boolean;
  /** Draws over scenery so a clue is never hidden behind a prop. Default true. */
  alwaysOnTop?: boolean;
}

const ringResource = sharedResource(
  () => new RingGeometry(0.5, 0.58, 40),
  (g) => g.dispose(),
);

const PULSE_S = 1.4;
const _v = new Vector3();

function stateLabel(state: HotspotState, label: string): string {
  if (state === 'found-flag') return `${label}: flagged as a warning sign`;
  if (state === 'found-ok') return `${label}: checked, looks safe`;
  return `Inspect ${label}`;
}

/** Clue marker. Place it at `anchor.position + (anchor.hotspotOffset ?? [0, 1.6, 0])`. */
export function Hotspot({
  position,
  state,
  label,
  onSelect,
  size = 0.5,
  minPixels = 44,
  interactive = true,
  domButton = true,
  alwaysOnTop = true,
}: HotspotProps) {
  const { reducedMotion, requestFrame, overlay } = useKit();
  const atlas = useShared(iconAtlas);
  const ring = useShared(ringResource);
  const camera = useThree((s) => s.camera);
  const viewport = useThree((s) => s.size);
  const group = useRef<Group>(null);
  const pulse = useRef<Mesh>(null);
  const [hot, setHot] = useState(false);
  const anim = useRef({ scale: 1, pop: 1, last: state });

  const iconMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        map: atlas.texture,
        transparent: true,
        depthTest: !alwaysOnTop,
        depthWrite: false,
        toneMapped: false,
        fog: false,
        alphaTest: 0.02,
      }),
    [atlas.texture, alwaysOnTop],
  );
  const ringMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: PALETTE.attention,
        transparent: true,
        depthTest: !alwaysOnTop,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    [alwaysOnTop],
  );
  useEffect(
    () => () => {
      iconMaterial.dispose();
      ringMaterial.dispose();
    },
    [iconMaterial, ringMaterial],
  );

  // A state change pops the marker (a found clue "lands").
  useEffect(() => {
    const a = anim.current;
    if (a.last !== state && state !== 'hidden' && state !== 'available' && !reducedMotion) a.pop = 0;
    a.last = state;
    requestFrame();
  }, [state, reducedMotion, requestFrame]);

  useEffect(() => {
    requestFrame();
  }, [hot, position, requestFrame]);

  useFrame((frame, delta) => {
    const g = group.current;
    if (!g) return;
    g.quaternion.copy(camera.quaternion);
    // Keep at least `minPixels` on screen.
    const dist = Math.max(0.001, camera.position.distanceTo(g.getWorldPosition(_v)));
    const perspective = (camera as PerspectiveCamera).isPerspectiveCamera;
    const pxPerUnit = perspective
      ? viewport.height / (2 * dist * Math.tan(((camera as PerspectiveCamera).fov * Math.PI) / 360))
      : (camera as OrthographicCamera).zoom;
    const fit = Math.max(1, minPixels / Math.max(1e-3, size * pxPerUnit));
    const a = anim.current;
    let busy = false;
    const target = hot && interactive ? 1.18 : 1;
    if (reducedMotion) a.scale = target;
    else if (Math.abs(a.scale - target) > 1e-3) {
      a.scale += (target - a.scale) * damp(14, delta);
      busy = true;
    }
    if (a.pop < 1) {
      a.pop = Math.min(1, a.pop + delta / 0.38);
      busy = true;
    }
    const pop = a.pop < 1 ? 0.6 + 0.4 * easeOutBack(a.pop) : 1;
    g.scale.setScalar(size * fit * a.scale * pop);
    const p = pulse.current;
    if (p) {
      if (reducedMotion) {
        p.scale.setScalar(1.12);
        ringMaterial.opacity = 0.55;
      } else {
        const k = (frame.clock.elapsedTime % PULSE_S) / PULSE_S;
        p.scale.setScalar(1 + k * 0.55);
        ringMaterial.opacity = 0.85 * (1 - k) * (1 - k);
        busy = true;
      }
    }
    if (busy) requestFrame();
  });

  if (state === 'hidden') return null;
  const select = interactive && onSelect ? onSelect : undefined;
  const handleClick = select
    ? (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        select();
      }
    : undefined;

  return (
    <group position={position}>
      <group ref={group}>
        <mesh
          geometry={atlas.planes[state]}
          material={iconMaterial}
          renderOrder={alwaysOnTop ? 20 : 0}
          onClick={handleClick}
          onPointerOver={select ? () => setHot(true) : undefined}
          onPointerOut={select ? () => setHot(false) : undefined}
        />
        {state === 'available' && (
          <mesh ref={pulse} geometry={ring} material={ringMaterial} renderOrder={alwaysOnTop ? 19 : 0} raycast={() => null} />
        )}
      </group>
      {domButton && select && (
        <Html
          portal={(overlay ?? undefined) as RefObject<HTMLElement> | undefined}
          center
          zIndexRange={[40, 0]}
          pointerEvents="auto"
        >
          <button
            type="button"
            className="w-hotspot-btn"
            aria-label={stateLabel(state, label)}
            onClick={(e) => {
              e.stopPropagation();
              select();
            }}
            onFocus={() => setHot(true)}
            onBlur={() => setHot(false)}
            onPointerEnter={() => setHot(true)}
            onPointerLeave={() => setHot(false)}
          />
        </Html>
      )}
    </group>
  );
}

export default Hotspot;
