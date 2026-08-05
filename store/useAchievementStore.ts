// store/useAchievementStore.ts
// Persistent achievement unlocks + recent-unlock notification slot.
// Mirrors the persist pattern of useGameStore / useSettingsStore.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ACHIEVEMENTS,
  checkAchievements,
  type Achievement,
  type PlayerStats,
} from '../engine/progression/Achievements';
import { SAVE_KEY } from '../lib/constants';

/**
 * Persistence stores only `unlocked` IDs — `recentUnlock` is ephemeral UI
 * state and is intentionally excluded via `partialize`.
 */
interface AchievementState {
  /** IDs of unlocked achievements, in unlock order (oldest first). */
  unlocked: string[];
  /** Most recent unlock for the notification toast, or null when idle. */
  recentUnlock: Achievement | null;
  // Actions
  /** Evaluate stats; append any newly-satisfied IDs; surface the newest. */
  checkAndUnlock: (stats: PlayerStats) => void;
  /** Clear the recent-unlock slot (toast dismiss). */
  clearRecentUnlock: () => void;
  /** Predicate: has `id` been unlocked? */
  isUnlocked: (id: string) => boolean;
}

const achievementById = new Map<string, Achievement>(ACHIEVEMENTS.map((a) => [a.id, a]));

export const useAchievementStore = create<AchievementState>()(
  persist(
    (set, get) => ({
      unlocked: [],
      recentUnlock: null,

      checkAndUnlock: (stats) => {
        const already = get().unlocked;
        const newlyUnlocked = checkAchievements(stats, already);
        if (newlyUnlocked.length === 0) {
          return;
        }
        const nextUnlocked = [...already, ...newlyUnlocked];
        // Surface the last-unlocked achievement; earlier ones in the same
        // tick remain in `unlocked` — the grid screen surfaces them.
        const lastId = newlyUnlocked[newlyUnlocked.length - 1];
        // lastId is guaranteed defined (length>0) but TS can't see through arrays.
        const recent = lastId !== undefined ? (achievementById.get(lastId) ?? null) : null;
        set({ unlocked: nextUnlocked, recentUnlock: recent });
      },

      clearRecentUnlock: () => set({ recentUnlock: null }),

      isUnlocked: (id) => get().unlocked.includes(id),
    }),
    {
      name: `${SAVE_KEY}_achievements`,
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist `unlocked`. Drop ephemeral `recentUnlock`.
      partialize: (state) => ({ unlocked: state.unlocked }),
    },
  ),
);
