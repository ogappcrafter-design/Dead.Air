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
  callTypes: ['JUST_LISTEN', 'RIGHT_ANSWER', 'DEAD_AIR'],

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
};
