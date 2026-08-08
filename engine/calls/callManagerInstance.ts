import { initCallManager } from './CallManager';
import { CALLS, BANDS as BANDS_DATA } from '@/data/calls';
import { getCallPool } from '@/engine/progression/InfiniteSignal';
import { TUTORIAL_CALLS } from '@/data/tutorialCalls';
import { DailyCallGenerator, getTodayUTC } from './DailyCallGenerator'; (feat(calls): DEA-49 daily mystery call system — seeded RNG, streak tracking, exclusive calls)
import { useGameStore } from '@/store/useGameStore';
import { useRadioStore } from '@/store/useRadioStore';
import { useAchievementStore } from '@/store/useAchievementStore';
import { useAnalyticsStore } from '@/store/useAnalyticsStore';
import { useChoiceHistoryStore } from '@/store/choiceHistoryStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useDailyCallStore } from '@/store/useDailyCallStore'; (feat(calls): DEA-49 daily mystery call system — seeded RNG, streak tracking, exclusive calls)
import { useStoreStore } from '@/store/useStoreStore';
import { ATMOSPHERIC_FRAGMENTS } from '@/data/fragments';
import { ATMOSPHERIC_PACKS } from '@/data/atmosphericPacks';
import { ProceduralCallGenerator } from './ProceduralCallGenerator';
import type { Band } from '@/lib/constants';
import type { CallData } from './types';

// Build registry from sacred calls + procedural/seasonal calls (DEA-68 P1 #2).
// getCallPool generates IDs >= 1000 for procedural/seasonal calls so they
// never collide with sacred call IDs 0..17 from data/calls.js.
const _sacredEntries = (CALLS as unknown as CallData[]).map((c) => [c.id, c] as const);
const _expansionEntries = getCallPool(CALLS as unknown as CallData[], true).map(
  (c) => [c.id, c] as const,
);
const _tutorialEntries = TUTORIAL_CALLS.map((c) => [c.id, c] as const);
const registry = new Map<number, CallData>([
  ..._sacredEntries,
  ..._expansionEntries,
  ..._tutorialEntries,
]);

// Generate today's daily call and add to registry (DEA-49).
// The streak may be 0 if the store hasn't rehydrated yet; useDailyCall
// hook will refresh the registration once the correct streak is known.
const _dailyGenerator = new DailyCallGenerator();
const _dailyStreak = useDailyCallStore.getState().streak;
const _todayStr = getTodayUTC();
const _dailyResult = _dailyGenerator.generate({ streak: _dailyStreak, dateStr: _todayStr });
registry.set(_dailyResult.call.id, _dailyResult.call);

// Generate atmospheric DLC calls and register them (DEA-30).
// Each pack gets a unique idBase to avoid collision with base game IDs.
const _atmosIdBases = [2000, 3000, 4000];
const atmosphericCallPackMap = new Map<number, string>();
ATMOSPHERIC_FRAGMENTS.forEach((lib, i) => {
  const packId = ATMOSPHERIC_PACKS[i]?.id;
  if (packId === undefined) return;
  const idBase = _atmosIdBases[i] ?? 5000;
  const gen = new ProceduralCallGenerator([lib], undefined, idBase);
  const calls = gen.generateBatch(0, 5);
  for (const c of calls) {
    registry.set(c.id, c);
    atmosphericCallPackMap.set(c.id, packId);
  }
});

/**
 * Register or replace a daily call in the registry.
 * Called by useDailyCall hook after store rehydration to ensure
 * the daily call reflects the player's actual streak tier.
 */
export function registerDailyCall(call: CallData): void {
  registry.set(call.id, call);
}

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
      const dailyState = useDailyCallStore.getState();
      const today = getTodayUTC();
      if (dailyState.currentDailyCallId === callId && dailyState.currentDailyCallDate === today) {
        dailyState.markCompleted(today);
      }
      const call = registry.get(callId);
      if (call !== undefined) {
        useAnalyticsStore.getState().track('call_survived', {
          callType: call.type,
        });
      }
    },
    recordCallDuration: (ms) => useGameStore.getState().recordCallDuration(ms),
    recordChoice: (callId, choiceKey, value) => {
      const parts = choiceKey.split(':');
      const choiceIndex = parseInt(parts[parts.length - 1] ?? '0', 10) || 0;
      useChoiceHistoryStore.getState().addChoice({
        callId,
        choiceIndex,
        tag: choiceKey,
        sanityDelta: typeof value === 'number' ? value : 0,
      });
    },
    getPlayerStats: () => {
      const s = useGameStore.getState();
      const difficulty = useSettingsStore.getState().difficulty;
      const ds = useDailyCallStore.getState(); (feat(calls): DEA-49 daily mystery call system — seeded RNG, streak tracking, exclusive calls)
      return {
        callsReceived: s.receivedCalls.length,
        bandsUnlocked: s.unlockedBands.length,
        tapesCollected: s.tapes.length,
        sanityLowest: s.sanityLowest,
        shiftsCompleted: s.shiftsCompleted,
        shiftsCompletedByDifficulty: s.shiftsCompletedByDifficulty,
        longestCallSurvivedMs: s.longestCallSurvivedMs,
        difficultyMode: difficulty,
        dailyStreak: ds.streak, (feat(calls): DEA-49 daily mystery call system — seeded RNG, streak tracking, exclusive calls)
      };
    },
  },
  radio: {
    getCurrentBand: () => useRadioStore.getState().currentBand,
  },
  audio: null,
  bands,
  ownsAtmosphericPack: (packId) =>
    useStoreStore.getState().ownedAtmosphericPacks.includes(packId),
  callPackMap: atmosphericCallPackMap,
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
