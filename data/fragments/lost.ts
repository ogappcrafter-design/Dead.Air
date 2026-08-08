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
  callTypes: [
    'JUST_LISTEN',
    'RIGHT_ANSWER',
    'DEAD_AIR',
    'RECORDING',
    'MULTI_CALLER',
    'TIMING',
    'PUZZLE',
    'CONVERSATION',
  ],

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

  recordingClips: [
    {
      audioLabel: 'LAST_VOICEMAIL_0621',
      metadata: [
        'Final message left on birthday',
        'Background: birds and wind',
        'Voice is calm, unafraid',
        'Duration: 3 minutes 47 seconds',
      ],
    },
    {
      audioLabel: 'FOUND_TAPE_WOODS',
      metadata: [
        'Recovered from hiking trail',
        'Contains laughter and quiet talking',
        'No one is identified',
        'Tape stops mid-sentence',
      ],
    },
    {
      audioLabel: 'BEDSIDE_RECORDING',
      metadata: [
        'Recorded in final hours',
        'Voice is gentle, addressing family by name',
        'Background: hospital monitors fading',
        'Ends with "I love you so much"',
      ],
    },
    {
      audioLabel: 'ANSWERING_MACHINE_FINAL',
      metadata: [
        'Left for someone who never checked it',
        'Voice knows this is the last call',
        'Says "don\'t carry this for me"',
        'Magnetic tape still warm',
      ],
    },
  ],

  speakerPairs: [
    { voiceId: 0, name: 'THE FATHER' },
    { voiceId: 1, name: 'THE SON' },
    { voiceId: 0, name: 'THE MOTHER' },
    { voiceId: 1, name: 'THE DAUGHTER' },
    { voiceId: 0, name: 'THE FRIEND' },
    { voiceId: 1, name: 'THE ONE LEFT BEHIND' },
  ],

  beatMaps: [
    [
      { timestampMs: 0, type: 'TAP' as const },
      { timestampMs: 700, type: 'TAP' as const },
      { timestampMs: 1400, type: 'HOLD' as const, holdDurationMs: 600 },
      { timestampMs: 2100, type: 'TAP' as const },
    ],
    [
      { timestampMs: 0, type: 'HOLD' as const, holdDurationMs: 1000 },
      { timestampMs: 1100, type: 'TAP' as const },
      { timestampMs: 1800, type: 'TAP' as const },
      { timestampMs: 2500, type: 'TAP' as const },
    ],
  ],

  cipherLayers: [
    {
      encoded: 'WKHQ BRX DUH UHDGB KLPP',
      solution: 'THEN YOU ARE READY HIM',
      hint: 'Caesar shift: +3',
    },
    { encoded: 'HOOBRXZKHQLWVTXLHW', solution: 'ALLYOUWHENITSQUIET', hint: 'Caesar shift: +3' },
    {
      encoded: 'BRX NQRZ ZKR WKLV LV IRU',
      solution: 'YOU KNOW WHO THIS IS FOR',
      hint: 'Caesar shift: +3',
    },
    {
      encoded: 'FRPH VRRQHU GRQW ZDLW',
      solution: 'COME SOONER DONT WAIT',
      hint: 'Caesar shift: +3',
    },
  ],

  dialogueTrees: [
    [
      {
        speaker: 'THE FATHER',
        text: '"Yo. I know this is weird. Just listen, alright? I don\'t have long on this line."',
        responses: [
          {
            text: "I'm listening.",
            outcome:
              'He breathes out. Relieved. "Good. That\'s all I needed. You were always the best listener." The static softens.',
            sanityDelta: 15,
            staticMult: 2,
            tapeChance: 0.3,
          },
          {
            text: 'Who is this?',
            outcome:
              'Silence. Then, quietly: "You know. You\'ve always known." The signal wavers. You do know.',
            sanityDelta: 5,
            staticMult: 1.5,
          },
        ],
      },
      {
        speaker: 'THE FATHER',
        text: '"Tell my people I\'m good. That\'s all I needed to say."',
        responses: [
          {
            text: "I'll tell them.",
            outcome:
              'Relief. Real relief. You feel it through the static. He describes who to tell. You will find them.',
            sanityDelta: 15,
            staticMult: 2,
            tapeChance: 0.35,
          },
          {
            text: 'They already know.',
            outcome:
              '"Maybe they do. Maybe they always did." Warmth. Like a hand on your shoulder. Then quiet.',
            sanityDelta: 10,
            staticMult: 2,
            tapeChance: 0.2,
          },
        ],
      },
    ],
    [
      {
        speaker: 'THE MOTHER',
        text: '"Baby. Don\'t fuss. I don\'t have long on this line. But I need you to hear this."',
        responses: [
          {
            text: "I'm here, Mom.",
            outcome:
              'She laughs. It sounds like sunlight through a kitchen window. "I know you are. I\'ve always known." The static holds.',
            sanityDelta: 20,
            staticMult: 3,
            tapeChance: 0.3,
          },
          {
            text: 'I miss you.',
            outcome:
              'Silence. Long. Then: "I know. I can feel it. Every time you miss me, I feel it." The static swells. Like a hug.',
            sanityDelta: 20,
            staticMult: 3,
            tapeChance: 0.2,
          },
        ],
      },
      {
        speaker: 'THE MOTHER',
        text: '"You take care of yourself. Look out for the ones you love. And stop carrying guilt around like it\'s yours to keep."',
        responses: [
          {
            text: "I'll try.",
            outcome:
              '"That\'s all I ever asked." The line goes warm. Then warm. Then gone. You feel lighter.',
            sanityDelta: 10,
            staticMult: 2,
          },
          {
            text: "I can't promise that.",
            outcome:
              '"I know. I know you can\'t. But I had to say it." She sounds like she\'s smiling. "I\'ll keep saying it. Every time it\'s quiet."',
            sanityDelta: 8,
            staticMult: 2,
            tapeChance: 0.25,
          },
        ],
      },
    ],
  ],
};
