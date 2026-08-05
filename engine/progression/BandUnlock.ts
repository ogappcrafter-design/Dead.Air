// engine/progression/BandUnlock.ts
// Pure functions for metroidvania-style band unlock progression.
// Bands unlock based on calls survived (deduplicated count), matching the
// BANDS unlockAt values from data/calls.js:
//   LIVING=0, LIMINAL=4, LOST=8, CLASSIFIED=12, ████████=15.
// No side effects, no I/O — fully testable. Bands data is dependency-injected
// so tests can pass a fixture instead of importing data/calls.js.

import type { Band } from '../../lib/constants';

/**
 * Minimal band row shape this module needs from data/calls.js BANDS.
 * Only id, name, and unlockAt are read. Callers may pass the full BANDS
 * array (which also has freq/color) — structural typing accepts the wider row.
 */
export interface BandUnlockRow {
  id: number;
  name: Band;
  unlockAt: number;
}

/** Criteria evaluated by checkBandUnlock — a snapshot of progression state. */
export interface UnlockCriteria {
  /** Total calls received (deduplicated). */
  callsReceived: number;
  /** Total tapes collected. */
  tapesCollected: number;
  /** Currently unlocked bands. */
  unlockedBands: readonly Band[];
}

/** Result of a band unlock check. */
export interface BandUnlockResult {
  /** Band to unlock, or null if none. */
  band: Band | null;
  /** True if criteria met for next band. */
  canUnlock: boolean;
  /** Progress toward next unlock (0..1). */
  progress: number;
  /** Calls still needed for next unlock. */
  callsRemaining: number;
}

/**
 * Find the next band row (in BANDS order) that is not yet unlocked.
 * Returns null when every band is already unlocked.
 */
const findNextLockedBand = (
  criteria: UnlockCriteria,
  bandsData: ReadonlyArray<BandUnlockRow>,
): BandUnlockRow | null => {
  for (const row of bandsData) {
    if (!criteria.unlockedBands.includes(row.name)) {
      return row;
    }
  }
  return null;
};

/**
 * Check if a band should unlock based on criteria.
 *
 * Rules:
 * - LIVING (unlockAt=0): always unlocked (store initializes it so); not
 *   returned here because its row is already in unlockedBands.
 * - LIMINAL/LOST/CLASSIFIED/████████: unlock when callsReceived >= unlockAt.
 * - progress = callsReceived / nextBandUnlockAt, clamped 0..1.
 * - callsRemaining = max(0, nextBandUnlockAt - callsReceived).
 * - canUnlock = callsRemaining === 0 && nextBand exists && not already unlocked.
 * - band = nextBand name when canUnlock, else null.
 *
 * `bandsData` must be ordered by ascending unlockAt (matches data/calls.js).
 */
export const checkBandUnlock = (
  criteria: UnlockCriteria,
  bandsData: ReadonlyArray<BandUnlockRow>,
): BandUnlockResult => {
  const nextBand = findNextLockedBand(criteria, bandsData);

  if (nextBand === null) {
    // All bands unlocked — no further progress to make.
    return {
      band: null,
      canUnlock: false,
      progress: 1,
      callsRemaining: 0,
    };
  }

  const threshold = nextBand.unlockAt;
  const callsRemaining = Math.max(0, threshold - criteria.callsReceived);
  const canUnlock = callsRemaining === 0;
  // Guard against unlockAt 0 (would divide by zero) — though LIVING is
  // always in unlockedBands so this branch is unreachable for it, clamp
  // defensively.
  const progress =
    threshold <= 0 ? 1 : Math.min(1, Math.max(0, criteria.callsReceived / threshold));

  return {
    band: canUnlock ? nextBand.name : null,
    canUnlock,
    progress,
    callsRemaining,
  };
};

/**
 * Get all unlockable bands given current criteria — every locked band whose
 * unlockAt threshold has been met. Ordered by BANDS row order (ascending id).
 *
 * Unlike checkBandUnlock (which reports only the *next* band), this returns
 * every band that qualifies at once. Useful for bulk-unlock scenarios or
 * catch-up after a save-load where multiple thresholds were crossed.
 */
export const getUnlockableBands = (
  criteria: UnlockCriteria,
  bandsData: ReadonlyArray<BandUnlockRow>,
): Band[] => {
  const unlockable: Band[] = [];
  for (const row of bandsData) {
    if (criteria.unlockedBands.includes(row.name)) {
      continue;
    }
    if (criteria.callsReceived >= row.unlockAt) {
      unlockable.push(row.name);
    }
  }
  return unlockable;
};
