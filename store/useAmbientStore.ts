// store/useAmbientStore.ts
// Tracks which ambient profile is active. Persisted via AsyncStorage.
// 'default' = no atmospheric pack, uses the base engine ambience.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AMBIENT_KEY = 'dead_air_ambient_v1';

interface AmbientState {
  activeAmbient: string;
  setActiveAmbient: (packId: string) => void;
}

export const useAmbientStore = create<AmbientState>()(
  persist(
    (set) => ({
      activeAmbient: 'default',
      setActiveAmbient: (packId) => set({ activeAmbient: packId }),
    }),
    {
      name: AMBIENT_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ activeAmbient: state.activeAmbient }),
    },
  ),
);
