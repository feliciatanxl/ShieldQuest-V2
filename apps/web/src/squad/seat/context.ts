import type { BandId, Mission, SeatSnapshot, SquadMissionView } from '@shieldquest/shared';
import type { Cues, ExitView } from '../../game/mission';
import type { RenderMode } from '../../world';
import type { MissionLocal } from './local';

/** Everything a squad phase panel needs, passed down from SeatMission (panels hold no session state). */
export interface SeatCtx {
  snap: SeatSnapshot;
  view: SquadMissionView;
  mission: Mission;
  /** The squad's shared Exit order (same letters on every phone in the squad). */
  exits: ExitView[];
  /** Server time (ms), ticking a few times a second. */
  now: number;
  band: BandId;
  /** Gentle mode (session or this squad): no surges, no countdown visuals. */
  gentle: boolean;
  reduced: boolean;
  renderMode: RenderMode;
  cues: Cues;
  announce: (text: string) => void;
  local: MissionLocal;
  patch: (p: Partial<MissionLocal> | ((s: MissionLocal) => Partial<MissionLocal>)) => void;
  /** Short status line for something that did not go through ("Another role holds those tiles"). */
  flash: (text: string) => void;
}
