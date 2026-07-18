// lib/constants.ts
export const SAVE_KEY = 'dead_air_save_v1';
export const PURCHASES_KEY = 'dead_air_purchases_v1';

export const BANDS = ['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED', '████████'] as const;
export type Band = (typeof BANDS)[number];

export const CALL_TYPES = [
  'JUST_LISTEN',
  'DEAD_AIR',
  'RIGHT_ANSWER',
  'SIGNAL_DECODE',
  'STAY_CALM',
] as const;
export type CallType = (typeof CALL_TYPES)[number];

export const MAX_SANITY = 100;
export const MAX_STATIC = 100;
