import { initCallManager } from './CallManager';
import { CALLS, BANDS as BANDS_DATA } from '@/data/calls';
import { getCallPool } from '@/engine/progression/InfiniteSignal';
import { useGameStore } from '@/store/useGameStore';
import { useRadioStore } from '@/store/useRadioStore';
import { useAchievementStore } from '@/store/useAchievementStore';
import { useAnalyticsStore } from '@/store/useAnalyticsStore';
import { useChoiceHistoryStore } from '@/store/choiceHistoryStore';
import type { Band } from '@/lib/constants';
import type { CallData } from './types';

// Build registry from sacred calls + procedural/seasonal calls (DEA-68 P1 #2).
// getCallPool generates IDs >= 1000 for procedural/seasonal calls so they
// never collide with sacred call IDs 0..17 from data/calls.js.
const _sacredEntries = (CALLS as unknown as CallData[]).map((c) => [c.id, c] as const);
const _expansionEntries = getCallPool(CALLS as unknown as CallData[], true).map(
  (c) => [c.id, c] as const,
);
const registry = new Map<number, CallData>([..._sacredEntries, ..._expansionEntries]);

const bands = [
  ...(
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
  })),
  // DEA-68: Progression rows for new bands (data/calls.js is sacred — extend here)
  { id: 5, name: 'WEATHER' as Band, freq: '160.5 FM', color: '#4FC3F7', unlockAt: 20 },
  { id: 6, name: 'PIRATE' as Band, freq: '164.7 FM', color: '#FFD700', unlockAt: 25 },
  { id: 7, name: 'HISTORICAL' as Band, freq: '168.3 AM', color: '#D4A76A', unlockAt: 30 },
];

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
    recordChoice: (callId, choiceKey, value) =>
      useChoiceHistoryStore.getState().recordChoice(callId, choiceKey, value),
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
