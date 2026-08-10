/**
 * Static asset handles.
 *
 * Metro resolves `require` of an asset at build time, so these cannot be built
 * from the manifest's filenames at runtime — the map has to be literal. The
 * test suite asserts it stays in step with the manifest.
 */
export const ASSETS = {
  tune: require('../../assets/audio/tune.wav'),
  answer: require('../../assets/audio/answer.wav'),
  hangup: require('../../assets/audio/hangup.wav'),
  key: require('../../assets/audio/key.wav'),
  reject: require('../../assets/audio/reject.wav'),
  breath: require('../../assets/audio/breath.wav'),
  tape: require('../../assets/audio/tape.wav'),
  carrier: require('../../assets/audio/carrier.wav'),
};
