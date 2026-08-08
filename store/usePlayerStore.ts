// store/usePlayerStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_KEY } from '../lib/constants';

interface PlayerState {
  // Identity
  playerName: string;
  djCallSign: string;
  stationName: string;

  // Onboarding
  hasOnboarded: boolean;

  // Actions
  setPlayerName: (name: string) => void;
  setDjCallSign: (callSign: string) => void;
  setStationName: (name: string) => void;
  completeOnboarding: (data: {
    playerName: string;
    djCallSign: string;
    stationName: string;
  }) => void;
  resetPlayer: () => void;
}

const initialState = {
  playerName: '',
  djCallSign: '',
  stationName: '',
  hasOnboarded: false,
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      ...initialState,

      setPlayerName: (name) => set({ playerName: name.trim() }),
      setDjCallSign: (callSign) => set({ djCallSign: callSign.trim() }),
      setStationName: (name) => set({ stationName: name.trim() }),
      completeOnboarding: (data) =>
        set({
          playerName: data.playerName.trim(),
          djCallSign: data.djCallSign.trim(),
          stationName: data.stationName.trim(),
          hasOnboarded: true,
        }),
      resetPlayer: () => set(initialState),
    }),
    {
      name: `${SAVE_KEY}_player`,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
