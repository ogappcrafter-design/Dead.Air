import { BANDS } from '../content/bands';
import { CALLS, CALL_COUNT, callsInBand } from '../content/calls';
import { TAPE_COUNT } from '../content/tapes';

/** Free players get this many Infinite Signal generations before the paywall. */
export const FREE_GENERATIONS = 3;

/**
 * Can the player tune to this band?
 *
 * Two independent gates, both of which must pass:
 *   1. Ownership — every band except LIVING is part of the base purchase.
 *   2. Progression — you must have logged `unlockAt` calls to reach it.
 *
 * (v1 short-circuited gate 2 whenever `baseUnlocked` was set, which handed a
 * paying player all five bands the instant they bought and made the unlock
 * table in the README decorative. Both gates now apply.)
 */
export function isBandUnlocked(band, save, purchases) {
  if (!band) return false;
  if (band.unlockAt === 0) return true;
  if (band.paid && !purchases?.baseUnlocked) return false;
  return (save?.done?.length || 0) >= band.unlockAt;
}

/** Why a band is dark, for the locked label on the dial. */
export function bandLockReason(band, save, purchases) {
  if (isBandUnlocked(band, save, purchases)) return null;
  if (band.paid && !purchases?.baseUnlocked) return 'LOCKED';
  const remaining = band.unlockAt - (save?.done?.length || 0);
  return `${remaining} MORE CALL${remaining === 1 ? '' : 'S'}`;
}

export const unlockedBands = (save, purchases) =>
  BANDS.filter((b) => isBandUnlocked(b, save, purchases));

/** Calls still waiting on a band — completed ones drop off the dial. */
export const availableCalls = (bandId, save) =>
  callsInBand(bandId).filter((c) => !(save?.done || []).includes(c.id));

export const isBandCleared = (bandId, save) => availableCalls(bandId, save).length === 0;

/** Can the player generate an AI call right now, and why not if they can't. */
export function generationStatus(save, purchases) {
  if (purchases?.infiniteUnlocked) {
    return { allowed: true, unlimited: true, remaining: Infinity };
  }
  const used = save?.genCount || 0;
  const remaining = Math.max(0, FREE_GENERATIONS - used);
  return {
    allowed: remaining > 0,
    unlimited: false,
    remaining,
  };
}

/** Everything the progress readout needs, in one pass. */
export function progressSummary(save, purchases) {
  const done = save?.done?.length || 0;
  return {
    callsDone: done,
    callsTotal: CALL_COUNT,
    tapesFound: save?.tapes?.length || 0,
    tapesTotal: TAPE_COUNT,
    bandsOpen: unlockedBands(save, purchases).length,
    bandsTotal: BANDS.length,
    complete: done >= CALL_COUNT,
    percent: CALL_COUNT ? Math.round((done / CALL_COUNT) * 100) : 0,
  };
}

/**
 * The band the dial should open on: the earliest unlocked band that still has
 * calls waiting, so the player resumes where the story left off. Falls back to
 * the last unlocked band once everything reachable has been logged.
 */
export function defaultBandId(save, purchases) {
  const open = unlockedBands(save, purchases);
  if (!open.length) return BANDS[0].id;
  const withCalls = open.find((b) => availableCalls(b.id, save).length > 0);
  return (withCalls || open[open.length - 1]).id;
}

/** Recent caller names on a band, used to steer the generator away from repeats. */
export const recentCallerNames = (bandId, limit = 5) =>
  CALLS.filter((c) => c.band === bandId)
    .slice(-limit)
    .map((c) => c.callerName);
