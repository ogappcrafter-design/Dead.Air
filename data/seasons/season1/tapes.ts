// data/seasons/season1/tapes.ts
// DEA-85 Season 1 tape collection. Ids tape-s1-001..005 sit outside the base
// range (001..015), the DLC range (016..035), and NG+ (ngp-001..003).

import type { TapeInfo } from '../../tapes';

export const SEASON_1_TAPE_IDS = [
  'tape-s1-001',
  'tape-s1-002',
  'tape-s1-003',
  'tape-s1-004',
  'tape-s1-005',
] as const;

/** Tapes that must be held before Act V (the finale) opens. */
export const SEASON_1_REQUIRED_TAPE_IDS: readonly string[] = [
  'tape-s1-001',
  'tape-s1-002',
  'tape-s1-003',
  'tape-s1-004',
];

export const SEASON_1_TAPES: TapeInfo[] = [
  {
    id: 'tape-s1-001',
    title: 'Position in Queue',
    description: 'She only wanted to cancel a line. The line had been waiting for her.',
    band: 'LIVING',
    duration: '4:12',
    rarity: 'common',
  },
  {
    id: 'tape-s1-002',
    title: 'Relay 23',
    description: 'The line was decommissioned in 1987. It has been taking calls ever since.',
    band: 'LIVING',
    duration: '6:03',
    rarity: 'uncommon',
  },
  {
    id: 'tape-s1-003',
    title: 'Hey, Bug',
    description: 'He has been rehearsing the same sentence since the year she was seven.',
    band: 'LOST',
    duration: '7:39',
    rarity: 'rare',
  },
  {
    id: 'tape-s1-004',
    title: 'End of Shift',
    description:
      'She clocked out at three in the morning. The network does not accept that a shift can end.',
    band: 'CLASSIFIED',
    duration: '9:87',
    rarity: 'rare',
  },
  {
    id: 'tape-s1-005',
    title: 'Hold Music',
    description: 'Forty-seven calls. One operator. No one has hung up.',
    band: '████████',
    duration: '39:00',
    rarity: 'legendary',
  },
];
