import type { Mission } from '../mission';
import { fiveFingerDare } from './missions/five-finger-dare';
import { fiveFingerDareJunior } from './missions/five-finger-dare-junior';
import { luckyDrawBooth } from './missions/lucky-draw-booth';
import { luckyDrawBoothYa } from './missions/lucky-draw-booth-ya';
import { prankForTheFeed } from './missions/prank-for-the-feed';
import { simForFifty } from './missions/sim-for-fifty';

/**
 * Retail District missions (GAME_DESIGN.md §9.2 M05–M08). Owned by the Retail District content batch.
 * Ordered M05 → M08; band variants follow their primary so each band's first Retail mission stays stable.
 */
export const RETAIL_MISSIONS: Mission[] = [
  fiveFingerDare,
  fiveFingerDareJunior,
  prankForTheFeed,
  luckyDrawBooth,
  luckyDrawBoothYa,
  simForFifty,
];
