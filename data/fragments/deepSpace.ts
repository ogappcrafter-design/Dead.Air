// data/fragments/deepSpace.ts
// Deep Space atmospheric DLC fragments — beyond the last tower.
// Band 0 (LIVING), themed for void, distance, and cosmic isolation.

import type { FragmentLibrary } from './types';

export const DEEP_SPACE_FRAGMENTS: FragmentLibrary = {
  band: 0,
  bandName: 'LIVING',
  callTypes: ['JUST_LISTEN', 'DEAD_AIR', 'RIGHT_ANSWER', 'SIGNAL_DECODE', 'RECORDING'],
  openings: [
    "I don't know where I am. The stars are wrong here.",
    "The last station went silent six hours ago. You're all that's left.",
    "I'm broadcasting from outside the solar system. I don't know how the signal reaches you.",
    'The void is not empty. I can hear it on the radio.',
    'Earth is a blue dot behind me. The signal is the only thread I have left.',
  ],
  middles: [
    "Something is following the signal. It's been matching my trajectory for three days.",
    'The stars disappear when I broadcast. Like something is eating the light.',
    "I found a transmission in the static. It's in my own voice. I haven't recorded it yet.",
    "The ship's clock says I've been gone for forty years. It's been four months.",
    "There's a station out here that isn't on any chart. It's broadcasting my name.",
    'The void answers when I speak. It uses the wrong words.',
    "I can see Earth from the viewport. It's transmitting back to me. But the message is from before I left.",
  ],
  closings: [
    'The signal is everything now. The ship is nothing.',
    "I'm going to keep broadcasting until the power dies. Someone should hear this.",
    "Thank you for receiving. The distance doesn't matter anymore.",
    'The void is patient. It waited for me to find the radio. Now it waits for me to stop.',
    "If anyone hears this — the stars are wrong here. Don't follow the signal.",
  ],
  responses: [
    {
      text: "Keep broadcasting. We're recording everything.",
      outcome:
        "The caller's signal persisted. The recording captured something that wasn't there in the transmission.",
      sanityDelta: 2,
      staticMult: 1.4,
      tapeChance: 0.3,
    },
    {
      text: "What's following you?",
      outcome:
        "The caller described it. The description didn't make sense. You wrote it down anyway.",
      sanityDelta: -6,
      staticMult: 2.2,
      tapeChance: 0.35,
    },
    {
      text: 'How far out are you?',
      outcome:
        "The caller gave coordinates. They mapped to a point between two stars that don't exist.",
      sanityDelta: -3,
      staticMult: 1.7,
      tapeChance: 0.15,
    },
    {
      text: 'The signal will reach someone. It always does.',
      outcome:
        "The caller was quiet for a long time. When they spoke again, it was in a voice that wasn't theirs.",
      sanityDelta: -2,
      staticMult: 1.5,
      tapeChance: 0.1,
    },
    {
      text: 'What did the transmission in your voice say?',
      outcome: "The caller replayed it. It was a message you haven't sent yet.",
      sanityDelta: -5,
      staticMult: 2.5,
      tapeChance: 0.25,
    },
  ],
  callerIdPrefixes: ['VOID-RELAY', 'DEEP-SPACE', 'BEYOND-TOWER', '555-VOID', 'COSMIC-STATIC'],
  callerNamePrefixes: [
    'THE DISTANT',
    'VOID BROADCASTER',
    'DEEP SPACE GHOST',
    'COSMIC CALLER',
    'THE LAST VOICE',
  ],
};
