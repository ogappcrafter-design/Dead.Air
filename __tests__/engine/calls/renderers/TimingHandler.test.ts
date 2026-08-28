// __tests__/engine/calls/renderers/TimingHandler.test.ts
// Unit tests for the TIMING call type outcome computer.

import { computeTimingOutcome, TIMING_RENDERER } from '@/engine/calls/renderers/TimingHandler';
import type { CallData } from '@/engine/calls/types';

// --- Fixtures ---

const TIMING_CALL: CallData = {
  id: 1003,
  band: 1,
  callerId: 'TM-003',
  callerName: 'RHYTHM OF THE SIGNAL',
  signal: 3,
  type: 'TIMING',
  staticReward: 65,
  sanityDelta: -15,
  sanityPenalty: 20,
  duration: 10,
  tape: true,
  tapeName: 'Tape #T1 — Perfect Sync',
  beatMap: [
    { timestampMs: 1000, type: 'TAP' },
    { timestampMs: 2000, type: 'TAP' },
    { timestampMs: 3000, type: 'TAP' },
  ],
  lines: ['"Match the rhythm. Don\'t miss a beat."'],
};

// --- Tests ---

describe('TIMING renderer — perfect sync', () => {
  const perfectTaps = [
    { timestampMs: 1000, isHold: false },
    { timestampMs: 2000, isHold: false },
    { timestampMs: 3000, isHold: false },
  ];

  it('returns full sanityDelta on perfect sync', () => {
    const outcome = computeTimingOutcome(TIMING_CALL, perfectTaps);
    expect(outcome.sanityDelta).toBe(-15);
  });

  it('returns full staticReward', () => {
    const outcome = computeTimingOutcome(TIMING_CALL, perfectTaps);
    expect(outcome.staticReward).toBe(65);
  });

  it('returns staticMultiplier 1 on perfect sync', () => {
    const outcome = computeTimingOutcome(TIMING_CALL, perfectTaps);
    expect(outcome.staticMultiplier).toBe(1); // 0.5 + 1.0 * 0.5
  });

  it('unlocks tape on perfect sync', () => {
    const outcome = computeTimingOutcome(TIMING_CALL, perfectTaps);
    expect(outcome.tapeUnlocked).toBe('Tape #T1 — Perfect Sync');
  });
});

describe('TIMING renderer — high deviation', () => {
  const offTaps = [
    { timestampMs: 1500, isHold: false },
    { timestampMs: 2500, isHold: false },
    { timestampMs: 3500, isHold: false },
  ];

  it('reduces sanityDelta with deviation', () => {
    const outcome = computeTimingOutcome(TIMING_CALL, offTaps);
    // avgDeviation = 500, accuracy = max(0, 1 - 500/1000) = 0.5
    // sanityDelta = trunc(-15 * 0.5) = -7
    expect(outcome.sanityDelta).toBe(-7);
  });

  it('reduces staticMultiplier with deviation', () => {
    const outcome = computeTimingOutcome(TIMING_CALL, offTaps);
    // accuracy = 0.5, mult = 0.5 + 0.5 * 0.5 = 0.75
    expect(outcome.staticMultiplier).toBe(0.75);
  });

  it('does not unlock tape on high deviation', () => {
    const outcome = computeTimingOutcome(TIMING_CALL, offTaps);
    expect(outcome.tapeUnlocked).toBeUndefined();
  });
});

describe('TIMING renderer — empty taps (penalty)', () => {
  it('applies sanityPenalty as negative sanityDelta', () => {
    const outcome = computeTimingOutcome(TIMING_CALL, []);
    expect(outcome.sanityDelta).toBe(-20);
  });

  it('returns staticReward still', () => {
    const outcome = computeTimingOutcome(TIMING_CALL, []);
    expect(outcome.staticReward).toBe(65);
  });

  it('returns staticMultiplier 0.5', () => {
    const outcome = computeTimingOutcome(TIMING_CALL, []);
    expect(outcome.staticMultiplier).toBe(0.5);
  });

  it('does not unlock tape', () => {
    const outcome = computeTimingOutcome(TIMING_CALL, []);
    expect(outcome.tapeUnlocked).toBeUndefined();
  });
});

describe('TIMING renderer — edge cases', () => {
  it('returns zero outcome when beatMap is empty', () => {
    const noBeat: CallData = { ...TIMING_CALL, beatMap: [] };
    const outcome = computeTimingOutcome(noBeat, [{ timestampMs: 1000, isHold: false }]);
    expect(outcome.sanityDelta).toBe(0);
    expect(outcome.staticReward).toBe(0);
    expect(outcome.staticMultiplier).toBe(0);
  });

  it('treats missing taps as high deviation (500ms penalty per beat)', () => {
    const partialTaps = [
      { timestampMs: 1000, isHold: false },
      // Missing taps for beats 2 and 3
    ];
    const outcome = computeTimingOutcome(TIMING_CALL, partialTaps);
    // totalDeviation = 0 + 500 + 500 = 1000
    // avgDeviation = 1000/3 ≈ 333.33
    // accuracy = max(0, 1 - 333.33/1000) ≈ 0.667
    // sanityDelta = trunc(-15 * 0.667) = trunc(-10) = -10
    expect(outcome.sanityDelta).toBe(-10);
  });

  it('returns bandUnlocked undefined always', () => {
    const outcome = computeTimingOutcome(TIMING_CALL, [{ timestampMs: 1000, isHold: false }]);
    expect(outcome.bandUnlocked).toBeUndefined();
  });

  it('TIMING_RENDERER exports computeOutcome', () => {
    expect(TIMING_RENDERER.computeOutcome).toBe(computeTimingOutcome);
  });
});
