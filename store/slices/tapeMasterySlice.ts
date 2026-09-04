// store/slices/tapeMasterySlice.ts
// Tape Mastery: per-tape listen counts for progression layer tracking.

import type { StoreApi } from 'zustand';
import type { GameState } from '../useGameStore';
import { incrementListenCount } from '../../engine/progression/TapeMastery';

export interface TapeMasterySlice {
  tapeListenCounts: Record<string, number>;
  recordTapeListen: (tapeId: string) => void;
}

export const createTapeMasterySlice = (set: StoreApi<GameState>['setState']): TapeMasterySlice => ({
  tapeListenCounts: {} as Record<string, number>,

  recordTapeListen: (tapeId: string) =>
    set((state: GameState) => ({
      tapeListenCounts: incrementListenCount(state.tapeListenCounts, tapeId),
    })),
});
