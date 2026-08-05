// engine/calls/TapeProgression.ts
// Pure functions for tape count + band unlock progression.
// No side effects, no I/O — fully testable.

import type { Band } from '../../lib/constants';

/**
 * Band metadata row from data/calls.js BANDS export.
 * Kept as a local interface so this module does not import the .js
 * directly (callers pass it in → dependency-injectable for tests).
 */
export interface BandMetaRow {
  id: number;
  name: Band;
  freq: string;
  color: string;
  unlockAt: number;
}

/**
 * Total number of distinct calls the player has received.
 * Cross-cycle count: receivedCallIds is the persistent list on useGameStore.
 * Duplicates are ignored (defensive — store already dedupes, but the
 * contract here is a set count, not a list length).
 */
export const getTotalCallsReceived = (receivedCallIds: readonly number[]): number =>
  new Set(receivedCallIds).size;

/**
 * Whether a band row should unlock right now, given how many distinct
 * calls the player has received and which bands are already unlocked.
 *
 * A band unlocks when:
 *   1. it is not already in unlockedBands, AND
 *   2. getTotalCallsReceived(receivedCallIds) >= band.unlockAt.
 *
 * Bands with unlockAt <= 0 (e.g. LIVING) are never returned here —
 * they are unlocked by default in the store's initialState.
 */
export const shouldUnlockBand = (
  band: BandMetaRow,
  unlockedBands: readonly Band[],
  receivedCallIds: readonly number[],
): boolean => {
  if (unlockedBands.includes(band.name)) {
    return false;
  }
  return getTotalCallsReceived(receivedCallIds) >= band.unlockAt;
};

/**
 * Next band to unlock (in BANDS order), or null if none meet the
 * threshold yet. Iterates the injected BANDS rows in order and returns
 * the first one that shouldUnlockBand reports true for.
 *
 * Brief contract:
 *   getNextBandUnlock(['LIVING'], [1,2,3,4], BANDS) → 'LIMINAL'
 * because LIMINAL.unlockAt = 4 and getTotalCallsReceived([1,2,3,4]) = 4.
 */
export const getNextBandUnlock = (
  unlockedBands: readonly Band[],
  receivedCallIds: readonly number[],
  bands: readonly BandMetaRow[],
): Band | null => {
  for (const band of bands) {
    if (shouldUnlockBand(band, unlockedBands, receivedCallIds)) {
      return band.name;
    }
  }
  return null;
};

/**
 * Format a tape count for display: "0/15", "3/15", etc.
 * Takes the collected tapes array and the constant total (15 today).
 * Uses the array length, not a set, because the store dedupes on add
 * so there cannot be duplicates by contract.
 */
export const formatTapeCount = (collectedTapes: readonly string[], totalTapes: number): string =>
  `${collectedTapes.length}/${totalTapes}`;
