// engine/calls/renderers/StayCalmHandler.ts
// Pure renderer for STAY_CALM call type.
// The caller is escalating in panic. The player must do nothing (stay calm)
// for `duration` seconds. Interacting causes the caller to panic — the player
// takes a sanity penalty and loses half the static reward.

import type { CallData, CallOutcome } from '../types';

/**
 * Compute the outcome of a STAY_CALM call.
 *
 * @param call       - The STAY_CALM call data. Requires `sanityPenalty` and
 *                     `staticReward`; `duration` is consumed by the UI.
 * @param stayedCalm - true if the player did NOT interact for the full
 *                     `duration`; false if the player tapped (flinched).
 * @returns CallOutcome with sanity/reward per spec.
 */
export function computeStayCalmOutcome(call: CallData, stayedCalm: boolean): CallOutcome {
  if (stayedCalm) {
    return {
      sanityDelta: 0,
      staticReward: call.staticReward,
      staticMultiplier: 0.5,
      tapeUnlocked: undefined,
      bandUnlocked: undefined,
    };
  }

  // Player flinched: caller panics.
  return {
    sanityDelta: -(call.sanityPenalty ?? 0),
    staticReward: call.staticReward,
    staticMultiplier: 0.5,
    tapeUnlocked: undefined,
    bandUnlocked: undefined,
  };
}

export const STAY_CALM_RENDERER = { computeOutcome: computeStayCalmOutcome };
