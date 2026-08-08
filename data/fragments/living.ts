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
    '"I rearranged the furniture. The room looks bigger now. Something has more space."',
    '"The thermostat keeps setting itself to 62. Nobody likes 62. Nobody I can see."',
    '"My alarm clock goes off at 6:47 every morning. I haven\'t set an alarm in four years."',
    '"The neighbor\'s kid drew our house for a school project. There were five people in the drawing. There are two of us."',
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

  recordingClips: [
    {
      audioLabel: 'ANSWERING_MACHINE_0247',
      metadata: [
        'Call logged at 2:47 AM',
        'Caller ID blocked',
        'Background: kitchen faucet running',
        'Voice matches homeowner',
      ],
    },
    {
      audioLabel: 'BABY_MONITOR_NIGHT4',
      metadata: [
        'No infant in residence',
        'Recorded from empty crib',
        'Whispered: "go back to sleep"',
        'Duration exceeds monitor capacity',
      ],
    },
    {
      audioLabel: 'DRIVEWAY_CAM_2317',
      metadata: [
        'Vehicle never arrives',
        'Garage opens untriggered',
        'Figure enters through front door',
        'No exit recorded',
      ],
    },
    {
      audioLabel: 'VOICEMAIL_LOOP_7',
      metadata: [
        'Identical message left 7 times',
        'All timestamps identical',
        'Caller voice matches machine owner',
        'Tape degrades with each repeat',
      ],
    },
  ],

  speakerPairs: [
    { voiceId: 0, name: 'THE WIFE' },
    { voiceId: 1, name: 'THE OTHER' },
    { voiceId: 0, name: 'THE NEIGHBOR' },
    { voiceId: 1, name: 'SOMEONE IN HIS VOICE' },
    { voiceId: 0, name: 'THE MOTHER' },
    { voiceId: 1, name: 'THE DAUGHTER' },
  ],

  beatMaps: [
    [
      { timestampMs: 0, type: 'TAP' as const },
      { timestampMs: 600, type: 'TAP' as const },
      { timestampMs: 1200, type: 'TAP' as const },
      { timestampMs: 1800, type: 'HOLD' as const, holdDurationMs: 400 },
    ],
    [
      { timestampMs: 0, type: 'TAP' as const },
      { timestampMs: 800, type: 'HOLD' as const, holdDurationMs: 300 },
      { timestampMs: 1400, type: 'TAP' as const },
      { timestampMs: 2200, type: 'TAP' as const },
    ],
  ],

  cipherLayers: [
    { encoded: 'EHJRZLQ KWVSZ', solution: 'BEDROOM WINDOW', hint: 'Each letter shifted by +3' },
    {
      encoded: 'VJKU KU QPF VJGP VJGP',
      solution: 'THIS IS NOT THEM THEM',
      hint: 'Each letter shifted by +2',
    },
    { encoded: 'ZIFUZ WKWHPOAW', solution: 'CLOSE BACKYARD', hint: 'Caesar shift: -4' },
    { encoded: 'WUYQAWJSIYWJ', solution: 'DONTOPENIT', hint: 'Caesar shift: +4' },
  ],

  dialogueTrees: [
    [
      {
        speaker: 'NEIGHBOR',
        text: '"You\'re new here, aren\'t you? I can tell. We all can."',
        responses: [
          {
            text: "I've lived here for years.",
            outcome: 'They smile. It doesn\'t reach their eyes. "Have you? Have you really?"',
            sanityDelta: -5,
            staticMult: 1.5,
          },
          {
            text: 'What do you mean "we"?',
            outcome:
              'They gesture at the dark houses. Every porch has someone standing on it. Watching.',
            sanityDelta: -8,
            staticMult: 2,
          },
        ],
      },
      {
        speaker: 'NEIGHBOR',
        text: '"The previous family left suddenly. You should check the basement."',
        responses: [
          {
            text: 'I already did.',
            outcome: '"Then you know." Click. The dial tone sounds like breathing.',
            sanityDelta: -10,
            staticMult: 2,
            tapeChance: 0.2,
          },
          {
            text: "I don't have a basement.",
            outcome:
              'Silence. "That\'s what they said too." The line goes cold. The floor creaks beneath you.',
            sanityDelta: -12,
            staticMult: 1.5,
          },
        ],
      },
    ],
    [
      {
        speaker: 'THE WIFE',
        text: '"I heard you on the phone last night. Who was that?"',
        responses: [
          {
            text: "I wasn't on the phone.",
            outcome:
              '"I heard your voice. Through the baby monitor. You were talking to someone." She sounds afraid. Of you.',
            sanityDelta: -10,
            staticMult: 2,
          },
          {
            text: 'Just a wrong number.',
            outcome:
              '"They knew your name." Long pause. "They knew mine too." The house settles. The walls listen.',
            sanityDelta: -8,
            staticMult: 1.5,
          },
        ],
      },
      {
        speaker: 'THE WIFE',
        text: '"The dog won\'t go in the backyard anymore. Did you do something to it?"',
        responses: [
          {
            text: "I haven't touched the backyard.",
            outcome:
              '"Something did. The grass grows in patterns now." She hangs up. You look out the window. It does.',
            sanityDelta: -12,
            staticMult: 2,
            tapeChance: 0.15,
          },
          {
            text: "Maybe it's just old.",
            outcome:
              'She laughs. "Nothing gets old in this neighborhood. Nothing stays dead either." The call ends.',
            sanityDelta: -10,
            staticMult: 1.5,
          },
        ],
      },
    ],
  ],
};
