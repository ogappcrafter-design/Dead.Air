// engine/audio/profiles/trainStation.ts
// Last Train ambience — low mechanical drone, metallic highs, platform echo.

import type { AmbientProfile } from './types';

export const TRAIN_STATION_PROFILE: AmbientProfile = {
  id: 'train_station',
  name: 'Last Train',
  staticCharacter: 'brown',
  bandParams: {
    LIVING: { centerFreq: 420, baseGain: 0.3, detuneCents: -80 },
    LIMINAL: { centerFreq: 220, baseGain: 0.36, detuneCents: -400 },
    LOST: { centerFreq: 120, baseGain: 0.42, detuneCents: -900 },
    CLASSIFIED: { centerFreq: 760, baseGain: 0.4, detuneCents: 300 },
    '████████': { centerFreq: 980, baseGain: 0.5, detuneCents: -1200 },
    WEATHER: { centerFreq: 200, baseGain: 0.44, detuneCents: -500 },
    PIRATE: { centerFreq: 460, baseGain: 0.34, detuneCents: 150 },
    HISTORICAL: { centerFreq: 340, baseGain: 0.32, detuneCents: -250 },
  },
};
