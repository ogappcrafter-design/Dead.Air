// store/seasonStore.ts
// DEA-85: persisted narrative-season state. Wraps the pure NarrativeSeason
// functions with a Zustand store, mirroring store/narrativeStore.ts.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_KEY, type Band } from '../lib/constants';
import {
  getSeasonAct,
  getSeasonBandLadder,
  selectSeasonEnding,
  SEASON_1_BAND_LADDER,
  SEASON_1_ID,
  type SeasonAct,
  type SeasonProgressInput,
} from '../engine/progression/NarrativeSeason';
import type { SeasonEndingId } from '../data/seasons/season1/ending';

interface SeasonState {
  seasonId: typeof SEASON_1_ID | null;
  started: boolean;
  prologueSeen: boolean;
  act: SeasonAct;
  bandsUnlocked: Band[];
  receivedCalls: number[];
  tapesCollected: string[];
  endingId: SeasonEndingId | null;
  endingPlayed: boolean;
  unlockedAt: number | null;
  start: () => void;
  markPrologueSeen: () => void;
  reconcile: (input: SeasonProgressInput) => void;
  markEndingPlayed: () => void;
  reset: () => void;
}

const initialState = {
  seasonId: null,
  started: false,
  prologueSeen: false,
  act: 1 as SeasonAct,
  bandsUnlocked: [SEASON_1_BAND_LADDER[0] as Band],
  receivedCalls: [] as number[],
  tapesCollected: [] as string[],
  endingId: null,
  endingPlayed: false,
  unlockedAt: null,
};

export const useSeasonStore = create<SeasonState>()(
  persist(
    (set, get) => ({
      ...initialState,

      start: (): void => {
        set({
          seasonId: SEASON_1_ID,
          started: true,
          act: 1,
          bandsUnlocked: [SEASON_1_BAND_LADDER[0] as Band],
        });
      },

      markPrologueSeen: (): void => {
        set({ prologueSeen: true });
      },

      reconcile: (input): void => {
        if (!get().started) return;
        const act = getSeasonAct(input);
        const finaleReceived = input.receivedCalls.includes(16007);
        const endingId = finaleReceived ? selectSeasonEnding(input.choiceTags ?? []) : null;
        set({
          act,
          bandsUnlocked: getSeasonBandLadder(act),
          receivedCalls: [...input.receivedCalls],
          tapesCollected: [...input.tapesCollected],
          endingId,
          unlockedAt: endingId === 's1_hold' ? (get().unlockedAt ?? Date.now()) : get().unlockedAt,
        });
      },

      markEndingPlayed: (): void => {
        set({ endingPlayed: true });
      },

      reset: (): void => {
        set({ ...initialState });
      },
    }),
    {
      name: SAVE_KEY + ':season',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
