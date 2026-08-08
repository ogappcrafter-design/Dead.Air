// engine/progression/InfiniteSignal.ts
// Pure helpers for the Infinite Signal IAP entitlement. No I/O, no imports
// of store modules — fully testable. The store state shape is passed in as
// a plain object so tests can construct fixtures without wiring Zustand.
//
// Phase 6 (DEA-84): procedural call generation is now wired. When
// `hasExpansion` is true, `getCallPool` appends procedurally generated
// calls from all five band fragment libraries to the 18 sacred calls.

import type { CallData } from '../calls/types';
import { ProceduralCallGenerator } from '../calls/ProceduralCallGenerator';
import { ALL_FRAGMENTS } from '../../data/fragments';
import type { FragmentLibrary, BandVariation } from '../../data/fragments/types';
import type { ChoiceHistorySnapshot } from '../../store/choiceHistoryStore';
import { getActiveSeason, generateSeasonalCalls } from './SeasonalCallInjector';

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
 * The procedural calls use ids >= 1000 (see ProceduralCallGenerator
 * PROCEDURAL_ID_BASE) so they never collide with sacred call ids 0..17
 * in the CallManager registry.
 *
 * @param sacredCalls  The 18 hand-authored calls from data/calls.js (CALLS).
 * @param hasExpansion  True when Infinite Signal is owned.
 * @param options       Optional overrides for test injection:
 *                      - fragments: fragment libraries (defaults to ALL_FRAGMENTS)
 *                      - variations: band variations (defaults to BAND_VARIATIONS)
 *                      - proceduralCountPerBand: calls per band (default 6)
 * @returns the call pool to draw from (base game + expansion).
 */
export const getCallPool = (
  sacredCalls: ReadonlyArray<CallData>,
  hasExpansion: boolean,
  options?: {
    fragments?: ReadonlyArray<FragmentLibrary>;
    variations?: ReadonlyArray<BandVariation>;
    proceduralCountPerBand?: number;
    now?: Date;
    choiceHistory?: ChoiceHistorySnapshot;
  },
): CallData[] => {
  if (!hasExpansion) {
    return [...sacredCalls];
  }

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

  // DEA-61: exclude gated calls whose prerequisite choice hasn't been
  // recorded yet. No-op when CHOICE_GATES is empty.
  const pool = [...sacredCalls, ...procedural, ...seasonal];
  if (options?.choiceHistory) {
    return generator.filterGatedCalls(pool, options.choiceHistory);
  }
  return pool;
};
