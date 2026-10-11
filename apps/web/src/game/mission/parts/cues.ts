// Sound cues with captions, plus the polite screen-reader announcer used by the mission player.
// Every meaningful sound gets a caption (GAME_DESIGN.md §5.2, §10.1), so play sounds through `cue`, not playSfx.

import { useCallback, useEffect, useRef, useState } from 'react';
import * as audio from '../../../audio/sfx';
import type { Sfx } from '../../../audio/sfx';

/** Our own caption map, used when the audio module does not export SFX_CAPTIONS. */
const FALLBACK_CAPTIONS: Partial<Record<Sfx, string>> = {
  message: '[message arrives]',
  tick: '[clock ticking faster]',
  freeze: '[time stops]',
  release: '[time starts again]',
  clue: '[soft pluck]',
  seal: '[envelope seals]',
  reveal: '[thread pulls tight]',
  aftershock: '[low rumble]',
  afterglow: '[warm chime]',
  unfold: '[paper unfolds]',
  surge: '[phone buzzes hard]',
  success: '[bright chime]',
  'soft-fail': '[soft low note]',
};

function moduleCaptions(): Partial<Record<Sfx, string>> {
  // Read dynamically so this keeps compiling whether or not the audio build exports the map.
  const exported = (audio as unknown as Record<string, unknown>)['SFX_CAPTIONS'];
  return exported && typeof exported === 'object' ? (exported as Partial<Record<Sfx, string>>) : {};
}

/** Caption text for a sound, or null for quiet UI ticks that do not need one. */
export function captionFor(name: Sfx): string | null {
  const fromModule = moduleCaptions()[name];
  const text = fromModule ?? FALLBACK_CAPTIONS[name];
  if (!text) return null;
  return text.startsWith('[') ? text : `[${text}]`;
}

export interface Cues {
  /** Current caption (null when nothing is playing). */
  caption: string | null;
  /** Plays a sound and shows its caption. `caption` overrides the default text; pass null for no caption. */
  cue: (name: Sfx, opts?: { intensity?: number; step?: number; caption?: string | null }) => void;
  /** Shows a caption without a sound (e.g. "[clock ticking faster]" when tension rises). */
  showCaption: (text: string) => void;
}

const CAPTION_MS = 2600;

export function useCues(): Cues {
  const [caption, setCaption] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const showCaption = useCallback((text: string) => {
    setCaption(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCaption(null), CAPTION_MS);
  }, []);

  const cue = useCallback<Cues['cue']>(
    (name, opts) => {
      try {
        audio.playSfx(name, opts ? { intensity: opts.intensity, step: opts.step } : undefined);
      } catch {
        // Sound is a bonus: a failing audio context must never break play.
      }
      const text = opts?.caption === undefined ? captionFor(name) : opts.caption;
      if (text) showCaption(text);
    },
    [showCaption],
  );

  return { caption, cue, showCaption };
}

/** Polite live-region text. Re-announcing the same words works because each call bumps a counter. */
export function useAnnouncer(): { message: string; announce: (text: string) => void } {
  const [state, setState] = useState({ text: '', n: 0 });
  const announce = useCallback((text: string) => setState((s) => ({ text, n: s.n + 1 })), []);
  // A trailing zero-width space on alternate calls makes screen readers treat repeats as new content.
  return { message: state.n % 2 ? `${state.text}​` : state.text, announce };
}

export function safeHaptic(pattern: number | number[]): void {
  try {
    audio.haptic(pattern);
  } catch {
    // Vibration is optional.
  }
}

/** Live-phase tension (0..1). Audio is a bonus: failures are swallowed. */
export function safeTension(level: number): void {
  try {
    audio.setTension(Math.max(0, Math.min(1, level)));
  } catch {
    // Ignore.
  }
}

/** The six-note S.H.I.E.L.D. motif with the player's lit letters. */
export function safeMotif(lit: boolean[]): void {
  try {
    audio.playMotif(lit);
  } catch {
    // Ignore.
  }
}

/** Call from a user gesture (Start, Continue) so browsers allow sound. */
export function safeUnlock(): void {
  try {
    audio.unlockAudio();
  } catch {
    // Ignore.
  }
}

export function safeAmbient(where: Parameters<typeof audio.startAmbient>[0] | null): void {
  try {
    if (where) audio.startAmbient(where);
    else audio.stopAmbient();
  } catch {
    // Ignore.
  }
}
