// engine/audio/profiles/winterStatic.ts
// Winter Static ambience — brittle white noise, crystal-clear and cold.

import type { AmbientProfile } from './types';

export const WINTER_STATIC_PROFILE: AmbientProfile = {
  id: 'winter_static',
  name: 'Winter Static',
  staticCharacter: 'white',
  bandParams: {
    LIVING: { centerFreq: 680, baseGain: 0.22, detuneCents: 100 },
    LIMINAL: { centerFreq: 420, baseGain: 0.28, detuneCents: -100 },
    LOST: { centerFreq: 240, baseGain: 0.32, detuneCents: -500 },
    CLASSIFIED: { centerFreq: 1000, baseGain: 0.36, detuneCents: 500 },
    '████████': { centerFreq: 1400, baseGain: 0.44, detuneCents: -900 },
    WEATHER: { centerFreq: 300, baseGain: 0.38, detuneCents: -200 },
    PIRATE: { centerFreq: 520, baseGain: 0.3, detuneCents: 300 },
    HISTORICAL: { centerFreq: 440, baseGain: 0.28, detuneCents: 0 },
  },
};
