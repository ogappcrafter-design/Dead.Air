// store/useGameStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Band, SAVE_KEY, MAX_SANITY, MAX_STATIC } from '../lib/constants';
import type { DifficultyMode } from '../lib/difficulty';
import { useAnalyticsStore } from './useAnalyticsStore';
import { useSettingsStore } from './useSettingsStore';
import { useAchievementStore } from './useAchievementStore';
import { useNarrativeStore } from './narrativeStore';
import { useChoiceHistoryStore } from './choiceHistoryStore';
import {
  startNewGamePlus,
  endNewGamePlus,
  getNgPlusUnlockedBands,
} from '../engine/progression/NewGamePlus';
import {
  startEndlessNight,
  onShiftCompleted,
  onGameOver,
  endEndlessNight,
} from '../engine/progression/EndlessNight';
import { incrementListenCount } from '../engine/progression/TapeMastery';

interface GameState {
  sanity: number;
  static: number;
  tapes: string[];
  unlockedBands: Band[];
  isPlaying: boolean;
  currentCall: string | null;
  receivedCalls: number[];
  /** Cumulative lowest sanity ever reached (MAX_SANITY at fresh save). */
  sanityLowest: number;
  /** Number of completed night shifts. */
  shiftsCompleted: number;
  /** Longest single-call duration survived, in milliseconds. */
  longestCallSurvivedMs: number;
  /** Completed night shifts, bucketed by the difficulty they were played on. */
  shiftsCompletedByDifficulty: Partial<Record<DifficultyMode, number>>;

  // NG+ state
  /** Whether New Game+ has been unlocked (meta-ending reached). */
  ngPlusUnlocked: boolean;
  /** Whether a New Game+ run is currently active. */
  ngPlusActive: boolean;
  /** Number of New Game+ runs completed. */
  ngPlusCompleted: number;

  // Endless Night state
  /** Whether Endless Night mode is currently active. */
  endlessModeActive: boolean;
  /** Current score (shifts survived) in the active Endless Night run. */
  endlessScore: number;
  /** All-time highest Endless Night score across runs. */
  endlessHighScore: number;
  /** Current Endless Night escalation level (derived from score). */
  escalationLevel: number;
  /** Current Endless Night weather descriptor. */
  endlessWeather: string;
  /** Whether Endless Night run ended (sanity hit 0). */
  endlessGameOver: boolean;

  // Tape Mastery state
  /** Per-tape listen counts for Tape Mastery layer progression. */
  tapeListenCounts: Record<string, number>;

  // Actions
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

  // NG+ actions
  startNgPlusRun: () => void;
  endNgPlusRun: () => void;

  // Endless Night actions
  startEndlessNightMode: () => void;
  endEndlessNightMode: () => void;
  incrementEndlessScore: () => void;
  setEndlessGameOver: () => void;

  // Tape Mastery actions
  recordTapeListen: (tapeId: string) => void;
}

const initialState = {
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
  ngPlusUnlocked: false,
  ngPlusActive: false,
  ngPlusCompleted: 0,
  endlessModeActive: false,
  endlessScore: 0,
  endlessHighScore: 0,
  escalationLevel: 0,
  endlessWeather: 'Clear',
  endlessGameOver: false,
  tapeListenCounts: {} as Record<string, number>,
};

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      ...initialState,

      decreaseSanity: (amount) =>
        set((state) => {
          const sanity = Math.max(0, state.sanity - amount);
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

      increaseSanity: (amount) =>
        set((state) => ({
          sanity: Math.min(MAX_SANITY, state.sanity + amount),
        })),

      addStatic: (amount) =>
        set((state) => ({
          static: Math.min(MAX_STATIC, state.static + amount),
        })),

      addTape: (tapeId) =>
        set((state) => {
          if (state.tapes.includes(tapeId)) {
            return state;
          }
          useAnalyticsStore.getState().track('tape_collected', { tapeId });
          return { tapes: [...state.tapes, tapeId] };
        }),

      unlockBand: (band) =>
        set((state) => ({
          unlockedBands: state.unlockedBands.includes(band)
            ? state.unlockedBands
            : [...state.unlockedBands, band],
        })),

      setPlaying: (playing) => set({ isPlaying: playing }),

      setCurrentCall: (callId) => set({ currentCall: callId }),

      markCallReceived: (callId) =>
        set((state) => ({
          receivedCalls: state.receivedCalls.includes(callId)
            ? state.receivedCalls
            : [...state.receivedCalls, callId],
        })),

      incrementShiftsCompleted: () =>
        set((state) => {
          const d = useSettingsStore.getState().difficulty;
          return {
            shiftsCompleted: state.shiftsCompleted + 1,
            shiftsCompletedByDifficulty: {
              ...state.shiftsCompletedByDifficulty,
              [d]: (state.shiftsCompletedByDifficulty[d] ?? 0) + 1,
            },
          };
        }),

      recordCallDuration: (durationMs) =>
        set((state) => ({
          longestCallSurvivedMs: Math.max(state.longestCallSurvivedMs, durationMs),
        })),

      resetGame: () => set(initialState),

      startNgPlusRun: () =>
        set((state) => {
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
        set((state) => {
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

      startEndlessNightMode: () =>
        set((state) => {
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
        set((state) => {
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
        set((state) => {
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
        set((state) => {
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

      recordTapeListen: (tapeId) =>
        set((state) => ({
          tapeListenCounts: incrementListenCount(state.tapeListenCounts, tapeId),
        })),
    }),
    {
      name: SAVE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
