// engine/calls/SanityEffectConfig.ts
// Pure type definition for sanity-driven call-time effects. No data/calls.js touch.
// Used by SanityEffectEngine (compute), useSanityEffect hook, and SanityOverlay view.

/**
 * Sanity effect descriptor: how the call experience degrades at low sanity.
 * All numeric fields are intensities in [0, 1] except `glitchProbability`
 * which is in [0, 0.3].
 */
export interface SanityEffect {
  /** Visual distortion intensity 0..1 (0 = none, 1 = severe). */
  visualDistortion: number;
  /** Audio distortion intensity 0..1. */
  audioDistortion: number;
  /** Hallucination text overlays to show (empty array = none). */
  hallucinationTexts: string[];
  /** Vignette opacity 0..1. */
  vignetteOpacity: number;
  /** Text glitch probability 0..1 per render (clamped to <= 0.3). */
  glitchProbability: number;
}
