export interface TapeInfo {
  id: string;
  title: string;
  description: string;
  band: string;
  duration: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}

export const TAPES: TapeInfo[] = [
  {
    id: 'tape-001',
    title: 'First Night',
    description: 'Your first shift. Everything seems normal.',
    band: 'LIVING',
    duration: '4:32',
    rarity: 'common',
  },
  {
    id: 'tape-002',
    title: 'Static Lullaby',
    description: 'A child hums through the interference.',
    band: 'LIMINAL',
    duration: '3:18',
    rarity: 'common',
  },
  {
    id: 'tape-003',
    title: 'The Last Broadcast',
    description: "They signed off. They didn't come back.",
    band: 'LIVING',
    duration: '6:45',
    rarity: 'uncommon',
  },
  {
    id: 'tape-004',
    title: 'Numbers',
    description: 'Seven. Seven. Seven. Seven.',
    band: 'CLASSIFIED',
    duration: '2:14',
    rarity: 'rare',
  },
  {
    id: 'tape-005',
    title: 'Dead Air',
    description: 'The silence between stations.',
    band: 'LOST',
    duration: '5:00',
    rarity: 'uncommon',
  },
  {
    id: 'tape-006',
    title: 'Emergency',
    description: 'This is not a test.',
    band: 'CLASSIFIED',
    duration: '1:58',
    rarity: 'rare',
  },
  {
    id: 'tape-007',
    title: 'Lullaby',
    description: 'Go to sleep. Go to sleep. Go to sleep.',
    band: 'LIMINAL',
    duration: '4:12',
    rarity: 'uncommon',
  },
  {
    id: 'tape-008',
    title: 'The Signal',
    description: 'You found it. Now it found you.',
    band: '████████',
    duration: '13:33',
    rarity: 'legendary',
  },
  {
    id: 'tape-009',
    title: 'Frequencies',
    description: 'Every number has a name.',
    band: 'CLASSIFIED',
    duration: '3:44',
    rarity: 'rare',
  },
  {
    id: 'tape-010',
    title: 'Whispers',
    description: "They're talking about you.",
    band: 'LIMINAL',
    duration: '2:56',
    rarity: 'uncommon',
  },
  {
    id: 'tape-011',
    title: 'The Void',
    description: 'Listen too long and it listens back.',
    band: 'LOST',
    duration: '7:21',
    rarity: 'rare',
  },
  {
    id: 'tape-012',
    title: 'Broadcast',
    description: 'One final transmission.',
    band: 'LIVING',
    duration: '5:33',
    rarity: 'common',
  },
  {
    id: 'tape-013',
    title: 'Static',
    description: 'White noise. Pure. Perfect.',
    band: 'LOST',
    duration: '4:00',
    rarity: 'uncommon',
  },
  {
    id: 'tape-014',
    title: 'Protocol',
    description: 'Follow instructions. Do not deviate.',
    band: 'CLASSIFIED',
    duration: '3:12',
    rarity: 'rare',
  },
  {
    id: 'tape-015',
    title: '███████',
    description: '[CORRUPTED]',
    band: '████████',
    duration: '9:99',
    rarity: 'legendary',
  },
];

export const getTapeById = (id: string): TapeInfo | undefined => {
  return TAPES.find((tape) => tape.id === id);
};

export const getTapesByBand = (band: string): TapeInfo[] => {
  return TAPES.filter((tape) => tape.band === band);
};
