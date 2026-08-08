import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_KEY } from '../lib/constants';

export type TutorialStep =
  'not-started' | 'call-1' | 'call-2' | 'call-3' | 'transition' | 'completed';

interface TutorialState {
  step: TutorialStep;
  skipped: boolean;
  setStep: (step: TutorialStep) => void;
  skip: () => void;
  complete: () => void;
  reset: () => void;
}

const initialState = {
  step: 'not-started' as TutorialStep,
  skipped: false,
};

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set) => ({
      ...initialState,
      setStep: (step) => set({ step }),
      skip: () => set({ skipped: true, step: 'completed' }),
      complete: () => set({ step: 'completed' }),
      reset: () => set(initialState),
    }),
    {
      name: `${SAVE_KEY}_tutorial`,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
