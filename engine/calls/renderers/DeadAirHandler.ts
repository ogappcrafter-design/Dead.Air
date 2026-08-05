// engine/calls/renderers/DeadAirHandler.ts
// DEAD_AIR call-type renderer — pure outcome computation.
// The caller goes silent and the player must wait through dead air.
// No interaction, no multiplier, no band unlock.

import type { CallData, CallOutcome } from '../types';

/**
 * Compute the outcome for a DEAD_AIR call.
 *
 * - sanityDelta: `call.sanityDelta ?? 0` (may be positive, negative, or absent).
 * - staticReward: `call.staticReward` (base, no multiplier).
 * - staticMultiplier: always 1 — DEAD_AIR has no player choice.
 * - tapeUnlocked: `call.tapeName` when `call.tape` is true, else undefined.
 * - bandUnlocked: never — DEAD_AIR unlocks no band.
 */
export function computeDeadAirOutcome(call: CallData): CallOutcome {
  const sanityDelta = call.sanityDelta ?? 0;
  const staticReward = call.staticReward;
  const staticMultiplier = 1;
  const tapeUnlocked = call.tape ? call.tapeName : undefined;
  const bandUnlocked = undefined;

  const outcome: CallOutcome = {
    sanityDelta,
    staticReward,
    staticMultiplier,
  };
  if (tapeUnlocked !== undefined) {
    outcome.tapeUnlocked = tapeUnlocked;
  }
  if (bandUnlocked !== undefined) {
    outcome.bandUnlocked = bandUnlocked;
  }
  return outcome;
}

/** Renderer export consumed by the call system. */
export const DEAD_AIR_RENDERER = { computeOutcome: computeDeadAirOutcome };
