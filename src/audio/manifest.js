/**
 * The sound set, as data.
 *
 * Kept separate from the asset requires so the mix can be reasoned about — and
 * tested — without loading a single byte of audio.
 *
 * The palette is deliberately small. Sound marks the moments the game already
 * treats as significant: tuning, a line opening and closing, the two decode
 * responses, holding your nerve, and recovering a tape. Ordinary buttons, tab
 * switches and scrolling stay silent; a station that chirps at every touch
 * stops sounding like a station.
 */
export const SOUNDS = Object.freeze({
  /** Dial moved to another band. */
  tune: { file: 'tune.wav', volume: 0.5 },
  /** A line opens. Relay, then carrier. */
  answer: { file: 'answer.wav', volume: 0.6 },
  /** A line closes. */
  hangup: { file: 'hangup.wav', volume: 0.5 },
  /** Decode glyph accepted. */
  key: { file: 'key.wav', volume: 0.45 },
  /** Decode glyph rejected. */
  reject: { file: 'reject.wav', volume: 0.5 },
  /** BREATHE, in STAY_CALM. */
  breath: { file: 'breath.wav', volume: 0.4 },
  /** A tape reaches the archive. The one moment allowed to sound like a reward. */
  tape: { file: 'tape.wav', volume: 0.7 },
  /** Station bed. Loops under a live call only, well beneath everything else. */
  carrier: { file: 'carrier.wav', volume: 0.28, loop: true },
});

export const SOUND_NAMES = Object.keys(SOUNDS);

/** The looping bed, resolved by role rather than hard-coded at call sites. */
export const CARRIER = 'carrier';

/**
 * Audio session policy.
 *
 * Both choices here are deference: the game honours the iOS silent switch, and
 * it mixes rather than interrupting, so starting a call does not stop whatever
 * the player already had on.
 */
export const AUDIO_MODE = Object.freeze({
  playsInSilentMode: false,
  shouldPlayInBackground: false,
  interruptionMode: 'mixWithOthers',
});
