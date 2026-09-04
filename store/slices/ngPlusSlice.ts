// store/slices/ngPlusSlice.ts
// New Game+ state: unlock, active run, completion count.

import type { StoreApi } from 'zustand';
import type { Band } from '../../lib/constants';
import type { GameState } from '../useGameStore';
import {
  startNewGamePlus,
  endNewGamePlus,
  getNgPlusUnlockedBands,
} from '../../engine/progression/NewGamePlus';
import { initialState } from './initialState';

export interface NgPlusSlice {
  ngPlusUnlocked: boolean;
  ngPlusActive: boolean;
  ngPlusCompleted: number;
  startNgPlusRun: () => void;
  endNgPlusRun: () => void;
}

export const createNgPlusSlice = (set: StoreApi<GameState>['setState']): NgPlusSlice => ({
  ngPlusUnlocked: false,
  ngPlusActive: false,
  ngPlusCompleted: 0,

  startNgPlusRun: () =>
    set((state: GameState) => {
      const ngPlusState = startNewGamePlus({
        ngPlusUnlocked: state.ngPlusUnlocked,
        ngPlusActive: state.ngPlusActive,
      });
      return {
        ...initialState,
        ngPlusUnlocked: ngPlusState.ngPlusUnlocked,
        ngPlusActive: ngPlusState.ngPlusActive,
        ngPlusCompleted: state.ngPlusCompleted,
        unlockedBands: [...getNgPlusUnlockedBands()] as Band[],
        endlessHighScore: state.endlessHighScore,
        tapeListenCounts: state.tapeListenCounts,
      };
    }),

  endNgPlusRun: () =>
    set((state: GameState) => {
      const ngPlusState = endNewGamePlus({
        ngPlusUnlocked: state.ngPlusUnlocked,
        ngPlusActive: state.ngPlusActive,
      });
      return {
        ...initialState,
        ngPlusUnlocked: ngPlusState.ngPlusUnlocked,
        ngPlusActive: ngPlusState.ngPlusActive,
        ngPlusCompleted: state.ngPlusCompleted + 1,
        endlessHighScore: state.endlessHighScore,
        tapeListenCounts: state.tapeListenCounts,
      };
    }),
});
