/// <reference types="jest" />
// __tests__/engine/calls/renderers/DeadAirHandler.test.ts
// Unit tests for the DEAD_AIR call-type outcome renderer.

import { computeDeadAirOutcome, DEAD_AIR_RENDERER } from '@/engine/calls/renderers/DeadAirHandler';
import type { CallData } from '@/engine/calls/types';

// --- Real DEAD_AIR calls from data/calls.js (SACRED — shape mirrored, not modified) ---

// id 1: WRONG NUMBER — no sanityDelta, no tape.
const wrongNumber: CallData = {
  id: 1,
  band: 0,
  callerId: 'UNKNOWN',
  callerName: 'WRONG NUMBER',
  signal: 4,
  type: 'DEAD_AIR',
  staticReward: 25,
  waitSeconds: 8,
  lines: [
    'They called you.',
    'You answer.',
    '...',
    'Total silence. Eight seconds.',
    '...',
    '"Oh. Wrong number."',
    'Click.',
    '...',
    'The static sounded exactly like breathing.',
  ],
};

// id 5: 3:47 AM — negative sanityDelta, tape unlock.
const three47AM: CallData = {
  id: 5,
  band: 1,
  callerId: '3:47 AM',
  callerName: '3:47 AM',
  signal: 2,
  type: 'DEAD_AIR',
  staticReward: 60,
  waitSeconds: 12,
  sanityDelta: -12,
  tape: true,
  tapeName: 'Tape #3 — The 3:47 Sessions',
  lines: [
    '"It\'s 3:47 AM."',
    '...',
    'You check your clock.',
    '...',
    "It doesn't matter what it says.",
    '...',
    "It's 3:47 AM.",
    '...',
    "It's always 3:47 AM.",
    '...',
    'Just wait.',
  ],
};

// id 17: DEAD AIR — positive sanityDelta, tape unlock, band 4.
const deadAir17: CallData = {
  id: 17,
  band: 4,
  callerId: '— — — — —',
  callerName: 'DEAD AIR',
  signal: 0,
  type: 'DEAD_AIR',
  staticReward: 500,
  waitSeconds: 20,
  sanityDelta: 30,
  tape: true,
  tapeName: 'Tape #15 — What Answered',
  lines: [
    'The station goes dark.',
    'Every monitor.',
    'Every light.',
    "The amber glow that's been your constant —",
    'Gone.',
    '...',
    'Just you.',
    'In the dark.',
    '...',
    'Wait.',
    '...',
    'Something answers.',
    '...',
    'The game will never tell you what it was.',
    '...',
    'But you felt it.',
  ],
};

describe('computeDeadAirOutcome', () => {
  it('returns sanityDelta 0 when absent (id 1: WRONG NUMBER)', () => {
    expect(computeDeadAirOutcome(wrongNumber).sanityDelta).toBe(0);
  });

  it('returns negative sanityDelta when present (id 5: 3:47 AM, -12)', () => {
    expect(computeDeadAirOutcome(three47AM).sanityDelta).toBe(-12);
  });

  it('returns positive sanityDelta when present (id 17: DEAD AIR, +30)', () => {
    expect(computeDeadAirOutcome(deadAir17).sanityDelta).toBe(30);
  });

  it('returns correct staticReward (id 1: 25)', () => {
    expect(computeDeadAirOutcome(wrongNumber).staticReward).toBe(25);
  });

  it('returns correct staticReward (id 5: 60)', () => {
    expect(computeDeadAirOutcome(three47AM).staticReward).toBe(60);
  });

  it('returns correct staticReward (id 17: 500)', () => {
    expect(computeDeadAirOutcome(deadAir17).staticReward).toBe(500);
  });

  it('always returns staticMultiplier = 1', () => {
    expect(computeDeadAirOutcome(wrongNumber).staticMultiplier).toBe(1);
    expect(computeDeadAirOutcome(three47AM).staticMultiplier).toBe(1);
    expect(computeDeadAirOutcome(deadAir17).staticMultiplier).toBe(1);
  });

  it('returns tapeUnlocked when call.tape is true (id 5)', () => {
    expect(computeDeadAirOutcome(three47AM).tapeUnlocked).toBe('Tape #3 — The 3:47 Sessions');
  });

  it('returns tapeUnlocked when call.tape is true (id 17)', () => {
    expect(computeDeadAirOutcome(deadAir17).tapeUnlocked).toBe('Tape #15 — What Answered');
  });

  it('returns undefined tapeUnlocked when call.tape is absent (id 1)', () => {
    expect(computeDeadAirOutcome(wrongNumber).tapeUnlocked).toBeUndefined();
  });

  it('never sets bandUnlocked', () => {
    expect(computeDeadAirOutcome(wrongNumber).bandUnlocked).toBeUndefined();
    expect(computeDeadAirOutcome(three47AM).bandUnlocked).toBeUndefined();
    expect(computeDeadAirOutcome(deadAir17).bandUnlocked).toBeUndefined();
  });

  it('handles id 1 (WRONG NUMBER) — full outcome shape', () => {
    const outcome = computeDeadAirOutcome(wrongNumber);
    expect(outcome).toEqual({
      sanityDelta: 0,
      staticReward: 25,
      staticMultiplier: 1,
      // tapeUnlocked absent (not set on the object)
    });
    expect(outcome).not.toHaveProperty('tapeUnlocked');
    expect(outcome).not.toHaveProperty('bandUnlocked');
  });

  it('handles id 5 (3:47 AM) — full outcome shape', () => {
    const outcome = computeDeadAirOutcome(three47AM);
    expect(outcome).toEqual({
      sanityDelta: -12,
      staticReward: 60,
      staticMultiplier: 1,
      tapeUnlocked: 'Tape #3 — The 3:47 Sessions',
    });
  });

  it('handles id 17 (DEAD AIR) — full outcome shape', () => {
    const outcome = computeDeadAirOutcome(deadAir17);
    expect(outcome).toEqual({
      sanityDelta: 30,
      staticReward: 500,
      staticMultiplier: 1,
      tapeUnlocked: 'Tape #15 — What Answered',
    });
  });
});

describe('DEAD_AIR_RENDERER export', () => {
  it('exports computeOutcome bound to computeDeadAirOutcome', () => {
    expect(DEAD_AIR_RENDERER.computeOutcome).toBe(computeDeadAirOutcome);
  });

  it('renderer.computeOutcome produces same result as direct call', () => {
    const a = DEAD_AIR_RENDERER.computeOutcome(three47AM);
    const b = computeDeadAirOutcome(three47AM);
    expect(a).toEqual(b);
  });
});

// --- Edge cases hijacking real calls (shape preserved, fields overridden) ---

describe('computeDeadAirOutcome edge cases', () => {
  it('treats call.tape=false as no tape unlock', () => {
    const call: CallData = { ...wrongNumber, tape: false, tapeName: undefined };
    expect(computeDeadAirOutcome(call).tapeUnlocked).toBeUndefined();
  });

  it('treats call.tape=true with missing tapeName as undefined unlock', () => {
    const call: CallData = { ...wrongNumber, tape: true };
    // tape true but tapeName absent → tapeName is undefined
    expect(computeDeadAirOutcome(call).tapeUnlocked).toBeUndefined();
  });

  it('honors sanityDelta: 0 explicitly (not treated as absence)', () => {
    const call: CallData = { ...wrongNumber, sanityDelta: 0 };
    expect(computeDeadAirOutcome(call).sanityDelta).toBe(0);
  });
});
