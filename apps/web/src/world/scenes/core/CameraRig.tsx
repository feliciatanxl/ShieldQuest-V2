// The mission camera (GAME_DESIGN.md §4.5), inside the canvas:
// - intro: a slow crane down onto the authored live framing;
// - live: a locked director camera (FOV 30) that dollies towards the phone when a message lands and cuts to a
//   friend when they speak, with a 2-3 px sway that grows with pressure;
// - frozen (Hold): a 400 ms punch (FOV 30 -> 26, small dolly in), then a constrained orbit (±75° from the authored
//   front, 25-70° elevation, zoom 0.6-2.0×) or, for the 10-13 band, a rail of four stops; double-tap flies to an
//   object in 600 ms, Recentre flies home, pulling the string frames both of its ends in 1 s;
// - released: eases back to the live framing.
// Reduced motion: every move is a cut (the DOM layer adds a short fade) and there is no sway.
import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { easeInOutCubic, easeOutCubic, useKit } from '../../kit';
import type { SceneMode } from '../../contracts';
import type { SetPiece } from '../sets/types';
import {
  aspectFit,
  blendShots,
  clampShot,
  closeUpShot,
  distance,
  focusShot,
  frameShot,
  introShot,
  liveShot,
  orbitLimits,
  orbitStep,
  punchShot,
  railStops,
  swayPixels,
  worldPerPixel,
  type OrbitLimits,
  type Shot,
} from './camera';
import type { DirectorFocus } from './director';
import type { CameraShot, Vec3 } from './staging';

/** Imperative camera commands from the DOM controls (Recentre, rail arrows, keyboard orbit, double-tap). */
export interface RigApi {
  recentre(): void;
  /** Orbit by azimuth / elevation (radians) and a zoom factor (< 1 = closer). */
  orbit(dTheta: number, dElevation: number, zoom?: number): void;
  railStep(direction: 1 | -1): void;
  flyTo(point: Vec3): void;
}

export interface CameraRigProps {
  camera: SetPiece['camera'];
  /** Authored junior rail stops (staging.rail), if any. */
  rail?: readonly CameraShot[];
  mode: SceneMode;
  /** 10-13 band: rail stops instead of the free orbit. */
  railMode: boolean;
  focus: DirectorFocus | null;
  /** 0..1 live pressure (sway amplitude). */
  pressure: number;
  /** While held: a point to fly to when it changes (the cast member named by focusCast). */
  heldFocus: Vec3 | null;
  /** While held: two points to frame together (the influence string's ends), keyed so it fires once. */
  frame: { key: string; a: Vec3; b: Vec3; bias?: number } | null;
  apiRef: MutableRefObject<RigApi | null>;
  /** Rail stop changed (index, count). */
  onRail?: (index: number, count: number) => void;
  /** The held view left (or came back to) its home framing. */
  onOffCentre?: (off: boolean) => void;
}

interface Flight {
  from: Shot;
  to: () => Shot;
  start: number;
  duration: number;
  ease: (t: number) => number;
  done?: () => void;
}

const PUNCH_S = 0.4;
const FLY_S = 0.6;
const RETURN_S = 0.9;
const INTRO_S = 2.6;
const STRING_S = 1.0;
const _target = new Vector3();
const _right = new Vector3();
const _up = new Vector3();
const _dir = new Vector3();

export function CameraRig(props: CameraRigProps) {
  const { reducedMotion, requestFrame } = useKit();
  const size = useThree((s) => s.size);
  const latest = useRef(props);
  latest.current = props;
  const controls = useRef<OrbitControlsImpl | null>(null);
  const st = useRef({
    clock: 0,
    shot: null as Shot | null,
    mode: null as SceneMode | null,
    flight: null as Flight | null,
    base: null as Shot | null,
    limits: null as OrbitLimits | null,
    stops: [] as Shot[],
    stop: 0,
    punched: false,
    offCentre: false,
    heldFocusKey: '',
    frameKey: '',
  });

  const aspect = size.width / Math.max(1, size.height);
  const fit = aspectFit(aspect);
  const live = useMemo(() => liveShot(props.camera.live, aspect), [props.camera.live, aspect]);
  const liveRef = useRef(live);
  liveRef.current = live;
  // The held framing: punched home shot, orbit limits and the junior rail stops (recomputed if the stage resizes).
  const held = useMemo(() => {
    const base0 = punchShot(live, props.camera.orbit.target);
    const limits = orbitLimits(base0, props.camera.orbit, fit);
    const base = clampShot(base0, limits);
    return { base, limits, stops: railStops(base, props.rail, fit) };
  }, [live, props.camera.orbit, props.rail, fit]);
  const heldRef = useRef(held);
  heldRef.current = held;
  const seenControls = useRef(new WeakSet<OrbitControlsImpl>());
  const attachControls = useCallback((c: OrbitControlsImpl | null) => {
    // Created disabled: the punch flight owns the camera until it lands.
    if (c && !seenControls.current.has(c)) {
      seenControls.current.add(c);
      c.enabled = false;
    }
    controls.current = c;
  }, []);

  /** The framing live mode wants right now (authored framing leaning towards the director's focus). */
  const liveTarget = useCallback((): Shot => {
    const f = latest.current.focus;
    return f ? focusShot(liveRef.current, f.point, f.cut ? 0.34 : 0.3, f.cut ? 0.84 : 0.88) : liveRef.current;
  }, []);

  const currentShot = useCallback((camera: PerspectiveCamera): Shot => {
    const s = st.current;
    const ctl = controls.current;
    if (ctl && ctl.enabled) {
      return { position: [camera.position.x, camera.position.y, camera.position.z], target: [ctl.target.x, ctl.target.y, ctl.target.z], fov: camera.fov };
    }
    return s.shot ?? liveRef.current;
  }, []);

  const camRef = useRef<PerspectiveCamera | null>(null);

  const fly = useCallback(
    (to: Shot | (() => Shot), duration: number, done?: () => void, ease: (t: number) => number = easeInOutCubic) => {
      const s = st.current;
      const camera = camRef.current;
      if (!camera) return;
      const from = currentShot(camera);
      const ctl = controls.current;
      if (ctl) ctl.enabled = false;
      const target = typeof to === 'function' ? to : () => to;
      s.shot = from;
      s.flight = { from, to: target, start: s.clock, duration: reducedMotion ? 0 : duration, ease, done };
      requestFrame();
    },
    [currentShot, reducedMotion, requestFrame],
  );

  /** Hands the camera to the orbit controls at the end of a held flight (free orbit only). */
  const handToOrbit = useCallback((shot: Shot) => {
    const ctl = controls.current;
    const p = latest.current;
    if (!ctl || p.mode !== 'frozen' || p.railMode) return;
    ctl.target.set(...shot.target);
    ctl.enabled = true;
    ctl.update();
  }, []);

  const setOffCentre = useCallback((off: boolean) => {
    const s = st.current;
    if (s.offCentre === off) return;
    s.offCentre = off;
    latest.current.onOffCentre?.(off);
  }, []);

  // Imperative API for the DOM controls.
  useEffect(() => {
    const api: RigApi = {
      recentre() {
        const s = st.current;
        if (latest.current.mode !== 'frozen' || !s.base) return;
        if (latest.current.railMode) {
          s.stop = 0;
          latest.current.onRail?.(0, s.stops.length);
          fly(s.stops[0] ?? s.base, FLY_S, () => setOffCentre(false));
          return;
        }
        const home = s.base;
        fly(home, FLY_S, () => {
          handToOrbit(home);
          setOffCentre(false);
        });
      },
      orbit(dTheta, dElevation, zoom = 1) {
        const s = st.current;
        const camera = camRef.current;
        if (latest.current.mode !== 'frozen' || latest.current.railMode || !s.limits || !camera || s.flight) return;
        const next = orbitStep(currentShot(camera), s.limits, dTheta, dElevation, zoom);
        fly(next, 0.28, () => {
          handToOrbit(next);
          setOffCentre(true);
        });
      },
      railStep(direction) {
        const s = st.current;
        if (latest.current.mode !== 'frozen' || !latest.current.railMode || s.stops.length === 0) return;
        s.stop = (s.stop + direction + s.stops.length) % s.stops.length;
        latest.current.onRail?.(s.stop, s.stops.length);
        fly(s.stops[s.stop]!, FLY_S, () => setOffCentre(s.stop !== 0));
      },
      flyTo(point) {
        const s = st.current;
        const camera = camRef.current;
        if (latest.current.mode !== 'frozen' || latest.current.railMode || !s.limits || !camera) return;
        const next = closeUpShot(currentShot(camera), point, s.limits);
        fly(next, FLY_S, () => {
          handToOrbit(next);
          setOffCentre(true);
        });
      },
    };
    props.apiRef.current = api;
    return () => {
      if (props.apiRef.current === api) props.apiRef.current = null;
    };
  }, [props.apiRef, fly, handToOrbit, currentShot, setOffCentre]);

  useFrame((state, delta) => {
    const camera = state.camera as PerspectiveCamera;
    camRef.current = camera;
    const p = latest.current;
    const s = st.current;
    const dt = Math.min(delta, 0.1);
    s.clock += dt;
    let busy = false;

    // --- Mode changes -------------------------------------------------------------------------------------
    if (s.mode !== p.mode) {
      const prev = s.mode;
      s.mode = p.mode;
      const ctl = controls.current;
      if (ctl) ctl.enabled = false;
      if (p.mode === 'intro') {
        s.shot = reducedMotion ? liveTarget() : introShot(liveRef.current);
        s.flight = reducedMotion ? null : { from: s.shot, to: liveTarget, start: s.clock, duration: INTRO_S, ease: easeInOutCubic };
      } else if (p.mode === 'frozen') {
        s.limits = heldRef.current.limits;
        s.base = heldRef.current.base;
        s.stops = heldRef.current.stops;
        s.stop = 0;
        s.punched = false;
        s.heldFocusKey = '';
        s.frameKey = '';
        if (p.railMode) p.onRail?.(0, s.stops.length);
        setOffCentre(false);
        const home = p.railMode ? s.stops[0]! : s.base;
        const from = s.shot ?? liveTarget();
        s.flight = {
          from,
          to: () => home,
          start: s.clock,
          duration: reducedMotion ? 0 : PUNCH_S,
          ease: easeOutCubic,
          done: () => {
            s.punched = true;
            handToOrbit(home);
          },
        };
      } else {
        // live or released: ease back to the director's framing (a cut from the intro if it was interrupted).
        setOffCentre(false);
        const from = prev === null ? liveTarget() : s.shot ?? liveTarget();
        if (prev === 'intro' && s.flight) s.flight = { ...s.flight, to: liveTarget };
        else s.flight = { from, to: liveTarget, start: s.clock, duration: reducedMotion || prev === null ? 0 : RETURN_S, ease: easeInOutCubic };
      }
    }

    // --- Held triggers: frame the influence string, fly to a named cast member ------------------------------
    if (p.mode === 'frozen' && s.punched && s.limits) {
      const fk = p.frame?.key ?? '';
      if (fk && fk !== s.frameKey && p.frame) {
        s.frameKey = fk;
        const limits = s.limits;
        const { a, b, bias = 0.45 } = p.frame;
        const next = frameShot(currentShot(camera), a, b, limits, bias);
        fly(next, STRING_S, () => {
          handToOrbit(next);
          setOffCentre(true);
        });
      } else if (!fk) {
        s.frameKey = '';
        const hk = p.heldFocus ? p.heldFocus.join(',') : '';
        if (hk && hk !== s.heldFocusKey && p.heldFocus) {
          const next = closeUpShot(currentShot(camera), p.heldFocus, s.limits);
          fly(next, FLY_S, () => {
            handToOrbit(next);
            setOffCentre(true);
          });
        }
        s.heldFocusKey = hk;
      }
    }

    // --- Flights --------------------------------------------------------------------------------------------
    const f = s.flight;
    if (f) {
      const k = f.duration <= 0 ? 1 : Math.min(1, (s.clock - f.start) / f.duration);
      s.shot = blendShots(f.from, f.to(), f.ease(k));
      if (k >= 1) {
        s.flight = null;
        f.done?.();
      } else busy = true;
    } else if (p.mode === 'live' || p.mode === 'released' || p.mode === 'intro') {
      // The director: damped dolly towards the focus, a fast move when someone else starts speaking.
      const want = liveTarget();
      const cur = s.shot ?? want;
      const rate = p.focus?.cut ? 9 : 2.2;
      const k = reducedMotion ? 1 : 1 - Math.exp(-rate * dt);
      s.shot = blendShots(cur, want, k);
      if (distance(s.shot.position, want.position) + distance(s.shot.target, want.target) > 1e-3) busy = true;
    } else if (p.mode === 'frozen' && controls.current?.enabled) {
      s.shot = currentShot(camera);
      if (s.base && !s.offCentre && distance(s.shot.position, s.base.position) > 0.5) setOffCentre(true);
    }

    // --- Write the camera (orbit controls own it while they are enabled) -------------------------------------
    const shot = s.shot;
    if (!shot || (controls.current?.enabled && !s.flight)) {
      if (busy) requestFrame();
      return;
    }
    let ox = 0;
    let oy = 0;
    if (p.mode === 'live' && !reducedMotion) {
      // Handheld drift of 2-3 CSS pixels, growing with pressure.
      const amp = swayPixels(p.pressure) * worldPerPixel(shot, state.size.height);
      ox = amp * (0.6 * Math.sin(s.clock * 0.61) + 0.4 * Math.sin(s.clock * 1.37 + 0.7));
      oy = amp * (0.6 * Math.sin(s.clock * 0.47 + 1.3) + 0.4 * Math.sin(s.clock * 1.13 + 0.2));
      busy = true;
    }
    _target.set(...shot.target);
    camera.position.set(...shot.position);
    if (ox !== 0 || oy !== 0) {
      _dir.subVectors(_target, camera.position).normalize();
      _right.crossVectors(_dir, camera.up).normalize();
      _up.crossVectors(_right, _dir).normalize();
      camera.position.addScaledVector(_right, ox).addScaledVector(_up, oy);
      _target.addScaledVector(_right, ox).addScaledVector(_up, oy);
    }
    camera.lookAt(_target);
    if (Math.abs(camera.fov - shot.fov) > 1e-4) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
    if (busy) requestFrame();
  });

  const { limits } = held;
  return props.mode === 'frozen' && !props.railMode ? (
    <OrbitControls
      ref={attachControls}
      makeDefault={false}
      enableDamping
      dampingFactor={0.12}
      enablePan={false}
      rotateSpeed={0.55}
      zoomSpeed={0.7}
      minAzimuthAngle={limits.minAzimuth}
      maxAzimuthAngle={limits.maxAzimuth}
      minPolarAngle={limits.minPolar}
      maxPolarAngle={limits.maxPolar}
      minDistance={limits.minDistance}
      maxDistance={limits.maxDistance}
    />
  ) : null;
}
