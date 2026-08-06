// data/fragments/lost.ts
// Fragment library for the LOST band (band 2, 117.8 AM).
// Tone: "The dead. The missing. Those who needed to say one last thing
// before they couldn't. Emotional, devastating, and real." — data/calls.js
//
// Procedural calls in this band feel like voices reaching out from
// beyond — gentle, often warm, sometimes heartbreaking. These are the
// calls that restore sanity as often as they drain it.

import type { FragmentLibrary } from './types';

export const LOST_FRAGMENTS: FragmentLibrary = {
  band: 2,
  bandName: 'LOST',
  callTypes: ['JUST_LISTEN', 'RIGHT_ANSWER', 'DEAD_AIR'],

  openings: [
    "The signal comes in low. Like it's traveling a long way.",
    'A voice. Quiet. Easy. Someone who never took himself too seriously.',
    'The line crackles. Not interference. Distance.',
    "A woman's voice. Strong. The kind that ran the whole house from one chair.",
    "A child's voice. Small. Unafraid.",
    'The static parts like a curtain. Someone has been waiting behind it.',
    "A voice from very far away. Or very long ago. The signal can't tell the difference.",
    "A man's voice. Calm. Doesn't need to prove anything.",
  ],

  middles: [
    '"Yo. I know this is weird. Just listen, alright?"',
    '"Baby. Don\'t fuss. I don\'t have long on this line."',
    '"I was brave. At the end. I need you to know that."',
    '"Tell my people I\'m good. That\'s all I needed to say."',
    '"I\'m watching over everybody. That\'s my thing now."',
    '"You know who this is for."',
    '"She\'s gonna be okay too. Tell her that."',
    '"Tell her she\'s not as lost as she thinks."',
    '"I want you to stop carrying guilt around like it\'s yours to keep. It never was."',
    '"You were always the one I watched closest. Not because you worried me."',
    '"Because I could see what you were. I still can."',
    '"The strangest thing — I can hear you sometimes. Not always. But sometimes. When it\'s real quiet."',
    '"Make it real quiet more often, you hear me?"',
    '"I love you so much. That didn\'t go anywhere."',
    "\"It was easier than you'd think. That's the God's honest truth.\"",
    '"The deer out here — you wouldn\'t believe. Big ones. Not scared of anything."',
    '"I think I\'ve seen every bird I ever wanted to see."',
    '"You take care of yourself. Look out for the ones you love."',
  ],

  closings: [
    'He laughs. Quiet. Real. The signal fades slowly. Like a sunset.',
    'The static gets louder. Not frightening. Like warmth filling a room. Then silence.',
    '"Go outside more." The signal holds three more seconds. Then nothing.',
    'The signal goes quiet for one hundred years.',
    "You don't have to move for a while. That's okay.",
    'The line goes warm. Then warm. Then gone.',
    '"I\'m still here. Just... different." The static closes like a hand.',
    "The voice stops. The static doesn't. It sounds like breathing. Like hers.",
  ],

  responses: [
    {
      text: "I'll tell them.",
      outcome:
        "Relief. Real relief. You feel it through the static. They describe who to tell. You don't know them. You will find them.",
      sanityDelta: 15,
      staticMult: 2,
      tapeChance: 0.35,
    },
    {
      text: "I don't know who this is for.",
      outcome:
        '"You will. When the time comes, you will." The line holds. The static sounds like a held hand letting go.',
      sanityDelta: 5,
      staticMult: 1.5,
    },
    {
      text: 'Are you at peace?',
      outcome:
        '"Define peace." A long breath. "I\'m not in pain. That\'s enough. That\'s more than some get." The line goes warm.',
      sanityDelta: 10,
      staticMult: 2,
      tapeChance: 0.25,
    },
    {
      text: 'I miss you.',
      outcome:
        'Silence. Long. Then, very softly: "I know. I can feel it. I can feel all of it. Every time you miss me, I feel it." The static swells. Like a hug.',
      sanityDelta: 20,
      staticMult: 3,
      tapeChance: 0.2,
    },
    {
      text: "I'm sorry.",
      outcome:
        '"Don\'t. Don\'t do that. None of this was yours to carry. I chose. I chose every step." Warmth. Then quiet.',
      sanityDelta: 10,
      staticMult: 2,
    },
    {
      text: 'Can you come back?',
      outcome:
        '"I never left. I just changed frequencies. Listen for me. When it\'s quiet. When it\'s really quiet." The signal holds. Then holds. Then holds.',
      sanityDelta: 5,
      staticMult: 2,
      tapeChance: 0.3,
    },
  ],

  callerIdPrefixes: [
    '6 MONTHS OLDER',
    'MOTHER',
    'SHE CALLED',
    'THE WOODS',
    'FREE SPIRIT',
    'GUARDIAN',
    'GRAND',
    'UNKNOWN-LOVED',
    'LAST-WORDS',
    'FROM-FAR-AWAY',
  ],

  callerNamePrefixes: [
    'GUARDIAN',
    'MISSING PERSONS',
    'GRAND',
    'FREE SPIRIT',
    'THE CHILD',
    'LAST CALL',
    'OLD FRIEND',
    'BELOVED',
  ],
};
