// Shared pieces for the Arcade: the game contract, feedback cues, per-device conveniences and small visuals.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { MiniGameId, MiniMessageChannel } from '@shieldquest/shared';
import { hapticCue } from '../../audio/sfx';
import { useSettings } from '../../state/settings';
import { readStored, useSfx, writeStored } from '../hub/kit';

/** One line in the "go over every answer" list on the result screen. */
export interface ReviewItem {
  id: string;
  ok: boolean;
  title: string;
  detail: string;
}

/** What a game reports when its round is decided (the page records Stars once, from this). */
export interface GameOutcome {
  /** 0..1 */
  score: number;
  right: number;
  total: number;
  /** "red flags found", "cards called right", "steps right" */
  unit: string;
  /** Real or Fake: cards called correctly. */
  correct?: number;
  lesson: string;
  review: ReviewItem[];
}

export interface GameProps<R> {
  round: R;
  seed: number;
  plain: boolean;
  gentle: boolean;
  reduced: boolean;
  /** The round is decided: record it. Called once. */
  onComplete: (o: GameOutcome) => void;
  /** The player is ready to see the result screen. */
  onResults: () => void;
}

/** Sound + vibration for game moments, respecting the Sound, Vibration and Gentle settings. */
export function useArcadeCues() {
  const sfx = useSfx();
  const gentle = useSettings((s) => s.gentle);
  return {
    tap: useCallback(() => {
      sfx('tap');
      hapticCue('tap');
    }, [sfx]),
    good: useCallback(() => {
      sfx('clue');
      hapticCue('clue');
    }, [sfx]),
    miss: useCallback(() => {
      // Gentle mode: no "wrong" sound at all, just the words on screen.
      if (!gentle) sfx('soft-fail');
    }, [sfx, gentle]),
    done: useCallback(() => {
      sfx('success');
      hapticCue('success');
    }, [sfx]),
  };
}

/** A polite live region: set the text and screen readers read it. */
export function useAnnounce(): [string, (text: string) => void] {
  const [msg, setMsg] = useState('');
  const flip = useRef(false);
  const announce = useCallback((text: string) => {
    // A trailing zero-width toggle makes repeated identical messages read again.
    flip.current = !flip.current;
    setMsg(text + (flip.current ? '​' : ''));
  }, []);
  return [msg, announce];
}

export function LiveRegion({ text }: { text: string }) {
  return (
    <p className="sr-only" role="status" aria-live="polite">
      {text}
    </p>
  );
}

/** Moves focus to a heading when it mounts (after a screen change), without scrolling on top of it. */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}

// ---------------------------------------------------------------------------------------------
// Per-device conveniences (best score, plays, recently seen content). Never Stars or progress.
// ---------------------------------------------------------------------------------------------

const STATS_KEY = 'sq.arcade.v1';
const RECENT_KEY = 'sq.arcade.recent.v1';

export type ArcadeStats = Partial<Record<MiniGameId, { plays: number; best: number }>>;

export const readArcadeStats = (): ArcadeStats => readStored<ArcadeStats>('local', STATS_KEY, {});

export function saveArcadePlay(game: MiniGameId, score: number): void {
  const all = readArcadeStats();
  const prev = all[game] ?? { plays: 0, best: 0 };
  writeStored('local', STATS_KEY, { ...all, [game]: { plays: prev.plays + 1, best: Math.max(prev.best, score) } });
}

export const readRecent = (game: MiniGameId): string[] =>
  readStored<Partial<Record<MiniGameId, string[]>>>('session', RECENT_KEY, {})[game] ?? [];

export function rememberRecent(game: MiniGameId, ids: string[], keep = 16): void {
  const all = readStored<Partial<Record<MiniGameId, string[]>>>('session', RECENT_KEY, {});
  const next = [...ids, ...(all[game] ?? []).filter((id) => !ids.includes(id))].slice(0, keep);
  writeStored('session', RECENT_KEY, { ...all, [game]: next });
}

export const newSeed = (): number => {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0]!;
  } catch {
    return Math.floor(Math.random() * 2 ** 32);
  }
};

// ---------------------------------------------------------------------------------------------
// Visuals
// ---------------------------------------------------------------------------------------------

export const GAME_ACCENT: Record<MiniGameId, string> = {
  wordsearch: 'var(--school)',
  'real-or-fake': 'var(--digi)',
  'money-trail': 'var(--retail)',
};

const CHANNEL_LABEL: Record<MiniMessageChannel, string> = {
  sms: 'Text message',
  chat: 'Chat',
  dm: 'Direct message',
  email: 'Email',
  popup: 'Pop-up',
};

/** A fictional message, phone-style: sender, small meta line, then the bubble. */
export function MessageCard({
  channel,
  from,
  meta,
  children,
  label = 'Fictional message',
}: {
  channel: MiniMessageChannel;
  from: string;
  meta?: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <figure className={`arc-msg arc-msg--${channel}`} aria-label={`${label}: ${CHANNEL_LABEL[channel]} from ${from}`}>
      <figcaption className="arc-msg__head">
        <span className="arc-msg__avatar" aria-hidden="true">
          {from.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase() || '?'}
        </span>
        <span className="arc-msg__who">
          <strong>{from}</strong>
          <small>
            {CHANNEL_LABEL[channel]}
            {meta ? ` · ${meta}` : ''}
          </small>
        </span>
      </figcaption>
      <div className="arc-msg__bubble">{children}</div>
    </figure>
  );
}

/** Small decorative art for each game (cards, intro). */
export function GameArt({ game, size = 64 }: { game: MiniGameId; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': true as const, focusable: 'false' as const };
  if (game === 'wordsearch') {
    const letters = ['S', 'C', 'A', 'M', 'O', 'T', 'P', 'K', 'F', 'R', 'E', 'E', 'H', 'U', 'R', 'Y'];
    return (
      <svg {...common} className="arc-art">
        <rect x="4" y="4" width="56" height="56" rx="10" fill="var(--paper)" />
        <rect x="9" y="33.5" width="46" height="11" rx="5.5" fill="var(--school)" opacity="0.55" />
        {letters.map((l, i) => (
          <text
            key={i}
            x={14 + (i % 4) * 12}
            y={18 + Math.floor(i / 4) * 12}
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontWeight="700"
            fontSize="9"
            fill="var(--ink)"
          >
            {l}
          </text>
        ))}
      </svg>
    );
  }
  if (game === 'real-or-fake') {
    return (
      <svg {...common} className="arc-art">
        <rect x="6" y="12" width="30" height="42" rx="6" fill="var(--paper-2)" transform="rotate(-10 21 33)" />
        <rect x="26" y="8" width="30" height="42" rx="6" fill="var(--paper)" transform="rotate(8 41 29)" />
        <path d="M34 26l5 5 9-10" fill="none" stroke="var(--safe)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" transform="rotate(8 41 29)" />
        <path d="M14 30l10 10M24 30L14 40" stroke="var(--risk)" strokeWidth="3.4" strokeLinecap="round" transform="rotate(-10 21 33)" />
      </svg>
    );
  }
  return (
    <svg {...common} className="arc-art">
      <path d="M10 50C18 30 30 46 36 30S52 18 54 12" fill="none" stroke="var(--paper)" strokeWidth="3" strokeDasharray="4 4" strokeLinecap="round" />
      <circle cx="10" cy="50" r="6" fill="var(--paper)" />
      <circle cx="36" cy="30" r="6" fill="var(--paper)" />
      <circle cx="54" cy="12" r="6" fill="var(--retail)" />
      <ellipse cx="22" cy="40" rx="7" ry="4" fill="var(--gold)" />
      <path d="M19.5 40h5" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Five-point star glyph for Stars counts. Decorative. */
export function StarGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="arc-star">
      <path
        d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"
        fill="var(--gold)"
        stroke="var(--gold)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
