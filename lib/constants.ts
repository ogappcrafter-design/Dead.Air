// lib/constants.ts
export const SAVE_KEY = 'dead_air_save_v1';
export const PURCHASES_KEY = 'dead_air_purchases_v1';
export const SKINS_KEY = 'dead_air_skins_v1';

export const BANDS = [
  'LIVING',
  'LIMINAL',
  'LOST',
  'CLASSIFIED',
  '████████',
  'WEATHER',
  'PIRATE',
  'HISTORICAL',
] as const;
export type Band = (typeof BANDS)[number];

export const CALL_TYPES = [
  'JUST_LISTEN',
  'DEAD_AIR',
  'RIGHT_ANSWER',
  'SIGNAL_DECODE',
  'STAY_CALM',
  'RECORDING',
  'MULTI_CALLER',
  'TIMING',
  'PUZZLE',
  'CONVERSATION',
] as const;
export type CallType = (typeof CALL_TYPES)[number];

/**
 * Friend codes are local-only handles (DEA-33). The format is shared with the
 * community preset API so a shared custom frequency can carry the code of the
 * player who authored it.
 */
export const FRIEND_CODE_PREFIX = 'DA';
export const FRIEND_CODE_LENGTH = 5;
/** Excludes visually ambiguous characters (I, O, 0, 1). */
export const FRIEND_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const FRIEND_CODE_PATTERN = /^DA-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;

export const ENTITLEMENT_PRODUCT_IDS = {
  BASE: 'com.deadair.base',
  INFINITE_SIGNAL: 'com.deadair.infinite_signal',
} as const;

export const MAX_SANITY = 100;
export const MAX_STATIC = 100;
