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

// DLC Tape Packs — premium content unlocked via IAP
export const DLC_TAPES: TapeInfo[] = [
  // Holiday Pack
  {
    id: 'tape-016',
    title: 'Christmas Eve Broadcast',
    description: 'The midnight show that only plays for those who believe.',
    band: 'LIVING',
    duration: '5:21',
    rarity: 'rare',
  },
  {
    id: 'tape-017',
    title: "New Year's Countdown",
    description: 'Ten. Nine. Eight. The static grows louder with each number.',
    band: 'LIVING',
    duration: '3:45',
    rarity: 'rare',
  },
  {
    id: 'tape-018',
    title: 'Halloween Séance',
    description: 'The veil thins. Something comes through.',
    band: 'LIVING',
    duration: '7:13',
    rarity: 'legendary',
  },
  {
    id: 'tape-019',
    title: "Valentine's Confession",
    description: 'A love letter read on air. The sender never signed off.',
    band: 'LIVING',
    duration: '4:08',
    rarity: 'rare',
  },
  {
    id: 'tape-020',
    title: 'Thanksgiving Family Hour',
    description: 'Gather round. Everyone is here. Even those who passed.',
    band: 'LIVING',
    duration: '6:33',
    rarity: 'rare',
  },
  // Numbers Station Pack
  {
    id: 'tape-021',
    title: 'Station X-7',
    description: "The frequency that shouldn't exist. It broadcasts anyway.",
    band: 'CLASSIFIED',
    duration: '8:44',
    rarity: 'legendary',
  },
  {
    id: 'tape-022',
    title: 'The Lincolnshire Poacher',
    description: 'A folk tune, then numbers. Always the same numbers.',
    band: 'CLASSIFIED',
    duration: '5:12',
    rarity: 'rare',
  },
  {
    id: 'tape-023',
    title: 'Yosemite Sam',
    description: 'A cartoon plays. Then the count begins.',
    band: 'CLASSIFIED',
    duration: '3:27',
    rarity: 'rare',
  },
  {
    id: 'tape-024',
    title: 'Atención',
    description: 'Atención. Atención. The Spanish voice has a message for you.',
    band: 'CLASSIFIED',
    duration: '4:55',
    rarity: 'rare',
  },
  {
    id: 'tape-025',
    title: 'Magnetic Disk Defect',
    description: 'The recording degrades. The message becomes clearer.',
    band: 'CLASSIFIED',
    duration: '6:18',
    rarity: 'legendary',
  },
  // Voices From Beyond Pack
  {
    id: 'tape-026',
    title: 'The Last Séance',
    description: 'The table rattles. The spirit speaks through the radio.',
    band: 'LOST',
    duration: '7:44',
    rarity: 'legendary',
  },
  {
    id: 'tape-027',
    title: 'Voices in the Static',
    description: "They've been trying to reach you. The static is their voice.",
    band: 'LOST',
    duration: '5:33',
    rarity: 'rare',
  },
  {
    id: 'tape-028',
    title: "The Medium's Confession",
    description: "I made most of it up. The rest was real. You'll know which.",
    band: 'LOST',
    duration: '4:21',
    rarity: 'rare',
  },
  {
    id: 'tape-029',
    title: 'Crossing Over',
    description: 'The bridge between stations. Something walks across it.',
    band: 'LOST',
    duration: '6:09',
    rarity: 'rare',
  },
  {
    id: 'tape-030',
    title: 'The Other Side',
    description: "You've been listening from the wrong side. They've been listening back.",
    band: 'LOST',
    duration: '9:11',
    rarity: 'legendary',
  },
];

// Combined array for lookups across base + DLC
export const ALL_TAPES: TapeInfo[] = [...TAPES, ...DLC_TAPES];

export const DLC_TAPE_NAMES: string[] = DLC_TAPES.map((t) => {
  const num = parseInt(t.id.replace('tape-', ''), 10);
  return `Tape #${num} — ${t.title}`;
});

export const getTapeById = (id: string): TapeInfo | undefined => {
  return ALL_TAPES.find((tape) => tape.id === id);
};

export const getTapesByBand = (band: string): TapeInfo[] => {
  return ALL_TAPES.filter((tape) => tape.band === band);
};
