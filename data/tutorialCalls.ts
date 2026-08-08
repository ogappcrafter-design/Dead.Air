import type { CallData } from '../engine/calls/types';

export const TUTORIAL_CALL_IDS = [2000, 2001, 2002] as const;

export const TUTORIAL_CALLS: CallData[] = [
  {
    id: 2000,
    band: 0,
    callerId: 'tutorial_mariner',
    callerName: 'OLD MARINER',
    signal: 3,
    type: 'JUST_LISTEN',
    staticReward: 0,
    sanityDelta: -2,
    isTutorial: true,
    lines: [
      '...you there? New operator?',
      'Good. You found the right frequency.',
      'This is the LIVING band. 87.5 to 92.0 on your dial.',
      'Calls come through here first. The gentle ones.',
      'When you hear a voice... you listen.',
      'Tap to move the conversation forward.',
      "That's all there is to it. Just... listen.",
    ],
  },
  {
    id: 2001,
    band: 0,
    callerId: 'tutorial_operator',
    callerName: 'NIGHT OPERATOR',
    signal: 4,
    type: 'RIGHT_ANSWER',
    staticReward: 0,
    isTutorial: true,
    lines: [
      'Station identification. Do you copy?',
      'I need you to respond. Choose an answer from the options below.',
      "Don't worry about getting it wrong. This is practice.",
      'Go ahead. Pick one.',
    ],
    choices: [
      {
        text: 'I copy. Loud and clear.',
        outcome: 'confident',
        sanityDelta: 1,
        staticMult: 0,
      },
      {
        text: '...I think I copy?',
        outcome: 'uncertain',
        sanityDelta: -1,
        staticMult: 0,
      },
      {
        text: 'Who is this?',
        outcome: 'curious',
        sanityDelta: 0,
        staticMult: 0,
      },
    ],
  },
  {
    id: 2002,
    band: 0,
    callerId: 'tutorial_whisper',
    callerName: 'WHISPER',
    signal: 2,
    type: 'RIGHT_ANSWER',
    staticReward: 0,
    isTutorial: true,
    lines: [
      "You've learned to listen. You've learned to answer.",
      'Now... choices have weight.',
      'What you say changes what you hear next.',
      'Some callers are fragile. Some are dangerous.',
      'Choose carefully, operator.',
      '...are you still there?',
    ],
    choices: [
      {
        text: "I'm here. I'm ready.",
        outcome: 'brave',
        sanityDelta: 2,
        staticMult: 0,
        choiceTag: 'tutorial_brave',
      },
      {
        text: "I don't know if I can do this.",
        outcome: 'afraid',
        sanityDelta: -3,
        staticMult: 0,
        choiceTag: 'tutorial_afraid',
      },
    ],
  },
];
