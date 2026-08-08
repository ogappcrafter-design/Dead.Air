// __tests__/engine/calls/renderers/ConversationHandler.test.ts
// Unit tests for the CONVERSATION call type outcome computer.

import {
  computeConversationOutcome,
  CONVERSATION_RENDERER,
} from '@/engine/calls/renderers/ConversationHandler';
import type { CallData } from '@/engine/calls/types';

// --- Fixtures ---

const CONVERSATION_CALL: CallData = {
  id: 1005,
  band: 1,
  callerId: 'CV-005',
  callerName: 'THE INTERROGATOR',
  signal: 3,
  type: 'CONVERSATION',
  staticReward: 65,
  tape: true,
  tapeName: 'Tape #C1 — The Confession',
  lines: ['"I know you know something."'],
  dialogueTree: [
    {
      speaker: 'INTERROGATOR',
      text: '"Where were you the night of the 14th?"',
      responses: [
        { text: '"I was home alone."', outcome: 'lie', sanityDelta: -10, staticMult: 1.5 },
        { text: '"I was at the station."', outcome: 'truth', sanityDelta: 5, staticMult: 1 },
      ],
    },
    {
      speaker: 'INTERROGATOR',
      text: '"Can anyone verify that?"',
      responses: [
        { text: '"My partner can."', outcome: 'truth', sanityDelta: -5, staticMult: 1.5 },
        { text: '"No, I was alone."', outcome: 'lie', sanityDelta: -15, staticMult: 2 },
      ],
    },
  ],
};

// --- Tests ---

describe('CONVERSATION renderer — golden path (best outcomes)', () => {
  // Path [1, 0] = choose truth (5), then truth (-5) → net 0, mult avg 1.25
  const goldenPath = [1, 0];

  it('returns summed sanityDelta from chosen responses', () => {
    const outcome = computeConversationOutcome(CONVERSATION_CALL, goldenPath);
    expect(outcome.sanityDelta).toBe(0); // 5 + (-5) = 0
  });

  it('returns full staticReward', () => {
    const outcome = computeConversationOutcome(CONVERSATION_CALL, goldenPath);
    expect(outcome.staticReward).toBe(65);
  });

  it('returns averaged staticMultiplier', () => {
    const outcome = computeConversationOutcome(CONVERSATION_CALL, goldenPath);
    // avg(1, 1.5) = 1.25
    expect(outcome.staticMultiplier).toBe(1.25);
  });

  it('unlocks tape (call.tape is true)', () => {
    const outcome = computeConversationOutcome(CONVERSATION_CALL, goldenPath);
    expect(outcome.tapeUnlocked).toBe('Tape #C1 — The Confession');
  });
});

describe('CONVERSATION renderer — bad path (worst outcomes)', () => {
  // Path [0, 1] = lie (-10), then lie (-15) → net -25, mult avg 1.75
  const badPath = [0, 1];

  it('returns negative summed sanityDelta', () => {
    const outcome = computeConversationOutcome(CONVERSATION_CALL, badPath);
    expect(outcome.sanityDelta).toBe(-25); // -10 + (-15)
  });

  it('still returns full staticReward', () => {
    const outcome = computeConversationOutcome(CONVERSATION_CALL, badPath);
    expect(outcome.staticReward).toBe(65);
  });

  it('returns averaged staticMultiplier', () => {
    const outcome = computeConversationOutcome(CONVERSATION_CALL, badPath);
    // avg(1.5, 2) = 1.75
    expect(outcome.staticMultiplier).toBe(1.75);
  });

  it('still unlocks tape (tape is unconditional on call.tape)', () => {
    const outcome = computeConversationOutcome(CONVERSATION_CALL, badPath);
    expect(outcome.tapeUnlocked).toBe('Tape #C1 — The Confession');
  });
});

describe('CONVERSATION renderer — edge cases', () => {
  it('returns zero outcome on empty path', () => {
    const outcome = computeConversationOutcome(CONVERSATION_CALL, []);
    expect(outcome.sanityDelta).toBe(0);
    expect(outcome.staticReward).toBe(0);
    expect(outcome.staticMultiplier).toBe(0);
    expect(outcome.tapeUnlocked).toBeUndefined();
  });

  it('returns zero outcome when dialogueTree is empty', () => {
    const noTree: CallData = { ...CONVERSATION_CALL, dialogueTree: [] };
    const outcome = computeConversationOutcome(noTree, [0]);
    expect(outcome.sanityDelta).toBe(0);
    expect(outcome.staticReward).toBe(0);
  });

  it('returns zero outcome when dialogueTree is undefined', () => {
    const noTree: CallData = { ...CONVERSATION_CALL, dialogueTree: undefined };
    const outcome = computeConversationOutcome(noTree, [0]);
    expect(outcome.sanityDelta).toBe(0);
    expect(outcome.staticReward).toBe(0);
  });

  it('returns zero outcome on invalid path index (out of range)', () => {
    const outcome = computeConversationOutcome(CONVERSATION_CALL, [999]);
    expect(outcome.sanityDelta).toBe(0);
    expect(outcome.staticReward).toBe(0);
    expect(outcome.staticMultiplier).toBe(0);
  });

  it('returns zero outcome on negative path index', () => {
    const outcome = computeConversationOutcome(CONVERSATION_CALL, [-1]);
    expect(outcome.sanityDelta).toBe(0);
    expect(outcome.staticReward).toBe(0);
  });

  it('handles single-node dialogue tree', () => {
    const singleNode: CallData = {
      ...CONVERSATION_CALL,
      dialogueTree: [
        {
          speaker: 'VOICE',
          text: '"Yes or no?"',
          responses: [
            { text: 'Yes', outcome: 'yes', sanityDelta: 5, staticMult: 1 },
            { text: 'No', outcome: 'no', sanityDelta: -5, staticMult: 2 },
          ],
        },
      ],
    };
    const outcome = computeConversationOutcome(singleNode, [0]);
    expect(outcome.sanityDelta).toBe(5);
    expect(outcome.staticMultiplier).toBe(1);
  });

  it('returns bandUnlocked undefined always', () => {
    const outcome = computeConversationOutcome(CONVERSATION_CALL, [0, 0]);
    expect(outcome.bandUnlocked).toBeUndefined();
  });

  it('CONVERSATION_RENDERER exports computeOutcome', () => {
    expect(CONVERSATION_RENDERER.computeOutcome).toBe(computeConversationOutcome);
  });
});
