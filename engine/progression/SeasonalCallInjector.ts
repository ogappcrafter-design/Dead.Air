import type { FragmentLibrary, BandVariation } from '../../data/fragments/types';
import { SEASONAL_FRAGMENTS } from '../../data/fragments/seasonal';
import { BAND_VARIATIONS } from '../../data/fragments/variations';
import { ProceduralCallGenerator } from '../calls/ProceduralCallGenerator';
import type { CallData } from '../calls/types';

export type Season = 'halloween' | 'christmas' | 'newyear' | 'none';

const HALLOWEEN_WINDOW_START = new Date(0, 9, 24).getTime();
const HALLOWEEN_WINDOW_END = new Date(0, 9, 31, 23, 59, 59).getTime();
const CHRISTMAS_WINDOW_START = new Date(0, 11, 18).getTime();
const CHRISTMAS_WINDOW_END = new Date(0, 11, 26, 23, 59, 59).getTime();
const NEWYEAR_WINDOW_START = new Date(0, 11, 29).getTime();
const NEWYEAR_WINDOW_END = new Date(0, 0, 6, 23, 59, 59).getTime();

const stripYear = (d: Date): number =>
  new Date(0, d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()).getTime();

export const getActiveSeason = (date: Date = new Date()): Season => {
  const t = stripYear(date);
  if (t >= HALLOWEEN_WINDOW_START && t <= HALLOWEEN_WINDOW_END) return 'halloween';
  if (t >= CHRISTMAS_WINDOW_START && t <= CHRISTMAS_WINDOW_END) return 'christmas';
  if (t >= NEWYEAR_WINDOW_START || t <= NEWYEAR_WINDOW_END) return 'newyear';
  return 'none';
};

export const SEASONAL_CALLS_PER_EVENT = 4;

/** Starting id for seasonal calls. Disjoint from procedural ids (>= 1000) so the CallManager registry Map never sees a collision. */
export const SEASONAL_ID_BASE = 2000;

export const generateSeasonalCalls = (
  season: Season,
  count: number = SEASONAL_CALLS_PER_EVENT,
  variations: ReadonlyArray<BandVariation> = BAND_VARIATIONS,
): CallData[] => {
  if (season === 'none') return [];
  const libraries = SEASONAL_FRAGMENTS[season];
  if (!libraries || libraries.length === 0) return [];
  const generator = new ProceduralCallGenerator(libraries, variations, SEASONAL_ID_BASE);
  return libraries.flatMap((lib) => generator.generateBatch(lib.band, count));
};
