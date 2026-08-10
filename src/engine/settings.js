/**
 * Player preferences. Separate from the save so that erasing progress does not
 * silently turn the sound back on.
 */
export const DEFAULT_SETTINGS = Object.freeze({
  sound: true,
  haptics: true,
});

// Only an explicit `false` switches a channel off; anything unreadable falls
// back to on rather than leaving a player mysteriously without feedback.
const onUnless = (value) => value !== false;

export function migrateSettings(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  return {
    sound: onUnless(raw.sound),
    haptics: onUnless(raw.haptics),
  };
}
