import { BANDS } from '../content/bands';
import { CALL_COUNT, STORY_CALLS, callsInBand } from '../content/calls';
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

/**
 * Is this call on the dial right now?
 *
 * Beyond "not already logged", a call can carry two extra gates:
 *   `window`   local hours it exists between, e.g. the 3:47 AM transmission
 *   `requires` the id of a call that has to be logged first
 *
 * `now` is injected so the clock can be tested rather than waited for.
 */
export function isCallAvailable(call, save, now = new Date()) {
  if (!call) return false;
  if ((save?.done || []).includes(call.id)) return false;
  if (call.requires && !(save?.done || []).includes(call.requires)) return false;

  if (call.window) {
    const hour = now.getHours();
    const { from, to } = call.window;
    // Windows that wrap past midnight (23 → 2) still read naturally.
    const inside = from <= to ? hour >= from && hour < to : hour >= from || hour < to;
    if (!inside) return false;
  }

  return true;
}

/** Calls still waiting on a band — completed ones drop off the dial. */
export const availableCalls = (bandId, save, now = new Date()) =>
  callsInBand(bandId).filter((c) => isCallAvailable(c, save, now));

/**
 * A secret the player has earned the right to know about but cannot reach yet
 * — the dial shows it as a locked slot rather than nothing, so missing it
 * feels like a near miss instead of an absence.
 */
export const teasedCalls = (bandId, save, now = new Date()) =>
  callsInBand(bandId).filter(
    (c) =>
      c.secret &&
      !(save?.done || []).includes(c.id) &&
      (!c.requires || (save?.done || []).includes(c.requires)) &&
      !isCallAvailable(c, save, now),
  );

export const isBandCleared = (bandId, save, now = new Date()) =>
  availableCalls(bandId, save, now).length === 0;

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
  // Secret calls are excluded so a player who is never awake at the right hour
  // still reads 100%.
  const logged = new Set(save?.done || []);
  const done = STORY_CALLS.filter((c) => logged.has(c.id)).length;
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
export function defaultBandId(save, purchases, now = new Date()) {
  const open = unlockedBands(save, purchases);
  if (!open.length) return BANDS[0].id;
  const withCalls = open.find((b) => availableCalls(b.id, save, now).length > 0);
  return (withCalls || open[open.length - 1]).id;
}

/**
 * Where the dial should move after a call, if anywhere.
 *
 * Clearing a band used to strand the player looking at "ALL CALLS LOGGED"
 * while the band they had just unlocked sat one tap away, unmentioned. Returns
 * null when the current band still has work, so the dial only ever moves on
 * its own at a genuine dead end.
 */
export function nextBandId(currentBandId, save, purchases, now = new Date()) {
  if (availableCalls(currentBandId, save, now).length > 0) return null;
  const open = unlockedBands(save, purchases);
  const next = open.find(
    (b) => b.id !== currentBandId && availableCalls(b.id, save, now).length > 0,
  );
  return next ? next.id : null;
}

/** Recent caller names on a band, used to steer the generator away from repeats. */
export const recentCallerNames = (bandId, limit = 5) =>
  STORY_CALLS.filter((c) => c.band === bandId)
    .slice(-limit)
    .map((c) => c.callerName);
