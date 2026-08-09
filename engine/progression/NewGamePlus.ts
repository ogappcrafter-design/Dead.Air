// engine/progression/NewGamePlus.ts
// DEA-7: New Game+ (NG+) — pure functions for NG+ state, unlock, and
// difficulty modifiers.
//
// NG+ unlocks after the player completes the main game (all 15 tapes
// collected + DEAD_AIR call 17 received → meta-ending). When active:
//   - All bands (LIVING through ████████) are unlocked from the start.
//   - Difficulty modifiers stack on top of the selected DifficultyMode:
//     callFrequency ×1.5, sanityDrain ×1.3, staticGain ×1.2.
//   - 3 NG+-exclusive tapes with unique calls become available.
//
// No side effects, no I/O — fully testable. Mirrors the pure-DI style of
// BandUnlock.ts and MetaNarrative.ts.

import type { Band } from '../../lib/constants';
import { BANDS } from '../../lib/constants';
import type { DifficultyConfig, DifficultyMode } from '../../lib/difficulty';
import { DIFFICULTY_CONFIGS } from '../../lib/difficulty';

/** NG+ difficulty modifier constants. Applied on top of base DifficultyConfig. */
export const NG_PLUS_MODIFIERS = {
  callFrequencyMultiplier: 1.5,
  sanityDrainMultiplier: 1.3,
  staticGainMultiplier: 1.2,
} as const;

/**
 * Input shape for checking whether NG+ should be unlocked. Matches the
 * outputs of evaluateMetaNarrative() + useGameStore state.
 */
export interface NewGamePlusUnlockInput {
  /** True when the meta-ending has been reached (15 tapes + DEAD_AIR call). */
  metaEndingUnlocked: boolean;
}

/** Result of the unlock check. */
export interface NewGamePlusUnlockResult {
  /** True if NG+ should now be available in the menu. */
  ngPlusUnlocked: boolean;
}

/**
 * Check whether NG+ should be unlocked.
 *
 * Pure: same input → same output. The store layer calls this and persists
 * the boolean; the function itself does not persist.
 */
export function checkNewGamePlusUnlock(input: NewGamePlusUnlockInput): NewGamePlusUnlockResult {
  return {
    ngPlusUnlocked: input.metaEndingUnlocked,
  };
}

/**
 * NG+ state snapshot — the full state needed by the game loop when NG+
 * is active.
 */
export interface NewGamePlusState {
  /** Whether NG+ has been unlocked (persistent across runs). */
  ngPlusUnlocked: boolean;
  /** Whether NG+ is currently active for this save. */
  ngPlusActive: boolean;
}

/**
 * Start a New Game+ run. Returns the initial NG+ state with all bands
 * unlocked and NG+ active.
 *
 * The caller (store) is responsible for:
 *   - Setting unlockedBands to ALL bands.
 *   - Resetting tapes, receivedCalls, sanity, static, etc.
 *   - Persisting ngPlusUnlocked=true, ngPlusActive=true.
 */
export function startNewGamePlus(_current: NewGamePlusState): NewGamePlusState {
  return {
    ngPlusUnlocked: true,
    ngPlusActive: true,
  };
}

/**
 * Deactivate NG+ (called when the player finishes or abandons the NG+ run).
 * Preserves the unlocked flag so NG+ remains available in the menu.
 */
export function endNewGamePlus(current: NewGamePlusState): NewGamePlusState {
  return {
    ngPlusUnlocked: current.ngPlusUnlocked,
    ngPlusActive: false,
  };
}

/**
 * The set of all bands unlocked at the start of an NG+ run.
 * This is the full BANDS array — LIVING through HISTORICAL.
 */
export function getNgPlusUnlockedBands(): readonly Band[] {
  return [...BANDS];
}

/**
 * Compute the effective difficulty config for NG+ by stacking NG+
 * modifiers on top of the selected base difficulty mode.
 *
 * - sanityDrain = base.sanityDrainMultiplier × NG_PLUS_MODIFIERS.sanityDrainMultiplier
 * - callFrequency = base.callFrequencyMultiplier × NG_PLUS_MODIFIERS.callFrequencyMultiplier
 *   (Note: callFrequencyMultiplier represents the interval multiplier.
 *    Higher = longer intervals = fewer calls. NG+ makes calls MORE frequent,
 *    so we divide by the modifier to shorten intervals. However, the existing
 *    difficulty system uses callFrequencyMultiplier as a direct multiplier on
 *    intervals. To make NG+ have MORE calls, we reduce the interval multiplier.)
 * - staticTolerance = base.staticTolerance / NG_PLUS_MODIFIERS.staticGainMultiplier
 *   (Lower tolerance → more static accumulation.)
 * - permadeath inherits from base (no_rest stays permadeath).
 */
export function getNgPlusDifficultyConfig(baseMode: DifficultyMode): DifficultyConfig {
  const base = DIFFICULTY_CONFIGS[baseMode];

  return {
    sanityDrainMultiplier: base.sanityDrainMultiplier * NG_PLUS_MODIFIERS.sanityDrainMultiplier,
    staticTolerance: base.staticTolerance / NG_PLUS_MODIFIERS.staticGainMultiplier,
    callFrequencyMultiplier:
      base.callFrequencyMultiplier / NG_PLUS_MODIFIERS.callFrequencyMultiplier,
    permadeath: base.permadeath,
    label: `${base.label}+`,
    description: `${base.description} NG+ modifiers in effect.`,
  };
}
