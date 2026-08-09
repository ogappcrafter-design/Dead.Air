import type { AmbientProfile } from './types';

/**
 * Rain weather: moderate low-frequency patter with brown noise character.
 * Adds static and slightly degrades signal clarity.
 */
export const RAIN_WEATHER_PROFILE: AmbientProfile = {
  id: 'weather_rain',
  name: 'Rain',
  staticCharacter: 'brown',
  bandParams: {
    LIVING: { centerFreq: 400, baseGain: 0.12, detuneCents: -100 },
    LIMINAL: { centerFreq: 350, baseGain: 0.13, detuneCents: -150 },
    LOST: { centerFreq: 300, baseGain: 0.14, detuneCents: -200 },
    CLASSIFIED: { centerFreq: 450, baseGain: 0.12, detuneCents: -80 },
    '████████': { centerFreq: 380, baseGain: 0.15, detuneCents: -120 },
    WEATHER: { centerFreq: 320, baseGain: 0.14, detuneCents: -180 },
    PIRATE: { centerFreq: 420, baseGain: 0.12, detuneCents: -90 },
    HISTORICAL: { centerFreq: 360, baseGain: 0.13, detuneCents: -110 },
  },
};
