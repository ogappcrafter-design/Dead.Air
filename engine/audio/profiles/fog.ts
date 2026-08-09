import type { AmbientProfile } from './types';

/**
 * Fog weather: dense, muffled brown noise at very low frequencies.
 * Heavily muffles signal clarity — sounds feel distant and dampened.
 */
export const FOG_WEATHER_PROFILE: AmbientProfile = {
  id: 'weather_fog',
  name: 'Fog',
  staticCharacter: 'brown',
  bandParams: {
    LIVING: { centerFreq: 100, baseGain: 0.08, detuneCents: -500 },
    LIMINAL: { centerFreq: 80, baseGain: 0.09, detuneCents: -600 },
    LOST: { centerFreq: 60, baseGain: 0.1, detuneCents: -700 },
    CLASSIFIED: { centerFreq: 130, baseGain: 0.08, detuneCents: -450 },
    '████████': { centerFreq: 90, baseGain: 0.1, detuneCents: -550 },
    WEATHER: { centerFreq: 70, baseGain: 0.09, detuneCents: -650 },
    PIRATE: { centerFreq: 110, baseGain: 0.08, detuneCents: -480 },
    HISTORICAL: { centerFreq: 95, baseGain: 0.09, detuneCents: -520 },
  },
};
