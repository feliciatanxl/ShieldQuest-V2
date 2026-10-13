// Small browser hooks for the squad clients: Screen Wake Lock, document title, audio extras.

import { useEffect, useRef, useState } from 'react';
import * as audio from '../audio/sfx';

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
}
interface WakeLockLike {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>;
}

/**
 * Keeps the screen awake while `active` (GDD §12.6). Browsers drop the lock when the tab is hidden,
 * so it is requested again when the page becomes visible. Needs no permission prompt.
 */
export function useWakeLock(active: boolean): void {
  const lock = useRef<WakeLockSentinelLike | null>(null);
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
    if (!active || !wl) return;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (lock.current && !lock.current.released)) return;
      try {
        const sentinel = await wl.request('screen');
        if (cancelled) void sentinel.release().catch(() => undefined);
        else lock.current = sentinel;
      } catch {
        // Battery saver or an unsupported browser: the session still works, the screen may dim.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
      else if (lock.current && !lock.current.released) void lock.current.release().catch(() => undefined);
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      const l = lock.current;
      lock.current = null;
      if (l && !l.released) void l.release().catch(() => undefined);
    };
  }, [active]);
}

/** An element's content-box size in CSS px, kept current with a ResizeObserver (sizes the projector QR). */
export function useElementSize<T extends HTMLElement>(): [(el: T | null) => void, { w: number; h: number }] {
  const [el, setEl] = useState<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    read();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, size];
}

/**
 * Sets attributes on <html> while mounted (e.g. data-grade="projector"), restoring what was there before.
 */
export function useRootAttributes(attrs: Readonly<Record<string, string>>): void {
  const key = JSON.stringify(attrs);
  useEffect(() => {
    const root = document.documentElement;
    const entries = Object.entries(JSON.parse(key) as Record<string, string>);
    const before = entries.map(([name]) => [name, root.getAttribute(name)] as const);
    for (const [name, value] of entries) root.setAttribute(name, value);
    return () => {
      for (const [name, value] of before) {
        if (value === null) root.removeAttribute(name);
        else root.setAttribute(name, value);
      }
    };
  }, [key]);
}

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ShieldQuest`;
  }, [title]);
}

type AudioProfile = 'solo' | 'squad-phone' | 'big-screen';

/**
 * Optional audio extras. The audio contract (audio/sfx.ts) may export a profile switch and Calm Mode;
 * they are looked up at runtime so this keeps working whichever audio build is in place.
 */
function optionalAudio(names: readonly string[], arg: unknown): void {
  const mod = audio as unknown as Record<string, unknown>;
  for (const name of names) {
    const fn = mod[name];
    if (typeof fn === 'function') {
      try {
        (fn as (a: unknown) => void)(arg);
      } catch {
        // Sound is a bonus.
      }
      return;
    }
  }
}

/** Phones in a classroom play only quiet UI cues; the projector carries ambience (GDD §10.2). */
export function useAudioProfile(profile: AudioProfile): void {
  useEffect(() => {
    optionalAudio(['setAudioProfile', 'setProfile'], profile);
    return () => optionalAudio(['setAudioProfile', 'setProfile'], 'solo');
  }, [profile]);
}

export function setCalmAudio(on: boolean): void {
  optionalAudio(['setCalmMode', 'setCalm'], on);
}
