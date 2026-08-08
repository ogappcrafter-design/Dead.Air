// engine/calls/SanityEffectEngine.ts
// Pure function: compute SanityEffect from current sanity (0..100).
// No side effects, no I/O, no React. data/calls.js untouched.

import type { SanityEffect } from './SanityEffectConfig';
import type { DifficultyMode } from '../../lib/difficulty';
import { DIFFICULTY_CONFIGS } from '../../lib/difficulty';

/**
 * Hallucination text pool per sanity tier.
 * Tier boundaries: high (>60), mid (30..60), low (<30).
 * Mid tier uses inclusive lower bound 30 (sanity === 30 falls here).
 * Low tier is strictly < 30.
 */
const HALLUCINATION_TEXTS = {
  high: [] as string[],
  mid: ['did you hear that?', "it's still on the line"],
  low: [
    "don't look behind you",
    'the signal is you',
    "they're all still here",
    'you never hung up',
  ],
} as const;

/**
 * Clamp a number to [min, max]. NaN-safe: NaN collapses to min.
 */
function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Compute the sanity-driven call experience effect.
 *
 * Thresholds:
 * - visualDistortion:  zero at sanity >= 60, scales up to 1 at sanity = 0.
 * - audioDistortion:    zero at sanity >= 40, scales up to 1 at sanity = 0.
 * - vignetteOpacity:    zero at sanity >= 50, scales up to 1 at sanity = 0.
 * - glitchProbability:  zero at sanity >= 30, scales up to 0.3 at sanity = 0.
 * - hallucinationTexts: tier-based fixed pool (see HALLUCINATION_TEXTS).
 *
 * @param sanity current sanity value 0..100 (clamped to that range first).
 * @param difficulty optional difficulty mode — applies sanity drain multiplier
 *  to thresholds (harder = effects kick in at higher sanity) and reduces
 *  static tolerance. Defaults to 'insomniac' when omitted (backward-compatible).
 */
export function computeSanityEffect(
  sanity: number,
  difficulty: DifficultyMode = 'insomniac',
): SanityEffect {
  const cfg = DIFFICULTY_CONFIGS[difficulty];
  const s = clamp(sanity, 0, 100);

  // Drain multiplier shifts thresholds: harder difficulty = effects at higher sanity.
  // Effective sanity = actual sanity / drainMultiplier (so 1.5x means effects
  // trigger as if sanity were 33% lower).
  const effectiveSanity = s / cfg.sanityDrainMultiplier;

  const visualDistortion = clamp(Math.max(0, (60 - effectiveSanity) / 60), 0, 1);
  const audioDistortion = clamp(Math.max(0, (40 - effectiveSanity) / 40), 0, 1);
  const vignetteOpacity = clamp(Math.max(0, (50 - effectiveSanity) / 50), 0, 1);
  const glitchProbability = clamp(Math.max(0, (30 - effectiveSanity) / 100), 0, 0.3);

  let hallucinationTexts: readonly string[];
  if (s > 60) {
    hallucinationTexts = HALLUCINATION_TEXTS.high;
  } else if (s >= 30) {
    // sanity 30..60 inclusive lower bound
    hallucinationTexts = HALLUCINATION_TEXTS.mid;
  } else {
    // sanity < 30
    hallucinationTexts = HALLUCINATION_TEXTS.low;
  }

  return {
    visualDistortion,
    audioDistortion,
    hallucinationTexts: [...hallucinationTexts],
    vignetteOpacity,
    glitchProbability,
  };
}
