// store/useGameStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Band, SAVE_KEY, MAX_SANITY, MAX_STATIC } from '../lib/constants';

interface GameState {
  sanity: number;
  static: number;
  tapes: string[];
  unlockedBands: Band[];
  isPlaying: boolean;
  currentCall: string | null;

  // Actions
  decreaseSanity: (amount: number) => void;
  addStatic: (amount: number) => void;
  addTape: (tapeId: string) => void;
  unlockBand: (band: Band) => void;
  setPlaying: (playing: boolean) => void;
  setCurrentCall: (callId: string | null) => void;
  resetGame: () => void;
}

const initialState = {
  sanity: MAX_SANITY,
  static: 0,
  tapes: [] as string[],
  unlockedBands: ['LIVING'] as Band[],
  isPlaying: false,
  currentCall: null as string | null,
};

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      ...initialState,

      decreaseSanity: (amount) =>
        set((state) => ({
          sanity: Math.max(0, state.sanity - amount),
        })),

      addStatic: (amount) =>
        set((state) => ({
          static: Math.min(MAX_STATIC, state.static + amount),
        })),

      addTape: (tapeId) =>
        set((state) => ({
          tapes: state.tapes.includes(tapeId) ? state.tapes : [...state.tapes, tapeId],
        })),

      unlockBand: (band) =>
        set((state) => ({
          unlockedBands: state.unlockedBands.includes(band)
            ? state.unlockedBands
            : [...state.unlockedBands, band],
        })),

      setPlaying: (playing) => set({ isPlaying: playing }),

      setCurrentCall: (callId) => set({ currentCall: callId }),

      resetGame: () => set(initialState),
    }),
    {
      name: SAVE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
