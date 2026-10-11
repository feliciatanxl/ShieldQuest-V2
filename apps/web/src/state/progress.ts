import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  MISSIONS,
  applyRun,
  dueAftershocks,
  emptyProgress,
  evaluateRun,
  resolveAftershock,
  type GuardianId,
  type Mission,
  type PendingAftershock,
  type Progress,
  type RunInput,
  type RunSummary,
} from '@shieldquest/shared';
import { deviceStorage } from './storage';

// Solo progress lives only on this device (privacy by design: no accounts, nothing uploaded).

interface ProgressStore {
  progress: Progress;
  /** Scores a finished mission, applies it, and returns what changed for the "Frame Saved" screen. */
  completeMission: (
    mission: Mission,
    run: RunInput,
  ) => { summary: RunSummary; guardianLevelUps: { guardian: GuardianId; level: number }[] };
  /** Aftershocks due now (call before starting a mission). */
  due: (endOfSession?: boolean) => PendingAftershock[];
  resolve: (key: string, recoveryOptionId: string) => void;
  saveIfThen: (missionId: string, text: string) => void;
  reset: () => void;
}

export const useProgress = create<ProgressStore>()(
  persist(
    (set, get) => ({
      progress: emptyProgress(),
      completeMission: (mission, run) => {
        const summary = evaluateRun(mission, run);
        const { progress, guardianLevelUps } = applyRun(get().progress, mission, summary, Date.now());
        set({ progress });
        return { summary, guardianLevelUps };
      },
      due: (endOfSession = false) => dueAftershocks(get().progress, endOfSession),
      resolve: (key, optionId) => set({ progress: resolveAftershock(get().progress, MISSIONS, key, optionId, Date.now()) }),
      saveIfThen: (missionId, text) =>
        set(({ progress }) => ({
          progress: {
            ...progress,
            ifThenCards: [...progress.ifThenCards.filter((c) => c.missionId !== missionId), { missionId, text, at: Date.now() }],
          },
        })),
      reset: () => set({ progress: emptyProgress() }),
    }),
    { name: 'sq.progress.v1', storage: deviceStorage, version: 1 },
  ),
);
