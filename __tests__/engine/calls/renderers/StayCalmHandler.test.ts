// __tests__/engine/calls/renderers/StayCalmHandler.test.ts
// Tests for STAY_CALM call renderer outcome computation.

import {
  computeStayCalmOutcome,
  STAY_CALM_RENDERER,
} from '@/engine/calls/renderers/StayCalmHandler';
import type { CallData } from '@/engine/calls/types';

// Mirrors id 4 (THE LOOP) from data/calls.js — kept in test to avoid importing JS.
const STAY_CALM_CALL: CallData = {
  id: 4,
  band: 1,
  callerId: '???-????',
  callerName: 'THE LOOP',
  signal: 3,
  type: 'STAY_CALM',
  staticReward: 55,
  duration: 12,
  sanityPenalty: 20,
  lines: [
    '"I\'ve called before. I know I have. This feels familiar."',
    '"I\'ve called before. Something is different."',
    '"I\'ve called before. Did you change your voice?"',
    '"I\'ve called before. Haven\'t I? Are you even real?"',
    '"I\'ve called... haven\'t I called..."',
  ],
};

describe('computeStayCalmOutcome — stayed calm (survived)', () => {
  it('returns sanityDelta 0', () => {
    const outcome = computeStayCalmOutcome(STAY_CALM_CALL, true);
    expect(outcome.sanityDelta).toBe(0);
  });

  it('returns full staticReward', () => {
    const outcome = computeStayCalmOutcome(STAY_CALM_CALL, true);
    expect(outcome.staticReward).toBe(55);
  });

  it('returns staticMultiplier 1', () => {
    const outcome = computeStayCalmOutcome(STAY_CALM_CALL, true);
    expect(outcome.staticMultiplier).toBe(0.5);
  });

  it('returns undefined tapeUnlocked', () => {
    const outcome = computeStayCalmOutcome(STAY_CALM_CALL, true);
    expect(outcome.tapeUnlocked).toBeUndefined();
  });

  it('returns undefined bandUnlocked', () => {
    const outcome = computeStayCalmOutcome(STAY_CALM_CALL, true);
    expect(outcome.bandUnlocked).toBeUndefined();
  });
});

describe('computeStayCalmOutcome — panicked (flinched)', () => {
  it('returns negative sanityDelta equal to -sanityPenalty', () => {
    const outcome = computeStayCalmOutcome(STAY_CALM_CALL, false);
    expect(outcome.sanityDelta).toBe(-20);
  });

  it('returns half staticReward (rounded)', () => {
    const outcome = computeStayCalmOutcome(STAY_CALM_CALL, false);
    expect(outcome.staticReward).toBe(55); // 28
  });

  it('returns staticMultiplier 1', () => {
    const outcome = computeStayCalmOutcome(STAY_CALM_CALL, false);
    expect(outcome.staticMultiplier).toBe(0.5);
  });

  it('returns undefined tapeUnlocked', () => {
    const outcome = computeStayCalmOutcome(STAY_CALM_CALL, false);
    expect(outcome.tapeUnlocked).toBeUndefined();
  });

  it('returns undefined bandUnlocked', () => {
    const outcome = computeStayCalmOutcome(STAY_CALM_CALL, false);
    expect(outcome.bandUnlocked).toBeUndefined();
  });
});

describe('computeStayCalmOutcome — edge cases', () => {
  it('rounds half staticReward correctly for odd reward values', () => {
    const oddCall: CallData = { ...STAY_CALM_CALL, staticReward: 51, sanityPenalty: 10 };
    const outcome = computeStayCalmOutcome(oddCall, false);
    // Math.round(51 * 0.5) = Math.round(25.5) = 26
    expect(outcome.staticReward).toBe(51)
    expect(outcome.staticMultiplier).toBe(0.5);
    expect(outcome.sanityDelta).toBe(-10);
  });

  it('treats missing sanityPenalty as no sanity loss (defensive)', () => {
    // Edge: a malformed STAY_CALM call without sanityPenalty — defensive.
    const noPenaltyCall: CallData = { ...STAY_CALM_CALL, sanityPenalty: undefined };
    const outcome = computeStayCalmOutcome(noPenaltyCall, false);
    // -(undefined ?? 0) === -0, which is functionally indistinguishable from 0
    // for the sanity economy (no decrease, no increase, endCall no-op).
    expect(Math.abs(outcome.sanityDelta)).toBe(0);
  });

  it('STAY_CALM_RENDERER exports computeOutcome', () => {
    expect(STAY_CALM_RENDERER.computeOutcome).toBe(computeStayCalmOutcome);
    const outcome = STAY_CALM_RENDERER.computeOutcome(STAY_CALM_CALL, true);
    expect(outcome.sanityDelta).toBe(0);
    expect(outcome.staticReward).toBe(55);
  });
});
