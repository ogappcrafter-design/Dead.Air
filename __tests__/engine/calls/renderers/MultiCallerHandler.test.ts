// __tests__/engine/calls/renderers/MultiCallerHandler.test.ts
// Unit tests for the MULTI_CALLER call type outcome computer.

import {
  computeMultiCallerOutcome,
  MULTI_CALLER_RENDERER,
} from '@/engine/calls/renderers/MultiCallerHandler';
import type { CallData } from '@/engine/calls/types';

// --- Fixtures ---

const MULTI_CALLER_CALL: CallData = {
  id: 1002,
  band: 1,
  callerId: 'MC-002',
  callerName: 'CROSSED LINES',
  signal: 3,
  type: 'MULTI_CALLER',
  staticReward: 65,
  sanityDelta: -15,
  tape: true,
  tapeName: 'Tape #M1 — Two Voices',
  lines: ['"Hello? Who is this?"', '"I asked first. Who are YOU?"', '"Stop calling this number."'],
  lineSpeakers: [0, 1, 0],
  speakerPairs: [
    { voiceId: 0, name: 'Voice A' },
    { voiceId: 1, name: 'Voice B' },
  ],
};

// --- Tests ---

describe('MULTI_CALLER renderer — all correct attribution', () => {
  const allCorrect = [
    { utteranceIndex: 0, voiceIndex: 0 },
    { utteranceIndex: 1, voiceIndex: 1 },
    { utteranceIndex: 2, voiceIndex: 0 },
  ];

  it('returns full sanityDelta', () => {
    const outcome = computeMultiCallerOutcome(MULTI_CALLER_CALL, allCorrect);
    expect(outcome.sanityDelta).toBe(-15);
  });

  it('returns full staticReward', () => {
    const outcome = computeMultiCallerOutcome(MULTI_CALLER_CALL, allCorrect);
    expect(outcome.staticReward).toBe(65);
  });

  it('returns staticMultiplier 1', () => {
    const outcome = computeMultiCallerOutcome(MULTI_CALLER_CALL, allCorrect);
    expect(outcome.staticMultiplier).toBe(1);
  });

  it('unlocks tape', () => {
    const outcome = computeMultiCallerOutcome(MULTI_CALLER_CALL, allCorrect);
    expect(outcome.tapeUnlocked).toBe('Tape #M1 — Two Voices');
  });
});

describe('MULTI_CALLER renderer — partial attribution', () => {
  it('reduces sanityDelta proportionally (2/3 correct)', () => {
    const partial = [
      { utteranceIndex: 0, voiceIndex: 0 },
      { utteranceIndex: 1, voiceIndex: 0 }, // wrong, should be 1
      { utteranceIndex: 2, voiceIndex: 0 },
    ];
    const outcome = computeMultiCallerOutcome(MULTI_CALLER_CALL, partial);
    // ratio = 2/3, sanityDelta = trunc(-15 * 2/3) = trunc(-10) = -10
    expect(outcome.sanityDelta).toBe(-10);
  });

  it('returns proportional staticMultiplier', () => {
    const partial = [
      { utteranceIndex: 0, voiceIndex: 0 },
      { utteranceIndex: 1, voiceIndex: 0 },
    ];
    const outcome = computeMultiCallerOutcome(MULTI_CALLER_CALL, partial);
    // ratio = 1/2 = 0.5
    expect(outcome.staticMultiplier).toBe(0.5);
  });

  it('does not unlock tape on partial', () => {
    const partial = [
      { utteranceIndex: 0, voiceIndex: 1 }, // wrong
      { utteranceIndex: 1, voiceIndex: 1 },
      { utteranceIndex: 2, voiceIndex: 0 },
    ];
    const outcome = computeMultiCallerOutcome(MULTI_CALLER_CALL, partial);
    expect(outcome.tapeUnlocked).toBeUndefined();
  });
});

describe('MULTI_CALLER renderer — edge cases', () => {
  it('returns zero outcome on empty attribution', () => {
    const outcome = computeMultiCallerOutcome(MULTI_CALLER_CALL, []);
    expect(outcome.sanityDelta).toBe(0);
    expect(outcome.staticReward).toBe(0);
    expect(outcome.staticMultiplier).toBe(0);
    expect(outcome.tapeUnlocked).toBeUndefined();
  });

  it('returns zero outcome when lineSpeakers is empty', () => {
    const noSpeakers: CallData = { ...MULTI_CALLER_CALL, lineSpeakers: [] };
    const outcome = computeMultiCallerOutcome(noSpeakers, [{ utteranceIndex: 0, voiceIndex: 0 }]);
    expect(outcome.sanityDelta).toBe(0);
    expect(outcome.staticReward).toBe(0);
  });

  it('returns zero outcome when lines is empty', () => {
    const noLines: CallData = { ...MULTI_CALLER_CALL, lines: [] };
    const outcome = computeMultiCallerOutcome(noLines, [{ utteranceIndex: 0, voiceIndex: 0 }]);
    expect(outcome.sanityDelta).toBe(0);
    expect(outcome.staticReward).toBe(0);
  });

  it('skips invalid utteranceIndex silently', () => {
    const invalid = [
      { utteranceIndex: 999, voiceIndex: 0 },
      { utteranceIndex: 0, voiceIndex: 0 },
    ];
    const outcome = computeMultiCallerOutcome(MULTI_CALLER_CALL, invalid);
    // Only index 0 is valid, and it's correct, so ratio = 1/1 = 1
    expect(outcome.sanityDelta).toBe(-15);
    expect(outcome.staticMultiplier).toBe(1);
  });

  it('returns bandUnlocked undefined always', () => {
    const outcome = computeMultiCallerOutcome(MULTI_CALLER_CALL, [
      { utteranceIndex: 0, voiceIndex: 0 },
    ]);
    expect(outcome.bandUnlocked).toBeUndefined();
  });

  it('MULTI_CALLER_RENDERER exports computeOutcome', () => {
    expect(MULTI_CALLER_RENDERER.computeOutcome).toBe(computeMultiCallerOutcome);
  });
});
