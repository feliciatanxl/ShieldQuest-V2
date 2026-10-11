import { useEffect, useState } from 'react';
import { useSettings, type QualitySetting } from '../state/settings';

export type QualityTier = 'high' | 'medium' | 'low';
export type RenderMode = QualityTier | '2d';

/** Per-tier render budgets (from the mobile performance playbook). */
export const QUALITY_BUDGET: Record<QualityTier, { dpr: [number, number]; shadows: boolean; antialias: boolean; particles: number }> = {
  high: { dpr: [1, 2], shadows: true, antialias: true, particles: 1500 },
  medium: { dpr: [1, 1.5], shadows: false, antialias: true, particles: 600 },
  low: { dpr: [1, 1], shadows: false, antialias: false, particles: 150 },
};

let cachedWebGL2: boolean | null = null;
export function hasWebGL2(): boolean {
  if (cachedWebGL2 !== null) return cachedWebGL2;
  try {
    const c = document.createElement('canvas');
    cachedWebGL2 = Boolean(c.getContext('webgl2'));
  } catch {
    cachedWebGL2 = false;
  }
  return cachedWebGL2;
}

/** Best-guess starting tier from device hints; PerformanceMonitor adjusts at runtime. */
export function detectTier(): QualityTier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  const small = Math.min(screen.width, screen.height) < 400;
  if (cores <= 4 || mem <= 3) return 'low';
  if (cores >= 8 && mem >= 8 && !small) return 'high';
  return 'medium';
}

export function resolveRenderMode(setting: QualitySetting): RenderMode {
  if (setting === '2d' || !hasWebGL2()) return '2d';
  if (setting === 'auto') return detectTier();
  return setting;
}

/** Current render mode, honouring the player's Quality setting and WebGL2 support. */
export function useRenderMode(): RenderMode {
  const quality = useSettings((s) => s.quality);
  const [mode, setMode] = useState<RenderMode>(() => resolveRenderMode(quality));
  useEffect(() => setMode(resolveRenderMode(quality)), [quality]);
  return mode;
}
