import type { AmbientProfile } from './types';

/**
 * Room tone: persistent low-level ambient that plays whenever the radio is on,
 * beneath the band-specific ambient. Subtle electrical hum + low room resonance.
 */
export const ROOM_TONE_PROFILE: AmbientProfile = {
  id: 'room_tone',
  name: 'Room Tone',
  staticCharacter: 'brown',
  bandParams: {
    LIVING: { centerFreq: 65, baseGain: 0.04, detuneCents: 0 },
    LIMINAL: { centerFreq: 70, baseGain: 0.05, detuneCents: -10 },
    LOST: { centerFreq: 60, baseGain: 0.06, detuneCents: -20 },
    CLASSIFIED: { centerFreq: 72, baseGain: 0.04, detuneCents: 10 },
    '████████': { centerFreq: 68, baseGain: 0.05, detuneCents: -15 },
    WEATHER: { centerFreq: 62, baseGain: 0.04, detuneCents: 5 },
    PIRATE: { centerFreq: 75, baseGain: 0.05, detuneCents: -5 },
    HISTORICAL: { centerFreq: 66, baseGain: 0.04, detuneCents: 0 },
  },
};
