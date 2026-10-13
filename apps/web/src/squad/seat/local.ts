// What only this phone knows during a squad mission (GDD §11.9: computed and kept on the device).
// In memory: it survives re-renders and phase changes, and resets when a new mission opens.

import { create } from 'zustand';
import type { GuardianId, SkillId } from '@shieldquest/shared';
import type { SurgeState } from '../../game/mission/runReducer';

/** Investigate on the phone: scene list, then the LIVE vs HELD counter, the String, the forecast, then waiting. */
export type InvestigateStep = 'scene' | 'counter' | 'trace' | 'forecast' | 'waiting';

export interface MissionLocal {
  missionId: string | null;
  /** First-look pins tapped while the moment was live. */
  liveLooks: string[];
  /** Clues pinned on purpose while holding (a first look that is pinned again counts as a real pin). */
  confirmed: string[];
  /** Seconds into Live when this phone held, or null (late auto-freeze). */
  heldAtSec: number | null;
  replyTried: boolean;
  step: InvestigateStep;
  selected: string | null;
  threadPulled: boolean;
  traceAnswers: string[];
  /** Forecast pick per pass-and-play player. */
  forecastPick: Record<number, string>;
  /** Players whose forecast was sealed on this phone (shown sealed before the server confirms). */
  forecastSent: number[];
  /** Players who moved on from the sealed forecast to the Exits. */
  forecastSeen: number[];
  surge: SurgeState;
  /** The surge pulse already shown (so a re-render does not show it twice). */
  surgeSeen: number;
  sniffed: string | null;
  scanned: boolean;
  crossChecked: string | null;
  guardiansPressed: GuardianId[];
  /** Aftershock deliveries finished on this phone. */
  shocksDone: string[];
  shadowDone: boolean;
  /** Pass-and-play: players who confirmed only they can see the screen, per round ("1:0", "2:1"). */
  uncovered: string[];
  /** Seal the server has not acknowledged yet (shown as sealed, retried until it lands). */
  pendingSeal: Record<string, { voteId: string; choiceId: string; confidence?: 1 | 2 | 3 }>;
  eyesUp: boolean;
  steelmanPassed: boolean;
  shieldDelta: { guard: number; doubt: number } | null;
  /** Bond motif already played for this mission. */
  bondPlayed: boolean;
  /** Letters this phone showed (computed at Release, kept on the device only, GDD §5.3 step 10). */
  personal: Partial<Record<SkillId, boolean>> | null;
  /** If-Then card saved on this phone for this mission. */
  ifThenSaved: boolean;
}

const fresh = (missionId: string | null): MissionLocal => ({
  missionId,
  liveLooks: [],
  confirmed: [],
  heldAtSec: null,
  replyTried: false,
  step: 'scene',
  selected: null,
  threadPulled: false,
  traceAnswers: [],
  forecastPick: {},
  forecastSent: [],
  forecastSeen: [],
  surge: 'idle',
  surgeSeen: 0,
  sniffed: null,
  scanned: false,
  crossChecked: null,
  guardiansPressed: [],
  shocksDone: [],
  shadowDone: false,
  uncovered: [],
  pendingSeal: {},
  eyesUp: false,
  steelmanPassed: false,
  shieldDelta: null,
  bondPlayed: false,
  personal: null,
  ifThenSaved: false,
});

interface LocalStore extends MissionLocal {
  /** Resets everything when a different mission opens. */
  ensure: (missionId: string) => void;
  patch: (p: Partial<MissionLocal> | ((s: MissionLocal) => Partial<MissionLocal>)) => void;
}

export const useSeatLocal = create<LocalStore>((set, get) => ({
  ...fresh(null),
  ensure: (missionId) => {
    if (get().missionId !== missionId) set(fresh(missionId));
  },
  patch: (p) => set((s) => (typeof p === 'function' ? p(s) : p)),
}));

export const sealKey = (round: 1 | 2, player: number): string => `${round}:${player}`;
