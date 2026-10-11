import { initCallManager } from './CallManager';
import { CALLS, BANDS as BANDS_DATA } from '@/data/calls';
import { getCallPool } from '@/engine/progression/InfiniteSignal';
import { TUTORIAL_CALLS } from '@/data/tutorialCalls';
import { DailyCallGenerator, getTodayUTC } from './DailyCallGenerator';
import { useGameStore } from '@/store/useGameStore';
import { useRadioStore } from '@/store/useRadioStore';
import { useAchievementStore } from '@/store/useAchievementStore';
import { useAnalyticsStore } from '@/store/useAnalyticsStore';
import { useChoiceHistoryStore } from '@/store/choiceHistoryStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useDailyCallStore } from '@/store/useDailyCallStore';
import { getTotalLayersUnlocked } from '@/engine/progression/TapeMastery';
import { useStoreStore } from '@/store/useStoreStore';
import { ATMOSPHERIC_FRAGMENTS } from '@/data/fragments';
import { ATMOSPHERIC_PACKS } from '@/data/atmosphericPacks';
import { ProceduralCallGenerator } from './ProceduralCallGenerator';
import { SEASONAL_ID_BASE } from '@/engine/progression/SeasonalCallInjector';
import { ALL_DLC_CALLS } from '@/data/tapePacks';
import {
  LIVING_FRAGMENTS,
  LIMINAL_FRAGMENTS,
  LOST_FRAGMENTS,
  CLASSIFIED_FRAGMENTS,
  REDACTED_FRAGMENTS,
} from '@/data/fragments';
import type { CallType } from '@/lib/constants';
import type { Band } from '@/lib/constants';
import type { CallData } from './types';

// Build the registry from sacred calls plus the owner's procedural pool.
// The registry is refreshed after store hydration and entitlement changes;
// non-owners must never receive the Infinite Signal call IDs.
const _sacredEntries = (CALLS as unknown as CallData[]).map((c) => [c.id, c] as const);

// Track only Infinite Signal procedural IDs (1000 to SEASONAL_ID_BASE-1).
// Seasonal IDs overlap other generated content's reserved ranges.
let _expansionCallIds = new Set<number>();

function buildExpansionEntries(
  hasInfiniteSignal: boolean,
  ownedTapePacks: ReadonlyArray<string>,
): readonly (readonly [number, CallData])[] {
  const pool = getCallPool(CALLS as unknown as CallData[], hasInfiniteSignal, undefined, {
    ownedTapePacks,
  });
  const entries: (readonly [number, CallData])[] = [];
  for (const c of pool) {
    if (c.id >= 1000 && c.id < SEASONAL_ID_BASE) {
      entries.push([c.id, c] as const);
      _expansionCallIds.add(c.id);
    }
  }
  return entries;
}

const initialStore = useStoreStore.getState();
const _expansionEntries = buildExpansionEntries(
  initialStore.hasInfiniteSignal,
  initialStore.ownedTapePacks,
);
const _tutorialEntries = TUTORIAL_CALLS.map((c) => [c.id, c] as const);
const _dlcEntries = ALL_DLC_CALLS.map((c) => [c.id, c] as const);
const registry = new Map<number, CallData>([
  ..._sacredEntries,
  ..._expansionEntries,
  ..._tutorialEntries,
  ..._dlcEntries,
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

// --- DEA-86: Endless Night rare event calls ---

/**
 * Id base for Endless Night rare event calls. The space 6000+ is reserved
 * for the Endless Night generator (sacred 0-17, procedural 1000+, seasonal
 * 15000+, atmospheric 2000/3000/4000, daily 50000+).
 */
export const ENDLESS_RARE_EVENT_ID_BASE = 6000;

// Core-band fragment libraries that support every advanced call type.
// Rare events only ever spawn on these bands so a forced call type can
// never produce an unrenderable call.
const ENDLESS_RARE_EVENT_LIBRARIES = [
  LIVING_FRAGMENTS,
  LIMINAL_FRAGMENTS,
  LOST_FRAGMENTS,
  CLASSIFIED_FRAGMENTS,
  REDACTED_FRAGMENTS,
] as const;

let _endlessCallIds: number[] = [];
let _endlessNextId = ENDLESS_RARE_EVENT_ID_BASE;

/**
 * DEA-86: Generate a unique procedural rare event call for an Endless
 * Night run and register it in the call registry.
 *
 * `forcedType` is the advanced call type chosen by the escalation level
 * (see `selectRareEvent`). `band` is a core band index 0-4 — the generator
 * picks the matching library, so the call lands on the requested band.
 * Each call gets the next id in the 6000+ space, never colliding.
 *
 * Returns the registered call, or null if the band is out of range.
 */
export function registerEndlessRareEventCall(forcedType: string, band: number): CallData | null {
  if (band < 0 || band >= ENDLESS_RARE_EVENT_LIBRARIES.length) {
    return null;
  }
  const generator = new ProceduralCallGenerator(
    [ENDLESS_RARE_EVENT_LIBRARIES[band]!],
    undefined,
    _endlessNextId,
  );
  const call = generator.generate(band, { forceType: forcedType as CallType });
  _endlessNextId += 1;
  _endlessCallIds.push(call.id);
  registry.set(call.id, call);
  return call;
}

/**
 * DEA-86: Remove all Endless Night rare event calls from the registry.
 * Called when a run ends (game over or quit) so leftover calls cannot
 * leak into a later normal play session. Also resets the id cursor so a
 * subsequent run can reuse the low ids without unbounded growth.
 */
export function clearEndlessRareEventCalls(): void {
  for (const id of _endlessCallIds) {
    registry.delete(id);
  }
  _endlessCallIds = [];
  _endlessNextId = ENDLESS_RARE_EVENT_ID_BASE;
}

/** All currently-registered endless rare event call ids (test-only). */
export function getEndlessRareEventCallIds(): readonly number[] {
  return _endlessCallIds;
}

export function refreshExpansionCalls(
  hasInfiniteSignal: boolean,
  ownedTapePacks: ReadonlyArray<string>,
): void {
  for (const id of _expansionCallIds) {
    registry.delete(id);
  }
  _expansionCallIds = new Set();

  if (!hasInfiniteSignal) return;

  const pool = getCallPool(CALLS as unknown as CallData[], true, undefined, { ownedTapePacks });

  for (const c of pool) {
    if (c.id >= 1000 && c.id < SEASONAL_ID_BASE) {
      registry.set(c.id, c);
      _expansionCallIds.add(c.id);
    }
  }
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
        choiceKey,
        value,
        sanityDelta: typeof value === 'number' ? value : 0,
      });
    },
    getPlayerStats: () => {
      const s = useGameStore.getState();
      const difficulty = useSettingsStore.getState().difficulty;
      const ds = useDailyCallStore.getState();
      const mastery = getTotalLayersUnlocked(s.tapeListenCounts);
      return {
        callsReceived: s.receivedCalls.length,
        bandsUnlocked: s.unlockedBands.length,
        tapesCollected: s.tapes.length,
        sanityLowest: s.sanityLowest,
        shiftsCompleted: s.shiftsCompleted,
        shiftsCompletedByDifficulty: s.shiftsCompletedByDifficulty,
        longestCallSurvivedMs: s.longestCallSurvivedMs,
        difficultyMode: difficulty,
        dailyStreak: ds.streak,
        ngPlusUnlocked: s.ngPlusUnlocked ? 1 : 0,
        ngPlusCompleted: s.ngPlusCompleted,
        endlessShiftsSurvived: s.endlessHighScore,
        tapeMasteryDepthUnlocks: mastery.depth,
        tapeMasteryAbyssUnlocks: mastery.abyss,
      };
    },
    getOwnedTapePacks: () => useStoreStore.getState().ownedTapePacks,
  },
  radio: {
    getCurrentBand: () => useRadioStore.getState().currentBand,
  },
  audio: null,
  bands,
  ownsAtmosphericPack: (packId) => useStoreStore.getState().ownedAtmosphericPacks.includes(packId),
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
