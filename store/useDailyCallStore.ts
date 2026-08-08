// store/useDailyCallStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_KEY } from '../lib/constants';

/**
 * Date string format: YYYY-MM-DD (UTC).
 * Same format used by DailyCallGenerator for seeding.
 */
export type DateString = string;

export interface MissedCall {
  date: DateString;
  callId: number;
}

interface DailyCallState {
  /** Current consecutive day streak (0 = no streak). */
  streak: number;
  /** Date string (YYYY-MM-DD UTC) of the last completed daily call. */
  lastCompletedDate: DateString | null;
  /** Dates where the player missed the daily call (capped at 30 entries). */
  missedCalls: MissedCall[];
  /** The call ID generated for today's daily call. */
  currentDailyCallId: number | null;
  /** The date string for which currentDailyCallId was generated. */
  currentDailyCallDate: DateString | null;
  /** Whether today's daily call has been completed. */
  completedToday: boolean;

  // Actions
  /** Set today's daily call info (call ID + date). */
  setDailyCall: (callId: number, dateStr: DateString) => void;
  /** Mark today's daily call as completed. Updates streak + lastCompletedDate. */
  markCompleted: (dateStr: DateString) => void;
  /** Record a missed daily call. Adds to missedCalls (capped at 30). */
  recordMissed: (dateStr: DateString, callId: number) => void;
  /** Reset streak to 0 (streak broken). */
  breakStreak: () => void;
  /** Check if a date string is today's daily call date. */
  isToday: (dateStr: DateString) => boolean;
  /** Full reset. */
  resetDaily: () => void;
}

const MAX_MISSED = 30;

const initialState = {
  streak: 0,
  lastCompletedDate: null as DateString | null,
  missedCalls: [] as MissedCall[],
  currentDailyCallId: null as number | null,
  currentDailyCallDate: null as DateString | null,
  completedToday: false,
};

export const useDailyCallStore = create<DailyCallState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setDailyCall: (callId, dateStr) =>
        set({
          currentDailyCallId: callId,
          currentDailyCallDate: dateStr,
          completedToday: false,
        }),

      markCompleted: (dateStr) =>
        set((state) => {
          const last = state.lastCompletedDate;
          let streak = state.streak;

          if (last === dateStr) {
            // Already counted today — no-op
            return { completedToday: true };
          }

          // Check if this is consecutive (yesterday → today)
          if (last) {
            const lastDate = new Date(last + 'T00:00:00Z');
            const today = new Date(dateStr + 'T00:00:00Z');
            const diffMs = today.getTime() - lastDate.getTime();
            const oneDay = 86400000;
            if (diffMs === oneDay) {
              // Consecutive day
              streak = state.streak + 1;
            } else if (diffMs === 0) {
              // Same day — already handled above, but safety
              streak = state.streak;
            } else {
              // Streak broken — new streak starts at 1
              streak = 1;
            }
          } else {
            // First ever completion
            streak = 1;
          }

          return {
            streak,
            lastCompletedDate: dateStr,
            completedToday: true,
          };
        }),

      recordMissed: (dateStr, callId) =>
        set((state) => {
          const missed: MissedCall = { date: dateStr, callId };
          const updated = [...state.missedCalls, missed];
          // Cap at MAX_MISSED, dropping oldest
          if (updated.length > MAX_MISSED) {
            updated.splice(0, updated.length - MAX_MISSED);
          }
          return { missedCalls: updated };
        }),

      breakStreak: () => set({ streak: 0 }),

      isToday: (dateStr) => get().currentDailyCallDate === dateStr,

      resetDaily: () => set(initialState),
    }),
    {
      name: `${SAVE_KEY}_daily`,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
