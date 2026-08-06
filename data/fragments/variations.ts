// data/fragments/variations.ts
// Per-band variation rules for procedural call generation.
// Ranges are calibrated to match the sacred 18 calls' per-band economy
// so procedural calls feel consistent with hand-crafted ones.
//
// Source calibration (from data/calls.js):
//   LIVING     (band 0): staticReward 25-45,  sanityDelta 0..-10,  signal 3-5
//   LIMINAL    (band 1): staticReward 55-75,  sanityDelta -12..-15, signal 2-4
//   LOST       (band 2): staticReward 90-150, sanityDelta +10..+25, signal 1-4
//   CLASSIFIED (band 3): staticReward 100-130, sanityDelta -8..-20, signal 2-5
//   ████████  (band 4): staticReward 280-500, sanityDelta -30..+30, signal 0-3

import type { BandVariation } from './types';

export const BAND_VARIATIONS: BandVariation[] = [
  {
    band: 0,
    bandName: 'LIVING',
    staticRewardRange: [25, 45],
    sanityDeltaRange: [-10, 0],
    signalRange: [3, 5],
  },
  {
    band: 1,
    bandName: 'LIMINAL',
    staticRewardRange: [55, 75],
    sanityDeltaRange: [-15, -12],
    signalRange: [2, 4],
  },
  {
    band: 2,
    bandName: 'LOST',
    staticRewardRange: [90, 150],
    sanityDeltaRange: [10, 25],
    signalRange: [1, 4],
  },
  {
    band: 3,
    bandName: 'CLASSIFIED',
    staticRewardRange: [100, 130],
    sanityDeltaRange: [-20, -8],
    signalRange: [2, 5],
  },
  {
    band: 4,
    bandName: '████████',
    staticRewardRange: [280, 500],
    sanityDeltaRange: [-30, 30],
    signalRange: [0, 3],
  },
];

/**
 * Get the BandVariation for a band index. Throws if the index is out of
 * range — the generator validates inputs at construction so this is a
 * programming-error path, not a user-input path.
 */
export const getBandVariation = (band: number): BandVariation => {
  const variation = BAND_VARIATIONS[band];
  if (variation === undefined) {
    throw new Error(`No BandVariation for band index ${band}`);
  }
  return variation;
};
