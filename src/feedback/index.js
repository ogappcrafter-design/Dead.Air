import audio from '../audio';
import haptics from '../haptics';

/**
 * One entry point for everything the player feels.
 *
 * Sound and touch fire on the same list of moments, so binding them together
 * here means a call site cannot add one and forget the other, and the two can
 * never drift apart. Screens talk to this; nothing outside it should reach for
 * the audio or haptics modules directly.
 */

/** Fire the feedback for a named moment. Unknown names are a no-op in both. */
export function fire(name) {
  audio.play(name);
  haptics.tap(name);
}

/** The station bed, under a live call. Sound only — there is no ambient haptic. */
export const startCarrier = () => audio.startCarrier();
export const stopCarrier = () => audio.stopCarrier();

/** Boot: build players before the first screen that needs them. */
export const prime = () => audio.prime();

/** Apply persisted preferences to both channels. */
export function applySettings(settings) {
  audio.setEnabled(settings.sound);
  haptics.setEnabled(settings.haptics);
}

export default { fire, startCarrier, stopCarrier, prime, applySettings };
