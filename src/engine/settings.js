/**
 * Player preferences. Separate from the save so that erasing progress does not
 * silently turn the sound back on.
 */
export const DEFAULT_SETTINGS = Object.freeze({
  sound: true,
});

export function migrateSettings(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  return {
    // Only an explicit `false` turns sound off; anything unreadable falls back
    // to the default rather than leaving a player mysteriously muted.
    sound: raw.sound === false ? false : true,
  };
}
