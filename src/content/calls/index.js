import { LIVING_CALLS } from './living';
import { LIMINAL_CALLS } from './liminal';
import { LOST_CALLS } from './lost';
import { CLASSIFIED_CALLS } from './classified';
import { UNKNOWN_CALLS } from './unknown';
import { SECRET_CALLS } from './secret';

/** Every hand-authored transmission, in broadcast order. */
export const CALLS = [
  ...LIVING_CALLS,
  ...LIMINAL_CALLS,
  ...LOST_CALLS,
  ...CLASSIFIED_CALLS,
  ...UNKNOWN_CALLS,
  ...SECRET_CALLS,
];

/**
 * The authored run: everything that counts toward finishing the game.
 *
 * Secret calls are deliberately excluded, so a player who never happens to be
 * awake at the right hour still reads 100%.
 */
export const STORY_CALLS = CALLS.filter((c) => !c.secret);

export const CALL_COUNT = STORY_CALLS.length;

export const callById = (id) => CALLS.find((c) => c.id === id) || null;

export const callsInBand = (bandId) => CALLS.filter((c) => c.band === bandId);

/**
 * v1 saves stored completed calls as array indices into a single flat list.
 * This preserves that ordering so those saves can be migrated to stable ids.
 */
export const LEGACY_ID_ORDER = STORY_CALLS.map((c) => c.id);
