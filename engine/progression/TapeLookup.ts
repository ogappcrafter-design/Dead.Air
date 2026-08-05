// engine/progression/TapeLookup.ts
// Pure functions for resolving tapes to their originating call data.
//
// Tapes are unlocked by calls in two shapes (see data/calls.js):
//   1. Top-level `tape:true, tapeName:"..."` on JUST_LISTEN / DEAD_AIR /
//      SIGNAL_DECODE calls.
//   2. `choices[i].tape:true, tapeName:"..."` on RIGHT_ANSWER calls (the
//      tape unlocks only when the player picks that choice).
//
// The ALL_TAPES list in data/calls.js enumerates every unlockable tape name.
// findCallByTape resolves a tape name back to the call that unlocks it by
// scanning both shapes. getAllTapeNames collects every tapeName reachable
// from CALLS so callers can verify coverage against ALL_TAPES.
//
// No side effects, no I/O — fully testable. Calls data is dependency-injected
// so tests can pass a fixture instead of importing data/calls.js.

import type { CallData } from '../calls/types';

/**
 * Minimal call row shape this module needs from data/calls.js CALLS.
 * Only id, band, type, tapeName (top-level), and choices (with tapeName)
 * are read. Callers may pass the full CallData array — structural typing
 * accepts the wider row.
 */
export type TapeLookupRow = CallData;

/**
 * Find the call that unlocks a given tape name.
 *
 * Scans calls in order. For each call, checks:
 *   - top-level `tapeName` (JUST_LISTEN/DEAD_AIR/SIGNAL_DECODE), and
 *   - each `choices[i].tapeName` (RIGHT_ANSWER).
 *
 * Returns the first call whose tapeName matches exactly, or null if no
 * call unlocks that tape. The match is byte-exact — tape names in
 * data/calls.js use an EM dash (U+2014), so callers must use the same.
 *
 * @example
 *   findCallByTape('Tape #6 — Signal From Guardian', CALLS) // call id 8
 */
export const findCallByTape = (
  tapeName: string,
  calls: ReadonlyArray<TapeLookupRow>,
): CallData | null => {
  for (const call of calls) {
    if (call.tapeName === tapeName) {
      return call;
    }
    if (call.choices !== undefined) {
      for (const choice of call.choices) {
        if (choice.tapeName === tapeName) {
          return call;
        }
      }
    }
  }
  return null;
};

/**
 * Collect every unique tapeName reachable from CALLS — top-level and choice-
 * level. Deduplicated via Set; iteration order matches first-occurrence
 * order in the calls array.
 *
 * Useful for verifying that every entry in ALL_TAPES is backed by a real
 * call (and that tests don't drift when calls.js grows).
 */
export const getAllTapeNames = (calls: ReadonlyArray<TapeLookupRow>): string[] => {
  const seen = new Set<string>();
  for (const call of calls) {
    if (call.tapeName !== undefined) {
      seen.add(call.tapeName);
    }
    if (call.choices !== undefined) {
      for (const choice of call.choices) {
        if (choice.tapeName !== undefined) {
          seen.add(choice.tapeName);
        }
      }
    }
  }
  return Array.from(seen);
};
