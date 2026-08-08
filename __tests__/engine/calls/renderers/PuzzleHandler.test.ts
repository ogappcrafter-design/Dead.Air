// __tests__/engine/calls/renderers/PuzzleHandler.test.ts
// Unit tests for the PUZZLE call type outcome computer.

import {
  computePuzzleOutcome,
  PUZZLE_RENDERER,
} from '@/engine/calls/renderers/PuzzleHandler';
import type { CallData } from '@/engine/calls/types';

// --- Fixtures ---

const PUZZLE_CALL: CallData = {
  id: 1004,
  band: 2,
  callerId: 'PZ-004',
  callerName: 'CIPHER STATION',
  signal: 2,
  type: 'PUZZLE',
  staticReward: 100,
  sanityDelta: 15,
  tape: true,
  tapeName: 'Tape #P1 — The Key',
  intro: 'A distorted voice bleeds through static…',
  decodedMessage: 'THE FREQUENCY WAS ALWAYS INSIDE YOU',
  cipherLayers: [
    { encoded: '... --- ...', solution: 'SOS', hint: 'Morse code' },
    { encoded: '01001000', solution: 'H', hint: 'Binary ASCII' },
    { encoded: 'uryyb', solution: 'hello', hint: 'ROT13' },
  ],
};

// --- Tests ---

describe('PUZZLE renderer — all layers correct', () => {
  const allCorrect = ['SOS', 'H', 'hello'];

  it('returns full sanityDelta', () => {
    const outcome = computePuzzleOutcome(PUZZLE_CALL, allCorrect);
    expect(outcome.sanityDelta).toBe(15);
  });

  it('returns full staticReward', () => {
    const outcome = computePuzzleOutcome(PUZZLE_CALL, allCorrect);
    expect(outcome.staticReward).toBe(100);
  });

  it('returns staticMultiplier 1', () => {
    const outcome = computePuzzleOutcome(PUZZLE_CALL, allCorrect);
    expect(outcome.staticMultiplier).toBe(1);
  });

  it('unlocks tape', () => {
    const outcome = computePuzzleOutcome(PUZZLE_CALL, allCorrect);
    expect(outcome.tapeUnlocked).toBe('Tape #P1 — The Key');
  });
});

describe('PUZZLE renderer — partial layers', () => {
  it('reduces sanityDelta proportionally (2/3 correct)', () => {
    const partial = ['SOS', 'H', 'WRONG'];
    const outcome = computePuzzleOutcome(PUZZLE_CALL, partial);
    // ratio = 2/3, sanityDelta = trunc(15 * 2/3) = trunc(10) = 10
    expect(outcome.sanityDelta).toBe(10);
  });

  it('returns proportional staticMultiplier', () => {
    const partial = ['SOS', 'WRONG', 'WRONG'];
    const outcome = computePuzzleOutcome(PUZZLE_CALL, partial);
    // ratio = 1/3
    expect(outcome.staticMultiplier).toBeCloseTo(1 / 3, 5);
  });

  it('does not unlock tape on partial', () => {
    const partial = ['WRONG', 'H', 'hello'];
    const outcome = computePuzzleOutcome(PUZZLE_CALL, partial);
    expect(outcome.tapeUnlocked).toBeUndefined();
  });
});

describe('PUZZLE renderer — case insensitivity', () => {
  it('accepts case-insensitive submissions', () => {
    const mixed = ['sos', 'h', 'HELLO'];
    const outcome = computePuzzleOutcome(PUZZLE_CALL, mixed);
    expect(outcome.sanityDelta).toBe(15);
    expect(outcome.staticMultiplier).toBe(1);
  });

  it('trims whitespace before comparison', () => {
    const padded = ['  SOS  ', ' H ', 'hello '];
    const outcome = computePuzzleOutcome(PUZZLE_CALL, padded);
    expect(outcome.sanityDelta).toBe(15);
  });
});

describe('PUZZLE renderer — edge cases', () => {
  it('returns zero outcome when cipherLayers is empty', () => {
    const noLayers: CallData = { ...PUZZLE_CALL, cipherLayers: [] };
    const outcome = computePuzzleOutcome(noLayers, ['SOS']);
    expect(outcome.sanityDelta).toBe(0);
    expect(outcome.staticReward).toBe(0);
    expect(outcome.staticMultiplier).toBe(0);
  });

  it('returns zero outcome when cipherLayers is undefined', () => {
    const noLayers: CallData = { ...PUZZLE_CALL, cipherLayers: undefined };
    const outcome = computePuzzleOutcome(noLayers, ['SOS']);
    expect(outcome.sanityDelta).toBe(0);
    expect(outcome.staticReward).toBe(0);
  });

  it('handles undefined submission entries as incorrect', () => {
    const sparse: (string | undefined)[] = ['SOS', undefined, 'hello'];
    const outcome = computePuzzleOutcome(PUZZLE_CALL, sparse as string[]);
    // 2/3 correct
    expect(outcome.sanityDelta).toBe(10);
  });

  it('returns bandUnlocked undefined always', () => {
    const outcome = computePuzzleOutcome(PUZZLE_CALL, ['SOS', 'H', 'hello']);
    expect(outcome.bandUnlocked).toBeUndefined();
  });

  it('PUZZLE_RENDERER exports computeOutcome', () => {
    expect(PUZZLE_RENDERER.computeOutcome).toBe(computePuzzleOutcome);
  });
});
