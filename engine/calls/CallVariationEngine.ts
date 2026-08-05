// engine/calls/CallVariationEngine.ts
// Pure variation engine — randomizes per-call static, gaps, degradation, pitch.
// No state, no singletons: computeVariation is a pure function of (sanity, signal).
//
// Rules (per P4-7 brief):
//   introStaticMs  = 200 + random*600         → [200, 800)
//   outroStaticMs  = 300 + random*900         → [300, 1200)
//   lineGapMs      = 800 + random*1200        → [800, 2000)
//   degradation    = max(0, (50 - sanity)/50) → clamped 0..1
//   pitchShiftCents = round((random - 0.5) * 400 * degradation)
//
// signalStrength is reserved for future extension (e.g. extra static at low
// signal); it currently does not alter the output but is part of the contract
// so callers pass the call's signal value from CallData.signal.

import type { CallVariation } from './VariationConfig';

/**
 * Compute a CallVariation from current player state. Pure: same (sanity,
 * signalStrength, Math.random sequence) → same result.
 *
 * @param sanity         Player sanity 0..100. Below 50 → degradation rises.
 * @param signalStrength Call signal strength 0-5 (from CallData.signal).
 *                       Lower signal = noisier channel (reserved for future use).
 * @returns CallVariation with randomized static/gaps and sanity-driven degradation.
 */
export function computeVariation(sanity: number, signalStrength: number): CallVariation {
  // Degradation: 0 at sanity ≥ 50, ramps to 1 at sanity 0. Clamped 0..1.
  const degradation = Math.max(0, Math.min(1, (50 - sanity) / 50));

  // Static + gaps: jittered via Math.random. Independent draws.
  const introStaticMs = 200 + Math.random() * 600;
  const outroStaticMs = 300 + Math.random() * 900;
  const lineGapMs = 800 + Math.random() * 1200;

  // Pitch drift: more swing at higher degradation. 0 at degradation=0.
  const pitchShiftCents = Math.round((Math.random() - 0.5) * 400 * degradation);

  // signalStrength intentionally not currently used in the output — see header.
  void signalStrength;

  return {
    introStaticMs,
    outroStaticMs,
    lineGapMs,
    degradation,
    pitchShiftCents,
  };
}
