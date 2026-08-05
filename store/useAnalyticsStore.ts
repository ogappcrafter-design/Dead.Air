// store/useAnalyticsStore.ts
// Opt-in, local-only analytics. Off by default. Persists only the `enabled`
// boolean — never event payloads (no personal data persisted).
// Delegates event recording to AnalyticsEngine singleton.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_KEY } from '../lib/constants';
import {
  AnalyticsEngine,
  type AnalyticsEvent,
  type AnalyticsEventName,
} from '../lib/analytics/AnalyticsEngine';

interface AnalyticsState {
  /** Opt-in flag. Persisted across reinstalls. Off by default. */
  enabled: boolean;
  /** Mirror of engine events for reactive UI. State-only mirror; engine is
   *  the source of truth. Bumped (reassigned) on every track call. */
  sessionEvents: AnalyticsEvent[];
  // Actions
  setEnabled: (enabled: boolean) => void;
  track: (eventName: AnalyticsEventName, data?: AnalyticsEvent['data']) => void;
  reset: () => void;
}

const initialState = {
  enabled: false,
  sessionEvents: [] as AnalyticsEvent[],
};

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setEnabled: (enabled) => set({ enabled }),

      /**
       * Track an event IF enabled. Honors the opt-in: when disabled, the
       * event is dropped before reaching the engine. This means the engine
       * can be initialized unconditionally for session bookkeeping while
       * gameplay analytics remain gated by user consent.
       */
      track: (eventName, data) => {
        if (!get().enabled) {
          return;
        }
        AnalyticsEngine.track(eventName, data);
        set({ sessionEvents: AnalyticsEngine.getEvents() });
      },

      reset: () => {
        AnalyticsEngine.reset();
        set({ sessionEvents: [] });
      },
    }),
    {
      name: `${SAVE_KEY}_analytics`,
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only consent. Never persist events.
      partialize: (state) => ({ enabled: state.enabled }),
    },
  ),
);
