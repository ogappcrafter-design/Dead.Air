import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { ASSETS } from './assets';
import { AUDIO_MODE, CARRIER, SOUNDS } from './manifest';

/**
 * The station's audio bus.
 *
 * A module singleton rather than a context: sound is fire-and-forget, and
 * routing it through React state would re-render screens for something the
 * player only hears. Call sites are one-liners — `audio.play('key')`.
 *
 * Sound is a garnish, never a dependency. Every entry point is wrapped, so a
 * device that cannot load or play audio produces a silent game rather than a
 * broken one; nothing here is allowed to throw into a render path.
 */

const players = new Map();
let enabled = true;
let ready = false;
let failed = false;

const warn = (what, err) => {
  if (__DEV__) console.warn(`[audio] ${what}:`, err?.message || err);
};

function playerFor(name) {
  if (failed) return null;
  const existing = players.get(name);
  if (existing) return existing;

  const spec = SOUNDS[name];
  const asset = ASSETS[name];
  if (!spec || !asset) {
    warn('unknown sound', name);
    return null;
  }

  try {
    const player = createAudioPlayer(asset);
    player.volume = spec.volume;
    if (spec.loop) player.loop = true;
    players.set(name, player);
    return player;
  } catch (err) {
    warn(`could not create player for ${name}`, err);
    return null;
  }
}

/**
 * Configure the session and build every player up front.
 *
 * Done at boot, behind the loading screen: creating a player on first use puts
 * a decode delay exactly where the sound needs to be immediate.
 */
export async function prime() {
  if (ready || failed) return;
  try {
    await setAudioModeAsync(AUDIO_MODE);
  } catch (err) {
    // A session we cannot configure is still usually a session we can play on.
    warn('could not set audio mode', err);
  }
  try {
    Object.keys(SOUNDS).forEach(playerFor);
    ready = true;
  } catch (err) {
    failed = true;
    warn('audio unavailable, continuing silently', err);
  }
}

/** Fire a one-shot. Unknown names and dead players are no-ops. */
export function play(name) {
  if (!enabled || failed) return;
  const player = playerFor(name);
  if (!player) return;
  try {
    // Rewind first: a finished one-shot sits at its end, and a retriggered one
    // (rapid decode taps) has to restart rather than continue.
    player.seekTo(0)?.catch?.(() => {});
    player.play();
  } catch (err) {
    warn(`could not play ${name}`, err);
  }
}

/** Bring the station bed up under a live call. */
export function startCarrier() {
  if (!enabled || failed) return;
  const player = playerFor(CARRIER);
  if (!player) return;
  try {
    if (!player.playing) player.play();
  } catch (err) {
    warn('could not start carrier', err);
  }
}

/** Take the bed back down. Safe to call when it was never started. */
export function stopCarrier() {
  const player = players.get(CARRIER);
  if (!player) return;
  try {
    player.pause();
    player.seekTo(0)?.catch?.(() => {});
  } catch (err) {
    warn('could not stop carrier', err);
  }
}

/**
 * Turn the station's sound on or off.
 *
 * Switching off stops the bed immediately — a loop that kept running silently
 * would come back mid-cycle when sound was re-enabled.
 */
export function setEnabled(next) {
  enabled = !!next;
  if (!enabled) stopCarrier();
}

export const isEnabled = () => enabled;

/** Release every player. Only needed if the app tears the audio stack down. */
export function release() {
  players.forEach((player) => {
    try {
      player.remove();
    } catch (err) {
      warn('could not release player', err);
    }
  });
  players.clear();
  ready = false;
}

export default { prime, play, startCarrier, stopCarrier, setEnabled, isEnabled, release };
