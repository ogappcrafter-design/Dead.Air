// engine/progression/InfiniteSignal.ts
// Pure helpers for the Infinite Signal IAP entitlement. No I/O, no imports
// of store modules — fully testable. The store state shape is passed in as
// a plain object so tests can construct fixtures without wiring Zustand.
//
// Phase 6 (DEA-84): procedural call generation is now wired. When
// `hasExpansion` is true, `getCallPool` appends procedurally generated
// calls from all five band fragment libraries to the 18 sacred calls.
//
// DEA-62: sacred calls are gated by the unlock DAG. Only calls whose
// prerequisites are present in `receivedCalls` are eligible; the rest are
// filtered out before they enter the pool. Procedural calls are unaffected
// (band unlock already gates them) — only sacred ids 0..17 are filtered.

import type { CallData } from '../calls/types';
import { ProceduralCallGenerator } from '../calls/ProceduralCallGenerator';
import { ALL_FRAGMENTS } from '../../data/fragments';
import type { FragmentLibrary, BandVariation } from '../../data/fragments/types';
import { isCallUnlocked } from './UnlockGraph';

/**
 * Minimal subset of the store this module needs. The full useStoreStore
 * state has_extra fields (purchasing, setPurchasing, ...); we only read the
 * owns-Infinite-Signal flag.
 */
export interface InfiniteSignalStore {
  hasInfiniteSignal: boolean;
}

/**
 * Identity helper that returns true when Infinite Signal is owned.
 *
 * Exists so call sites (and tests) read intent (`hasInfiniteSignal(store)`)
 * rather than reaching into the raw boolean, and so Phase 6 can adapt the
 * predicate (e.g. also check an active subscription) without touching callers.
 *
 * @param store  Snapshot of the entitlement-relevant store state.
 * @returns true when the Infinite Signal expansion is owned.
 */
export const hasInfiniteSignal = (store: InfiniteSignalStore): boolean => {
  return store.hasInfiniteSignal;
};

/**
 * Default number of procedural calls generated per band when Infinite
 * Signal is owned. 5 bands × 6 calls = 30 procedural calls appended to
 * the 18 sacred calls, giving a pool of 48.
 *
 * Tests can override this via the `proceduralCountPerBand` param.
 */
export const DEFAULT_PROCEDURAL_COUNT_PER_BAND = 6;

/**
 * Get the call pool available to the radio.
 *
 * Phase 6 (DEA-84): when `hasExpansion` is true, procedurally generated
 * calls are appended to the 18 sacred calls. Non-owners receive only
 * the sacred 18.
 *
 * DEA-62: sacred calls are filtered by the unlock DAG — only ids whose
 * prerequisites are present in `receivedCalls` survive. Procedural ids
 * (>= 1000) are never filtered here (band unlock gates them directly).
 *
 * The procedural calls use ids >= 1000 (see ProceduralCallGenerator
 * PROCEDURAL_ID_BASE) so they never collide with sacred call ids 0..17
 * in the CallManager registry.
 *
 * @param sacredCalls    The 18 hand-authored calls from data/calls.js (CALLS).
 * @param hasExpansion    True when Infinite Signal is owned.
 * @param receivedCalls   Ids of calls the player has already received (for DEA-62 filter).
 *                        When left undefined, no DAG filtering is applied (legacy callers).
 * @param options         Optional overrides for test injection.
 * @returns the call pool to draw from (base game + expansion).
 */
export const getCallPool = (
  sacredCalls: ReadonlyArray<CallData>,
  hasExpansion: boolean,
  receivedCalls?: ReadonlyArray<number>,
  options?: {
    fragments?: ReadonlyArray<FragmentLibrary>;
    variations?: ReadonlyArray<BandVariation>;
    proceduralCountPerBand?: number;
    now?: Date;
    choiceHistory?: ChoiceHistorySnapshot;
  },
): CallData[] => {
  // DEA-62: filter sacred calls through unlock DAG before anything else.
  // When `receivedCalls` is undefined (legacy callers/tests), skip
  // filtering and behave exactly like Phase 6.
  const eligibleSacred =
    receivedCalls === undefined
      ? [...sacredCalls]
      : sacredCalls.filter((c) => isCallUnlocked(c.id, receivedCalls));

  // Non-owners: base game only. Always return a fresh array (never the
  // input reference) so callers can safely mutate the result.
  if (!hasExpansion) {
    return eligibleSacred;
  }

  // Owners: eligible sacred calls + procedural expansion.
  const fragments = options?.fragments ?? ALL_FRAGMENTS;
  const proceduralCountPerBand =
    options?.proceduralCountPerBand ?? DEFAULT_PROCEDURAL_COUNT_PER_BAND;

  const generator =
    options?.variations !== undefined
      ? new ProceduralCallGenerator(fragments, options.variations)
      : new ProceduralCallGenerator(fragments);

  const procedural = generator.generateAcrossBands(proceduralCountPerBand, {
    choiceHistory: options?.choiceHistory,
  });
  const seasonal = generateSeasonalCalls(getActiveSeason(options?.now));

  return [...eligibleSacred, ...procedural];
};
