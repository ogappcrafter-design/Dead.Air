// store/useSettingsStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_KEY } from '../lib/constants';

interface SettingsState {
  // Audio
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  voiceVolume: number;
  staticEnabled: boolean;

  // Display
  scanlineIntensity: number;
  crtEnabled: boolean;
  reducedMotion: boolean;

  // Gameplay
  autoSave: boolean;
  callFrequency: 'low' | 'medium' | 'high';
  difficulty: 'easy' | 'normal' | 'hard';

  // Account
  cloudSyncEnabled: boolean;
  userId: string | null;

  // Actions
  setMasterVolume: (vol: number) => void;
  setSfxVolume: (vol: number) => void;
  setMusicVolume: (vol: number) => void;
  setVoiceVolume: (vol: number) => void;
  setStaticEnabled: (enabled: boolean) => void;
  setScanlineIntensity: (intensity: number) => void;
  setCrtEnabled: (enabled: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  setAutoSave: (enabled: boolean) => void;
  setCallFrequency: (freq: 'low' | 'medium' | 'high') => void;
  setDifficulty: (diff: 'easy' | 'normal' | 'hard') => void;
  setCloudSyncEnabled: (enabled: boolean) => void;
  setUserId: (id: string | null) => void;
  resetSettings: () => void;
}

const initialState = {
  masterVolume: 0.7,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  voiceVolume: 1.0,
  staticEnabled: true,
  scanlineIntensity: 0.1,
  crtEnabled: true,
  reducedMotion: false,
  autoSave: true,
  callFrequency: 'medium' as const,
  difficulty: 'normal' as const,
  cloudSyncEnabled: false,
  userId: null as string | null,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...initialState,

      setMasterVolume: (vol) => set({ masterVolume: Math.max(0, Math.min(1, vol)) }),
      setSfxVolume: (vol) => set({ sfxVolume: Math.max(0, Math.min(1, vol)) }),
      setMusicVolume: (vol) => set({ musicVolume: Math.max(0, Math.min(1, vol)) }),
      setVoiceVolume: (vol) => set({ voiceVolume: Math.max(0, Math.min(1, vol)) }),
      setStaticEnabled: (enabled) => set({ staticEnabled: enabled }),
      setScanlineIntensity: (intensity) =>
        set({ scanlineIntensity: Math.max(0, Math.min(1, intensity)) }),
      setCrtEnabled: (enabled) => set({ crtEnabled: enabled }),
      setReducedMotion: (reduced) => set({ reducedMotion: reduced }),
      setAutoSave: (enabled) => set({ autoSave: enabled }),
      setCallFrequency: (freq) => set({ callFrequency: freq }),
      setDifficulty: (diff) => set({ difficulty: diff }),
      setCloudSyncEnabled: (enabled) => set({ cloudSyncEnabled: enabled }),
      setUserId: (id) => set({ userId: id }),
      resetSettings: () => set(initialState),
    }),
    {
      name: `${SAVE_KEY}_settings`,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
