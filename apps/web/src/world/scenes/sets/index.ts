import type { SceneId } from '@shieldquest/shared';
import type { SetPiece } from './types';
import { voidDeck } from './void-deck';
import { schoolGate } from './school-gate';
import { canteen } from './canteen';
import { minimart } from './minimart';
import { foodCourt } from './food-court';
import { digiSky } from './digi-sky';
import { bedroom } from './bedroom';

/** All 3D sets by scene id. Each set file is owned by one scenes build; this file only registers them. */
export const SETS: Record<SceneId, SetPiece> = {
  'void-deck': voidDeck,
  'school-gate': schoolGate,
  'canteen': canteen,
  'minimart': minimart,
  'food-court': foodCourt,
  'digi-sky': digiSky,
  'bedroom': bedroom,
};

export type { SetPiece, AnchorSpot, SetPieceProps } from './types';
