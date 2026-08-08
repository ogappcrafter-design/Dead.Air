// engine/audio/profiles/deepSpace.ts
// Deep Space ambience — deep pink drone, vast and empty.

import type { AmbientProfile } from './types';

export const DEEP_SPACE_PROFILE: AmbientProfile = {
  id: 'deep_space',
  name: 'Deep Space',
  staticCharacter: 'pink',
  bandParams: {
    LIVING: { centerFreq: 160, baseGain: 0.2, detuneCents: -200 },
    LIMINAL: { centerFreq: 110, baseGain: 0.26, detuneCents: -600 },
    LOST: { centerFreq: 60, baseGain: 0.35, detuneCents: -1200 },
    CLASSIFIED: { centerFreq: 480, baseGain: 0.3, detuneCents: 150 },
    '████████': { centerFreq: 720, baseGain: 0.42, detuneCents: -500 },
    WEATHER: { centerFreq: 130, baseGain: 0.32, detuneCents: -350 },
    PIRATE: { centerFreq: 280, baseGain: 0.28, detuneCents: -50 },
    HISTORICAL: { centerFreq: 200, baseGain: 0.24, detuneCents: -250 },
  },
};
