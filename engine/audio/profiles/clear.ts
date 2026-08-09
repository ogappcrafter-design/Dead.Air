import type { AmbientProfile } from './types';

/**
 * Clear weather: minimal ambient, barely audible.
 * High airy frequencies suggesting open, calm atmosphere.
 */
export const CLEAR_WEATHER_PROFILE: AmbientProfile = {
  id: 'weather_clear',
  name: 'Clear',
  staticCharacter: 'white',
  bandParams: {
    LIVING: { centerFreq: 3000, baseGain: 0.02, detuneCents: 0 },
    LIMINAL: { centerFreq: 3500, baseGain: 0.02, detuneCents: 50 },
    LOST: { centerFreq: 2800, baseGain: 0.03, detuneCents: -50 },
    CLASSIFIED: { centerFreq: 3200, baseGain: 0.02, detuneCents: 100 },
    '████████': { centerFreq: 3600, baseGain: 0.03, detuneCents: -100 },
    WEATHER: { centerFreq: 2900, baseGain: 0.02, detuneCents: 0 },
    PIRATE: { centerFreq: 3300, baseGain: 0.02, detuneCents: 30 },
    HISTORICAL: { centerFreq: 3100, baseGain: 0.02, detuneCents: -30 },
  },
};
