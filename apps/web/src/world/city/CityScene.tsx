// ShieldQuest City, the 3D City Hub (GAME_DESIGN.md §4.1-4.5, §7.3, §10.2, §14): a floating island city at blue hour round
// the Stillpoint clock tower (stuck at 11:59). District hex plates light up with trust (warm windows, rising
// lanterns) or frost over when dimmed; the Digi-District carries its glowing wireframe sky layer; two fogged
// expansion plates wait for new content; an MRT glides round the rim every 40 s over a softly lit bay.
// Projector extras: Room Freeze rain that hangs as glowing beads, and squad lanterns rising from towers round
// the Stillpoint. Budget: about 18 draw calls for the hub overview (merged plates, instanced props), well under
// the 40 allowed. All readable text and every decision stay in the DOM (the screens provide district buttons and
// mission lists; CityMap2D is the SVG twin).
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { LineBasicMaterial, type Group } from 'three';
import type { DistrictId } from '@shieldquest/shared';
import type { CitySceneProps, Lantern as SquadLantern } from '../contracts';
import type { QualityTier } from '../quality';
import { useSettings } from '../../state/settings';
import {
  AdaptiveCanvas,
  Freeze,
  KitInstances,
  KitMesh,
  Lanterns,
  Lighting,
  PALETTE,
  Rain,
  clamp,
  mixHex,
  useKit,
  useKitGeometry,
  type AdaptiveCanvasCamera,
  type Grade,
  type LanternItem,
} from '../kit';
import { CityMap2D } from '../flat/CityMap2D';
import {
  buildDigiSky,
  buildDistrict,
  buildFog,
  buildFrame,
  buildSea,
  buildTrain,
  cityLamp,
  scatter,
  squadTower,
  trainSpin,
  treeCone,
  treeRound,
} from './builders';
import { CAMERA_DISTANCE, type FrameMode } from './camera';
import { CityRig, type CityHover } from './CityRig';
import {
  CITY,
  DISTRICT_SPOTS,
  MAX_SQUAD_LANTERNS,
  describeCity,
  districtLanternCount,
  districtLanternSpot,
  pinLayout,
  pinRows,
  spotById,
  squadLanternCeiling,
  squadLanternSpot,
  squadTowerSpot,
  trustOf,
  type DistrictSpot,
} from './layout';
import { Pins, Ripples } from './Markers';
import './city.css';

const CAMERA: AdaptiveCanvasCamera = { position: [300, 500, 700], zoom: 2, near: 1, far: CAMERA_DISTANCE * 2 + 2000 };
const NO_SHADOW = { castShadow: false, receiveShadow: false } as const;

// ---------------------------------------------------------------------------------------------------------
// Ambient motion: idle animation (train, fog, sky layer, ripples, showcase orbit) asks for frames through a
// throttle, so an idle hub costs ~30 fps on Medium and ~20 on Low instead of a full-rate render loop.
// ---------------------------------------------------------------------------------------------------------

const AMBIENT_MS: Record<QualityTier, number> = { high: 0, medium: 33, low: 50 };

function useAmbient(on: boolean): () => void {
  const { tier, requestFrame } = useKit();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useCallback(() => {
    if (!on) return;
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
  }, [on, tier, requestFrame]);
  useEffect(() => {
    if (on) requestFrame();
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [on, requestFrame]);
  return tick;
}

/** Pauses idle animation while the city is scrolled out of view (home page hero). */
function useInView(ref: RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => setInView(entries.some((e) => e.isIntersecting)), { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return inView;
}

// ---------------------------------------------------------------------------------------------------------
// Static scenery
// ---------------------------------------------------------------------------------------------------------

export function Sea({ tier }: { tier: QualityTier }) {
  const geometry = useKitGeometry(() => buildSea(tier === 'low' ? 40 : 64), [tier]);
  return <KitMesh geometry={geometry} {...NO_SHADOW} />;
}

/** Stillpoint plaza and clock tower, viaduct bridges and the rim viaduct: one draw call. */
export function Frame({ tier }: { tier: QualityTier }) {
  const geometry = useKitGeometry(() => buildFrame(tier), [tier]);
  return <KitMesh geometry={geometry} {...NO_SHADOW} />;
}

export function DistrictPlate({ spot, trust, highlight }: { spot: DistrictSpot; trust: number; highlight: number }) {
  const geometry = useKitGeometry(() => buildDistrict(spot.id, trust), [spot.id, trust]);
  return <KitMesh geometry={geometry} position={[spot.x, 0, spot.z]} rotation={[0, spot.rotY, 0]} highlight={highlight} {...NO_SHADOW} />;
}

export function Greenery({ tier }: { tier: QualityTier }) {
  const spots = useMemo(() => scatter(tier), [tier]);
  const round = useKitGeometry(treeRound, []);
  const cone = useKitGeometry(treeCone, []);
  const lamp = useKitGeometry(cityLamp, []);
  return (
    <>
      <KitInstances geometry={round} items={spots.round} {...NO_SHADOW} />
      <KitInstances geometry={cone} items={spots.cone} {...NO_SHADOW} />
      <KitInstances geometry={lamp} items={spots.lamps} {...NO_SHADOW} />
    </>
  );
}

/** Translucent fog banks drifting over a "coming soon" plate. */
export function FogShroud({ spot, tier, still, onAnimate }: { spot: DistrictSpot; tier: QualityTier; still: boolean; onAnimate: () => void }) {
  const geometry = useKitGeometry(() => buildFog(spot.id, tier), [spot.id, tier]);
  const ref = useRef<Group>(null);
  const drift = !still && tier !== 'low';
  useFrame((state) => {
    const g = ref.current;
    if (!g || !drift) return;
    const t = state.clock.elapsedTime;
    g.rotation.y = spot.rotY + t * 0.025;
    g.position.y = Math.sin(t * 0.4 + spot.angle) * 0.6;
    onAnimate();
  });
  return (
    <group position={[spot.x, 0, spot.z]}>
      <group ref={ref} rotation={[0, spot.rotY, 0]}>
        <KitMesh geometry={geometry} transparent opacity={0.62} depthWrite={false} renderOrder={4} {...NO_SHADOW} />
      </group>
    </group>
  );
}

/** The Digi Sky layer (§4.1): glowing wireframe blocks, chat bubbles and booth lanterns floating over Digi-District. */
export function DigiSky({ tier, still, onAnimate }: { tier: QualityTier; still: boolean; onAnimate: () => void }) {
  const spot = spotById('digi-district');
  const sky = useMemo(() => {
    const built = buildDigiSky(tier);
    built.lines.setAttribute('color', built.lines.getAttribute('aColor'));
    return built;
  }, [tier]);
  useEffect(
    () => () => {
      sky.fill.dispose();
      sky.lines.dispose();
    },
    [sky],
  );
  const lineMaterial = useMemo(
    () => new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.88, fog: false, toneMapped: false }),
    [],
  );
  useEffect(() => () => lineMaterial.dispose(), [lineMaterial]);
  const ref = useRef<Group>(null);
  useFrame((state) => {
    const g = ref.current;
    if (!g || still) return;
    g.position.y = Math.sin(state.clock.elapsedTime * 0.55) * 0.7;
    onAnimate();
  });
  return (
    <group position={[spot.x, 0, spot.z]} rotation={[0, spot.rotY, 0]}>
      <group ref={ref}>
        <KitMesh geometry={sky.fill} transparent opacity={0.9} depthWrite={false} glowBoost={1.15} renderOrder={6} {...NO_SHADOW} />
        <lineSegments geometry={sky.lines} material={lineMaterial} renderOrder={7} raycast={() => null} />
      </group>
    </group>
  );
}

/** The MRT gliding round the rim, one lap per 40 s (parked under reduced motion). */
export function Train({ still, onAnimate }: { still: boolean; onAnimate: () => void }) {
  const geometry = useKitGeometry(buildTrain, []);
  const ref = useRef<Group>(null);
  useFrame((state) => {
    const g = ref.current;
    if (!g || still) return;
    g.rotation.y = trainSpin(state.clock.elapsedTime);
    onAnimate();
  });
  return (
    <group ref={ref} rotation={[0, trainSpin(CITY.trainPeriod * 0.62), 0]}>
      <KitMesh geometry={geometry} {...NO_SHADOW} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Lanterns: district trust (hub) and squad towers (projector)
// ---------------------------------------------------------------------------------------------------------

const LANTERN_RISE = { from: 10, duration: 2.6 };

function DistrictLanterns({ trust, bob }: { trust: Record<string, number>; bob: boolean }) {
  // Keyed by the trust values, not the object, so an unchanged map never re-lays the lanterns.
  const key = DISTRICT_SPOTS.map((s) => trustOf(trust, s.id)).join(',');
  const items = useMemo<LanternItem[]>(() => {
    const levels = key.split(',').map(Number);
    return DISTRICT_SPOTS.flatMap((spot, i) =>
      spot.fogged
        ? []
        : Array.from({ length: districtLanternCount(levels[i] ?? 0) }, (_, k) => ({
            position: districtLanternSpot(spot, k),
            color: mixHex(PALETTE.gold, spot.color, 0.22),
            scale: 5.5,
          })),
    );
  }, [key]);
  if (items.length === 0) return null;
  return <Lanterns items={items} rise={LANTERN_RISE} bob={bob} />;
}

function SquadTowers({ lanterns, bob }: { lanterns: readonly SquadLantern[]; bob: boolean }) {
  const tower = useKitGeometry(squadTower, []);
  const n = lanterns.length;
  const towers = useMemo(
    () => lanterns.map((l, i) => ({ position: squadTowerSpot(i, n), color: l.color })),
    [lanterns, n],
  );
  return (
    <>
      <KitInstances geometry={tower} items={towers} warm {...NO_SHADOW} />
      {lanterns.map((l, i) => (
        <SquadLanternStack key={l.squadId} tower={towers[i]!.position} color={l.color} count={l.count} bob={bob} />
      ))}
    </>
  );
}

/** One squad's lanterns: their own instanced draw so only the newly sealed ones rise (§14 "Lanterns rise"). */
function SquadLanternStack({ tower, color, count, bob }: { tower: [number, number, number]; color: string; count: number; bob: boolean }) {
  const shown = Math.max(0, Math.min(MAX_SQUAD_LANTERNS, Math.floor(count)));
  const [tx, ty, tz] = tower;
  const items = useMemo<LanternItem[]>(
    () => Array.from({ length: shown }, (_, k) => ({ position: squadLanternSpot([tx, ty, tz], k), color, scale: 4.4 })),
    [shown, tx, ty, tz, color],
  );
  if (items.length === 0) return null;
  return <Lanterns items={items} rise={{ from: 9, duration: 2.4 }} stagger={0.12} bob={bob} />;
}

/** Room Freeze rain over the whole city (scaled up so drops read at city scale). */
const RAIN_SCALE = 7;
function CityRain({ amount }: { amount: number }) {
  const span = (CITY.rim * 2 + 16) / RAIN_SCALE;
  return (
    <group scale={RAIN_SCALE}>
      <Rain
        freezeAmount={amount}
        area={[span, 66 / RAIN_SCALE, span]}
        position={[0, CITY.sea / RAIN_SCALE, 0]}
        speed={7.5}
        wind={0.1}
        seed="lumen-room-freeze"
      />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------
// The world inside the canvas
// ---------------------------------------------------------------------------------------------------------

interface CityWorldProps extends CitySceneProps {
  grade: Grade;
  interactive: boolean;
  /** On screen (idle animation runs only while visible). */
  active: boolean;
  /** Called once, on the first rendered frame (the canvas fades in then). */
  onReady: () => void;
}

/** Fires `onReady` on the first frame the city renders. */
function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    onReady();
  });
  return null;
}

function CityWorld({
  focus,
  districtTrust,
  markers,
  onSelectDistrict,
  onSelectMission,
  freezeAmount,
  lanterns,
  showcase = false,
  grade,
  interactive,
  active,
  onReady,
}: CityWorldProps) {
  const { tier, reducedMotion } = useKit();
  const still = reducedMotion || !active;
  const ambient = useAmbient(!still);
  const [hover, setHover] = useState<CityHover | null>(null);
  const pins = useMemo(() => pinLayout(markers, focus), [markers, focus]);
  const rows = useMemo(() => pinRows(markers, focus), [markers, focus]);
  const mode: FrameMode = focus ? 'focus' : interactive ? 'overview' : 'decorative';
  const hoverDistrict: DistrictId | null = hover ? (hover.kind === 'district' ? hover.id : hover.district) : null;
  const hoverPin = hover?.kind === 'pin' ? hover.missionId : null;
  const fogged = DISTRICT_SPOTS.filter((s) => s.fogged);
  const bob = tier === 'high' && !still;
  const ceiling = useMemo(() => squadLanternCeiling((lanterns ?? []).map((l) => l.count)), [lanterns]);

  return (
    <>
      <FirstFrame onReady={onReady} />
      <Lighting grade={grade} timeOfDay="evening" fog={{ near: CAMERA_DISTANCE + 40, far: CAMERA_DISTANCE + 480 }} />
      <Freeze amount={clamp(freezeAmount ?? 0)} durationMs={700} />
      <CityRig
        focus={focus}
        mode={mode}
        pins={pins}
        pinRows={rows}
        showcase={showcase}
        interactive={interactive}
        onSelectDistrict={onSelectDistrict}
        onSelectMission={onSelectMission}
        onHover={setHover}
        onAnimate={ambient}
        ceiling={ceiling}
      />
      <Sea tier={tier} />
      <Frame tier={tier} />
      {DISTRICT_SPOTS.map((spot) => (
        <DistrictPlate
          key={spot.id}
          spot={spot}
          trust={trustOf(districtTrust, spot.id)}
          highlight={hoverDistrict === spot.id ? 0.75 : focus === spot.id ? 0.28 : 0}
        />
      ))}
      <Greenery tier={tier} />
      <DigiSky tier={tier} still={still} onAnimate={ambient} />
      {fogged.map((spot) => (
        <FogShroud key={spot.id} spot={spot} tier={tier} still={still} onAnimate={ambient} />
      ))}
      {tier !== 'low' && <Train still={still} onAnimate={ambient} />}
      <DistrictLanterns trust={districtTrust} bob={bob} />
      {lanterns && lanterns.length > 0 && <SquadTowers lanterns={lanterns} bob={!still && tier !== 'low'} />}
      <Ripples markers={markers} onAnimate={ambient} still={still} />
      <Pins pins={pins} hover={hoverPin} onAnimate={ambient} still={still} />
      {freezeAmount !== undefined && <CityRain amount={clamp(freezeAmount)} />}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------------------------------------

/**
 * The 3D city. Fills its parent (give the parent a size). Interactive (drag to spin, tap districts and pins)
 * when `onSelectDistrict` or `onSelectMission` is given; otherwise decorative and scroll-friendly.
 */
export default function CityScene(props: CitySceneProps) {
  const { quality, focus, districtTrust, markers, freezeAmount, lanterns, onSelectDistrict, onSelectMission } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const inView = useInView(wrap);
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  const band = useSettings((s) => s.band);
  // Freeze or lanterns mean the Big Screen: the projector grade. Juniors get the friendlier Daylight grade.
  const projector = freezeAmount !== undefined || lanterns !== undefined;
  const grade: Grade = projector ? 'bright-room' : band === 'junior' ? 'daylight' : 'blue-hour';
  const interactive = Boolean(onSelectDistrict || onSelectMission);
  const label = useMemo(
    () => describeCity({ focus, districtTrust, markers, freezeAmount, lanterns }),
    [focus, districtTrust, markers, freezeAmount, lanterns],
  );
  const flatProps: Omit<CitySceneProps, 'quality'> = {
    focus,
    districtTrust,
    markers,
    onSelectDistrict,
    onSelectMission,
    freezeAmount,
    lanterns,
    showcase: props.showcase,
  };

  return (
    <div
      ref={wrap}
      className={`w-city${interactive ? ' w-city--interactive' : ' w-city--decorative'}`}
      data-grade={grade}
      data-ready={ready ? 'true' : undefined}
    >
      <AdaptiveCanvas
        quality={quality}
        ariaLabel={label}
        orthographic
        camera={CAMERA}
        fallback={<CityMap2D {...flatProps} />}
        onFallback2D={markReady}
      >
        <CityWorld {...props} grade={grade} interactive={interactive} active={inView} onReady={markReady} />
      </AdaptiveCanvas>
      {interactive && !ready && (
        <p className="w-city__loading" role="status">
          Drawing the city…
        </p>
      )}
    </div>
  );
}
