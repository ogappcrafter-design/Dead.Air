// engine/calls/renderers/RightAnswerHandler.ts
// Pure outcome computer for RIGHT_ANSWER call type.
// Caller delivers lines, then player picks one of `call.choices`.
// Each choice carries its own sanity delta, static multiplier, and optional tape unlock.

import type { CallChoice, CallData, CallOutcome } from '../types';

/**
 * Compute the outcome of a RIGHT_ANSWER call given the player's chosen index.
 *
 * Contract (mirrors CallManager.endCall reward application):
 * - `sanityDelta` = chosen choice's `sanityDelta` (negative = loss, positive = gain)
 * - `staticReward` = call's base `staticReward` (CallManager multiplies by `staticMultiplier`)
 * - `staticMultiplier` = chosen choice's `staticMult`
 * - `tapeUnlocked` = chosen choice's `tapeName` when `choice.tape` is true, else undefined
 * - `bandUnlocked` = undefined (RIGHT_ANSWER never unlocks a band directly)
 *
 * Precondition: `call.choices` is a non-empty array and `choiceIndex` is in range.
 * Callers (the React renderer) must validate before invoking; this function does
 * not throw on out-of-range — it returns an empty-outcome stub so a stray render
 * cannot crash the call system. The renderer disables choice buttons while
 * resolving, making out-of-range unreachable in practice.
 */
export function computeRightAnswerOutcome(call: CallData, choiceIndex: number): CallOutcome {
  const choices = call.choices ?? [];
  const choice: CallChoice | undefined = choices[choiceIndex];

  // Defensive: if caller passes an invalid index, return a zero-effect outcome
  // rather than throwing. Keeps the call system non-fatal.
  if (choice === undefined) {
    return {
      sanityDelta: 0,
      staticReward: 0,
      staticMultiplier: 0,
      tapeUnlocked: undefined,
      bandUnlocked: undefined,
    };
  }

  const tapeUnlocked =
    choice.tape === true && choice.tapeName !== undefined ? choice.tapeName : undefined;

  return {
    sanityDelta: choice.sanityDelta,
    staticReward: call.staticReward,
    staticMultiplier: choice.staticMult,
    tapeUnlocked,
    bandUnlocked: undefined,
    recordedChoice: {
      callId: call.id,
      choiceKey: `RIGHT_ANSWER:${call.id}:${choiceIndex}`,
      value: choice.text,
    },
  };
}

/** Renderer registration marker consumed by future CallTypeRouter wiring. */
export const RIGHT_ANSWER_RENDERER = {
  computeOutcome: computeRightAnswerOutcome,
};
