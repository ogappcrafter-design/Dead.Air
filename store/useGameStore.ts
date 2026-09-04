// store/useGameStore.ts
// Central game store, composed from domain-specific slices using the
// Zustand slice pattern. Each slice owns its state + actions; this
// file wires them together with persist middleware.
//
// Slices:
//   gameStateSlice      — sanity, static, tapes, bands, calls, shifts
//   ngPlusSlice         — New Game+ unlock/active/completion
//   endlessNightSlice   — Endless Night mode state + scoring
//   tapeMasterySlice    — Per-tape listen counts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_KEY } from '../lib/constants';

import { createGameSlice, type GameStateSlice } from './slices/gameStateSlice';
import { createNgPlusSlice, type NgPlusSlice } from './slices/ngPlusSlice';
import { createEndlessNightSlice, type EndlessNightSlice } from './slices/endlessNightSlice';
import { createTapeMasterySlice, type TapeMasterySlice } from './slices/tapeMasterySlice';

export type GameState = GameStateSlice & NgPlusSlice & EndlessNightSlice & TapeMasterySlice;

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      ...createGameSlice(set),
      ...createNgPlusSlice(set),
      ...createEndlessNightSlice(set),
      ...createTapeMasterySlice(set),
    }),
    {
      name: SAVE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
