// __tests__/engine/calls/renderers/RightAnswerHandler.test.ts
// Unit tests for the RIGHT_ANSWER call type outcome computer.
// data/calls.js is SACRED — tests import the live registry to assert against
// the real call shapes (ids 0, 2, 6, 9, 12, 16) so the renderer is validated
// against production data, not just synthetic fixtures.

import { CALLS } from '@/data/calls';
import {
  computeRightAnswerOutcome,
  RIGHT_ANSWER_RENDERER,
} from '@/engine/calls/renderers/RightAnswerHandler';
import type { CallData } from '@/engine/calls/types';

// --- Fixtures ---

const RIGHT_ANSWER_IDS = [0, 2, 6, 9, 12, 16];

const getCall = (id: number): CallData => {
  const call = CALLS.find((c) => c.id === id);
  if (call === undefined) {
    throw new Error(`test fixture missing: call id ${id}`);
  }
  return call as unknown as CallData;
};

// Mirror of data/calls.js choice vectors, locked as constants so tests
// document the exact expected outcome shape for each RIGHT_ANSWER call.
const EXPECTED = {
  // id 0 — NUMBER DISCONNECTED (band 0, staticReward 40)
  0: {
    choices: [
      { sanityDelta: -5, staticMult: 2, tape: null },
      { sanityDelta: 0, staticMult: 1, tape: null },
      { sanityDelta: -3, staticMult: 1.5, tape: 'Tape #1 — The Wrong Number' },
    ],
  },
  // id 2 — THE COLLECTOR (band 0, staticReward 45)
  2: {
    choices: [
      { sanityDelta: -10, staticMult: 1.5, tape: "Tape #2 — The Collector's Archive" },
      { sanityDelta: 0, staticMult: 1, tape: null },
      { sanityDelta: -5, staticMult: 2, tape: null },
    ],
  },
  // id 6 — YESTERDAY'S CALL (band 1, staticReward 65)
  6: {
    choices: [
      { sanityDelta: -15, staticMult: 2, tape: "Tape #4 — Yesterday's Frequency" },
      { sanityDelta: -5, staticMult: 1, tape: null },
      { sanityDelta: -10, staticMult: 1.5, tape: null },
    ],
  },
  // id 9 — MISSING PERSONS (band 2, staticReward 90)
  9: {
    choices: [
      { sanityDelta: -15, staticMult: 2, tape: 'Tape #7 — Found Signal' },
      { sanityDelta: 0, staticMult: 1, tape: null },
      { sanityDelta: 5, staticMult: 1.5, tape: null },
    ],
  },
  // id 12 — AGENT 7 (band 3, staticReward 100)
  12: {
    choices: [
      { sanityDelta: -10, staticMult: 1, tape: null },
      { sanityDelta: -5, staticMult: 1.5, tape: null },
      { sanityDelta: -15, staticMult: 2, tape: 'Tape #10 — Courtesy Call' },
    ],
  },
  // id 16 — YOU CALLED US (band 4, staticReward 280)
  16: {
    choices: [
      { sanityDelta: 15, staticMult: 3, tape: null },
      { sanityDelta: 20, staticMult: 2, tape: 'Tape #14 — The Choice' },
      { sanityDelta: 10, staticMult: 2, tape: null },
    ],
  },
} as const;

// --- Tests ---

describe('RIGHT_ANSWER renderer — sanity deltas', () => {
  test('id 0 NUMBER DISCONNECTED: choice 0 sanity -5, choice 1 sanity 0, choice 2 sanity -3', () => {
    const call = getCall(0);
    expect(computeRightAnswerOutcome(call, 0).sanityDelta).toBe(-5);
    expect(computeRightAnswerOutcome(call, 1).sanityDelta).toBe(0);
    expect(computeRightAnswerOutcome(call, 2).sanityDelta).toBe(-3);
  });

  test('id 16 YOU CALLED US: positive sanity deltas (+15, +20, +10)', () => {
    const call = getCall(16);
    expect(computeRightAnswerOutcome(call, 0).sanityDelta).toBe(15);
    expect(computeRightAnswerOutcome(call, 1).sanityDelta).toBe(20);
    expect(computeRightAnswerOutcome(call, 2).sanityDelta).toBe(10);
  });

  test('id 2 THE COLLECTOR: negative sanity delta on choice 0 (-10)', () => {
    const call = getCall(2);
    expect(computeRightAnswerOutcome(call, 0).sanityDelta).toBe(-10);
  });
});

describe('RIGHT_ANSWER renderer — static reward + multiplier', () => {
  test('id 6 YESTERDAY_CAL: staticReward 65, choice 0 multiplier 2', () => {
    const call = getCall(6);
    const outcome = computeRightAnswerOutcome(call, 0);
    expect(outcome.staticReward).toBe(65);
    expect(outcome.staticMultiplier).toBe(2);
  });

  test('id 9 MISSING PERSONS: staticReward 90, choice 2 multiplier 1.5', () => {
    const call = getCall(9);
    const outcome = computeRightAnswerOutcome(call, 2);
    expect(outcome.staticReward).toBe(90);
    expect(outcome.staticMultiplier).toBe(1.5);
  });

  test('id 12 AGENT 7: staticReward 100, choice 2 multiplier 2', () => {
    const call = getCall(12);
    const outcome = computeRightAnswerOutcome(call, 2);
    expect(outcome.staticReward).toBe(100);
    expect(outcome.staticMultiplier).toBe(2);
  });

  test('id 16 YOU CALLED US: staticReward 280, choice 0 multiplier 3', () => {
    const call = getCall(16);
    const outcome = computeRightAnswerOutcome(call, 0);
    expect(outcome.staticReward).toBe(280);
    expect(outcome.staticMultiplier).toBe(3);
  });
});

describe('RIGHT_ANSWER renderer — tape unlocks', () => {
  test('id 0 choice 2 unlocks Tape #1', () => {
    const call = getCall(0);
    expect(computeRightAnswerOutcome(call, 2).tapeUnlocked).toBe('Tape #1 — The Wrong Number');
  });

  test('id 0 choice 0 (tape false) returns undefined tapeUnlocked', () => {
    const call = getCall(0);
    expect(computeRightAnswerOutcome(call, 0).tapeUnlocked).toBeUndefined();
  });

  test('id 2 choice 0 unlocks Tape #2', () => {
    const call = getCall(2);
    expect(computeRightAnswerOutcome(call, 0).tapeUnlocked).toBe(
      "Tape #2 — The Collector's Archive",
    );
  });

  test('id 6 choice 0 unlocks Tape #4', () => {
    const call = getCall(6);
    expect(computeRightAnswerOutcome(call, 0).tapeUnlocked).toBe("Tape #4 — Yesterday's Frequency");
  });

  test('id 9 choice 0 unlocks Tape #7', () => {
    const call = getCall(9);
    expect(computeRightAnswerOutcome(call, 0).tapeUnlocked).toBe('Tape #7 — Found Signal');
  });

  test('id 12 choice 2 unlocks Tape #10', () => {
    const call = getCall(12);
    expect(computeRightAnswerOutcome(call, 2).tapeUnlocked).toBe('Tape #10 — Courtesy Call');
  });

  test('id 16 choice 1 unlocks Tape #14', () => {
    const call = getCall(16);
    expect(computeRightAnswerOutcome(call, 1).tapeUnlocked).toBe('Tape #14 — The Choice');
  });
});

describe('RIGHT_ANSWER renderer — bandUnlocked always undefined', () => {
  test('all choices return bandUnlocked undefined across all 6 calls', () => {
    for (const id of RIGHT_ANSWER_IDS) {
      const call = getCall(id);
      const choices = call.choices ?? [];
      for (let i = 0; i < choices.length; i++) {
        expect(computeRightAnswerOutcome(call, i).bandUnlocked).toBeUndefined();
      }
    }
  });
});

describe('RIGHT_ANSWER renderer — zero sanityDelta cases + invalid index', () => {
  test('id 2 choice 1 sanity delta is exactly zero (no-op)', () => {
    const call = getCall(2);
    expect(computeRightAnswerOutcome(call, 1).sanityDelta).toBe(0);
  });

  test('id 9 choice 1 sanity delta is exactly zero', () => {
    const call = getCall(9);
    expect(computeRightAnswerOutcome(call, 1).sanityDelta).toBe(0);
  });

  test('invalid choice index returns zero-outcome stub (non-fatal)', () => {
    const call = getCall(0);
    const outcome = computeRightAnswerOutcome(call, 999);
    expect(outcome.sanityDelta).toBe(0);
    expect(outcome.staticReward).toBe(0);
    expect(outcome.staticMultiplier).toBe(0);
    expect(outcome.tapeUnlocked).toBeUndefined();
    expect(outcome.bandUnlocked).toBeUndefined();
  });
});

describe('RIGHT_ANSWER renderer — registry export shape', () => {
  test('RIGHT_ANSWER_RENDERER.computeOutcome is the same function', () => {
    expect(RIGHT_ANSWER_RENDERER.computeOutcome).toBe(computeRightAnswerOutcome);
  });
});

describe('RIGHT_ANSWER renderer — full-call coverage on real data', () => {
  // Cross-check every choice across all 6 RIGHT_ANSWER calls against
  // the EXPECTED lockfile above; catches silent data drift.
  for (const id of RIGHT_ANSWER_IDS) {
    test(`call id ${id} matches expected fixture for all choices`, () => {
      const call = getCall(id);
      const expected = EXPECTED[id as keyof typeof EXPECTED];
      const choices = call.choices ?? [];
      expect(choices.length).toBeGreaterThan(0);
      for (let i = 0; i < choices.length; i++) {
        const outcome = computeRightAnswerOutcome(call, i);
        expect(outcome.sanityDelta).toBe(expected.choices[i].sanityDelta);
        expect(outcome.staticMultiplier).toBe(expected.choices[i].staticMult);
        if (expected.choices[i].tape === null) {
          expect(outcome.tapeUnlocked).toBeUndefined();
        } else {
          expect(outcome.tapeUnlocked).toBe(expected.choices[i].tape);
        }
        expect(outcome.staticReward).toBe(call.staticReward);
        expect(outcome.bandUnlocked).toBeUndefined();
      }
    });
  }
});
