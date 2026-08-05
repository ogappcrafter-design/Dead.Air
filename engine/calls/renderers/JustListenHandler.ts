// engine/calls/renderers/JustListenHandler.ts
// Pure renderer for JUST_LISTEN call type. The player just listens — no
// interaction. Outcome is deterministic from the call data alone.
// data/calls.js is sacred; this file only reads its shape via CallData.

import type { CallData, CallOutcome } from '../types';

/**
 * Compute the deterministic `CallOutcome` for a JUST_LISTEN call.
 *
 * JUST_LISTEN has no multiplier and never unlocks a band:
 *   - sanityDelta   = call.sanityDelta ?? 0
 *   - staticReward  = call.staticReward
 *   - staticMultiplier = 1
 *   - tapeUnlocked  = call.tape ? call.tapeName : undefined
 *   - bandUnlocked  = undefined
 */
export function computeJustListenOutcome(call: CallData): CallOutcome {
  return {
    sanityDelta: call.sanityDelta ?? 0,
    staticReward: call.staticReward,
    staticMultiplier: 1,
    tapeUnlocked: call.tape ? call.tapeName : undefined,
    bandUnlocked: undefined,
  };
}

/** Renderer registry entry consumed by the call dispatcher. */
export const JUST_LISTEN_RENDERER = {
  computeOutcome: computeJustListenOutcome,
} as const;
