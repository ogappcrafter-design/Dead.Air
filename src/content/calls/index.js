import { LIVING_CALLS } from './living';
import { LIMINAL_CALLS } from './liminal';
import { LOST_CALLS } from './lost';
import { CLASSIFIED_CALLS } from './classified';
import { UNKNOWN_CALLS } from './unknown';

/** Every hand-authored transmission, in broadcast order. */
export const CALLS = [
  ...LIVING_CALLS,
  ...LIMINAL_CALLS,
  ...LOST_CALLS,
  ...CLASSIFIED_CALLS,
  ...UNKNOWN_CALLS,
];

export const CALL_COUNT = CALLS.length;

export const callById = (id) => CALLS.find((c) => c.id === id) || null;

export const callsInBand = (bandId) => CALLS.filter((c) => c.band === bandId);

/**
 * v1 saves stored completed calls as array indices into a single flat list.
 * This preserves that ordering so those saves can be migrated to stable ids.
 */
export const LEGACY_ID_ORDER = CALLS.map((c) => c.id);
