import { useEffect } from 'react';
import { AppState } from 'react-native';
import { DailyCallGenerator, getTodayUTC } from '@/engine/calls/DailyCallGenerator';
import { registerDailyCall } from '@/engine/calls/callManagerInstance';
import { useDailyCallStore } from '@/store/useDailyCallStore';

const dailyGenerator = new DailyCallGenerator();

const ONE_DAY_MS = 86_400_000;

/**
 * Reconcile daily call state for the current UTC date.
 *
 * - If the date changed since last run, records the missed call and
 *   breaks the streak if the gap is > 1 day.
 * - Generates today's daily call with the player's current streak tier.
 * - Registers the call in the CallManager registry so it can be started.
 * - Sets the daily call ID + date in the store.
 */
function reconcile(): void {
  const today = getTodayUTC();
  const state = useDailyCallStore.getState();

  if (state.currentDailyCallDate !== today) {
    if (state.currentDailyCallId !== null && state.currentDailyCallDate && !state.completedToday) {
      state.recordMissed(state.currentDailyCallDate, state.currentDailyCallId);
    }

    if (state.lastCompletedDate) {
      const last = new Date(state.lastCompletedDate + 'T00:00:00Z');
      const now = new Date(today + 'T00:00:00Z');
      const diffDays = Math.round((now.getTime() - last.getTime()) / ONE_DAY_MS);
      if (diffDays > 1) {
        state.breakStreak();
      }
    }

    const streakAfterBreak = useDailyCallStore.getState().streak;
    const result = dailyGenerator.generate({ streak: streakAfterBreak, dateStr: today });
    registerDailyCall(result.call);
    state.setDailyCall(result.call.id, today);
  }
}

/** Milliseconds until the next UTC midnight. */
function msUntilNextUTCMidnight(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return next - now.getTime();
}

/**
 * useDailyCall — ensures today's daily mystery call is generated, registered
 * in the CallManager registry, and visible to the player.
 *
 * - Reconciles on mount and after store rehydration.
 * - Schedules a refresh at the next UTC midnight so the daily call rolls
 *   over even if the app stays open across day boundary.
 * - Reconciles when the app returns to the foreground (AppState 'active').
 */
export function useDailyCall(): void {
  const streak = useDailyCallStore((s) => s.streak);
  const currentDailyCallDate = useDailyCallStore((s) => s.currentDailyCallDate);

  useEffect(() => {
    reconcile();

    // Schedule refresh at next UTC midnight.
    const timeoutId = setTimeout(() => {
      reconcile();
    }, msUntilNextUTCMidnight());

    // Reconcile when app returns to foreground.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        reconcile();
      }
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.remove();
    };
  }, [streak, currentDailyCallDate]);
}
