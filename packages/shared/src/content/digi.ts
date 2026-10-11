import type { Mission } from '../mission';
import { behindTheStall } from './missions/behind-the-stall';
import { behindTheStallYa } from './missions/behind-the-stall-ya';
import { easyMoney } from './missions/easy-money';
import { easyMoneyTeen } from './missions/easy-money-teen';
import { firstHold } from './missions/first-hold';
import { likeForCash } from './missions/like-for-cash';
import { parcelRedelivery } from './missions/parcel-redelivery';

/**
 * Digi-District missions (GAME_DESIGN.md §9.2 M09–M12) plus the solo tutorial (§9.4). Owned by the Digi-District
 * content batch. The tutorial comes first so it is the default first mission; band variants follow their primary.
 */
export const DIGI_MISSIONS: Mission[] = [
  firstHold,
  easyMoney,
  easyMoneyTeen,
  behindTheStall,
  behindTheStallYa,
  parcelRedelivery,
  likeForCash,
];
