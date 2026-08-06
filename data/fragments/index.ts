// data/fragments/index.ts
// Barrel export for the procedural call fragment system.
// Each band has its own fragment library; the ProceduralCallGenerator
// consumes them to assemble infinite procedural calls for the
// Infinite Signal IAP.

import type { FragmentLibrary, BandVariation, ResponseOption } from './types';
import { BAND_VARIATIONS, getBandVariation } from './variations';
import { LIVING_FRAGMENTS } from './living';
import { LIMINAL_FRAGMENTS } from './liminal';
import { LOST_FRAGMENTS } from './lost';
import { CLASSIFIED_FRAGMENTS } from './classified';
import { REDACTED_FRAGMENTS } from './redacted';

export type { FragmentLibrary, BandVariation, ResponseOption } from './types';
export { BAND_VARIATIONS, getBandVariation } from './variations';
export { LIVING_FRAGMENTS } from './living';
export { LIMINAL_FRAGMENTS } from './liminal';
export { LOST_FRAGMENTS } from './lost';
export { CLASSIFIED_FRAGMENTS } from './classified';
export { REDACTED_FRAGMENTS } from './redacted';

/**
 * All five band fragment libraries, ordered by band index 0..4.
 * The generator indexes into this array by band number.
 */
export const ALL_FRAGMENTS: FragmentLibrary[] = [
  LIVING_FRAGMENTS,
  LIMINAL_FRAGMENTS,
  LOST_FRAGMENTS,
  CLASSIFIED_FRAGMENTS,
  REDACTED_FRAGMENTS,
];
