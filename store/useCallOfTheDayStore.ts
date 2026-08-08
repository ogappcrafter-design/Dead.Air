import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_KEY } from '../lib/constants';

export interface DailyFeaturedCall {
  callId: number;
  date: string;
  callerName: string;
  band: number;
  lines: string[];
}

interface CallOfTheDayState {
  dailyCall: DailyFeaturedCall | null;
  hasVoted: boolean;
  voteCount: number;
  setDailyCall: (call: DailyFeaturedCall) => void;
  vote: () => void;
  checkNewDay: (dateStr: string) => void;
  reset: () => void;
}

const initialState = {
  dailyCall: null as DailyFeaturedCall | null,
  hasVoted: false,
  voteCount: 0,
};

export const useCallOfTheDayStore = create<CallOfTheDayState>()(
  persist(
    (set, get) => ({
      ...initialState,
      setDailyCall: (call: DailyFeaturedCall) => {
        const current = get().dailyCall;
        if (current && current.date === call.date) {
          return;
        }
        set({ dailyCall: call, hasVoted: false, voteCount: 0 });
      },
      vote: () => {
        const state = get();
        if (state.hasVoted) return;
        set({ hasVoted: true, voteCount: state.voteCount + 1 });
      },
      checkNewDay: (dateStr: string) => {
        const current = get().dailyCall;
        if (current && current.date !== dateStr) {
          set({ dailyCall: null, hasVoted: false, voteCount: 0 });
        }
      },
      reset: () => set(initialState),
    }),
    {
      name: `${SAVE_KEY}_call_of_the_day`,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
