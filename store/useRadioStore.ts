// store/useRadioStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Band, SAVE_KEY } from '../lib/constants';

const MIN_FREQUENCY = 87.5;
const MAX_FREQUENCY = 108.0;

interface RadioState {
  currentBand: Band;
  frequency: number;
  volume: number;
  isTuning: boolean;
  signalStrength: number;

  // Actions
  setBand: (band: Band) => void;
  setFrequency: (freq: number) => void;
  setVolume: (vol: number) => void;
  setTuning: (tuning: boolean) => void;
  setSignalStrength: (strength: number) => void;
  resetRadio: () => void;
}

const initialState = {
  currentBand: 'LIVING' as Band,
  frequency: MIN_FREQUENCY,
  volume: 0.5,
  isTuning: false,
  signalStrength: 1,
};

export const useRadioStore = create<RadioState>()(
  persist(
    (set) => ({
      ...initialState,

      setBand: (band) => set({ currentBand: band }),

      setFrequency: (freq) =>
        set({
          frequency: Math.max(MIN_FREQUENCY, Math.min(MAX_FREQUENCY, freq)),
        }),

      setVolume: (vol) =>
        set({
          volume: Math.max(0, Math.min(1, vol)),
        }),

      setTuning: (tuning) => set({ isTuning: tuning }),

      setSignalStrength: (strength) =>
        set({
          signalStrength: Math.max(0, Math.min(1, strength)),
        }),

      resetRadio: () => set(initialState),
    }),
    {
      name: `${SAVE_KEY}_radio`,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
