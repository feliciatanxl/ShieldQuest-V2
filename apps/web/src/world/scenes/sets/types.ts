import type { FC } from 'react';
import type { Mission, SceneId } from '@shieldquest/shared';
import type { SceneMood } from '../../contracts';
import type { QualityTier } from '../../quality';
import type { FlatStaging, SetStaging } from '../core/staging';

type Vec3 = [number, number, number];

/** Where a cast member stands or sits, and where a clue hotspot ring floats. */
export interface AnchorSpot {
  position: Vec3;
  /** Yaw (radians) a character placed here faces. */
  facing?: number;
  /** Offset from position for the hotspot ring (default [0, 1.6, 0]). */
  hotspotOffset?: Vec3;
  /** Plain-language name used in the Scene List and 2D view, e.g. "Notice board". */
  label: string;
}

export interface SetPieceProps {
  quality: QualityTier;
  /** True while time is held: the shared material drains to still-blue (handled by the kit uniform). */
  frozen: boolean;
  mood: SceneMood;
  /** Seconds into the live phase (all set animation is a pure function of t). */
  t: number;
  timeOfDay: Mission['timeOfDay'];
}

/** One reusable code-built 3D diorama (GAME_DESIGN.md §4.1 sets S1–S7) plus its 2D twin. */
export interface SetPiece {
  id: SceneId;
  name: string;
  /** Keys must be exactly the anchors listed for this scene in SCENES (packages/shared/src/mission.ts). */
  anchors: Record<string, AnchorSpot>;
  camera: {
    /** Locked director camera during the live phase. */
    live: { position: Vec3; target: Vec3; fov?: number };
    /** Constrained orbit while frozen. */
    orbit: { target: Vec3; minDistance: number; maxDistance: number };
  };
  /**
   * Static set geometry only (characters, hotspots, rain and threads are added by MissionScene).
   * May be React.lazy and suspend while its 3D chunk loads: render it inside <Suspense> (MissionScene covers the
   * stage with the Flat View until it is ready).
   */
  Component: FC<SetPieceProps>;
  /** Optional staging: influence window, seat stand-ins, rain zone, junior rail stops, DOM sign labels. */
  staging?: SetStaging;
  /** 2D twin for Flat View: an SVG drawing plus 2D anchor positions (in viewBox units). */
  flat: {
    viewBox: string;
    Draw: FC<{ timeOfDay: Mission['timeOfDay'] }>;
    anchors: Record<string, { x: number; y: number }>;
    /** Optional Flat View staging (projection, hotspot spots, seats, rain, influence window). */
    staging?: FlatStaging;
  };
}
