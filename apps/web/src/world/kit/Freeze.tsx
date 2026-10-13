// <Freeze>: drives the canvas's shared freeze uniform from props (the Hold look: colour drains to still-blue,
// rain hangs). A component form of useFreeze for scene code that only has JSX inside <AdaptiveCanvas>.
import { useFreeze } from './materials';

export interface FreezeProps {
  /** 0 = live colour, 1 = held. Tweened over `durationMs` (instant under reduced motion). */
  amount: number;
  /** Default 400 ms (GAME_DESIGN.md §4.5 freeze punch). */
  durationMs?: number;
}

/** Renders nothing; tweens the shared uFreeze uniform of the surrounding AdaptiveCanvas. */
export function Freeze({ amount, durationMs = 400 }: FreezeProps) {
  useFreeze(amount, durationMs);
  return null;
}

export default Freeze;
