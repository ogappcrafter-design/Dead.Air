// data/fragments/living.ts
// Fragment library for the LIVING band (band 0, 88.7 FM).
// Tone: "Eerily normal callers. Mundane conversations that reveal
// something deeply wrong in the last line. Suburban horror. The
// banal made sinister." — data/calls.js BAND_VIBES
//
// Procedural calls in this band should feel like wrong-number calls
// from neighbors who are not quite right, mundane confessions that
// curdle in the last sentence, and quiet domestic horrors.

import type { FragmentLibrary } from './types';

export const LIVING_FRAGMENTS: FragmentLibrary = {
  band: 0,
  bandName: 'LIVING',
  callTypes: ['JUST_LISTEN', 'RIGHT_ANSWER', 'DEAD_AIR'],

  openings: [
    '"Hello? Sorry, I know it\'s late."',
    '"Oh — you picked up. I almost hung up."',
    '"Is this the station? The one that plays at night?"',
    '"I\'m not sure who I meant to call. But I\'m glad you answered."',
    '"You\'re the DJ, right? The one everyone listens to?"',
    '"I found your number written on a napkin in my kitchen. I don\'t remember writing it."',
    '"Sorry. Wrong number. But can I ask you something anyway?"',
    '"My radio turned itself on. It tuned to your station. I haven\'t had a radio in twelve years."',
  ],

  middles: [
    '"My wife\'s been asleep for hours. She sleeps so well now."',
    '"The neighbors put up new fence. We didn\'t ask them to."',
    '"I keep finding things in the attic I don\'t remember buying."',
    '"My son\'s room is exactly how he left it. He\'s thirty-four now."',
    '"The dog won\'t go in the backyard anymore. Not since Tuesday."',
    '"I heard someone in the kitchen at 3 AM. It was me. I was making tea for two."',
    '"There\'s a photo of our wedding on the mantle. I don\'t recognize anyone in it."',
    '"My daughter called this morning. She sounded so grown up. She\'s been gone since \'09."',
    '"The mailman doesn\'t come by anymore. We still get letters."',
    '"I set the table for four last night. There are only two of us. There have only ever been two."',
    "\"I cleaned out the garage. Found a box marked 'hers'. I don't know whose.\"",
    '"The baby monitor picks up your station. The baby\'s been gone nine months."',
  ],

  closings: [
    '"Well. Good night. Sorry to bother you."',
    '"Thank you for listening. No one does anymore."',
    '"I\'ll let you go. The lights just went out in the hallway."',
    '"Sorry. I should hang up. She\'s awake now. She doesn\'t like when I talk on the phone."',
    '"Good night. Don\'t tell anyone I called."',
    '"I\'ll call again. Same time. If I remember."',
    '"...there\'s someone at the door. I didn\'t order anything."',
    '"Good night. Tell your wife I said hello. You don\'t have a wife? ...Yes you do."',
  ],

  responses: [
    {
      text: 'Stay on the line.',
      outcome:
        "They breathe out, relieved. The static settles. You hear a door close somewhere in their house. It shouldn't be audible.",
      sanityDelta: -5,
      staticMult: 1.5,
      tapeChance: 0.3,
    },
    {
      text: 'You should hang up now.',
      outcome:
        '"Yeah. Yeah, you\'re right." The line goes quiet. Then, softly: "I don\'t think I can."',
      sanityDelta: -8,
      staticMult: 2,
    },
    {
      text: 'Call back tomorrow.',
      outcome:
        '"I will. Same time. The kitchen light will be on." Click. You look at your kitchen light. It is on.',
      sanityDelta: -3,
      staticMult: 1.5,
      tapeChance: 0.2,
    },
    {
      text: 'Who gave you this number?',
      outcome:
        '"Nobody. I just... knew it. Like the address of a house I used to live in." The line goes cold.',
      sanityDelta: -10,
      staticMult: 2,
    },
    {
      text: "I'm calling the police.",
      outcome: '"There\'s no crime here. Not yet." A long pause. "Not yet." Click.',
      sanityDelta: -7,
      staticMult: 1.5,
    },
    {
      text: 'Are you okay?',
      outcome:
        '"Define okay." A small laugh, like a leaf being stepped on. "I think so. Ask me again tomorrow."',
      sanityDelta: -2,
      staticMult: 1.5,
      tapeChance: 0.25,
    },
  ],

  callerIdPrefixes: [
    'UNKNOWN',
    'PRIVATE',
    '555-####',
    'BLOCKED',
    'NO-CALLER-ID',
    '1-800-███-████',
    'OUT-OF-AREA',
    'WIRELESS',
  ],

  callerNamePrefixes: [
    'THE NEIGHBOR',
    'CONCERNED CALLER',
    'WAKEFUL SOUL',
    'QUIET VOICE',
    'DOMESTIC NOISE',
    'INSOMNIAC',
    'POLITE STRANGER',
    'CONFESSION',
  ],
};
