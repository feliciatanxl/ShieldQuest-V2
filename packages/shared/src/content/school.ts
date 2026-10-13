import type { Mission } from '../mission';
import { busStopPickup } from './missions/bus-stop-pickup';
import { freeSkins } from './missions/free-skins';
import { lendMeYourLogin } from './missions/lend-me-your-login';
import { lendMeYourLoginTeen } from './missions/lend-me-your-login-teen';
import { theScreenshot } from './missions/the-screenshot';
import { theScreenshotYa } from './missions/the-screenshot-ya';

/**
 * School Street missions (GAME_DESIGN.md §9.2 M01–M04). Owned by the School Street content batch.
 * Ordered M01 → M04; band variants follow their primary so each band's first School Street mission stays stable.
 */
export const SCHOOL_MISSIONS: Mission[] = [
  freeSkins,
  theScreenshot,
  theScreenshotYa,
  busStopPickup,
  lendMeYourLogin,
  lendMeYourLoginTeen,
];
