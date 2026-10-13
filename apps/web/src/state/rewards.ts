import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  buyCosmetic,
  emptyRewards,
  equipCosmetic,
  recordChance,
  recordMiniGame,
  recordMission,
  recordShard,
  roll,
  skipLanded,
  topUpDaily,
  type DistrictId,
  type Choice,
  type MiniGameResult,
  type RewardEvent,
  type RewardsState,
} from '@shieldquest/shared';
import { deviceStorage } from './storage';

// Stars, the City Board, streaks and cosmetics. Lives on this device like solo progress; the Save Card
// (state/saveCard.ts) is the only way it leaves, and then only as an encrypted blob.

interface RewardsStore {
  rewards: RewardsState;
  /** The latest reward, for the toast. Not persisted. */
  lastEvent: RewardEvent | null;
  clearEvent: () => void;
  topUp: () => number;
  roll: () => { die: number; path: number[] } | null;
  skip: () => void;
  miniGame: (r: MiniGameResult) => RewardEvent;
  mission: (m: { district: DistrictId; firstTime: boolean; safety: Choice['safety'] }) => RewardEvent;
  chance: (correct: boolean) => RewardEvent;
  shard: (id: string) => RewardEvent | null;
  buy: (id: string) => boolean;
  equip: (id: string) => boolean;
  reset: () => void;
}

const hasNews = (e: RewardEvent) => e.stars > 0 || e.badges.length > 0 || e.claimed !== null || e.secured !== null;

export const useRewards = create<RewardsStore>()(
  persist(
    (set, get) => ({
      rewards: emptyRewards(),
      lastEvent: null,
      clearEvent: () => set({ lastEvent: null }),
      topUp: () => {
        const { state, added } = topUpDaily(get().rewards, Date.now());
        if (added) set({ rewards: state });
        return added;
      },
      roll: () => {
        const r = roll(get().rewards);
        if (!r) return null;
        set({ rewards: r.state, lastEvent: hasNews(r.event) ? r.event : null });
        return { die: r.die, path: r.path };
      },
      skip: () => set({ rewards: skipLanded(get().rewards) }),
      miniGame: (result) => {
        const { state, event } = recordMiniGame(get().rewards, result, Date.now());
        set({ rewards: state, lastEvent: event });
        return event;
      },
      mission: (m) => {
        const { state, event } = recordMission(get().rewards, m, Date.now());
        set({ rewards: state, lastEvent: event });
        return event;
      },
      chance: (correct) => {
        const { state, event } = recordChance(get().rewards, correct, Date.now());
        set({ rewards: state, lastEvent: hasNews(event) ? event : null });
        return event;
      },
      shard: (id) => {
        const r = recordShard(get().rewards, id, Date.now());
        if (!r) return null;
        set({ rewards: r.state, lastEvent: r.event });
        return r.event;
      },
      buy: (id) => {
        const next = buyCosmetic(get().rewards, id);
        if (next) set({ rewards: next });
        return Boolean(next);
      },
      equip: (id) => {
        const next = equipCosmetic(get().rewards, id);
        if (next) set({ rewards: next });
        return Boolean(next);
      },
      reset: () => set({ rewards: emptyRewards(), lastEvent: null }),
    }),
    {
      name: 'sq.rewards.v1',
      storage: deviceStorage,
      version: 1,
      partialize: (s) => ({ rewards: s.rewards }),
    },
  ),
);

// A first-run handle is generated in memory. Write the (hydrated) state straight back so it is stored and
// does not change on every reload before the first reward. localStorage hydration is synchronous.
useRewards.setState((s) => ({ rewards: s.rewards }));
