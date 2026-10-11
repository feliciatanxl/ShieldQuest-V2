// Per-canvas kit context, provided by <AdaptiveCanvas>. Kit components read the quality tier, the shared
// shader uniforms, reduced motion and the frame scheduler from here, so they work under frameloop="demand".
import { createContext, useContext, type RefObject } from 'react';
import type { QualityTier } from '../quality';
import { createKitUniforms, type KitUniforms } from './uniforms';

export interface KitContextValue {
  tier: QualityTier;
  uniforms: KitUniforms;
  /** Settings "Motion: reduced" or the OS preference: no idle sway, pulses or flights; cuts and fades instead. */
  reducedMotion: boolean;
  /**
   * Asks for one more rendered frame. Call it from useFrame while something animates (and once after a
   * state change). Throttled to ~30 fps on the Low tier (GAME_DESIGN.md §10.2).
   */
  requestFrame: () => void;
  /** DOM layer above the canvas (outside role="img") for focusable buttons such as hotspots. */
  overlay: RefObject<HTMLDivElement | null> | null;
  /** Re-renders the one static shadow map (High tier only) after scenery changes. */
  refreshShadows: () => void;
}

const fallbackUniforms = createKitUniforms();

export const KitContext = createContext<KitContextValue>({
  tier: 'medium',
  uniforms: fallbackUniforms,
  reducedMotion: false,
  requestFrame: () => {},
  overlay: null,
  refreshShadows: () => {},
});

/** Reads the surrounding AdaptiveCanvas's kit context (sensible defaults outside one). */
export const useKit = () => useContext(KitContext);
