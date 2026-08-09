import type { AmbientProfile } from './types';

/**
 * Wind weather: low rushing pink noise, natural and persistent.
 * Adds mild static and slightly degrades signal clarity.
 */
export const WIND_WEATHER_PROFILE: AmbientProfile = {
  id: 'weather_wind',
  name: 'Wind',
  staticCharacter: 'pink',
  bandParams: {
    LIVING: { centerFreq: 180, baseGain: 0.14, detuneCents: -300 },
    LIMINAL: { centerFreq: 150, baseGain: 0.15, detuneCents: -400 },
    LOST: { centerFreq: 120, baseGain: 0.16, detuneCents: -500 },
    CLASSIFIED: { centerFreq: 220, baseGain: 0.14, detuneCents: -250 },
    '████████': { centerFreq: 160, baseGain: 0.17, detuneCents: -350 },
    WEATHER: { centerFreq: 100, baseGain: 0.16, detuneCents: -450 },
    PIRATE: { centerFreq: 200, baseGain: 0.14, detuneCents: -280 },
    HISTORICAL: { centerFreq: 170, baseGain: 0.15, detuneCents: -320 },
  },
};
