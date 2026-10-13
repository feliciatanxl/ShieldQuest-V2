import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BandId } from '@shieldquest/shared';
import { deviceStorage } from './storage';

export type QualitySetting = 'auto' | 'high' | 'medium' | 'low' | '2d';
export type MotionSetting = 'system' | 'reduced' | 'full';

export interface Settings {
  /** Multiplies the root font size (A− / A+). */
  textScale: number;
  motion: MotionSetting;
  quality: QualitySetting;
  sound: boolean;
  haptics: boolean;
  /** Removes Singlish and slang from dialogue (on by default for the junior band). */
  plainLanguage: boolean;
  /** Lets players complete the Hold with a single tap instead of press-and-hold. */
  tapToHold: boolean;
  /** How long press-and-hold takes, in ms (GDD §10.1: adjustable 0.3-2.0 s). */
  holdMs: number;
  /** Gentle mode (GDD §5.3, §10.1): no Pressure Surges and no countdown visuals in solo play. */
  gentle: boolean;
  band: BandId | null;
  onboarded: boolean;
  set: (patch: Partial<Omit<Settings, 'set'>>) => void;
}

export const TEXT_SCALES = [0.9, 1, 1.15, 1.3, 1.5] as const;
export const HOLD_MS_OPTIONS = [300, 600, 1000, 1500, 2000] as const;
export const DEFAULT_HOLD_MS = 600;

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      textScale: 1,
      motion: 'system',
      quality: 'auto',
      sound: true,
      haptics: true,
      plainLanguage: false,
      tapToHold: false,
      holdMs: DEFAULT_HOLD_MS,
      gentle: false,
      band: null,
      onboarded: false,
      set: (patch) => set(patch),
    }),
    { name: 'sq.settings.v1', storage: deviceStorage, version: 1 },
  ),
);

/** True when animation should be minimised (setting, or OS preference when on "system"). */
export function prefersReducedMotion(motion: MotionSetting): boolean {
  if (motion === 'reduced') return true;
  if (motion === 'full') return false;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Mirrors settings onto <html> so CSS can react (text scale, motion). */
export function applySettingsToDocument(s: Pick<Settings, 'textScale' | 'motion'>) {
  const root = document.documentElement;
  root.style.setProperty('--text-scale', String(s.textScale));
  if (s.motion === 'system') root.removeAttribute('data-motion');
  else root.setAttribute('data-motion', s.motion);
}
