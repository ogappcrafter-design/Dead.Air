// store/slices/endlessNightSlice.ts
// Endless Night mode: active state, score, high score, escalation, weather, game over.

import type { StoreApi } from 'zustand';
import type { GameState } from '../useGameStore';
import {
  startEndlessNight,
  onShiftCompleted,
  onGameOver,
  endEndlessNight,
} from '../../engine/progression/EndlessNight';
import { initialState } from './initialState';

export interface EndlessNightSlice {
  endlessModeActive: boolean;
  endlessScore: number;
  endlessHighScore: number;
  escalationLevel: number;
  endlessWeather: string;
  endlessGameOver: boolean;
  startEndlessNightMode: () => void;
  endEndlessNightMode: () => void;
  incrementEndlessScore: () => void;
  setEndlessGameOver: () => void;
}

export const createEndlessNightSlice = (
  set: StoreApi<GameState>['setState'],
): EndlessNightSlice => ({
  endlessModeActive: false,
  endlessScore: 0,
  endlessHighScore: 0,
  escalationLevel: 0,
  endlessWeather: 'Clear',
  endlessGameOver: false,

  startEndlessNightMode: () =>
    set((state: GameState) => {
      const endless = startEndlessNight(state.endlessHighScore);
      return {
        ...initialState,
        endlessModeActive: endless.endlessModeActive,
        endlessScore: endless.endlessScore,
        endlessHighScore: endless.endlessHighScore,
        escalationLevel: endless.escalationLevel,
        endlessWeather: endless.weather,
        endlessGameOver: endless.isGameOver,
        ngPlusUnlocked: state.ngPlusUnlocked,
        ngPlusActive: state.ngPlusActive,
        ngPlusCompleted: state.ngPlusCompleted,
        tapeListenCounts: state.tapeListenCounts,
      };
    }),

  endEndlessNightMode: () =>
    set((state: GameState) => {
      const endless = endEndlessNight({
        endlessModeActive: state.endlessModeActive,
        endlessScore: state.endlessScore,
        endlessHighScore: state.endlessHighScore,
        escalationLevel: state.escalationLevel,
        weather: state.endlessWeather,
        isGameOver: state.endlessGameOver,
      });
      return {
        endlessModeActive: endless.endlessModeActive,
        endlessHighScore: endless.endlessHighScore,
      };
    }),

  incrementEndlessScore: () =>
    set((state: GameState) => {
      const endless = onShiftCompleted({
        endlessModeActive: state.endlessModeActive,
        endlessScore: state.endlessScore,
        endlessHighScore: state.endlessHighScore,
        escalationLevel: state.escalationLevel,
        weather: state.endlessWeather,
        isGameOver: state.endlessGameOver,
      });
      return {
        endlessScore: endless.endlessScore,
        endlessHighScore: endless.endlessHighScore,
        escalationLevel: endless.escalationLevel,
        endlessWeather: endless.weather,
      };
    }),

  setEndlessGameOver: () =>
    set((state: GameState) => {
      const endless = onGameOver({
        endlessModeActive: state.endlessModeActive,
        endlessScore: state.endlessScore,
        endlessHighScore: state.endlessHighScore,
        escalationLevel: state.escalationLevel,
        weather: state.endlessWeather,
        isGameOver: state.endlessGameOver,
      });
      return {
        endlessModeActive: endless.endlessModeActive,
        endlessHighScore: endless.endlessHighScore,
        endlessGameOver: endless.isGameOver,
      };
    }),
});
