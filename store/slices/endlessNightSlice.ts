// store/slices/endlessNightSlice.ts
// Endless Night mode: active state, score, high score, escalation, weather, game over.
//
// DEA-86: the start action is eligibility-guarded (canStartEndlessNight +
// call manager idle) so the UI can't start a run while a call is live or the
// player is ineligible. incrementEndlessScore is guarded to only advance
// while a run is active. Starting a new run clears the previous run's
// game-over flag so the banner can't linger.
//
// A run start resets the survival run's state (sanity, static, score,
// escalation) but PRESERVES main-game progress (tapes, receivedCalls,
// shiftsCompleted): Endless Night is a parallel survival loop, not a new
// game — the player must not lose tapes by playing it, and eligibility
// (shiftsCompleted >= 1) must survive across runs.

import type { StoreApi } from 'zustand';
import type { GameState } from '../types';
import { MAX_SANITY } from '../../lib/constants';
import {
  canStartEndlessNight,
  startEndlessNight,
  onShiftCompleted,
  endEndlessNight,
} from '../../engine/progression/EndlessNight';
import type { EndlessNightState } from '../../engine/progression/EndlessNight';
import { getCallManager } from '../../engine/calls/CallManager';

export interface EndlessNightSlice {
  endlessModeActive: boolean;
  endlessScore: number;
  endlessHighScore: number;
  escalationLevel: number;
  endlessWeather: string;
  endlessGameOver: boolean;
  startEndlessNightMode: () => void;
  restartEndlessRun: () => void;
  endEndlessNightMode: () => void;
  incrementEndlessScore: () => void;
}

const currentEndlessState = (state: GameState): EndlessNightState => ({
  endlessModeActive: state.endlessModeActive,
  endlessScore: state.endlessScore,
  endlessHighScore: state.endlessHighScore,
  escalationLevel: state.escalationLevel,
  weather: state.endlessWeather,
  isGameOver: state.endlessGameOver,
});

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
      // Guard: player must be eligible (completed >= 1 shift, no NG+ active)
      // and the call manager must be idle (no call currently live).
      if (!canStartEndlessNight(state.shiftsCompleted, state.ngPlusActive)) {
        return {};
      }
      const manager = getCallManager();
      if (manager !== null && manager.getCallState() !== 'idle') {
        return {};
      }
      const endless = startEndlessNight(state.endlessHighScore);
      return {
        sanity: MAX_SANITY,
        static: 0,
        currentCall: null,
        endlessModeActive: endless.endlessModeActive,
        endlessScore: endless.endlessScore,
        endlessHighScore: endless.endlessHighScore,
        escalationLevel: endless.escalationLevel,
        endlessWeather: endless.weather,
        endlessGameOver: endless.isGameOver,
      };
    }),

  // DEA-86: restart from the game-over banner. Bypasses the eligibility
  // guard (reaching a run already proved eligibility; the player may have
  // fewer recorded shifts after the run's state reset) but still requires
  // an idle call manager.
  restartEndlessRun: () =>
    set((state: GameState) => {
      const manager = getCallManager();
      if (manager !== null && manager.getCallState() !== 'idle') {
        return {};
      }
      const endless = startEndlessNight(state.endlessHighScore);
      return {
        sanity: MAX_SANITY,
        static: 0,
        currentCall: null,
        endlessModeActive: endless.endlessModeActive,
        endlessScore: endless.endlessScore,
        endlessHighScore: endless.endlessHighScore,
        escalationLevel: endless.escalationLevel,
        endlessWeather: endless.weather,
        endlessGameOver: endless.isGameOver,
      };
    }),

  endEndlessNightMode: () =>
    set((state: GameState) => {
      const endless = endEndlessNight(currentEndlessState(state));
      return {
        endlessModeActive: endless.endlessModeActive,
        endlessHighScore: endless.endlessHighScore,
        // Voluntary quit is not a game over — clear the flag so the banner
        // from a previous run (if any) does not linger.
        endlessGameOver: false,
      };
    }),

  incrementEndlessScore: () =>
    set((state: GameState) => {
      // Guard: only advance the score while a run is actually active.
      if (!state.endlessModeActive) {
        return {};
      }
      const endless = onShiftCompleted(currentEndlessState(state));
      return {
        endlessScore: endless.endlessScore,
        endlessHighScore: endless.endlessHighScore,
        escalationLevel: endless.escalationLevel,
        endlessWeather: endless.weather,
      };
    }),
});
