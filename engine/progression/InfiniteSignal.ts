// engine/progression/InfiniteSignal.ts
// Pure helpers for the Infinite Signal IAP entitlement. No I/O, no imports
// of store modules — fully testable. The store state shape is passed in as
// a plain object so tests can construct fixtures without wiring Zustand.
//
// Phase 5-4 scope: returns the base-game sacred calls only. Phase 6 will
// generate procedural calls when hasExpansion is true (see TODO below).

import type { CallData } from '../calls/types';

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
 * Get the call pool available to the radio.
 *
 * Phase 5-4: returns `sacredCalls` unchanged — Infinite Signal only unlocks
 * *additional* procedural calls; it never restricts the base game.
 *
 * TODO(phase-6): when `hasExpansion` is true, append procedurally generated
 * calls (new band entries, generated callerId/callerName/signal, varied
 * types) to the returned array. Until then, callers receive the 18 sacred
 * calls regardless of ownsInfiniteSignal.
 *
 * @param sacredCalls  The 18 hand-authored calls from data/calls.js (CALLS).
 * @param hasExpansion  True when Infinite Signal is owned.
 * @returns the call pool to draw from (base game + future expansion).
 */
export const getCallPool = (
  sacredCalls: ReadonlyArray<CallData>,
  hasExpansion: boolean,
): CallData[] => {
  // Phase 5-4: base game only.
  // TODO(phase-6): if (hasExpansion) append procedural generation here.
  void hasExpansion; // expansion not yet used — see Phase 6 TODO above.
  return [...sacredCalls];
};
