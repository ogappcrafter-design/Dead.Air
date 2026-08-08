import { Band } from '../lib/constants';

export interface BandInfo {
  id: Band;
  name: string;
  description: string;
  frequencyRange: [number, number];
  vibe: string;
  unlockRequirement: string;
}

export const BANDS: Record<Band, BandInfo> = {
  LIVING: {
    id: 'LIVING',
    name: 'LIVING',
    description: 'Normal broadcasts. Safe. Boring.',
    frequencyRange: [87.5, 92.0],
    vibe: 'static, distant music, talk radio',
    unlockRequirement: 'None — starting band',
  },
  LIMINAL: {
    id: 'LIMINAL',
    name: 'LIMINAL',
    description: 'Between stations. Something listens.',
    frequencyRange: [92.0, 96.5],
    vibe: 'whispers, reversed audio, time distortion',
    unlockRequirement: 'Survive 3 night shifts',
  },
  LOST: {
    id: 'LOST',
    name: 'LOST',
    description: "Frequencies that shouldn't exist.",
    frequencyRange: [96.5, 101.0],
    vibe: 'children singing, dial-up tones, impossible distances',
    unlockRequirement: 'Collect 5 tapes',
  },
  CLASSIFIED: {
    id: 'CLASSIFIED',
    name: 'CLASSIFIED',
    description: "Government stations. They know you're listening.",
    frequencyRange: [101.0, 105.5],
    vibe: 'numbers stations, emergency alerts, distorted orders',
    unlockRequirement: 'Complete "The Signal" call',
  },
  '████████': {
    id: '████████',
    name: '████████',
    description: '[REDACTED]',
    frequencyRange: [105.5, 108.0],
    vibe: '[DATA EXPUNGED]',
    unlockRequirement: 'Find all 15 tapes',
  },
  WEATHER: {
    id: 'WEATHER',
    name: 'WEATHER',
    description: 'Atmospheric broadcasts. The storm is inside.',
    frequencyRange: [160.0, 164.0],
    vibe: 'thunder, static breaks, emergency klaxons, barometric dread',
    unlockRequirement: 'Survive 7 night shifts',
  },
  PIRATE: {
    id: 'PIRATE',
    name: 'PIRATE',
    description: 'Rogue frequencies. No license. No rules.',
    frequencyRange: [164.0, 168.0],
    vibe: 'numbers stations, cipher bursts, rebel comms, analog rebellion',
    unlockRequirement: 'Collect 10 tapes',
  },
  HISTORICAL: {
    id: 'HISTORICAL',
    name: 'HISTORICAL',
    description: 'Echoes from dead decades. They are still broadcasting.',
    frequencyRange: [168.0, 172.0],
    vibe: 'tube warmth, warble, period-accurate dread across the 20th century',
    unlockRequirement: 'Reach 100% static on any shift',
  },
};

export const getBandByFrequency = (freq: number): BandInfo | null => {
  return (
    Object.values(BANDS).find(
      (band) => freq >= band.frequencyRange[0] && freq <= band.frequencyRange[1],
    ) ?? null
  );
};
