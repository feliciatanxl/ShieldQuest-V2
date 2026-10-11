// Contract between game screens (DOM) and the 3D world.
// Screens own all state and readable text; the world only draws and reports taps.
// Every 3D interaction must also be possible from the DOM (clue lists, district buttons),
// and every 3D component has a 2D (SVG) twin used for 2D mode, no WebGL2, or reduced capability.

import type { DistrictId, GuardianId, Mission, SceneAnchor } from '@shieldquest/shared';
import type { QualityTier } from './quality';

export interface MissionMarker {
  missionId: string;
  district: DistrictId;
  state: 'new' | 'done' | 'aftershock';
}

export interface Lantern {
  squadId: string;
  color: string;
  /** Number of lanterns (e.g. sealed votes, holds made). Only positive trajectories are shown on the projector. */
  count: number;
}

export interface CitySceneProps {
  /** District the camera should frame, or null for the whole city. */
  focus: DistrictId | null;
  /** -3..+3 light level per district (protective choices light lanterns; Aftershocks dim until recovered). */
  districtTrust: Record<string, number>;
  markers: MissionMarker[];
  onSelectDistrict?: (district: DistrictId) => void;
  onSelectMission?: (missionId: string) => void;
  /** Projector "Room Freeze": 0 = rain falling, 1 = every drop frozen in mid-air. */
  freezeAmount?: number;
  lanterns?: Lantern[];
  /** Slow cinematic orbit (home page hero, projector idle). */
  showcase?: boolean;
  quality: QualityTier;
}

export type HotspotState = 'hidden' | 'available' | 'found-flag' | 'found-ok';

export interface Hotspot {
  clueId: string;
  anchor: SceneAnchor;
  state: HotspotState;
}

export type SceneMode = 'intro' | 'live' | 'frozen' | 'released';
export type SceneMood = 'neutral' | 'tense' | 'warm' | 'sober' | 'shiny';

export interface MissionSceneProps {
  mission: Mission;
  /**
   * intro: camera glides in. live: time runs (ambient motion, rain falling).
   * frozen: Hold — world desaturates, rain hangs, camera unlocks for orbit, hotspots become tappable.
   * released: time resumes for the outcome.
   */
  mode: SceneMode;
  /** Seconds into the live phase; frozen keeps the last value so the scene stays on the same frame. */
  t: number;
  hotspots: Hotspot[];
  onHotspot?: (clueId: string) => void;
  /** Identify the Influence: thread from a cast member to a faceless figure; revealed = drawn tight. */
  thread?: { from: string; revealed: boolean } | null;
  mood: SceneMood;
  /** Cast member the camera should lean towards (e.g. the speaker of the current beat). */
  focusCast?: string | null;
  quality: QualityTier;
}

export interface GuardianFigureProps {
  guardian: GuardianId;
  /** 0 = folded paper sheet (not yet earned), 1-3 = unfolded and growing. */
  level: number;
  /** Plays the fold-up animation once when it changes from 0 to 1. */
  celebrate?: boolean;
  quality: QualityTier;
}
