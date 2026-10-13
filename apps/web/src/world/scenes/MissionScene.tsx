// The 3D mission scene (GAME_DESIGN.md §4.2-4.5): one code-built set, the cast as beans, clue hotspots, rain
// that hangs in the air when time is held, the director camera, and the influence string to a faceless figure
// in a lit window. Screens own all state and readable text (world/contracts.ts); this only draws, reports taps
// and keeps a DOM twin of everything interactive (hotspot buttons, camera controls, sign text).
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Vector3 } from 'three';
import { prefersReducedMotion, useSettings } from '../../state/settings';
import type { MissionSceneProps } from '../contracts';
import { QUALITY_BUDGET } from '../quality';
import { MissionScene2D } from '../flat/MissionScene2D';
import {
  AdaptiveCanvas,
  Bean,
  Faceless,
  Freeze,
  GeoBuilder,
  Hotspot,
  KitInstances,
  Lighting,
  Rain,
  Thread,
  useKitGeometry,
  type KitInstance,
} from '../kit';
import { aspectFit, distance, pressureAt } from './core/camera';
import { CameraRig, type RigApi } from './core/CameraRig';
import { castExpression, castPose, placeCast, tacticCounts, threadBeads, type CastPlacement } from './core/cast';
import { describeScene } from './core/describe';
import {
  chestOf,
  directorFocus,
  gazeTargets,
  influenceSpot,
  pendingCards,
  phoneOf,
  placeHotspots,
  rainIntensity,
  threadEnds,
} from './core/director';
import { stagingOf, type RainZone, type SetStaging, type Vec3, type WorldLabel } from './core/staging';
import { SETS, type SetPiece } from './sets';
import './core/scene.css';

const DEFAULT_RAIN: RainZone = { position: [0, 0, 0], area: [18, 10, 14] };
const DEFAULT_RAIN_VOLUME = 18 * 10 * 14;

/**
 * Drops for a rain zone: the tier's particle budget scaled by the zone's volume, so a narrow strip of rain in
 * front of a shelter is as dense as open-air rain (and frozen beads never wall off the scene).
 */
function rainCount(tier: MissionSceneProps['quality'], zone: RainZone): number {
  const volume = zone.area[0] * zone.area[1] * zone.area[2];
  return Math.round(QUALITY_BUDGET[tier].particles * Math.min(1, Math.max(0.2, volume / DEFAULT_RAIN_VOLUME)));
}

interface StageProps {
  scene: MissionSceneProps;
  set: SetPiece;
  staging: SetStaging;
  placements: CastPlacement[];
  railMode: boolean;
  pending: number;
  apiRef: MutableRefObject<RigApi | null>;
  labelEls: MutableRefObject<(HTMLSpanElement | null)[]>;
  onRail: (index: number, count: number) => void;
  onOffCentre: (off: boolean) => void;
}

/** Lighting with fog fitted to the stage (narrow stages pull the camera back, so the fog moves back too). */
function SceneLighting({ set, scene, railMode }: { set: SetPiece; scene: MissionSceneProps; railMode: boolean }) {
  const [fit, setFit] = useState(1);
  useFrame(({ size }) => {
    const next = Math.round(aspectFit(size.width / Math.max(1, size.height)) * 20) / 20;
    if (next !== fit) setFit(next);
  });
  const d = distance(set.camera.live.position, set.camera.live.target) * fit;
  const fog = useMemo(() => ({ near: d * 1.1, far: d * 1.1 + 60 }), [d]);
  return (
    <Lighting
      grade={railMode ? 'daylight' : 'blue-hour'}
      timeOfDay={scene.mission.timeOfDay}
      mood={scene.mood}
      fog={fog}
      target={set.camera.orbit.target}
      shadowExtent={Math.min(18, Math.max(6, d * 0.55))}
    />
  );
}

/** Positions the DOM sign labels over their 3D anchors on every rendered frame. */
function LabelTracker({ labels, els }: { labels: readonly WorldLabel[]; els: MutableRefObject<(HTMLSpanElement | null)[]> }) {
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    labels.forEach((label, i) => {
      const el = els.current[i];
      if (!el) return;
      v.set(...label.position).project(camera);
      const visible = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      el.style.visibility = visible ? 'visible' : 'hidden';
      if (visible) el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -50%)`;
    });
  });
  return null;
}

/** Mounts only once everything in its Suspense boundary has loaded (the set's lazy 3D chunk included). */
function ReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

function buildCard() {
  const b = new GeoBuilder();
  // A small blank paper card with a speech-bubble tail (its words, if any, live in the DOM chat).
  b.box([-0.14, -0.09, -0.006], [0.14, 0.09, 0.006], { side: '#e9e2d4', front: '#f8f4ec', back: '#efe8dc' }, 0.25);
  b.tri([-0.08, -0.09, 0.006], [-0.02, -0.09, 0.006], [-0.1, -0.15, 0.006], '#f8f4ec', 0.25);
  b.box([-0.1, 0.02, 0.007], [0.08, 0.035, 0.009], '#c9c3d6');
  b.box([-0.1, -0.03, 0.007], [0.04, -0.015, 0.009], '#c9c3d6');
  return b.build();
}

/** Unarrived messages hang above the resident's phone as blank paper cards while time is held. */
function PaperCards({ count, from, yaw }: { count: number; from: Vec3 | null; yaw: number }) {
  const card = useKitGeometry(buildCard, []);
  const items = useMemo<KitInstance[]>(() => {
    if (!from || count <= 0) return [];
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    return Array.from({ length: count }, (_, i) => {
      const side = 0.22 + i * 0.2;
      return {
        position: [from[0] + rx * side, from[1] + 0.42 + i * 0.27, from[2] + rz * side] as Vec3,
        rotationY: yaw + (i % 2 === 0 ? -0.18 : 0.14),
        scale: 1 - i * 0.08,
      };
    });
  }, [count, from, yaw]);
  if (items.length === 0) return null;
  return <KitInstances geometry={card} items={items} warm castShadow={false} receiveShadow={false} />;
}

function Stage({ scene, set, staging, placements, railMode, pending, apiRef, labelEls, onRail, onOffCentre }: StageProps) {
  const { mission, mode, t, hotspots, onHotspot, thread, mood, focusCast, quality } = scene;
  const frozen = mode === 'frozen';
  const interactive = mode === 'frozen' || mode === 'live';
  const focus = useMemo(() => directorFocus(mission, placements, focusCast), [mission, placements, focusCast]);
  const { landed, total } = tacticCounts(mission, t);
  const pressure = pressureAt(t, mission.live.durationSec, landed, total);
  const gaze = useMemo(() => gazeTargets(placements, mode === 'live' || mode === 'released' ? focusCast : null, mode), [placements, focusCast, mode]);
  const placed = useMemo(() => placeHotspots(hotspots, set.anchors), [hotspots, set.anchors]);
  const spot = useMemo(() => influenceSpot(staging, set.camera.orbit.target), [staging, set.camera.orbit.target]);
  const ends = useMemo(() => threadEnds(thread ?? null, placements, spot), [thread, placements, spot]);
  const beads = useMemo(() => threadBeads(mission), [mission]);
  const resident = placements.find((p) => p.isResident) ?? null;
  const live = set.camera.live;
  const yaw = Math.atan2(live.position[0] - live.target[0], live.position[2] - live.target[2]);

  // While held: frame the string when it appears (and again, towards the window, when it is pulled tight);
  // otherwise fly to whoever the screen names.
  const frame = useMemo(
    () => (frozen && ends && thread ? { key: `${thread.from}:${thread.revealed ? 'tight' : 'slack'}`, a: ends.from, b: ends.to, bias: thread.revealed ? 0.62 : 0.45 } : null),
    [frozen, ends, thread],
  );
  const heldFocus = useMemo(() => {
    if (!frozen || thread || !focusCast) return null;
    const p = placements.find((q) => q.member.id === focusCast);
    return p ? chestOf(p) : null;
  }, [frozen, thread, focusCast, placements]);

  // Double-tap (or double-click) an object to fly to its close-up. Two short taps within 340 ms and 34 px.
  const tap = useRef({ downX: 0, downY: 0, downAt: 0, lastX: 0, lastY: 0, lastAt: 0 });
  const onDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const s = tap.current;
    s.downX = e.nativeEvent.clientX;
    s.downY = e.nativeEvent.clientY;
    s.downAt = performance.now();
  }, []);
  const onUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const s = tap.current;
      const now = performance.now();
      const x = e.nativeEvent.clientX;
      const y = e.nativeEvent.clientY;
      if (Math.hypot(x - s.downX, y - s.downY) > 10 || now - s.downAt > 350) return;
      if (now - s.lastAt < 340 && Math.hypot(x - s.lastX, y - s.lastY) < 34) {
        s.lastAt = 0;
        const hit: Vec3 = [e.point.x, e.point.y, e.point.z];
        // Snap to the nearest person or anchor (an authored close-up) when the tap lands near one.
        let best: Vec3 = [hit[0], Math.max(hit[1], 0.9), hit[2]];
        let bestD = 2.4;
        for (const p of placements) {
          const c = chestOf(p);
          const d = Math.hypot(c[0] - hit[0], c[2] - hit[2]);
          if (d < bestD) [best, bestD] = [c, d];
        }
        for (const a of Object.values(set.anchors)) {
          const c: Vec3 = [a.position[0], 1.1, a.position[2]];
          const d = Math.hypot(c[0] - hit[0], c[2] - hit[2]) + 0.3;
          if (d < bestD) [best, bestD] = [c, d];
        }
        apiRef.current?.flyTo(best);
        return;
      }
      s.lastX = x;
      s.lastY = y;
      s.lastAt = now;
    },
    [placements, set.anchors, apiRef],
  );

  const rainZone = staging.rain === false ? null : staging.rain ?? DEFAULT_RAIN;
  const SetComponent = set.Component;
  return (
    <>
      <SceneLighting set={set} scene={scene} railMode={railMode} />
      <Freeze amount={frozen ? 1 : 0} />
      <CameraRig
        camera={set.camera}
        rail={staging.rail}
        mode={mode}
        railMode={railMode}
        focus={mode === 'live' || mode === 'released' ? focus : null}
        pressure={pressure}
        heldFocus={heldFocus}
        frame={frame}
        apiRef={apiRef}
        onRail={onRail}
        onOffCentre={onOffCentre}
      />
      <group onPointerDown={frozen ? onDown : undefined} onPointerUp={frozen ? onUp : undefined}>
        <SetComponent quality={quality} frozen={frozen} mood={mood} t={t} timeOfDay={mission.timeOfDay} />
        {placements.map((p) =>
          p.kind === 'bean' ? (
            <Bean
              key={p.member.id}
              look={p.member.look}
              pose={castPose(p, mood, mode)}
              expression={castExpression(p.member.role, mood, mode, p.isResident)}
              position={p.position}
              facing={p.facing}
              seed={p.member.id}
              t={t}
              frozen={frozen}
              warm={p.isResident && frozen}
              highlighted={Boolean(ends && ends.fromId === p.member.id)}
              lookAt={gaze.get(p.member.id) ?? null}
            />
          ) : (
            <Faceless
              key={p.member.id}
              position={p.position}
              facing={p.facing}
              pose={p.pose === 'phone' ? 'phone' : 'stand'}
              frozen={frozen}
              t={t}
              highlighted={Boolean(ends && thread?.revealed && ends.fromId === p.member.id)}
            />
          ),
        )}
      </group>
      {placed.map((h) => (
        <Hotspot
          key={h.clueId}
          position={h.position}
          state={h.state}
          label={h.label}
          interactive={interactive && Boolean(onHotspot)}
          onSelect={onHotspot ? () => onHotspot(h.clueId) : undefined}
        />
      ))}
      {rainZone && (
        <Rain
          position={rainZone.position}
          area={rainZone.area}
          count={rainCount(quality, rainZone)}
          intensity={(rainZone.intensity ?? 1) * rainIntensity(mission.timeOfDay)}
          seed={`${mission.id}:${set.id}`}
        />
      )}
      {ends && thread && (
        <>
          <Faceless position={spot.position} facing={spot.facing} window highlighted={thread.revealed} frozen={frozen} t={t} />
          <Thread from={ends.from} to={ends.to} beads={beads} revealed={thread.revealed} />
        </>
      )}
      <PaperCards count={pending} from={resident ? phoneOf(resident) : null} yaw={yaw} />
      <LabelTracker labels={staging.labels ?? []} els={labelEls} />
    </>
  );
}

const ARROW_ROLES = '[role="radiogroup"],[role="radio"],[role="tablist"],[role="tab"],[role="listbox"],[role="option"],[role="slider"],[role="menu"],[role="menuitem"],[role="grid"],[role="tree"],[role="spinbutton"],[role="dialog"]';

/** Arrow keys orbit only when they are not already doing something for the focused element. */
function arrowsAreFree(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || document.querySelector('dialog[open]')) return false;
  const el = e.target;
  if (!(el instanceof HTMLElement)) return true;
  if (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.closest(ARROW_ROLES)) return false;
  // Focus on the stage itself (a hotspot, Recentre): the arrows are the camera's.
  if (el.closest('.w-mscene')) return true;
  // A scrollable panel uses the arrows to scroll.
  for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 1) return false;
  }
  return true;
}

function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" width="1.4em" height="1.4em" aria-hidden="true" focusable="false">
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RecentreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1.3em" height="1.3em" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      <path d="M12 2.5v3.5M12 18v3.5M2.5 12H6M18 12h3.5M5.5 12a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0 -13 0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

export default function MissionScene(props: MissionSceneProps) {
  const { mission, mode, t, thread, mood, quality } = props;
  const set = SETS[mission.scene];
  const staging = stagingOf(set);
  const band = useSettings((s) => s.band);
  const reduced = prefersReducedMotion(useSettings((s) => s.motion));
  const railMode = band === 'junior';
  const placements = useMemo(() => placeCast(mission, set.anchors, staging.seats), [mission, set.anchors, staging.seats]);
  const pending = pendingCards(mission, t, mode);
  const labels = staging.labels ?? [];

  const label = useMemo(() => {
    const parts = [describeScene({ mission, setName: set.name, anchors: set.anchors, seats: staging.seats, mode, mood, thread, rain: staging.rain !== false })];
    if (labels.length > 0) parts.push(`Signs: ${labels.map((l) => l.text).join(', ')}.`);
    if (pending > 0) parts.push(`${pending === 1 ? 'One more message is' : `${pending} more messages are`} on the way, hanging as blank paper cards.`);
    return parts.join(' ');
  }, [mission, set, staging, mode, mood, thread, labels, pending]);

  // Until the set's 3D chunk has loaded, the Flat View covers the stage (fully usable), then fades away.
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  // No WebGL (or two context losses): AdaptiveCanvas shows the Flat View itself; drop the 3D-only chrome.
  const [flatOnly, setFlatOnly] = useState(false);
  const onFallback2D = useCallback(() => setFlatOnly(true), []);
  const live3D = ready && !flatOnly;
  const apiRef = useRef<RigApi | null>(null);
  const labelEls = useRef<(HTMLSpanElement | null)[]>([]);
  const [rail, setRail] = useState({ index: 0, count: 0 });
  const [offCentre, setOffCentre] = useState(false);
  const onRail = useCallback((index: number, count: number) => setRail({ index, count }), []);

  // Reduced motion: camera moves are cuts, softened by a short fade on every mode change.
  const [fadeKey, setFadeKey] = useState(0);
  const prevMode = useRef(mode);
  useEffect(() => {
    if (prevMode.current === mode) return;
    prevMode.current = mode;
    if (reduced) setFadeKey((k) => k + 1);
  }, [mode, reduced]);

  // A short hint the first time time is held.
  const [hint, setHint] = useState(false);
  const hinted = useRef(false);
  useEffect(() => {
    if (mode !== 'frozen' || hinted.current) return;
    hinted.current = true;
    setHint(true);
    const id = window.setTimeout(() => setHint(false), 5200);
    return () => window.clearTimeout(id);
  }, [mode]);
  useEffect(() => {
    if (mode !== 'frozen') setHint(false);
  }, [mode]);

  // Keyboard: arrows orbit (or step along the rail), + and - zoom.
  useEffect(() => {
    if (mode !== 'frozen') return;
    const onKey = (e: KeyboardEvent) => {
      const api = apiRef.current;
      if (!api) return;
      const deg = Math.PI / 180;
      let handled = true;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!arrowsAreFree(e)) return;
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        if (railMode) api.railStep(dir);
        else api.orbit(dir * 12 * deg, 0);
      } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !railMode) {
        if (!arrowsAreFree(e)) return;
        api.orbit(0, (e.key === 'ArrowUp' ? 1 : -1) * 7 * deg);
      } else if ((e.key === '+' || e.key === '=' || e.key === '-') && !railMode) {
        if (!arrowsAreFree(e)) return;
        api.orbit(0, 0, e.key === '-' ? 1.18 : 0.85);
      } else handled = false;
      if (handled) {
        e.preventDefault();
        setHint(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, railMode]);

  // Junior rail: a horizontal swipe on the stage steps between the four views.
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    setHint(false);
    if (mode === 'frozen' && railMode) swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) apiRef.current?.railStep(dx < 0 ? 1 : -1);
  };

  const { quality: _q, ...flatProps } = props;
  void _q;
  const held = mode === 'frozen';
  return (
    <div
      className="w-mscene"
      data-mode={mode}
      data-rail={held && railMode ? '' : undefined}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipe.current = null)}
    >
      <AdaptiveCanvas
        quality={quality}
        ariaLabel={label}
        camera={{ position: set.camera.live.position, fov: set.camera.live.fov ?? 30, near: 0.1, far: 240 }}
        fallback={<MissionScene2D {...flatProps} />}
        onFallback2D={onFallback2D}
      >
        <Suspense fallback={null}>
          <Stage
            scene={props}
            set={set}
            staging={staging}
            placements={placements}
            railMode={railMode}
            pending={pending}
            apiRef={apiRef}
            labelEls={labelEls}
            onRail={onRail}
            onOffCentre={setOffCentre}
          />
          <ReadySignal onReady={onReady} />
        </Suspense>
      </AdaptiveCanvas>
      {!ready && !flatOnly && (
        <div className="w-mscene__cover">
          <MissionScene2D {...flatProps} />
        </div>
      )}
      {live3D && labels.length > 0 && (
        <div className="w-mscene__labels" aria-hidden="true">
          {labels.map((l, i) => (
            <span
              key={`${l.text}${i}`}
              ref={(el) => {
                labelEls.current[i] = el;
              }}
              className={`w-mscene__label${l.size === 'small' ? ' w-mscene__label--small' : ''}`}
            >
              {l.text}
            </span>
          ))}
        </div>
      )}
      {fadeKey > 0 && <div key={fadeKey} className="w-mscene__fade" aria-hidden="true" />}
      {held && live3D && (
        <div className="w-mscene__controls" role="group" aria-label="Camera">
          {railMode ? (
            <>
              <button type="button" className="w-mscene__btn w-mscene__btn--prev" aria-label="Previous view" onClick={() => apiRef.current?.railStep(-1)}>
                <ChevronIcon dir="left" />
              </button>
              <button type="button" className="w-mscene__btn w-mscene__btn--next" aria-label="Next view" onClick={() => apiRef.current?.railStep(1)}>
                <ChevronIcon dir="right" />
              </button>
              {rail.count > 0 && (
                <p className="w-mscene__chip w-mscene__chip--rail" aria-live="polite">
                  View {rail.index + 1} of {rail.count}
                </p>
              )}
            </>
          ) : (
            <button
              type="button"
              className="w-mscene__btn w-mscene__btn--recentre"
              data-off={offCentre ? '' : undefined}
              aria-label="Recentre the view"
              onClick={() => apiRef.current?.recentre()}
            >
              <RecentreIcon />
              <span className="w-mscene__btn-text" aria-hidden="true">
                Recentre
              </span>
            </button>
          )}
          {hint && (
            <p className="w-mscene__chip w-mscene__chip--hint">
              {railMode ? 'Swipe or use the arrows to change the view.' : 'Drag to look around. Double-tap to look closer.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

