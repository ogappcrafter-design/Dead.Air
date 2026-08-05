// engine/calls/renderers/SignalDecodeHandler.ts
// Pure renderer for SIGNAL_DECODE call type.
// Computes CallOutcome from CallData + whether the player decoded the sequence.

import type { CallData, CallOutcome } from '../types';

/**
 * Compute the outcome of a SIGNAL_DECODE call.
 *
 * On success (player matched the sequence):
 * - sanityDelta = call.sanityDelta ?? 0
 * - staticReward = call.staticReward
 * - staticMultiplier = 1
 * - tapeUnlocked = call.tape ? call.tapeName : undefined
 *
 * On failure (player failed to match):
 * - sanityDelta = (call.sanityDelta ?? 0) / 2, rounded toward zero
 * - staticReward = 0
 * - staticMultiplier = 0
 * - tapeUnlocked = undefined
 *
 * bandUnlocked is always undefined for SIGNAL_DECODE.
 */
export function computeSignalDecodeOutcome(call: CallData, decoded: boolean): CallOutcome {
  const baseSanityDelta = call.sanityDelta ?? 0;

  if (decoded) {
    return {
      sanityDelta: baseSanityDelta,
      staticReward: call.staticReward,
      staticMultiplier: 1,
      tapeUnlocked: call.tape === true ? call.tapeName : undefined,
      bandUnlocked: undefined,
    };
  }

  // Failure: half penalty, rounded toward zero. Math.trunc rounds toward zero.
  return {
    sanityDelta: Math.trunc(baseSanityDelta / 2),
    staticReward: 0,
    staticMultiplier: 0,
    tapeUnlocked: undefined,
    bandUnlocked: undefined,
  };
}

/** Renderer registration object consumed by call dispatcher. */
export const SIGNAL_DECODE_RENDERER = {
  computeOutcome: computeSignalDecodeOutcome,
};
