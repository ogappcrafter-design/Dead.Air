import type { AmbientProfile } from './types';

/**
 * Snow weather: soft crystalline hiss with white noise character.
 * Adds gentle static and slightly muffles signal.
 */
export const SNOW_WEATHER_PROFILE: AmbientProfile = {
  id: 'weather_snow',
  name: 'Snow',
  staticCharacter: 'white',
  bandParams: {
    LIVING: { centerFreq: 800, baseGain: 0.09, detuneCents: 200 },
    LIMINAL: { centerFreq: 900, baseGain: 0.1, detuneCents: 150 },
    LOST: { centerFreq: 700, baseGain: 0.11, detuneCents: 250 },
    CLASSIFIED: { centerFreq: 1000, baseGain: 0.09, detuneCents: 100 },
    '████████': { centerFreq: 1100, baseGain: 0.12, detuneCents: 300 },
    WEATHER: { centerFreq: 750, baseGain: 0.1, detuneCents: 200 },
    PIRATE: { centerFreq: 850, baseGain: 0.09, detuneCents: 180 },
    HISTORICAL: { centerFreq: 950, baseGain: 0.1, detuneCents: 220 },
  },
};
