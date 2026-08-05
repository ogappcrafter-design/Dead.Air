import { initCallManager } from './CallManager';
import { CALLS, BANDS as BANDS_DATA } from '@/data/calls';
import { useGameStore } from '@/store/useGameStore';
import { useRadioStore } from '@/store/useRadioStore';
import { useAchievementStore } from '@/store/useAchievementStore';
import { useAnalyticsStore } from '@/store/useAnalyticsStore';
import type { Band } from '@/lib/constants';
import type { CallData } from './types';

const registry = new Map<number, CallData>((CALLS as unknown as CallData[]).map((c) => [c.id, c]));

const bands = (
  BANDS_DATA as unknown as Array<{
    id: number;
    name: string;
    freq: string;
    color: string;
    unlockAt: number;
  }>
).map((b) => ({
  id: b.id,
  name: b.name as Band,
  freq: b.freq,
  color: b.color,
  unlockAt: b.unlockAt,
}));

export const callManager = initCallManager({
  registry,
  stores: {
    setCurrentCall: (id) => {
      useGameStore.getState().setCurrentCall(id);
      if (id !== null) {
        const numId = Number(id);
        const call = registry.get(numId);
        const band = useRadioStore.getState().currentBand;
        if (call !== undefined) {
          useAnalyticsStore.getState().track('call_received', {
            callType: call.type,
            band,
          });
        }
      }
    },
    decreaseSanity: (n) => useGameStore.getState().decreaseSanity(n),
    increaseSanity: (n) => useGameStore.getState().increaseSanity(n),
    addStatic: (n) => useGameStore.getState().addStatic(n),
    addTape: (id) => useGameStore.getState().addTape(id),
    unlockBand: (band) => {
      useGameStore.getState().unlockBand(band);
      useAnalyticsStore.getState().track('band_unlocked', { band });
    },
    getReceivedCalls: () => useGameStore.getState().receivedCalls,
    getUnlockedBands: () => useGameStore.getState().unlockedBands,
    markCallReceived: (callId) => {
      useGameStore.getState().markCallReceived(callId);
      const call = registry.get(callId);
      if (call !== undefined) {
        useAnalyticsStore.getState().track('call_survived', {
          callType: call.type,
        });
      }
    },
    recordCallDuration: (ms) => useGameStore.getState().recordCallDuration(ms),
    getPlayerStats: () => {
      const s = useGameStore.getState();
      return {
        callsReceived: s.receivedCalls.length,
        bandsUnlocked: s.unlockedBands.length,
        tapesCollected: s.tapes.length,
        sanityLowest: s.sanityLowest,
        shiftsCompleted: s.shiftsCompleted,
        longestCallSurvivedMs: s.longestCallSurvivedMs,
      };
    },
  },
  radio: {
    getCurrentBand: () => useRadioStore.getState().currentBand,
  },
  audio: null,
  bands,
  onAchievementsCheck: (stats) => useAchievementStore.getState().checkAndUnlock(stats),
  onCallReset: (activeCall) => {
    if (activeCall === null) {
      return;
    }
    useAnalyticsStore.getState().track('call_failed', {
      callType: activeCall.call.type,
    });
  },
});
