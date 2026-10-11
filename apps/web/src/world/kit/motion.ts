// Motion helpers shared by every 3D component: reduced-motion detection and ref-counted shared GPU
// resources (so module-level geometries and textures are disposed when nobody uses them).
import { useEffect, useSyncExternalStore } from 'react';
import { useSettings, prefersReducedMotion } from '../../state/settings';

export * from './math';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribeOs(onChange: () => void): () => void {
  if (typeof matchMedia === 'undefined') return () => {};
  const mq = matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

const osReduced = () => typeof matchMedia !== 'undefined' && matchMedia(QUERY).matches;

/**
 * True when animation should be minimised: the in-app Motion setting, or the OS preference when the
 * setting is "system". Live-updates when either changes. Works inside and outside <Canvas>.
 */
export function useReducedMotion(): boolean {
  const motion = useSettings((s) => s.motion);
  const os = useSyncExternalStore(subscribeOs, osReduced, () => false);
  if (motion === 'system') return os;
  return motion === 'reduced';
}

/** Non-hook variant for event handlers and frame loops. */
export function isReducedMotion(): boolean {
  return prefersReducedMotion(useSettings.getState().motion);
}

/** A GPU resource built on first use and disposed (after a short grace period) when nobody holds it. */
export interface SharedResource<T> {
  /** Current value, created if needed. Does not count as a user. */
  get(): T;
  acquire(): T;
  release(): void;
}

export function sharedResource<T>(create: () => T, dispose: (value: T) => void, graceMs = 1500): SharedResource<T> {
  let value: T | null = null;
  let users = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  // The grace period covers render -> effect gaps and quick remounts (StrictMode, route changes).
  const scheduleDispose = () => {
    cancel();
    timer = setTimeout(() => {
      timer = null;
      if (users === 0 && value !== null) {
        dispose(value);
        value = null;
      }
    }, graceMs);
  };
  const get = () => {
    if (value === null) {
      value = create();
      if (users === 0) scheduleDispose();
    }
    return value;
  };
  return {
    get,
    acquire() {
      users++;
      cancel();
      return get();
    },
    release() {
      users = Math.max(0, users - 1);
      if (users === 0) scheduleDispose();
    },
  };
}

/** Holds a shared resource for the lifetime of the component (counted from the effect, StrictMode-safe). */
export function useShared<T>(resource: SharedResource<T>): T {
  const value = resource.get();
  useEffect(() => {
    resource.acquire();
    return () => resource.release();
  }, [resource]);
  return value;
}
