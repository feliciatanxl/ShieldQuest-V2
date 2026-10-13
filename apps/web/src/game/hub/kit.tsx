// Small building blocks shared by the city hub and the Bond Book (both owned by the hub module).
import {
  Component,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import type { DistrictId } from '@shieldquest/shared';
import { prefersReducedMotion, useSettings } from '../../state/settings';
import { playSfx, unlockAudio, type Sfx } from '../../audio/sfx';
import { TRUST_MAX, trustWord } from './hubData';
import './kit.css';

/** Layout switch shared by CSS and JS: side panel on laptops and on phones held sideways. */
export const SIDE_LAYOUT_QUERY = '(min-width: 64rem), (orientation: landscape) and (min-width: 40rem)';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof matchMedia === 'undefined') return () => {};
      const mq = matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => typeof matchMedia !== 'undefined' && matchMedia(query).matches,
    () => false,
  );
}

/** Reduced motion from the in-app setting, following the OS preference live when set to "system". */
export function useReducedMotionSetting(): boolean {
  const motion = useSettings((s) => s.motion);
  const osReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  return motion === 'system' ? osReduced : prefersReducedMotion(motion);
}

/** LazyMotion keeps the motion bundle small; MotionConfig turns transforms into plain fades when reduced. */
export function MotionRoot({ children }: { children: ReactNode }) {
  const reduced = useReducedMotionSetting();
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>{children}</MotionConfig>
    </LazyMotion>
  );
}

/** Sound cue that respects the Sound setting (the audio module stays a dumb synthesizer). */
export function useSfx() {
  const sound = useSettings((s) => s.sound);
  return useCallback(
    (name: Sfx, opts?: { intensity?: number; step?: number }) => {
      if (sound) playSfx(name, opts);
    },
    [sound],
  );
}

/** Browsers block audio until a gesture: unlock on the first tap or key press, then run `then`. */
export function useFirstGesture(then?: () => void) {
  const thenRef = useRef(then);
  useEffect(() => {
    thenRef.current = then;
  });
  useEffect(() => {
    const off = () => {
      window.removeEventListener('pointerdown', on, true);
      window.removeEventListener('keydown', on, true);
    };
    const on = () => {
      off();
      unlockAudio();
      thenRef.current?.();
    };
    window.addEventListener('pointerdown', on, true);
    window.addEventListener('keydown', on, true);
    return off;
  }, []);
}

/**
 * Scrolls a horizontally scrolling row just enough to show `item`. Only the row moves: scrollIntoView
 * would also nudge the page or the overlay vertically on phones.
 */
export function revealInRow(row: HTMLElement | null, item: Element | null, reduced: boolean): void {
  if (!row || !item || row.scrollWidth <= row.clientWidth + 1) return;
  const r = row.getBoundingClientRect();
  const b = item.getBoundingClientRect();
  const pad = 12;
  const by = b.left < r.left + pad ? b.left - r.left - pad : b.right > r.right - pad ? b.right - r.right + pad : 0;
  if (by !== 0) row.scrollBy({ left: by, behavior: reduced ? 'auto' : 'smooth' });
}

/** Per-viewer conveniences only (remembered district, seen Bond marks). Never game state. */
export function readStored<T>(store: 'local' | 'session', key: string, fallback: T): T {
  try {
    const raw = (store === 'local' ? localStorage : sessionStorage).getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(store: 'local' | 'session', key: string, value: unknown): void {
  try {
    const s = store === 'local' ? localStorage : sessionStorage;
    if (value === null || value === undefined) s.removeItem(key);
    else s.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked (private mode, managed devices): the convenience is simply not remembered.
  }
}

/**
 * Error boundary around lazy 3D views. If the 3D chunk fails to load (offline before it was cached)
 * or WebGL throws, the 2D twin takes over so play never depends on the 3D view.
 * A class is the only way React offers to catch render errors.
 */
export class ViewBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.warn('[ShieldQuest] 3D view unavailable, showing the 2D view instead.', error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * The Stillpoint: the city's clock tower, stuck at 11:59. Decorative (aria-hidden); the second hand
 * trembles unless motion is reduced.
 */
export function Stillpoint({ size = 160, frozen = false }: { size?: number; frozen?: boolean }) {
  const glowId = `hub-sp-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg
      className={`hub-stillpoint${frozen ? ' hub-stillpoint--frozen' : ''}`}
      width={size}
      height={size * 1.25}
      viewBox="0 0 160 200"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* hex plates around the base */}
      <path d="M14 170l20-11 20 11-20 11z" fill="var(--school)" opacity="0.85" />
      <path d="M106 170l20-11 20 11-20 11z" fill="var(--digi)" opacity="0.85" />
      <path d="M60 184l20-11 20 11-20 11z" fill="var(--retail)" opacity="0.85" />
      <circle cx="80" cy="58" r="44" fill={`url(#${glowId})`} />
      {/* tower */}
      <path d="M66 172V92l14-14 14 14v80z" fill="var(--bg-3)" />
      <path d="M80 78l14 14v80H80z" fill="var(--bg-2)" />
      <path d="M70 34h20l6 10v40H64V44z" fill="var(--surface-2)" />
      <path d="M80 12l12 22H68z" fill="var(--bg-3)" />
      <circle cx="80" cy="9" r="3.2" fill="var(--gold)" />
      {/* clock face at 11:59 */}
      <circle cx="80" cy="60" r="15" fill="var(--paper)" stroke="var(--gold)" strokeWidth="2.5" />
      <path d="M80 60l-0.2-8" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M80 60l-1.2-11.5" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" />
      <g className="hub-stillpoint__second">
        <path d="M80 62l0-13" stroke="var(--retail)" strokeWidth="1" strokeLinecap="round" />
      </g>
      <circle cx="80" cy="60" r="1.6" fill="var(--ink)" />
      {/* windows */}
      <path d="M75 104h10v8H75zM75 124h10v8H75zM75 144h10v8H75z" fill="var(--gold)" opacity="0.7" />
      {/* hanging rain beads */}
      <g className="hub-stillpoint__rain" fill="var(--frost)">
        <circle cx="30" cy="40" r="1.6" />
        <circle cx="42" cy="88" r="1.4" />
        <circle cx="22" cy="122" r="1.6" />
        <circle cx="128" cy="34" r="1.5" />
        <circle cx="140" cy="96" r="1.6" />
        <circle cx="118" cy="130" r="1.4" />
        <circle cx="50" cy="14" r="1.3" />
        <circle cx="112" cy="70" r="1.3" />
      </g>
    </svg>
  );
}

/** Paper lantern glyph (trust / light). Decorative. */
export function LanternGlyph({ size = 18, lit = true }: { size?: number; lit?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M10 2.5h4M12 2.5v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M7.5 7.5c0-1.6 2-3 4.5-3s4.5 1.4 4.5 3v8c0 1.6-2 3-4.5 3s-4.5-1.4-4.5-3z"
        fill={lit ? 'var(--gold)' : 'none'}
        stroke={lit ? 'var(--gold)' : 'currentColor'}
        strokeWidth="1.8"
        strokeDasharray={lit ? undefined : '2.5 2'}
      />
      <path d="M8 11.5h8" stroke={lit ? 'var(--ink)' : 'currentColor'} strokeWidth="1.2" opacity="0.5" />
      <path d="M10.5 18.5l-.5 3M13.5 18.5l.5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Story-wallet coin (fictional S$). Decorative. */
export function CoinGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <ellipse cx="12" cy="15" rx="8" ry="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <ellipse cx="12" cy="10" rx="8" ry="4" fill="var(--gold)" stroke="var(--gold)" strokeWidth="1.8" />
      <path d="M4 10v5M20 10v5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.2 10h3.6" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const DISTRICT_GLYPH: Record<DistrictId, string> = {
  // book
  'school-street': 'M5 4.5h9.5A3.5 3.5 0 0 1 18 8v12a2.5 2.5 0 0 0-2.5-2.5H5zM5 4.5v13',
  // shopping bag
  'retail-district': 'M5.5 8h13l-1 12h-11zM9 8V6.5a3 3 0 0 1 6 0V8',
  // chat bubble with spark
  'digi-district': 'M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4V16H5.5A1.5 1.5 0 0 1 4 14.5zM12 7.5v5M9.5 10h5',
  // void deck pillars
  'void-deck-commons': 'M3 8h18M3 8l9-4 9 4M6 8v11M12 8v11M18 8v11M3 19h18',
  // train
  interchange: 'M7 4h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM5 11h14M8.5 14h.01M15.5 14h.01M8 17l-2 3M16 17l2 3',
};

/** District plate: a hex in the district colour with its glyph. Fogged plates get a dashed outline. */
export function DistrictPlate({
  district,
  color,
  fogged,
  size = 40,
}: {
  district: DistrictId;
  color: string;
  fogged?: boolean;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false" className="hub-plate">
      <path
        d="M20 2.5l15.2 8.75v17.5L20 37.5 4.8 28.75v-17.5z"
        fill={fogged ? 'var(--surface-2)' : color}
        stroke={fogged ? 'var(--muted)' : 'rgba(255,255,255,0.35)'}
        strokeWidth="1.5"
        strokeDasharray={fogged ? '3 2.5' : undefined}
      />
      <g transform="translate(9 9) scale(0.917)">
        <path
          d={DISTRICT_GLYPH[district]}
          fill="none"
          stroke={fogged ? 'var(--muted)' : 'var(--ink)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** Trust meter: seven segments from -3 to +3 plus the number and a word (never colour alone). */
export function TrustMeter({ value, label }: { value: number; label: string }) {
  const segs = [];
  for (let i = -TRUST_MAX; i <= TRUST_MAX; i++) {
    if (i === 0) continue;
    const on = (value > 0 && i > 0 && i <= value) || (value < 0 && i < 0 && i >= value);
    segs.push(<span key={i} className={`hub-meter__seg${on ? (i > 0 ? ' is-lit' : ' is-dim') : ''}`} />);
  }
  const signed = value > 0 ? `+${value}` : String(value);
  return (
    <div className="hub-meter" role="img" aria-label={`${label}: ${signed} of ${TRUST_MAX}, ${trustWord(value)}`}>
      <span className="hub-meter__track" aria-hidden="true">
        {segs.slice(0, TRUST_MAX)}
        <span className="hub-meter__mid" />
        {segs.slice(TRUST_MAX)}
      </span>
      <span className="hub-meter__value" aria-hidden="true">
        {signed} <small>{trustWord(value)}</small>
      </span>
    </div>
  );
}

/** Short-lived visible caption for a meaningful sound (shown only when sound is on). */
export function useSoundCaption(): [string | null, (text: string) => void] {
  const [caption, setCaption] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setCaption(text);
    timer.current = window.setTimeout(() => setCaption(null), 3200);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [caption, show];
}
