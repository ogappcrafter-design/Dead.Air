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
import { WEATHER_FRAGMENTS } from './weather';
import { PIRATE_FRAGMENTS } from './pirate';
import { HISTORICAL_FRAGMENTS } from './historical';
import { RAIN_NIGHT_FRAGMENTS } from './rainNight';
import { WINTER_STATIC_FRAGMENTS } from './winterStatic';
import { DEEP_SPACE_FRAGMENTS } from './deepSpace';

export type { FragmentLibrary, BandVariation, ResponseOption } from './types';
export { BAND_VARIATIONS, getBandVariation } from './variations';
export { LIVING_FRAGMENTS } from './living';
export { LIMINAL_FRAGMENTS } from './liminal';
export { LOST_FRAGMENTS } from './lost';
export { CLASSIFIED_FRAGMENTS } from './classified';
export { REDACTED_FRAGMENTS } from './redacted';
export { WEATHER_FRAGMENTS } from './weather';
export { PIRATE_FRAGMENTS } from './pirate';
export { HISTORICAL_FRAGMENTS } from './historical';
export { RAIN_NIGHT_FRAGMENTS } from './rainNight';
export { WINTER_STATIC_FRAGMENTS } from './winterStatic';
export { DEEP_SPACE_FRAGMENTS } from './deepSpace';

export const ALL_FRAGMENTS: FragmentLibrary[] = [
  LIVING_FRAGMENTS,
  LIMINAL_FRAGMENTS,
  LOST_FRAGMENTS,
  CLASSIFIED_FRAGMENTS,
  REDACTED_FRAGMENTS,
  WEATHER_FRAGMENTS,
  PIRATE_FRAGMENTS,
  HISTORICAL_FRAGMENTS,
];

export const ATMOSPHERIC_FRAGMENTS: FragmentLibrary[] = [
  RAIN_NIGHT_FRAGMENTS,
  WINTER_STATIC_FRAGMENTS,
  DEEP_SPACE_FRAGMENTS,
];
