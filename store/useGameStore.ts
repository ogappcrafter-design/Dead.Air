// store/useGameStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Band, SAVE_KEY, MAX_SANITY, MAX_STATIC } from '../lib/constants';
import { useAnalyticsStore } from './useAnalyticsStore';

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
};

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      ...initialState,

      decreaseSanity: (amount) =>
        set((state) => {
          const sanity = Math.max(0, state.sanity - amount);
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
        set((state) => ({ shiftsCompleted: state.shiftsCompleted + 1 })),

      recordCallDuration: (durationMs) =>
        set((state) => ({
          longestCallSurvivedMs: Math.max(state.longestCallSurvivedMs, durationMs),
        })),

      resetGame: () => set(initialState),
    }),
    {
      name: SAVE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
