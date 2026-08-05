// engine/calls/VariationConfig.ts
// Procedural variation config for calls — randomized static, gaps, degradation.
// Pure data: no logic here. CallVariationEngine computes values.

/**
 * Per-call procedural variation. Each field is randomized per call so
 * repeated playthroughs feel less deterministic.
 */
export interface CallVariation {
  /** Randomized intro static duration in ms (200-800ms). */
  introStaticMs: number;
  /** Randomized outro static duration in ms (300-1200ms). */
  outroStaticMs: number;
  /** Silence gap between lines in ms (base + jitter). */
  lineGapMs: number;
  /** Signal quality degradation 0..1 (0 = clean, 1 = severe). Higher at low sanity. */
  degradation: number;
  /** Pitch shift in cents (-200..+200). 0 = normal. */
  pitchShiftCents: number;
}
