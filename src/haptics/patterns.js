/**
 * Which moment feels like what, as data.
 *
 * Kept free of any React Native import so the policy can be tested — and
 * checked against the sound manifest — without a native runtime. `index.js`
 * translates these into expo-haptics calls.
 */
export const IMPACT = 'impact';
export const NOTIFICATION = 'notification';
export const SELECTION = 'selection';

export const PATTERNS = Object.freeze({
  /** Decode glyph accepted. The lightest thing available. */
  key: { kind: IMPACT, style: 'light' },
  /** Decode glyph refused. */
  reject: { kind: NOTIFICATION, style: 'warning' },
  /** A line opens. */
  answer: { kind: IMPACT, style: 'medium' },
  /** A line closes. */
  hangup: { kind: IMPACT, style: 'light' },
  /** The dial moves — the one place a selection tick is the honest gesture. */
  tune: { kind: SELECTION },
  /** BREATHE. Soft, so it reads as release rather than another demand. */
  breath: { kind: IMPACT, style: 'light' },
  /** A tape reaches the archive — the one success note. */
  tape: { kind: NOTIFICATION, style: 'success' },
});

export const PATTERN_NAMES = Object.keys(PATTERNS);
