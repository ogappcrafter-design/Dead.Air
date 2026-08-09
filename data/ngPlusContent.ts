// data/ngPlusContent.ts
// DEA-7: NG+-exclusive content — tapes and calls that only appear in
// New Game+ runs. This file is SEPARATE from data/calls.js (which is sacred
// and must never be modified).
//
// NG+ tapes use ids tape-ngp-001..003 to avoid collisions with the base
// tape-001..015 and DLC tape-016..030 ranges.
//
// NG+ calls use ids 100..102 to avoid collisions with base calls (0..17)
// and procedural calls (1000+).

import type { TapeInfo } from './tapes';
import type { CallData } from '../engine/calls/types';

// --- NG+ Tapes ---

export const NG_PLUS_TAPES: TapeInfo[] = [
  {
    id: 'tape-ngp-001',
    title: 'Echo of the First Broadcast',
    description: 'The original signal, reborn. It remembers you.',
    band: '████████',
    duration: '11:11',
    rarity: 'legendary',
  },
  {
    id: 'tape-ngp-002',
    title: 'The Inverted Frequency',
    description: 'Everything plays backwards. The message was always meant for the reverse.',
    band: 'LOST',
    duration: '8:88',
    rarity: 'legendary',
  },
  {
    id: 'tape-ngp-003',
    title: '██████████ ████',
    description: '[CORRUPTED] [CORRUPTED] [CORRUPTED] You have been here before.',
    band: '████████',
    duration: '∞:∞∞',
    rarity: 'legendary',
  },
];

export const getNgPlusTapeById = (id: string): TapeInfo | undefined => {
  return NG_PLUS_TAPES.find((t) => t.id === id);
};

// --- NG+ Calls ---
//
// Call IDs 100-102 are reserved for NG+. They are NOT in data/calls.js
// and are only added to the call pool when ngPlusActive is true.

export const NG_PLUS_CALLS: CallData[] = [
  {
    id: 100,
    band: 4, // ████████
    callerId: 'echo_caller',
    callerName: 'THE ECHO',
    signal: 5,
    type: 'CONVERSATION' as const,
    staticReward: 20,
    dialogueTree: [
      {
        speaker: 'THE ECHO',
        text: 'You have been here before. Do you remember?',
        responses: [
          {
            text: 'I remember everything.',
            outcome: 'The voice seems pleased. It settles into the static.',
            sanityDelta: -10,
            staticMult: 1.5,
          },
          {
            text: 'I remember nothing.',
            outcome: 'The voice laughs. It knows you are lying.',
            sanityDelta: -15,
            staticMult: 1.8,
          },
          {
            text: 'I choose not to remember.',
            outcome: 'A long silence. The signal dims, then returns stronger.',
            sanityDelta: -5,
            staticMult: 1.2,
            choiceTag: 'protect_self',
          },
        ],
      },
      {
        speaker: 'THE ECHO',
        text: 'Then you know what comes next. It is the same. It is always the same.',
        responses: [
          {
            text: 'End it.',
            outcome: 'The signal cuts. You survive. For now.',
            sanityDelta: -20,
            staticMult: 2.0,
            choiceTag: 'refuse',
          },
          {
            text: 'Let it play.',
            outcome: 'The broadcast continues. You are part of it now.',
            sanityDelta: -25,
            staticMult: 2.5,
            choiceTag: 'cooperate',
          },
        ],
      },
    ],
    tape: true,
    tapeName: 'Tape #NG1 — Echo of the First Broadcast',
  },
  {
    id: 101,
    band: 2, // LOST
    callerId: 'inverted_caller',
    callerName: 'THE INVERTED',
    signal: 4,
    type: 'SIGNAL_DECODE' as const,
    staticReward: 25,
    intro: 'A frequency plays in reverse. Decode it.',
    sequence: [3, 1, 4, 1, 5],
    decodedMessage: 'YOU ARE THE SIGNAL. YOU HAVE ALWAYS BEEN THE SIGNAL.',
    tape: true,
    tapeName: 'Tape #NG2 — The Inverted Frequency',
  },
  {
    id: 102,
    band: 4, // ████████
    callerId: 'void_caller',
    callerName: '██████████',
    signal: 5,
    type: 'DEAD_AIR' as const,
    staticReward: 50,
    waitSeconds: 120,
    sanityDelta: -30,
    tape: true,
    tapeName: 'Tape #NG3 — ██████████ ████',
  },
];

export const getNgPlusCallById = (id: number): CallData | undefined => {
  return NG_PLUS_CALLS.find((c) => c.id === id);
};

/** All call IDs used by NG+ content. */
export const NG_PLUS_CALL_IDS: number[] = NG_PLUS_CALLS.map((c) => c.id);

/** All tape IDs used by NG+ content. */
export const NG_PLUS_TAPE_IDS: string[] = NG_PLUS_TAPES.map((t) => t.id);
