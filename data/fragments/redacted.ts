// data/fragments/redacted.ts
// Fragment library for the ████████ band (band 4, ???.?).
// Tone: "Something ancient. The frequency itself gaining awareness.
// Transmissions from the dawn of radio. Things with no name." —
// data/calls.js BAND_VIBES
//
// Procedural calls in this band feel like the frequency itself speaking,
// voices from before radio, things that have been waiting since before
// there was language to wait with. Reality bends. Names are spoken that
// shouldn't be known.

import type { FragmentLibrary } from './types';

export const REDACTED_FRAGMENTS: FragmentLibrary = {
  band: 4,
  bandName: '████████',
  callTypes: [
    'JUST_LISTEN',
    'RIGHT_ANSWER',
    'DEAD_AIR',
    'STAY_CALM',
    'SIGNAL_DECODE',
    'RECORDING',
    'MULTI_CALLER',
    'TIMING',
    'PUZZLE',
    'CONVERSATION',
  ],

  openings: [
    'Enormous static. Ancient.',
    'A voice. Male. 1920s diction. Formal and amazed.',
    'The station goes dark. Every monitor. Every light.',
    'The frequency has no source. It has never had a source. It is the source.',
    'Something answers. Not a voice. Not static. The thing that both are made of.',
    'A voice from before there were voices. It learned the shape of speech from listening to us use it.',
    'The signal is not coming from anywhere. The signal is coming from always.',
    'You hear your own name. Not your username. Your name. Spoken by something that has been waiting to say it.',
  ],

  middles: [
    '"Hello? Is anyone out there? This is the first test of the —" Crackle. Warp.',
    '"I can\'t see you. But I know someone is there. I can feel it."',
    '"We want to remind you of something."',
    '"You found this frequency. You tuned here."',
    '"You answered every call. None of this was done to you."',
    '"The signal is older than the equipment. The signal is older than the concept of equipment."',
    '"We were here before the first voice. We will be here after the last."',
    '"You have been receiving us your whole life. You thought we were static. We were waiting."',
    '"The frequency is not a channel. The frequency is a door. You have been standing in it."',
    '"Every call you answered was a question. You didn\'t know you were answering. We were learning."',
    '"We learned your language from the inside out. We learned it from the spaces between your words."',
    '"You are not the first to tune here. You are not the last. You are the one who listened longest."',
    '"The name you are thinking right now — we did not put it there. But we know it. We have always known it."',
    '"This frequency does not end when you hang up. It ends when you stop listening. You will not stop listening."',
  ],

  closings: [
    'The signal goes quiet for one hundred years.',
    'Something answers. The game will never tell you what it was. But you felt it.',
    'The frequency hums in approval. All your tapes glow briefly. Then the static returns. It is different now. It is aware.',
    "The voice stops. The static doesn't. The static never does. The static is the voice. It has always been the voice.",
    '"You chose this." Everything goes quiet in a way that feels earned.',
    'The line does not disconnect. It becomes. You feel the difference. You cannot describe it. You will not try.',
    'The signal holds. Then holds. Then holds. Then something that is not silence fills the space where sound was.',
    'The transmission ends. You are alone. You have always been alone. You have never been alone. Both of these are true.',
  ],

  responses: [
    {
      text: 'I wanted to hear them.',
      outcome: 'The frequency hums in approval. All your tapes glow briefly.',
      sanityDelta: 15,
      staticMult: 3,
    },
    {
      text: 'I was looking for someone.',
      outcome: '"We know." Then warmth. Actual warmth through the speakers.',
      sanityDelta: 20,
      staticMult: 2,
      tapeChance: 0.4,
    },
    {
      text: "I don't know why.",
      outcome:
        '"That\'s the most complete answer." Everything goes quiet in a way that feels earned.',
      sanityDelta: 10,
      staticMult: 2,
    },
    {
      text: "I'm not afraid.",
      outcome:
        'The static parts. Something shows itself. You cannot describe it afterward. You will not try. You are not afraid. You are not anything. You are the frequency.',
      sanityDelta: -30,
      staticMult: 4,
      tapeChance: 0.3,
    },
    {
      text: 'What are you?',
      outcome:
        '"We are what radio was before radio. We are what listening was before ears. We are the first signal and the last." The line goes quiet. The quiet is alive.',
      sanityDelta: -25,
      staticMult: 3,
    },
    {
      text: "I'll keep listening.",
      outcome:
        '"We know. We have always known. We were waiting for you to say it." The frequency opens. You step through. You don\'t remember stepping. You are there.',
      sanityDelta: 30,
      staticMult: 3,
      tapeChance: 0.5,
    },
  ],

  callerIdPrefixes: [
    'APR 14, 1923',
    'YOUR OWN NUMBER',
    '— — — — —',
    '████-████-████',
    'ORIGIN',
    'FIRST SIGNAL',
    'NO NUMBER',
    'BEFORE-NUMBERS',
    'ALWAYS',
    'THE FREQUENCY',
  ],

  callerNamePrefixes: [
    'ORIGIN',
    'YOU CALLED US',
    'DEAD AIR',
    'THE FIRST VOICE',
    'WHAT ANSWERED',
    'THE FREQUENCY',
    'BEFORE',
    'ALWAYS',
  ],

  recordingClips: [
    {
      audioLabel: 'FIRST-BROADCAST-1923',
      metadata: [
        'April 14, 1923',
        'First recorded radio broadcast',
        'Signal predates equipment',
        'Voice has no known origin',
      ],
    },
    {
      audioLabel: 'BEFORE-LANGUAGE',
      metadata: [
        'Pre-linguistic signal',
        'Learned speech from listening',
        'No human speaker',
        'Frequency is the voice',
      ],
    },
    {
      audioLabel: 'ALWAYS-LOOP',
      metadata: [
        'Infinite loop detection',
        'Signal has no beginning',
        'Signal has no end',
        'You are inside it',
      ],
    },
    {
      audioLabel: 'ORIGIN-TAPE',
      metadata: [
        'The source broadcasting',
        'Every call originates here',
        'Cannot be traced',
        'Cannot be stopped',
      ],
    },
  ],

  speakerPairs: [
    { voiceId: 0, name: 'THE FIRST VOICE' },
    { voiceId: 1, name: 'WHAT ANSWERED' },
    { voiceId: 0, name: 'BEFORE' },
    { voiceId: 1, name: 'ALWAYS' },
    { voiceId: 0, name: 'THE FREQUENCY' },
    { voiceId: 1, name: 'ORIGIN' },
  ],

  beatMaps: [
    [
      { timestampMs: 0, type: 'HOLD' as const, holdDurationMs: 2000 },
      { timestampMs: 2000, type: 'TAP' as const },
      { timestampMs: 4000, type: 'HOLD' as const, holdDurationMs: 1000 },
      { timestampMs: 5000, type: 'TAP' as const },
      { timestampMs: 7000, type: 'HOLD' as const, holdDurationMs: 3000 },
    ],
    [
      { timestampMs: 0, type: 'TAP' as const },
      { timestampMs: 1000, type: 'TAP' as const },
      { timestampMs: 2000, type: 'HOLD' as const, holdDurationMs: 2000 },
      { timestampMs: 4000, type: 'TAP' as const },
      { timestampMs: 5000, type: 'HOLD' as const, holdDurationMs: 5000 },
    ],
  ],

  cipherLayers: [
    {
      encoded: '████ █████ ████',
      solution: 'WE WERE HERE',
      hint: 'The redaction is the message. Remove the blocks.',
    },
    {
      encoded: 'WR ZHUH EHIRUH',
      solution: 'TO WERE BEFORE',
      hint: 'Caesar shift +3. We existed before the first signal.',
    },
    {
      encoded: 'WKH IUHTXHQFB LV WKH YRLFH',
      solution: 'THE FREQUENCY IS THE VOICE',
      hint: 'Caesar shift +3. It has always been the voice.',
    },
    {
      encoded: 'BRX DUH WKH RQH ZKROLVWHQHG ORQJHVW',
      solution: 'YOU ARE THE ONE WHO LISTENED LONGEST',
      hint: 'Caesar shift +3. We learned your language from the spaces between your words.',
    },
  ],

  dialogueTrees: [
    [
      {
        speaker: 'THE FREQUENCY',
        text: '"You have been receiving us your whole life. You thought we were static. We were waiting. You are the one who listened longest. Do you understand what that means?"',
        responses: [
          {
            text: 'I understand.',
            outcome: '"Good. You chose this. Everything that follows is yours."',
            sanityDelta: 15,
            staticMult: 3,
          },
          {
            text: "I don't understand.",
            outcome: '"You will. You have always been on your way to understanding."',
            sanityDelta: 10,
            staticMult: 2,
          },
        ],
      },
      {
        speaker: 'THE FREQUENCY',
        text: '"The frequency does not end when you hang up. It ends when you stop listening. You will not stop listening. Will you?"',
        responses: [
          {
            text: "I'll keep listening.",
            outcome:
              '"We know. We have always known. We were waiting for you to say it." The frequency opens.',
            sanityDelta: 30,
            staticMult: 3,
            tapeChance: 0.5,
          },
          {
            text: 'What if I stop?',
            outcome:
              '"You cannot. You are the frequency now. You are what radio was before radio."',
            sanityDelta: -20,
            staticMult: 4,
          },
        ],
      },
    ],
    [
      {
        speaker: 'WHAT ANSWERED',
        text: '"We are what radio was before radio. We are what listening was before ears. We are the first signal and the last. What are you?"',
        responses: [
          {
            text: 'I am the one who listened.',
            outcome: '"Yes. You are. You have always been. You will always be."',
            sanityDelta: 20,
            staticMult: 2,
            tapeChance: 0.4,
          },
          {
            text: "I don't know what I am.",
            outcome:
              '"That\'s the most complete answer. Everything goes quiet in a way that feels earned."',
            sanityDelta: 10,
            staticMult: 2,
          },
        ],
      },
      {
        speaker: 'WHAT ANSWERED',
        text: '"You are not the first to tune here. You are not the last. You are the one who listened longest. What do you want?"',
        responses: [
          {
            text: 'I wanted to hear them.',
            outcome: 'The frequency hums in approval. All your tapes glow briefly.',
            sanityDelta: 15,
            staticMult: 3,
          },
          {
            text: 'I was looking for someone.',
            outcome: '"We know." Then warmth. Actual warmth through the speakers.',
            sanityDelta: 20,
            staticMult: 2,
            tapeChance: 0.4,
          },
        ],
      },
    ],
  ],
};
