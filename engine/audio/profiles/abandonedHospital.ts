// engine/audio/profiles/abandonedHospital.ts
// Mercy General ambience — hollow tube hum, distant drip rhythm, corridor reverb.

import type { AmbientProfile } from './types';

export const ABANDONED_HOSPITAL_PROFILE: AmbientProfile = {
  id: 'abandoned_hospital',
  name: 'Mercy General',
  staticCharacter: 'pink',
  bandParams: {
    LIVING: { centerFreq: 300, baseGain: 0.26, detuneCents: -120 },
    LIMINAL: { centerFreq: 160, baseGain: 0.34, detuneCents: -350 },
    LOST: { centerFreq: 80, baseGain: 0.4, detuneCents: -700 },
    CLASSIFIED: { centerFreq: 540, baseGain: 0.38, detuneCents: 250 },
    '████████': { centerFreq: 820, baseGain: 0.48, detuneCents: -1100 },
    WEATHER: { centerFreq: 140, baseGain: 0.4, detuneCents: -300 },
    PIRATE: { centerFreq: 360, baseGain: 0.32, detuneCents: 120 },
    HISTORICAL: { centerFreq: 260, baseGain: 0.3, detuneCents: -180 },
  },
};
