// /play/explore: free-roam ShieldQuest City. Walk round in 3D (stick, WASD / arrows, or tap the ground), find
// Shield Shards, play arcade kiosks and visit mission beacons. In 2D mode (or without WebGL) the same places are
// buttons on a top-down map, and the Nearby list reaches everything without precise movement.
// The 3D chunk is lazy: it only downloads on this route, and the hub never imports it.
import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, Redirect, useLocation } from 'wouter';
import type { Grade } from '../../world/kit/uniforms';
import { useRenderMode, type QualityTier } from '../../world/quality';
import {
  EXPLORE_WORLD,
  OPEN_DISTRICTS,
  PLACES,
  SHARD_TOTAL,
  placeById,
  type AreaId,
  type Place,
} from '../../world/explore/exploreMap';
import { areaAt, byDistance, isClear } from '../../world/explore/movement';
import { MOVE_KEYS, createController, jumpTo, keysVector, turnOf, type ExploreController } from '../../world/explore/controller';
import { useSettings } from '../../state/settings';
import { useProgress } from '../../state/progress';
import { useRewards } from '../../state/rewards';
import { startAmbient, stopAmbient } from '../../audio/sfx';
import { Icon, type IconName } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { SettingsButton } from '../../ui/SettingsPanel';
import { HelpButton } from '../../ui/HelpPanel';
import { Stillpoint, ViewBoundary, readStored, useFirstGesture, useMediaQuery, useReducedMotionSetting, useSfx, writeStored } from '../hub/kit';
import { ExploreMap } from './ExploreMap';
import { Joystick } from './Joystick';
import { PromptCard, placeActions } from './PromptCard';
import { AREA_VIEWS, CITY_VIEW, arrivalPoint, placesIn, project, viewById, type ViewId } from './mapView';
import { tokenColor } from '../rewards/tokens';
import { areaLabel, availableShards, distanceWords, placeTitle, shardCountToday, shardsFoundToday } from './places';
import './explore.css';

const ExploreScene = lazy(() => import('../../world/explore/ExploreScene'));

const POS_KEY = 'sq.explore.pos.v1';
const MAP_KEY = 'sq.explore.minimap.v1';
/** The hub remembers its open district under this key (game/hub/CityHub.tsx). */
const HUB_FOCUS_KEY = 'sq.hub.focus.v1';

const SCENE_LABEL =
  'ShieldQuest City in 3D. You walk as a small figure in your colour. Every place here is also in the Nearby list.';

const PLACE_ICON: Record<Place['kind'], IconName> = { kiosk: 'play', beacon: 'pin', townie: 'chat', shard: 'shield' };

interface SavedPos {
  x: number;
  z: number;
  heading: number;
  yaw: number;
}

function loadPos(): SavedPos | undefined {
  const p = readStored<Partial<SavedPos> | null>('session', POS_KEY, null);
  if (!p || ![p.x, p.z, p.heading, p.yaw].every((v) => typeof v === 'number' && Number.isFinite(v))) return undefined;
  return isClear(EXPLORE_WORLD, p.x!, p.z!) ? (p as SavedPos) : undefined;
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
const isControl = (t: EventTarget | null) =>
  t instanceof Element && Boolean(t.closest('button, a, input, select, textarea, summary, [role="button"]'));

function ShardGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ex-glyph">
      <path d="M12 2.5l6 7.5-6 11.5L6 10z" fill="#5cc4f2" stroke="#bfe9ff" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6.6 10h10.8" stroke="#f2c14e" strokeWidth="1.6" />
    </svg>
  );
}

function StageLoading() {
  return (
    <div className="ex-loading" role="status">
      <Stillpoint size={84} />
      <p>Building the city…</p>
    </div>
  );
}

/** Rendered by the error boundary: switches the page to the 2D explore map. */
function SwitchTo2D({ onSwitch }: { onSwitch: () => void }) {
  useEffect(() => onSwitch(), [onSwitch]);
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// 3D stage (memoised: HUD updates never re-render the canvas)
// ---------------------------------------------------------------------------------------------------------

interface StageProps {
  quality: QualityTier;
  controller: ExploreController;
  playerColor: string;
  hiddenShards: readonly string[];
  active: string | null;
  districtTrust: Record<string, number>;
  grade: Grade;
  onNear: (id: string | null) => void;
  onShard: (id: string) => void;
  onArea: (a: AreaId | null) => void;
  onFallback: () => void;
  onTapMiss: () => void;
}

const Stage3D = memo(function Stage3D({ onFallback, onTapMiss, controller, ...rest }: StageProps) {
  const drag = useRef<{ id: number; x: number; y: number; lastX: number; t: number; moved: boolean } | null>(null);

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, t: performance.now(), moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-released pointer: dragging still works while over the view.
    }
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) d.moved = true;
    if (d.moved) {
      // Drag to turn the camera round the player.
      controller.yaw -= (e.clientX - d.lastX) * 0.007;
      controller.wake?.();
    }
    d.lastX = e.clientX;
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.moved || performance.now() - d.t > 600 || e.type === 'pointercancel') return;
    // A tap: walk to the ground under it.
    const r = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    if (controller.tapTo && !controller.tapTo(nx, ny)) onTapMiss();
  };

  return (
    <div className="ex-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <ViewBoundary fallback={<SwitchTo2D onSwitch={onFallback} />}>
        <Suspense fallback={<StageLoading />}>
          <ExploreScene
            {...rest}
            controller={controller}
            ariaLabel={SCENE_LABEL}
            onFallback2D={onFallback}
            fallback={null}
          />
        </Suspense>
      </ViewBoundary>
    </div>
  );
});

/** Mini-map in 3D mode: polls the controller a few times a second (its own state, so nothing else re-renders). */
function MiniMap({ controller, color, shards }: { controller: ExploreController; color: string; shards: readonly string[] }) {
  const [p, setP] = useState({ x: controller.x, z: controller.z, heading: controller.heading });
  useEffect(() => {
    const id = window.setInterval(() => {
      setP((prev) =>
        Math.abs(prev.x - controller.x) + Math.abs(prev.z - controller.z) + Math.abs(prev.heading - controller.heading) < 0.05
          ? prev
          : { x: controller.x, z: controller.z, heading: controller.heading },
      );
    }, 250);
    return () => window.clearInterval(id);
  }, [controller]);
  return <ExploreMap view={CITY_VIEW} markers shards={shards} player={{ ...p, color }} className="ex-mini" />;
}

// ---------------------------------------------------------------------------------------------------------
// 2D board: one view per area, places as real buttons
// ---------------------------------------------------------------------------------------------------------

const SHORT_LABEL: Record<ViewId, string> = {
  city: 'City',
  hub: 'Plaza',
  'school-street': 'School',
  'retail-district': 'Retail',
  'digi-district': 'Digi',
  'void-deck-commons': 'Void Deck',
  interchange: 'Interchange',
};

interface BoardProps {
  view: ViewId;
  player: { x: number; z: number };
  color: string;
  available: ReadonlySet<string>;
  selected: string | null;
  onView: (v: ViewId) => void;
  onPlace: (p: Place) => void;
}

function Board({ view, player, color, available, selected, onView, onPlace }: BoardProps) {
  const v = viewById(view);
  const places = placesIn(view).filter((p) => p.kind !== 'shard' || available.has(p.id));
  const me = project(v, player.x, player.z);
  const views = [CITY_VIEW, ...AREA_VIEWS];
  const shardsIn = (id: ViewId) => placesIn(id).filter((p) => p.kind === 'shard' && available.has(p.id)).length;
  return (
    <section className="ex-board" aria-label="Explore map">
      <div className="ex-tabs" role="group" aria-label="Go to">
        {views.map((x) => (
          <button
            key={x.id}
            type="button"
            className="ex-tab"
            aria-pressed={view === x.id}
            aria-label={x.id === 'city' ? 'Whole city map' : x.label}
            onClick={() => onView(x.id)}
          >
            {SHORT_LABEL[x.id]}
          </button>
        ))}
      </div>
      <ExploreMap view={v} className="ex-board__map">
        {view === 'city' ? (
          ['hub' as const, ...OPEN_DISTRICTS.map((d) => d.id)].map((id) => {
            const c = id === 'hub' ? { x: 0, z: 0 } : OPEN_DISTRICTS.find((d) => d.id === id)!;
            const pos = project(v, c.x, c.z);
            const n = shardsIn(id);
            return (
              <button
                key={id}
                type="button"
                className="ex-area"
                style={{ left: `${pos.u * 100}%`, top: `${pos.v * 100}%` }}
                onClick={() => onView(id)}
              >
                <span className="ex-area__name">{viewById(id).label}</span>
                <span className="ex-area__meta">
                  {n > 0 ? `${n} ${n === 1 ? 'shard' : 'shards'}` : 'No shards left'}
                </span>
              </button>
            );
          })
        ) : (
          <>
            {places.map((p) => {
              const pos = project(v, p.x, p.z);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`ex-spot ex-spot--${p.kind}`}
                  data-selected={selected === p.id ? 'true' : undefined}
                  style={{ left: `${pos.u * 100}%`, top: `${pos.v * 100}%` }}
                  aria-label={`${placeTitle(p)}: ${p.where}`}
                  title={placeTitle(p)}
                  onClick={() => onPlace(p)}
                >
                  {p.kind === 'shard' ? <ShardGlyph size={24} /> : <Icon name={PLACE_ICON[p.kind]} size={22} />}
                </button>
              );
            })}
            <span className="ex-me" aria-hidden="true" style={{ left: `${me.u * 100}%`, top: `${me.v * 100}%`, background: color }} />
          </>
        )}
      </ExploreMap>
      <p className="ex-board__hint">
        {view === 'city' ? 'Tap a place to walk there.' : 'Tap a shard to grab it, or a kiosk, beacon or townie to visit.'}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------------------------------------

function Explore() {
  const mode = useRenderMode();
  const [lost3d, setLost3d] = useState(false);
  const flat = mode === '2d' || lost3d;
  const band = useSettings((s) => s.band);
  const sound = useSettings((s) => s.sound);
  const progress = useProgress((s) => s.progress);
  const stars = useRewards((s) => s.rewards.stars);
  const shardsDay = useRewards((s) => s.rewards.shardsDay);
  const shardsFound = useRewards((s) => s.rewards.shardsFound);
  const colorId = useRewards((s) => s.rewards.equipped.color);
  const reduced = useReducedMotionSetting();
  const coarse = useMediaQuery('(any-pointer: coarse)');
  const sfx = useSfx();
  const [, navigate] = useLocation();

  const today = { shardsDay, shardsFound };
  const hidden = useMemo(() => shardsFoundToday({ shardsDay, shardsFound }, Date.now()), [shardsDay, shardsFound]);
  const available = useMemo(() => availableShards({ shardsDay, shardsFound }, Date.now()), [shardsDay, shardsFound]);
  const availableIds = useMemo(() => available.map((s) => s.id), [available]);
  const availableSet = useMemo(() => new Set(availableIds), [availableIds]);
  const count = shardCountToday(today, Date.now());
  const color = tokenColor(colorId);
  const grade: Grade = band === 'junior' ? 'daylight' : 'blue-hour';

  const controller = useMemo(() => createController(loadPos()), []);
  const [near, setNear] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [area, setArea] = useState<AreaId | null>(() => areaAt(EXPLORE_WORLD, controller.x, controller.z));
  const [announce, setAnnounce] = useState('');
  const [pop, setPop] = useState<{ key: number; text: string } | null>(null);
  const [panel, setPanel] = useState<'nearby' | 'help' | null>(null);
  const [showMap, setShowMap] = useState(() => readStored<boolean>('local', MAP_KEY, true));
  const [miss, setMiss] = useState(0);
  // 2D board state.
  const [view, setView] = useState<ViewId>(() => {
    const a = areaAt(EXPLORE_WORLD, controller.x, controller.z);
    return a && a !== 'bridge' ? a : 'hub';
  });
  const [pos2d, setPos2d] = useState(() => ({ x: controller.x, z: controller.z }));
  const arriveTimer = useRef<number | undefined>(undefined);

  useEffect(() => writeStored('local', MAP_KEY, showMap), [showMap]);

  // Remember where you were (for this tab), so coming back from a mini-game puts you by the kiosk.
  const savePos = useCallback(
    () => writeStored('session', POS_KEY, { x: controller.x, z: controller.z, heading: controller.heading, yaw: controller.yaw }),
    [controller],
  );
  useEffect(() => {
    window.addEventListener('pagehide', savePos);
    return () => {
      savePos();
      window.removeEventListener('pagehide', savePos);
      window.clearTimeout(arriveTimer.current);
    };
  }, [savePos]);

  // City ambience while exploring (Sound setting respected; unlocked on the first gesture).
  useEffect(() => {
    if (!sound) {
      stopAmbient();
      return;
    }
    startAmbient('city');
    return () => stopAmbient();
  }, [sound]);
  useFirstGesture(() => {
    if (useSettings.getState().sound) startAmbient('city');
  });

  // --- What you're near -----------------------------------------------------------------------------------

  const onNear = useCallback((id: string | null) => {
    setNear(id);
    setDismissed((d) => (d === id ? d : null));
  }, []);

  const onArea = useCallback((a: AreaId | null) => setArea(a), []);

  const onShard = useCallback(
    (id: string) => {
      const event = useRewards.getState().shard(id);
      if (!event) return;
      // Explore shows its own pop; don't leave the event for another screen's toast.
      useRewards.getState().clearEvent();
      const n = shardCountToday(useRewards.getState().rewards, Date.now());
      sfx('clueOk');
      setPop({ key: Date.now(), text: `+${event.stars} Stars` });
      const badge = event.badges.includes('shard-hunter') ? ' New badge: Shard Hunter!' : '';
      const all = n >= SHARD_TOTAL ? ' You found every shard today. New ones appear tomorrow!' : '';
      setAnnounce(`Shield Shard found! Plus ${event.stars} Stars. ${n} of ${SHARD_TOTAL} today.${badge}${all}`);
    },
    [sfx],
  );

  useEffect(() => {
    if (!pop) return;
    const t = window.setTimeout(() => setPop(null), 1600);
    return () => window.clearTimeout(t);
  }, [pop]);

  const onFallback = useCallback(() => setLost3d(true), []);
  const onTapMiss = useCallback(() => setMiss((n) => n + 1), []);
  useEffect(() => {
    if (miss === 0) return;
    const t = window.setTimeout(() => setMiss(0), 1400);
    return () => window.clearTimeout(t);
  }, [miss]);

  // --- The prompt -------------------------------------------------------------------------------------------

  const promptPlace = near && near !== dismissed ? placeById(near) : undefined;
  const shownPlace = promptPlace && promptPlace.kind !== 'shard' ? promptPlace : undefined;

  const go = useCallback(
    (href: string) => {
      sfx('tap');
      savePos();
      navigate(href);
    },
    [sfx, savePos, navigate],
  );
  const allMissions = useCallback(
    (district: string) => {
      writeStored('session', HUB_FOCUS_KEY, district);
      go('/play');
    },
    [go],
  );
  const dismiss = useCallback(() => setDismissed(near), [near]);
  const actions = shownPlace ? placeActions(shownPlace, band, progress, dismiss, allMissions) : [];
  const primary = useRef<(() => void) | null>(null);
  const first = actions[0];
  primary.current = first ? () => (first.href ? go(first.href) : first.run?.()) : null;

  const lastPrompt = useRef<string | null>(null);
  useEffect(() => {
    const id = shownPlace?.id ?? null;
    if (id === lastPrompt.current) return;
    lastPrompt.current = id;
    if (!shownPlace) return;
    sfx('tick');
    const verb = actions[0]?.label ?? 'OK';
    setAnnounce(`${placeTitle(shownPlace)} is here. Press Space or the ${verb} button.`);
  }, [shownPlace, actions, sfx]);

  // --- Keyboard: WASD / arrows move, Q / E turn the camera, Space / Enter use the prompt -------------------

  useEffect(() => {
    const held = new Set<string>();
    const sync = () => {
      const k = keysVector(held);
      controller.keys.x = k.x;
      controller.keys.y = k.y;
      controller.turn = turnOf(held);
      controller.wake?.();
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || document.querySelector('dialog[open]')) return;
      const key = e.key.toLowerCase();
      if (MOVE_KEYS.has(key)) {
        if (key.startsWith('arrow')) e.preventDefault();
        if (!held.has(key)) {
          held.add(key);
          sync();
        }
        return;
      }
      if ((key === ' ' || key === 'enter') && !isControl(e.target) && primary.current) {
        e.preventDefault();
        primary.current();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (held.delete(e.key.toLowerCase())) sync();
    };
    const clear = () => {
      held.clear();
      sync();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', clear);
      clear();
    };
  }, [controller]);

  const onStick = useCallback(
    (x: number, y: number) => {
      controller.stick.x = x;
      controller.stick.y = y;
      controller.wake?.();
    },
    [controller],
  );

  // --- 2D: walking between areas and to places ---------------------------------------------------------------

  const goView = useCallback(
    (id: ViewId) => {
      window.clearTimeout(arriveTimer.current);
      setView(id);
      setNear(null);
      if (id === 'city') return;
      const p = arrivalPoint(id);
      controller.x = p.x;
      controller.z = p.z;
      setPos2d(p);
      setArea(id);
      setAnnounce(`Walked to ${viewById(id).label}.`);
    },
    [controller],
  );

  const goPlace2D = useCallback(
    (p: Place) => {
      window.clearTimeout(arriveTimer.current);
      if (p.area !== 'bridge' && p.area !== view) setView(p.area);
      controller.x = p.standX;
      controller.z = p.standZ;
      setPos2d({ x: p.standX, z: p.standZ });
      setArea(p.area);
      setNear(null);
      arriveTimer.current = window.setTimeout(
        () => {
          if (p.kind === 'shard') onShard(p.id);
          else {
            setDismissed(null);
            setNear(p.id);
          }
        },
        reduced ? 0 : 420,
      );
    },
    [controller, view, reduced, onShard],
  );

  // --- Nearby list: everything, sorted by distance, one tap to get there --------------------------------------

  const nearbyList = useMemo(() => {
    if (panel !== 'nearby') return [];
    const places = PLACES.filter((p) => p.kind !== 'shard' || availableSet.has(p.id));
    return byDistance(places, controller.x, controller.z);
  }, [panel, availableSet, controller]);

  const jump = (p: Place) => {
    setPanel(null);
    if (flat) {
      goPlace2D(p);
      return;
    }
    jumpTo(controller, { x: p.standX, z: p.standZ }, p.kind === 'shard' ? undefined : { x: p.x, z: p.z });
    setDismissed(null);
  };

  useEffect(() => {
    const before = document.title;
    document.title = 'Explore · ShieldQuest';
    return () => {
      document.title = before;
    };
  }, []);

  const allFound = count >= SHARD_TOTAL;

  return (
    <div className="ex" data-mode={flat ? '2d' : '3d'} data-anim={reduced ? 'off' : 'on'}>
      {!flat && (
        <Stage3D
          quality={mode}
          controller={controller}
          playerColor={color}
          hiddenShards={hidden}
          active={shownPlace?.id ?? null}
          districtTrust={progress.districtTrust}
          grade={grade}
          onNear={onNear}
          onShard={onShard}
          onArea={onArea}
          onFallback={onFallback}
          onTapMiss={onTapMiss}
        />
      )}

      <div className="ex-hud">
        <header className="ex-top">
          <Link href="/play" className="ex-back" onClick={savePos}>
            <Icon name="arrowLeft" />
            <span>
              City<span className="sr-only"> hub</span>
            </span>
          </Link>
          <h1 className="ex-title">Explore</h1>
          <div className="ex-tools">
            <button type="button" className="ui-iconbtn" onClick={() => setPanel('nearby')} aria-label="Nearby places: jump to any place">
              <Icon name="pin" />
            </button>
            {!flat && (
              <button
                type="button"
                className="ui-iconbtn"
                aria-pressed={showMap}
                onClick={() => setShowMap((s) => !s)}
                aria-label="Mini-map"
              >
                <Icon name="map" />
              </button>
            )}
            <button type="button" className="ui-iconbtn" onClick={() => setPanel('help')} aria-label="How to explore">
              <Icon name="help" />
            </button>
            <SettingsButton />
            <HelpButton />
          </div>
        </header>

        <div className="ex-strip">
          <p className="ex-chip" title="Stars: spend them in your locker">
            <Icon name="spark" size="1.1em" />
            <span className="sr-only">Stars:</span>
            <span>{stars}</span>
          </p>
          <p className="ex-chip" data-done={allFound ? 'true' : undefined}>
            <ShardGlyph />
            <span className="sr-only">Shield Shards found today:</span>
            <span>
              {count}/{SHARD_TOTAL}
            </span>
            <span className="ex-chip__word" aria-hidden="true">
              today
            </span>
          </p>
          {area && (
            <p className="ex-chip ex-chip--area" aria-live="polite">
              <Icon name="pin" size="1em" />
              <span className="sr-only">You are in </span>
              <span>{areaLabel(area)}</span>
            </p>
          )}
        </div>

        {!flat && showMap && <MiniMap controller={controller} color={color} shards={availableIds} />}

        {flat && (
          <Board
            view={view}
            player={pos2d}
            color={color}
            available={availableSet}
            selected={near}
            onView={goView}
            onPlace={goPlace2D}
          />
        )}

        {pop && (
          <p key={pop.key} className="ex-pop" aria-hidden="true">
            <ShardGlyph size={22} /> {pop.text}
          </p>
        )}
        {miss > 0 && (
          <p className="ex-miss" aria-hidden="true">
            Can’t walk there
          </p>
        )}

        <div className="ex-bottom">
          {!flat && coarse && <Joystick onChange={onStick} />}
          {!flat && !coarse && !shownPlace && (
            <p className="ex-keys" aria-hidden="true">
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> move · <kbd>Q</kbd>
              <kbd>E</kbd> turn · click the ground to walk
            </p>
          )}
          {shownPlace && (
            <PromptCard
              place={shownPlace}
              band={band}
              progress={progress}
              actions={actions}
              onNavigate={go}
              onClose={dismiss}
            />
          )}
        </div>
      </div>

      <Sheet open={panel === 'nearby'} onClose={() => setPanel(null)} title="Nearby">
        <p className="ex-sheet__lead">Jump straight to any place. Shards you find today disappear from the list.</p>
        <ul className="ex-nearby">
          {nearbyList.map(({ place, distance }) => (
            <li key={place.id} className="ex-nearby__row">
              <span className={`ex-nearby__icon ex-nearby__icon--${place.kind}`} aria-hidden="true">
                {place.kind === 'shard' ? <ShardGlyph size={20} /> : <Icon name={PLACE_ICON[place.kind]} size={20} />}
              </span>
              <span className="ex-nearby__text">
                <strong>{placeTitle(place)}</strong>
                <span>
                  {place.where} · {flat ? areaLabel(place.area) : distanceWords(distance)}
                </span>
              </span>
              <button type="button" className="ui-btn ui-btn--sm ex-go" onClick={() => jump(place)}>
                <span>
                  Go<span className="sr-only"> to {placeTitle(place)}, {place.where}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={panel === 'help'} onClose={() => setPanel(null)} title="How to explore">
        <ul className="ex-help">
          {flat ? (
            <li>
              <strong>Move:</strong> pick an area at the top, then tap a place on the map to walk there.
            </li>
          ) : (
            <>
              <li>
                <strong>Move:</strong> use the stick (bottom left), <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the
                arrow keys, or tap the ground to walk there.
              </li>
              <li>
                <strong>Look around:</strong> drag the view, or press <kbd>Q</kbd> and <kbd>E</kbd>.
              </li>
            </>
          )}
          <li>
            <strong>Find Shield Shards:</strong> {SHARD_TOTAL} glowing shards hide round the city each day. Each one is
            worth Stars.
          </li>
          <li>
            <strong>Visit places:</strong> arcade kiosks start a mini-game, beacons open missions, and townies share a
            safety tip. Use the button, or press <kbd>Space</kbd>.
          </li>
          <li>
            <strong>Can’t find something?</strong> Open <Icon name="pin" size="1em" label="Nearby" /> to jump straight
            there.
          </li>
        </ul>
        <p className="ui-fineprint">Turn the 3D view on or off in Settings (Quality).</p>
      </Sheet>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

export default function ExplorePage() {
  const onboarded = useSettings((s) => s.onboarded);
  if (!onboarded) return <Redirect to="/play" />;
  return <Explore />;
}
