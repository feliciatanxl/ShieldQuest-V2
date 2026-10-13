// City Hub camera rig and pointer controls (GAME_DESIGN.md §4.5): an orthographic, isometric-style turntable whose
// zoom is fitted to the canvas every frame (so the city fits a 360x800 phone and a 1920x1080 projector alike). Drag
// spins the turntable with inertia and tilts within a clamped range; focusing a district plays a 900 ms ease-out
// zoom (a cut under reduced motion); `showcase` adds a slow cinematic orbit. Taps are picked analytically (pins in
// screen space, districts as vertical cylinders) so no per-move raycast walks the city's triangles.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Raycaster, Vector2, Vector3, type OrthographicCamera } from 'three';
import type { DistrictId } from '@shieldquest/shared';
import { useKit } from '../kit/context';
import { clamp, easeOutCubic, lerp } from '../kit/math';
import {
  CAMERA_DISTANCE,
  FOCUS_MS,
  HOME_AZIMUTH,
  HOME_ELEVATION,
  MAX_ELEVATION,
  MIN_ELEVATION,
  OVERVIEW_POINTS,
  OVERVIEW_TARGET,
  SHOWCASE_PERIOD,
  basis,
  districtPoints,
  districtTarget,
  facingAzimuth,
  fitView,
  nearestAngle,
  rayCylinder,
  regionWithPins,
  viewRegion,
  type Basis,
  type FrameMode,
} from './camera';
import { CITY, DISTRICT_SPOTS, PIN, markerAnchor, spotById, type Pin, type V3 } from './layout';

export type CityHover = { kind: 'district'; id: DistrictId } | { kind: 'pin'; missionId: string; district: DistrictId };

interface Frame {
  target: V3;
  zoom: number;
  u: number;
  v: number;
}

interface Drag {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
  samples: { t: number; az: number }[];
}

/** Pointer travel (px) below which a press counts as a tap, not a drag. */
const TAP_SLOP = 8;
/** Seconds of stillness after a drag before the showcase orbit resumes. */
const SHOWCASE_RESUME = 2.5;
/** Inertia half-life-ish decay rate (1/s). */
const SPIN_DECAY = 2.6;

export interface CityRigProps {
  focus: DistrictId | null;
  mode: FrameMode;
  pins: readonly Pin[];
  /** Rows of pins over the focused district (framing leaves room for them). */
  pinRows: number;
  showcase: boolean;
  /** Pointer drag, hover and taps are on (City Hub). Off for decorative views so page scrolling is untouched. */
  interactive: boolean;
  onSelectDistrict?: (district: DistrictId) => void;
  onSelectMission?: (missionId: string) => void;
  onHover: (hover: CityHover | null) => void;
  /** Ambient (throttled) frame request for the showcase orbit. */
  onAnimate: () => void;
  /** Extra height (m) the overview must keep in frame above the Stillpoint (projector lantern stacks). */
  ceiling?: number;
}

function blend(a: Frame, b: Frame, t: number): Frame {
  return {
    target: [lerp(a.target[0], b.target[0], t), lerp(a.target[1], b.target[1], t), lerp(a.target[2], b.target[2], t)],
    // Zoom blends geometrically so the move feels even from far to near.
    zoom: a.zoom * Math.pow(b.zoom / a.zoom, t),
    u: lerp(a.u, b.u, t),
    v: lerp(a.v, b.v, t),
  };
}

const sameHover = (a: CityHover | null, b: CityHover | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.kind === b.kind &&
    (a.kind === 'district' ? a.id === (b as typeof a).id : a.missionId === (b as typeof a).missionId));

export function CityRig({
  focus,
  mode,
  pins,
  pinRows,
  showcase,
  interactive,
  onSelectDistrict,
  onSelectMission,
  onHover,
  onAnimate,
  ceiling = 0,
}: CityRigProps) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const { reducedMotion, requestFrame } = useKit();

  const st = useRef({
    az: HOME_AZIMUTH,
    el: HOME_ELEVATION,
    vel: 0,
    azFrom: HOME_AZIMUTH,
    azTo: null as number | null,
    p: 1,
    from: null as Frame | null,
    cur: null as Frame | null,
    drag: null as Drag | null,
    idleSince: -Infinity,
    clock: 0,
    hover: null as CityHover | null,
  });

  // Latest props for the native listeners (attached once per interactive/canvas change).
  const latest = useRef({ pins, onSelectDistrict, onSelectMission, onHover, reducedMotion, focus });
  latest.current = { pins, onSelectDistrict, onSelectMission, onHover, reducedMotion, focus };

  const view = useMemo(
    () => ({
      points: focus
        ? districtPoints(focus)
        : ceiling > CITY.tower + 6
          ? [...OVERVIEW_POINTS, [0, ceiling, 0] as V3]
          : OVERVIEW_POINTS,
      target: focus ? districtTarget(focus) : OVERVIEW_TARGET,
    }),
    [focus, ceiling],
  );

  // Camera clip range: far enough for the whole bay, near plane never cutting the water at the bottom edge.
  useEffect(() => {
    camera.near = 1;
    camera.far = CAMERA_DISTANCE * 2 + 2000;
    camera.updateProjectionMatrix();
  }, [camera]);

  // Focus changes start the 900 ms zoom (or cut), turning the turntable to look at the district from outside.
  useEffect(() => {
    const s = st.current;
    s.from = s.cur ? { ...s.cur, target: [...s.cur.target] as V3 } : null;
    s.azFrom = s.az;
    s.azTo = focus ? nearestAngle(s.az, facingAzimuth(focus)) : null;
    s.vel = 0;
    if (reducedMotion || !s.cur) {
      s.p = 1;
      if (s.azTo !== null) s.az = s.azTo;
      s.azTo = null;
      s.from = null;
    } else {
      s.p = 0;
    }
    requestFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  useEffect(() => {
    requestFrame();
  }, [size.width, size.height, mode, pinRows, showcase, requestFrame]);

  const frameFor = (b: Basis): Frame => {
    const w = Math.max(1, size.width);
    const h = Math.max(1, size.height);
    let region = viewRegion(w / h, mode);
    if (focus) region = regionWithPins(region, pinRows, h, PIN.spacing);
    const f = fitView(view.points, view.target, b, w, h, region);
    return { target: view.target, zoom: f.zoom, u: f.shiftU, v: f.shiftV };
  };

  useFrame((state, delta) => {
    const s = st.current;
    const dt = Math.min(delta, 0.1);
    s.clock = state.clock.elapsedTime;
    let busy = false;
    let orbiting = false;
    if (!s.drag) {
      if (Math.abs(s.vel) > 0.004) {
        s.az += s.vel * dt;
        s.vel *= Math.exp(-SPIN_DECAY * dt);
        busy = true;
      } else {
        s.vel = 0;
      }
      if (showcase && !reducedMotion && s.vel === 0 && s.azTo === null && s.clock - s.idleSince > SHOWCASE_RESUME) {
        s.az += ((Math.PI * 2) / SHOWCASE_PERIOD) * dt;
        orbiting = true;
      }
    }
    if (s.p < 1) {
      s.p = Math.min(1, s.p + (dt * 1000) / FOCUS_MS);
      busy = true;
    }
    const e = easeOutCubic(s.p);
    if (s.azTo !== null) {
      s.az = lerp(s.azFrom, s.azTo, e);
      if (s.p >= 1) s.azTo = null;
    }
    const b = basis(s.az, s.el);
    const dest = frameFor(b);
    const cur = s.from && s.p < 1 ? blend(s.from, dest, e) : dest;
    if (s.p >= 1) s.from = null;
    s.cur = cur;

    const [tx, ty, tz] = cur.target;
    const px = tx + b.right[0] * cur.u + b.up[0] * cur.v + b.dir[0] * CAMERA_DISTANCE;
    const py = ty + b.right[1] * cur.u + b.up[1] * cur.v + b.dir[1] * CAMERA_DISTANCE;
    const pz = tz + b.right[2] * cur.u + b.up[2] * cur.v + b.dir[2] * CAMERA_DISTANCE;
    camera.position.set(px, py, pz);
    camera.up.set(0, 1, 0);
    camera.lookAt(px - b.dir[0], py - b.dir[1], pz - b.dir[2]);
    if (Math.abs(camera.zoom - cur.zoom) > 1e-6) {
      camera.zoom = cur.zoom;
      camera.updateProjectionMatrix();
    }
    if (busy || s.drag) requestFrame();
    else if (orbiting) onAnimate();
  });

  // --- Pointer: drag to spin/tilt, tap to select, hover to highlight -----------------------------------------
  useEffect(() => {
    const el = gl.domElement;
    if (!interactive) {
      el.style.cursor = '';
      return;
    }
    const s = st.current;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const v = new Vector3();

    const pick = (clientX: number, clientY: number): CityHover | null => {
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      // Pins first (they draw on top), nearest centre wins.
      let best: CityHover | null = null;
      let bestD = Infinity;
      for (const pin of latest.current.pins) {
        const a = markerAnchor(spotById(pin.marker.district));
        v.set(a[0], a[1], a[2]).project(camera);
        const cx = ((v.x + 1) / 2) * rect.width + pin.offset[0];
        const cy = ((1 - v.y) / 2) * rect.height - pin.offset[1];
        const half = Math.max(24, pin.size / 2) + 3;
        const dx = Math.abs(x - cx);
        const dy = Math.abs(y - cy);
        if (dx <= half && dy <= half && dx * dx + dy * dy < bestD) {
          bestD = dx * dx + dy * dy;
          best = { kind: 'pin', missionId: pin.marker.missionId, district: pin.marker.district };
        }
      }
      if (best) return best;
      ndc.set((x / Math.max(1, rect.width)) * 2 - 1, -(y / Math.max(1, rect.height)) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const o = raycaster.ray.origin.toArray() as V3;
      const d = raycaster.ray.direction.toArray() as V3;
      // The Stillpoint plaza blocks what is behind it.
      let tBest = rayCylinder(o, d, 0, 0, CITY.hub * 0.92, -CITY.hubDepth - 4, CITY.tower) ?? Infinity;
      let hit: DistrictId | null = null;
      for (const spot of DISTRICT_SPOTS) {
        const top = spot.id === 'digi-district' ? CITY.skyTop : 24;
        const t = rayCylinder(o, d, spot.x, spot.z, CITY.plate * 0.96, -CITY.plateDepth - 4, top);
        if (t !== null && t < tBest) {
          tBest = t;
          hit = spot.id;
        }
      }
      return hit ? { kind: 'district', id: hit } : null;
    };

    const setHover = (h: CityHover | null) => {
      if (sameHover(s.hover, h)) return;
      s.hover = h;
      latest.current.onHover(h);
    };

    const cursor = () => {
      el.style.cursor = s.drag?.moved ? 'grabbing' : s.hover ? 'pointer' : 'grab';
    };

    const onDown = (e: PointerEvent) => {
      if (s.drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Capture can fail for synthetic events; dragging still works inside the canvas.
      }
      s.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false, samples: [] };
      s.vel = 0;
      requestFrame();
    };

    const onMove = (e: PointerEvent) => {
      const d = s.drag;
      if (!d) {
        if (e.pointerType === 'mouse') {
          setHover(pick(e.clientX, e.clientY));
          cursor();
        }
        return;
      }
      if (e.pointerId !== d.id) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > TAP_SLOP) {
        d.moved = true;
        // A drag takes over from a running focus spin (the zoom itself still completes).
        s.azTo = null;
        setHover(null);
        cursor();
      }
      if (!d.moved) return;
      // Ground under the finger roughly follows it: radians per pixel from the framed radius on screen.
      const zoom = s.cur?.zoom ?? 2;
      const radiusPx = clamp((latest.current.focus ? CITY.plate * 1.4 : CITY.rim * 0.8) * zoom, 110, 800);
      s.az -= dx / radiusPx;
      s.el = clamp(s.el + dy * 0.0045, MIN_ELEVATION, MAX_ELEVATION);
      const t = performance.now();
      d.samples.push({ t, az: s.az });
      while (d.samples.length > 2 && t - d.samples[0]!.t > 120) d.samples.shift();
      requestFrame();
    };

    const end = (e: PointerEvent, cancelled: boolean) => {
      const d = s.drag;
      if (!d || e.pointerId !== d.id) return;
      s.drag = null;
      try {
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      } catch {
        // Already released.
      }
      s.idleSince = s.clock;
      if (!d.moved) {
        if (!cancelled) {
          const hit = pick(e.clientX, e.clientY);
          const { onSelectDistrict: selectDistrict, onSelectMission: selectMission } = latest.current;
          if (hit?.kind === 'pin') {
            if (selectMission) selectMission(hit.missionId);
            else selectDistrict?.(hit.district);
          } else if (hit?.kind === 'district') {
            selectDistrict?.(hit.id);
          }
        }
      } else if (!latest.current.reducedMotion && d.samples.length >= 2) {
        const first = d.samples[0]!;
        const last = d.samples[d.samples.length - 1]!;
        const span = (last.t - first.t) / 1000;
        if (span > 0.008 && performance.now() - last.t < 90) s.vel = clamp((last.az - first.az) / span, -5, 5);
      }
      if (e.pointerType === 'mouse') setHover(pick(e.clientX, e.clientY));
      else setHover(null);
      cursor();
      requestFrame();
    };

    const onUp = (e: PointerEvent) => end(e, false);
    const onCancel = (e: PointerEvent) => end(e, true);
    const onLeave = (e: PointerEvent) => {
      if (!s.drag && e.pointerType === 'mouse') {
        setHover(null);
        cursor();
      }
    };

    cursor();
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('pointerleave', onLeave);
      el.style.cursor = '';
      s.drag = null;
      if (s.hover) {
        s.hover = null;
        latest.current.onHover(null);
      }
    };
  }, [gl, camera, interactive, requestFrame]);

  return null;
}
