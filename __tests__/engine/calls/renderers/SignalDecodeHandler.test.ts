// __tests__/engine/calls/renderers/SignalDecodeHandler.test.ts
// Unit tests for computeSignalDecodeOutcome (SIGNAL_DECODE renderer).

import {
  computeSignalDecodeOutcome,
  SIGNAL_DECODE_RENDERER,
} from '@/engine/calls/renderers/SignalDecodeHandler';
import type { CallData } from '@/engine/calls/types';

// --- Test fixtures ---

/**
 * Canonical SIGNAL_DECODE call — id 13 (ARIA-9).
 * Mirrors data/calls.js exactly. data/calls.js is SACRED; we build a local
 * fixture matching its shape so tests stay independent of the data import.
 */
const ARIA9_CALL: CallData = {
  id: 13,
  band: 3,
  callerId: 'SYSTEM·ARIA-9',
  callerName: 'ARIA-9',
  signal: 4,
  type: 'SIGNAL_DECODE',
  staticReward: 120,
  sanityDelta: -8,
  tape: true,
  tapeName: 'Tape #11 — ARIA-9 Transcript',
  intro:
    'An artificial intelligence identifies itself calmly. Professionally. It begins transmitting a code sequence.',
  sequence: [2, 2, 1, 0, 2],
  decodedMessage: 'I AM ASKING FOR HELP',
};

const makeCall = (overrides: Partial<CallData> = {}): CallData => ({
  ...ARIA9_CALL,
  ...overrides,
});

// --- Tests ---

describe('computeSignalDecodeOutcome — success (decoded === true)', () => {
  it('returns full sanityDelta for ARIA-9 success', () => {
    const outcome = computeSignalDecodeOutcome(ARIA9_CALL, true);
    expect(outcome.sanityDelta).toBe(-8);
  });

  it('returns full staticReward for ARIA-9 success', () => {
    const outcome = computeSignalDecodeOutcome(ARIA9_CALL, true);
    expect(outcome.staticReward).toBe(120);
  });

  it('returns staticMultiplier 1 for success', () => {
    const outcome = computeSignalDecodeOutcome(ARIA9_CALL, true);
    expect(outcome.staticMultiplier).toBe(1);
  });

  it('returns tapeUnlocked when call.tape is true on success', () => {
    const outcome = computeSignalDecodeOutcome(ARIA9_CALL, true);
    expect(outcome.tapeUnlocked).toBe('Tape #11 — ARIA-9 Transcript');
  });

  it('returns undefined tapeUnlocked when call.tape is missing/true but no name', () => {
    // call.tape true but tapeName undefined — contract returns undefined name.
    const call = makeCall({ tape: true, tapeName: undefined });
    const outcome = computeSignalDecodeOutcome(call, true);
    expect(outcome.tapeUnlocked).toBeUndefined();
  });

  it('returns undefined tapeUnlocked when call.tape is false on success', () => {
    const call = makeCall({ tape: false, tapeName: 'ignored' });
    const outcome = computeSignalDecodeOutcome(call, true);
    expect(outcome.tapeUnlocked).toBeUndefined();
  });

  it('returns undefined bandUnlocked on success', () => {
    const outcome = computeSignalDecodeOutcome(ARIA9_CALL, true);
    expect(outcome.bandUnlocked).toBeUndefined();
  });
});

describe('computeSignalDecodeOutcome — failure (decoded === false)', () => {
  it('returns half sanityDelta rounded toward zero for ARIA-9 failure', () => {
    const outcome = computeSignalDecodeOutcome(ARIA9_CALL, false);
    // -8 / 2 = -4 (Math.trunc rounds toward zero)
    expect(outcome.sanityDelta).toBe(-4);
  });

  it('returns staticReward 0 on failure', () => {
    const outcome = computeSignalDecodeOutcome(ARIA9_CALL, false);
    expect(outcome.staticReward).toBe(0);
  });

  it('returns staticMultiplier 0 on failure', () => {
    const outcome = computeSignalDecodeOutcome(ARIA9_CALL, false);
    expect(outcome.staticMultiplier).toBe(0);
  });

  it('returns undefined tapeUnlocked on failure even when call.tape is true', () => {
    const outcome = computeSignalDecodeOutcome(ARIA9_CALL, false);
    expect(outcome.tapeUnlocked).toBeUndefined();
  });

  it('returns undefined bandUnlocked on failure', () => {
    const outcome = computeSignalDecodeOutcome(ARIA9_CALL, false);
    expect(outcome.bandUnlocked).toBeUndefined();
  });

  it('halves positive sanityDelta toward zero on failure', () => {
    // Odd positive stays odd after trunc: 7 / 2 = 3 (toward zero).
    const call = makeCall({ sanityDelta: 7 });
    const outcome = computeSignalDecodeOutcome(call, false);
    expect(outcome.sanityDelta).toBe(3);
  });

  it('halves odd negative sanityDelta toward zero on failure (-7 → -3, not -4)', () => {
    const call = makeCall({ sanityDelta: -7 });
    const outcome = computeSignalDecodeOutcome(call, false);
    expect(outcome.sanityDelta).toBe(-3);
  });
});

describe('computeSignalDecodeOutcome — edge cases', () => {
  it('returns sanityDelta 0 when call has no sanityDelta (undefined) on success', () => {
    const call = makeCall({ sanityDelta: undefined });
    const outcome = computeSignalDecodeOutcome(call, true);
    expect(outcome.sanityDelta).toBe(0);
  });

  it('returns sanityDelta 0 when call has no sanityDelta (undefined) on failure', () => {
    const call = makeCall({ sanityDelta: undefined });
    const outcome = computeSignalDecodeOutcome(call, false);
    expect(outcome.sanityDelta).toBe(0);
  });

  it('handles zero sanityDelta cleanly on both paths', () => {
    const call = makeCall({ sanityDelta: 0 });
    expect(computeSignalDecodeOutcome(call, true).sanityDelta).toBe(0);
    expect(computeSignalDecodeOutcome(call, false).sanityDelta).toBe(0);
  });
});

describe('SIGNAL_DECODE_RENDERER registration object', () => {
  it('exposes computeOutcome as the same function as computeSignalDecodeOutcome', () => {
    expect(SIGNAL_DECODE_RENDERER.computeOutcome).toBe(computeSignalDecodeOutcome);
  });

  it('produces the success outcome via SIGNAL_DECODE_RENDERER.computeOutcome', () => {
    const outcome = SIGNAL_DECODE_RENDERER.computeOutcome(ARIA9_CALL, true);
    expect(outcome).toEqual({
      sanityDelta: -8,
      staticReward: 120,
      staticMultiplier: 1,
      tapeUnlocked: 'Tape #11 — ARIA-9 Transcript',
      bandUnlocked: undefined,
    });
  });

  it('produces the failure outcome via SIGNAL_DECODE_RENDERER.computeOutcome', () => {
    const outcome = SIGNAL_DECODE_RENDERER.computeOutcome(ARIA9_CALL, false);
    expect(outcome).toEqual({
      sanityDelta: -4,
      staticReward: 0,
      staticMultiplier: 0,
      tapeUnlocked: undefined,
      bandUnlocked: undefined,
    });
  });
});
