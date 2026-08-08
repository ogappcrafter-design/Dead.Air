// data/fragments/rainNight.ts
// Rain Night atmospheric DLC fragments — calls from the storm.
// Band 0 (LIVING), themed for rain and flooded signals.

import type { FragmentLibrary } from './types';

export const RAIN_NIGHT_FRAGMENTS: FragmentLibrary = {
  band: 0,
  bandName: 'LIVING',
  callTypes: ['JUST_LISTEN', 'DEAD_AIR', 'RIGHT_ANSWER', 'STAY_CALM'],
  openings: [
    "The rain's coming in through the antenna. Can you hear it?",
    "I'm calling from the flood zone. The water's rising and the signal's all I have left.",
    "Static and rainwater. That's all that's coming through tonight.",
    "You're the only station I can reach. The roads are gone.",
  ],
  middles: [
    'The rain sounds like someone tapping on the window. But I live on the fourteenth floor.',
    "My radio's battery is dying. The water got everything else.",
    "There's something moving in the rain. I can see it from the window.",
    'The signal keeps cutting out. Like the rain is washing it away.',
    "Nobody's answering the emergency channels. Just you.",
    'I found a radio in the attic. The whole house is underwater now.',
  ],
  closings: [
    "The rain stopped. But the signal's still here.",
    "I think the water's receding. Thank you for staying on the line.",
    "The antenna's gone now. But I heard everything. I heard you.",
    "Don't go. The rain's starting again.",
  ],
  responses: [
    {
      text: "Stay on the line. I'll keep the signal open.",
      outcome: "The caller's voice steadied. The rain continued, but so did the connection.",
      sanityDelta: 2,
      staticMult: 1.2,
      tapeChance: 0.15,
    },
    {
      text: 'Tell me what you see in the rain.',
      outcome: "The caller described shapes in the downpour. You wish you hadn't heard.",
      sanityDelta: -4,
      staticMult: 1.8,
      tapeChance: 0.25,
    },
    {
      text: 'Is anyone else alive in your building?',
      outcome: 'The caller went quiet. The rain filled the silence for a long time.',
      sanityDelta: -2,
      staticMult: 1.4,
      tapeChance: 0.1,
    },
    {
      text: 'The storm will pass. They always do.',
      outcome: "The caller laughed. It wasn't a comforting sound.",
      sanityDelta: -1,
      staticMult: 1.1,
    },
  ],
  callerIdPrefixes: ['FLOOD-ZONE', 'STORM-RELAY', 'RAIN-PRIVATE', '555-RAIN'],
  callerNamePrefixes: ['THE DROWNED', 'STORM CALLER', 'FLOOD WATCHER', 'RAIN GHOST'],
};
