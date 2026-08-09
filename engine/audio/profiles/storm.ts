import type { AmbientProfile } from './types';

/**
 * Storm weather: heavy deep rumble, high intensity.
 * Significantly increases static and degrades signal clarity.
 */
export const STORM_WEATHER_PROFILE: AmbientProfile = {
  id: 'weather_storm',
  name: 'Storm',
  staticCharacter: 'brown',
  bandParams: {
    LIVING: { centerFreq: 200, baseGain: 0.2, detuneCents: -200 },
    LIMINAL: { centerFreq: 160, baseGain: 0.22, detuneCents: -300 },
    LOST: { centerFreq: 120, baseGain: 0.25, detuneCents: -400 },
    CLASSIFIED: { centerFreq: 250, baseGain: 0.2, detuneCents: -150 },
    '████████': { centerFreq: 180, baseGain: 0.24, detuneCents: -250 },
    WEATHER: { centerFreq: 140, baseGain: 0.25, detuneCents: -350 },
    PIRATE: { centerFreq: 220, baseGain: 0.2, detuneCents: -180 },
    HISTORICAL: { centerFreq: 190, baseGain: 0.22, detuneCents: -220 },
  },
};
