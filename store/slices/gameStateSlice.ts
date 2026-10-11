// store/slices/gameStateSlice.ts
// Core game state: sanity, static, tapes, bands, calls, shifts, durations.

import type { StoreApi } from 'zustand';
import { MAX_SANITY, MAX_STATIC } from '../../lib/constants';
import type { Band } from '../../lib/constants';
import type { DifficultyMode } from '../../lib/difficulty';
import { DIFFICULTY_CONFIGS } from '../../lib/difficulty';
import { getEndlessDrainMultiplier, onGameOver } from '../../engine/progression/EndlessNight';
import type { GameState } from '../types';
import { useAnalyticsStore } from '../useAnalyticsStore';
import { useSettingsStore } from '../useSettingsStore';
import { useAchievementStore } from '../useAchievementStore';
import { useNarrativeStore } from '../narrativeStore';
import { useChoiceHistoryStore } from '../choiceHistoryStore';
import { initialState } from './initialState';

export interface GameStateSlice {
  sanity: number;
  static: number;
  tapes: string[];
  unlockedBands: Band[];
  isPlaying: boolean;
  currentCall: string | null;
  receivedCalls: number[];
  sanityLowest: number;
  shiftsCompleted: number;
  longestCallSurvivedMs: number;
  shiftsCompletedByDifficulty: Partial<Record<DifficultyMode, number>>;

  decreaseSanity: (amount: number) => void;
  increaseSanity: (amount: number) => void;
  addStatic: (amount: number) => void;
  addTape: (tapeId: string) => void;
  unlockBand: (band: Band) => void;
  setPlaying: (playing: boolean) => void;
  setCurrentCall: (callId: string | null) => void;
  markCallReceived: (callId: number) => void;
  incrementShiftsCompleted: () => void;
  recordCallDuration: (durationMs: number) => void;
  resetGame: () => void;
}

export const createGameSlice = (set: StoreApi<GameState>['setState']): GameStateSlice => ({
  sanity: MAX_SANITY,
  static: 0,
  tapes: [] as string[],
  unlockedBands: ['LIVING'] as Band[],
  isPlaying: false,
  currentCall: null as string | null,
  receivedCalls: [] as number[],
  sanityLowest: MAX_SANITY,
  shiftsCompleted: 0,
  longestCallSurvivedMs: 0,
  shiftsCompletedByDifficulty: {} as Partial<Record<DifficultyMode, number>>,

  decreaseSanity: (amount: number) =>
    set((state: GameState) => {
      // DEA-86: during an active Endless Night run, compose the difficulty
      // multiplier with the escalation multiplier so escalation makes the
      // night deadlier. Reads the current run state (safe: set is only
      // invoked with the previous state inside its own updater).
      const drainMultiplier = state.endlessModeActive
        ? getEndlessDrainMultiplier(
            DIFFICULTY_CONFIGS[useSettingsStore.getState().difficulty].sanityDrainMultiplier,
            state.escalationLevel,
          )
        : 1;
      const sanity = Math.max(0, state.sanity - amount * drainMultiplier);
      // DEA-86: Endless Night ends when sanity hits 0 — score is final,
      // the hook (useEndlessNight) observes this flag and submits the
      // leaderboard entry + clears the run's rare-event calls.
      // Must run BEFORE the no_rest permadeath wipe so an endless death
      // still records game-over (and the score) instead of silently wiping.
      if (sanity === 0 && state.endlessModeActive && !state.endlessGameOver) {
        const endless = endlessGameOverFields(state);
        return {
          sanity,
          ...endless,
          sanityLowest: Math.min(state.sanityLowest, sanity),
        };
      }
      if (sanity === 0 && state.sanity > 0) {
        const difficulty = useSettingsStore.getState().difficulty;
        if (difficulty === 'no_rest') {
          useAnalyticsStore.getState().track('permadeath', {});
          useAchievementStore.getState().clearUnlocked();
          useNarrativeStore.getState().reset();
          useChoiceHistoryStore.getState().reset();
          return initialState;
        }
      }
      return {
        sanity,
        sanityLowest: Math.min(state.sanityLowest, sanity),
      };
    }),

  increaseSanity: (amount: number) =>
    set((state: GameState) => ({
      sanity: Math.min(MAX_SANITY, state.sanity + amount),
    })),

  addStatic: (amount: number) =>
    set((state: GameState) => ({
      static: Math.min(MAX_STATIC, state.static + amount),
    })),

  addTape: (tapeId: string) =>
    set((state: GameState) => {
      if (state.tapes.includes(tapeId)) {
        return state;
      }
      useAnalyticsStore.getState().track('tape_collected', { tapeId });
      return { tapes: [...state.tapes, tapeId] };
    }),

  unlockBand: (band: Band) =>
    set((state: GameState) => ({
      unlockedBands: state.unlockedBands.includes(band)
        ? state.unlockedBands
        : [...state.unlockedBands, band],
    })),

  setPlaying: (playing: boolean) => set({ isPlaying: playing }),

  setCurrentCall: (callId: string | null) => set({ currentCall: callId }),

  markCallReceived: (callId: number) =>
    set((state: GameState) => ({
      receivedCalls: state.receivedCalls.includes(callId)
        ? state.receivedCalls
        : [...state.receivedCalls, callId],
    })),

  incrementShiftsCompleted: () =>
    set((state: GameState) => {
      // DEA-86: shifts completed inside an Endless Night run do not count
      // toward normal-mode shift progress — the endless score (endlessScore)
      // tracks them instead. Without this gate a run would both advance the
      // endless score and inflate shiftsCompleted (double count).
      if (state.endlessModeActive) {
        return {};
      }
      const d = useSettingsStore.getState().difficulty;
      return {
        shiftsCompleted: state.shiftsCompleted + 1,
        shiftsCompletedByDifficulty: {
          ...state.shiftsCompletedByDifficulty,
          [d]: (state.shiftsCompletedByDifficulty[d] ?? 0) + 1,
        },
      };
    }),

  recordCallDuration: (durationMs: number) =>
    set((state: GameState) => ({
      longestCallSurvivedMs: Math.max(state.longestCallSurvivedMs, durationMs),
    })),

  resetGame: () => set(initialState),
});

// DEA-86: endless game-over fields computed here (not in the slice) to
// avoid an import cycle: gameStateSlice → endlessNightSlice → gameStateSlice.
// Mirrors createEndlessNightSlice.setEndlessGameOver exactly.
function endlessGameOverFields(state: GameState): Partial<GameState> {
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
}
