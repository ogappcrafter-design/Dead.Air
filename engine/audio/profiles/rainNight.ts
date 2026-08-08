// engine/audio/profiles/rainNight.ts
// Rain Night ambience — low brown noise, washed-out highs.

import type { AmbientProfile } from './types';

export const RAIN_NIGHT_PROFILE: AmbientProfile = {
  id: 'rain_night',
  name: 'Rain Night',
  staticCharacter: 'brown',
  bandParams: {
    LIVING: { centerFreq: 320, baseGain: 0.28, detuneCents: -50 },
    LIMINAL: { centerFreq: 180, baseGain: 0.34, detuneCents: -300 },
    LOST: { centerFreq: 90, baseGain: 0.4, detuneCents: -800 },
    CLASSIFIED: { centerFreq: 620, baseGain: 0.38, detuneCents: 200 },
    '████████': { centerFreq: 880, baseGain: 0.48, detuneCents: -1000 },
    WEATHER: { centerFreq: 160, baseGain: 0.42, detuneCents: -400 },
    PIRATE: { centerFreq: 380, baseGain: 0.32, detuneCents: 100 },
    HISTORICAL: { centerFreq: 280, baseGain: 0.3, detuneCents: -150 },
  },
};
