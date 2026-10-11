// The ONE <Canvas> wrapper every 3D view uses (GAME_DESIGN.md §10.2):
// - dpr / antialias / shadows from QUALITY_BUDGET[tier]; frame-rate aware resolution (flip-flop limited to 3);
// - frameloop "demand" with a kit frame scheduler (30 fps cap on Low), paused while the tab is hidden;
// - WebGL context loss -> DOM "Tap to restore the 3D view" -> remount; after two losses -> 2D fallback;
// - accessible: the stage is role="img" with a scene description, and a DOM overlay layer (outside the img)
//   hosts focusable controls such as hotspot buttons.
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber';
import { SRGBColorSpace } from 'three';
import { QUALITY_BUDGET, type QualityTier } from '../quality';
import { KitContext, type KitContextValue } from './context';
import { clamp, type Vec3 } from './math';
import { useReducedMotion } from './motion';
import { createKitUniforms, type KitUniforms } from './uniforms';
import './kit.css';

export { useReducedMotion } from './motion';

export interface AdaptiveCanvasCamera {
  position?: Vec3;
  fov?: number;
  near?: number;
  far?: number;
  /** Orthographic zoom (pixels per unit) when `orthographic` is set. */
  zoom?: number;
}

export interface PerformanceReport {
  /** decline/incline: resolution changed; struggling: already at the lowest resolution and still slow;
   * settled: flip-flopped more than 3 times, resolution locked. */
  type: 'decline' | 'incline' | 'struggling' | 'settled';
  /** 0..1 position inside the tier's dpr range. */
  factor: number;
  fps: number;
}

export interface AdaptiveCanvasProps {
  children: ReactNode;
  quality: QualityTier;
  /** Describes the scene for screen readers (the stage has role="img"). */
  ariaLabel: string;
  camera?: AdaptiveCanvasCamera;
  orthographic?: boolean;
  className?: string;
  style?: CSSProperties;
  /**
   * 'demand' (default): renders only when something changes or a kit component animates.
   * 'always': continuous (still capped at ~30 fps on Low). 'never': frozen frame.
   */
  frameloop?: 'demand' | 'always' | 'never';
  /** Called after the second WebGL context loss (switch to Flat View), or when WebGL is unavailable. */
  onFallback2D?: () => void;
  /** Rendered instead of the canvas when WebGL is unavailable or after two context losses (e.g. the 2D twin). */
  fallback?: ReactNode;
  /** Runtime performance reports (e.g. drop a tier on 'struggling'). */
  onPerformance?: (report: PerformanceReport) => void;
  /** Shared shader uniforms; pass your own to drive the freeze from outside, otherwise one set per canvas. */
  uniforms?: KitUniforms;
  /** Called once the renderer exists (after every remount). */
  onCreated?: (state: RootState) => void;
}

const LOW_FRAME_MS = 33;

function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return hidden;
}

interface KitRootProps {
  tier: QualityTier;
  uniforms: KitUniforms;
  reducedMotion: boolean;
  /** Null until the overlay element is mounted (so consumers' effects re-run once it exists). */
  overlay: RefObject<HTMLDivElement | null> | null;
  continuous: boolean;
  hidden: boolean;
  onPerformance?: (report: PerformanceReport) => void;
  children: ReactNode;
}

/** Lives inside <Canvas>: frame scheduler, adaptive resolution, static shadows and the kit context. */
function KitRoot({ tier, uniforms, reducedMotion, overlay, continuous, hidden, onPerformance, children }: KitRootProps) {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const setDpr = useThree((s) => s.setDpr);
  const regress = useThree((s) => s.performance.current);
  const budget = QUALITY_BUDGET[tier];
  const frameStart = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportRef = useRef(onPerformance);
  reportRef.current = onPerformance;

  const requestFrame = useCallback(() => {
    if (tier !== 'low') {
      invalidate();
      return;
    }
    if (timer.current !== null) return;
    const wait = Math.max(0, LOW_FRAME_MS - (performance.now() - frameStart.current));
    timer.current = setTimeout(() => {
      timer.current = null;
      invalidate();
    }, wait);
  }, [tier, invalidate]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    },
    [],
  );

  // Runs before every other frame callback: marks the frame start for the Low-tier throttle.
  useFrame(() => {
    frameStart.current = performance.now();
  }, -1000);

  useFrame(() => {
    if (continuous) requestFrame();
  });

  useEffect(() => {
    if (!hidden) requestFrame();
  }, [hidden, continuous, requestFrame]);

  // --- Adaptive resolution (gap-aware monitor: idle gaps in demand mode are not slow frames) ---
  const [factor, setFactor] = useState(1);
  const monitor = useRef({ frames: 0, acc: 0, windows: [] as number[], lastDir: 0, flips: 0, settled: false, factor: 1 });
  useEffect(() => {
    const [min, max] = budget.dpr;
    const device = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const target = Math.min(device, min + (max - min) * factor);
    setDpr(Math.max(0.5, Math.round(target * regress * 100) / 100));
  }, [factor, regress, budget, setDpr]);

  useFrame((_, delta) => {
    const m = monitor.current;
    if (m.settled) return;
    const ms = delta * 1000;
    if (ms <= 0 || ms > 250) return;
    m.frames++;
    m.acc += ms;
    if (m.acc < 250) return;
    const fps = (m.frames / m.acc) * 1000;
    m.frames = 0;
    m.acc = 0;
    m.windows.push(fps);
    if (m.windows.length < 10) return;
    const [lower, upper] = tier === 'low' ? [20, 27] : [40, 55];
    const below = m.windows.filter((f) => f < lower).length;
    const above = m.windows.filter((f) => f >= upper).length;
    const avg = m.windows.reduce((a, b) => a + b, 0) / m.windows.length;
    m.windows = [];
    let dir = 0;
    if (below > 7) dir = -1;
    else if (above > 7 && m.factor < 1) dir = 1;
    if (dir === 0) return;
    const next = clamp(Math.round((m.factor + dir * 0.2) * 10) / 10);
    if (next === m.factor) {
      if (dir < 0) reportRef.current?.({ type: 'struggling', factor: m.factor, fps: avg });
      return;
    }
    if (m.lastDir !== 0 && dir !== m.lastDir) m.flips++;
    m.lastDir = dir;
    m.factor = dir < 0 ? next : m.flips >= 3 ? m.factor : next;
    setFactor(m.factor);
    reportRef.current?.({ type: dir < 0 ? 'decline' : 'incline', factor: m.factor, fps: avg });
    if (m.flips >= 3) {
      m.settled = true;
      reportRef.current?.({ type: 'settled', factor: m.factor, fps: avg });
    }
  });

  // --- One static shadow map on High: rendered on demand, not every frame ---
  const refreshShadows = useCallback(() => {
    if (!gl.shadowMap.enabled) return;
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, invalidate]);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    const t = setTimeout(refreshShadows, 300);
    return () => clearTimeout(t);
  }, [gl, refreshShadows]);

  const value = useMemo<KitContextValue>(
    () => ({ tier, uniforms, reducedMotion, requestFrame, overlay, refreshShadows }),
    [tier, uniforms, reducedMotion, requestFrame, overlay, refreshShadows],
  );
  useEffect(() => {
    invalidate();
  }, [value, invalidate]);

  return <KitContext.Provider value={value}>{children}</KitContext.Provider>;
}

function webglAvailable(): boolean {
  try {
    return typeof document !== 'undefined' && Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

/** The one Canvas wrapper. Fills its parent; give the parent a size. */
export function AdaptiveCanvas({
  children,
  quality,
  ariaLabel,
  camera,
  orthographic = false,
  className,
  style,
  frameloop = 'demand',
  onFallback2D,
  fallback,
  onPerformance,
  uniforms: uniformsProp,
  onCreated,
}: AdaptiveCanvasProps) {
  const budget = QUALITY_BUDGET[quality];
  const reducedMotion = useReducedMotion();
  const hidden = useDocumentHidden();
  const overlay = useRef<HTMLDivElement | null>(null);
  // The r3f tree can mount before the sibling overlay div's ref is attached: publish the ref through context
  // only once it is set, so hotspot buttons (and other overlay users) mount into it reliably.
  const [overlayReady, setOverlayReady] = useState(false);
  const setOverlay = useCallback((el: HTMLDivElement | null) => {
    overlay.current = el;
    setOverlayReady(el !== null);
  }, []);
  const ownUniforms = useMemo(() => createKitUniforms(), []);
  const uniforms = uniformsProp ?? ownUniforms;
  const [canvasKey, setCanvasKey] = useState(0);
  const [lost, setLost] = useState(false);
  const [losses, setLosses] = useState(0);
  const [supported] = useState(webglAvailable);
  const detach = useRef<(() => void) | null>(null);
  const restoreButton = useRef<HTMLButtonElement | null>(null);
  const fallbackRef = useRef(onFallback2D);
  fallbackRef.current = onFallback2D;

  const gaveUp = !supported || losses >= 2;
  useEffect(() => {
    if (gaveUp) fallbackRef.current?.();
  }, [gaveUp]);

  useEffect(() => () => detach.current?.(), []);
  useEffect(() => {
    if (lost) restoreButton.current?.focus();
  }, [lost]);

  const handleCreated = useCallback(
    (state: RootState) => {
      state.gl.outputColorSpace = SRGBColorSpace;
      detach.current?.();
      const canvas = state.gl.domElement;
      const onLost = (event: Event) => {
        // preventDefault lets the browser hand the context back; we still remount for a clean renderer.
        event.preventDefault();
        setLost(true);
        setLosses((n) => n + 1);
      };
      canvas.addEventListener('webglcontextlost', onLost);
      detach.current = () => canvas.removeEventListener('webglcontextlost', onLost);
      onCreated?.(state);
    },
    [onCreated],
  );

  const restore = useCallback(() => {
    setLost(false);
    setCanvasKey((k) => k + 1);
  }, []);

  const cameraProps = useMemo(() => {
    const c = camera ?? {};
    return {
      position: c.position ?? ([0, 4, 10] as Vec3),
      ...(c.fov !== undefined ? { fov: c.fov } : {}),
      ...(c.near !== undefined ? { near: c.near } : {}),
      ...(c.far !== undefined ? { far: c.far } : {}),
      ...(c.zoom !== undefined ? { zoom: c.zoom } : {}),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(camera)]);

  const classes = ['w-canvas', className].filter(Boolean).join(' ');

  if (gaveUp) {
    return (
      <div className={classes} style={style}>
        {fallback ?? (
          <div className="w-canvas__lost w-canvas__lost--static" role="status">
            <p className="w-canvas__lost-text">The 3D view is resting. Everything you need is in the panels.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={classes} style={style}>
      <div className="w-canvas__stage" role="img" aria-label={ariaLabel}>
        {!lost && (
          <Canvas
            key={canvasKey}
            dpr={budget.dpr}
            shadows={budget.shadows ? 'percentage' : false}
            flat
            orthographic={orthographic}
            camera={cameraProps}
            frameloop={hidden || frameloop === 'never' ? 'never' : 'demand'}
            gl={{ antialias: budget.antialias, powerPreference: 'high-performance', alpha: true, stencil: false }}
            performance={{ min: 0.6 }}
            onCreated={handleCreated}
            aria-hidden="true"
          >
            <KitRoot
              tier={quality}
              uniforms={uniforms}
              reducedMotion={reducedMotion}
              overlay={overlayReady ? overlay : null}
              continuous={frameloop === 'always'}
              hidden={hidden}
              onPerformance={onPerformance}
            >
              <Suspense fallback={null}>{children}</Suspense>
            </KitRoot>
          </Canvas>
        )}
      </div>
      <div ref={setOverlay} className="w-canvas__overlay" />
      {lost && (
        <div className="w-canvas__lost" role="status">
          <p className="w-canvas__lost-text">The 3D view paused to protect your device.</p>
          <button ref={restoreButton} type="button" className="w-canvas__restore" onClick={restore}>
            Tap to restore the 3D view
          </button>
        </div>
      )}
    </div>
  );
}

export default AdaptiveCanvas;
