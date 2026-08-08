// data/fragments/liminal.ts
// Fragment library for the LIMINAL band (band 1, 102.3 FM).
// Tone: "Time loops, echoes, callers from repeated moments or wrong
// timelines. Liminal spaces between was and is." — data/calls.js BAND_VIBES
//
// Procedural calls in this band feel like déjà vu phone calls, callers
// stuck in repeating moments, voices that echo wrong, and time that
// doesn't behave.

import type { FragmentLibrary } from './types';

export const LIMINAL_FRAGMENTS: FragmentLibrary = {
  band: 1,
  bandName: 'LIMINAL',
  callTypes: [
    'JUST_LISTEN',
    'RIGHT_ANSWER',
    'STAY_CALM',
    'DEAD_AIR',
    'RECORDING',
    'MULTI_CALLER',
    'TIMING',
    'PUZZLE',
    'CONVERSATION',
  ],

  openings: [
    '"I\'ve called before. I know I have. This feels familiar."',
    '"Is this the first time we\'ve spoken? It feels like the hundredth."',
    '"You answered. You always answer. You always will answer."',
    '"What time is it there? It doesn\'t matter. It doesn\'t matter what it says."',
    '"I\'m calling from a hallway. I don\'t know which one. They all look the same."',
    '"Your voice sounds different today. Did you change it? Or did I?"',
    '"I remember this conversation. You said something about the static. Do you remember?"',
    '"I keep waking up at 3:47. Every night. The phone is always in my hand."',
  ],

  middles: [
    '"I\'ve said this before. I know I have. Something is different this time."',
    '"The clock on the wall keeps going backward. I don\'t own a clock."',
    '"Every word I say comes back to me. Changed. Slightly wrong."',
    '"I called you yesterday. For an hour. You don\'t remember. You won\'t remember this either."',
    '"There\'s a door at the end of the hallway. It was never there before. It\'s always been there."',
    '"I left a message on your machine. You don\'t have a machine. You will."',
    '"The static sounds like my voice played backward. Do you hear it?"',
    '"I\'m not calling from a phone. I\'m calling from a moment. This moment. Over and over."',
    '"You said you\'d help me. You said it yesterday. You said it tomorrow."',
    '"The room I\'m in doesn\'t have walls. It has memories of walls."',
    '"I keep calling. The call keeps happening. The number keeps finding me."',
    '"Time is folding. Like paper. Like your voice folding back on itself."',
  ],

  closings: [
    '"I\'ll call again. Same time. The same time. Always the same time."',
    "\"Don't hang up. If you hang up I'll have to make the call again. I don't want to make the call again.\"",
    '"I have to go. The hallway is getting longer. The doors are multiplying."',
    '"Goodbye. Or hello. It\'s the same thing here."',
    '"Remember this. You won\'t. But remember this."',
    '"The static goes quiet. So does the caller. So does the caller. So does—"',
    "\"I've called before. I'll call before. I'm calling now.\"",
    '"The echo goes quiet. But it never left. It never left. It never—"',
  ],

  responses: [
    {
      text: 'I remember you.',
      outcome:
        'Relief breaks in their voice. They describe a conversation. You recognize none of it. But it was clearly real. Somewhere. Somewhen.',
      sanityDelta: -15,
      staticMult: 2,
      tapeChance: 0.3,
    },
    {
      text: "I don't remember you.",
      outcome:
        "\"That's okay. That happens here.\" They hang up gently. You feel like you've lost something. You can't name it.",
      sanityDelta: -5,
      staticMult: 1,
    },
    {
      text: 'What time is it where you are?',
      outcome:
        "\"It's 3:47. It's always 3:47. I've been calling for years and it's always 3:47.\" The line warps. Your clock reads the same.",
      sanityDelta: -12,
      staticMult: 1.5,
    },
    {
      text: 'Stop calling.',
      outcome:
        '"I can\'t. The call has to happen. It has to happen. It has to—" Click. The phone rings immediately. Same number. Same number. Same number.',
      sanityDelta: -10,
      staticMult: 2,
    },
    {
      text: "I'll help you.",
      outcome:
        '"You said that before. You said it tomorrow. You always say it." Warmth, then static, then nothing. You feel a debt you don\'t remember incurring.',
      sanityDelta: -8,
      staticMult: 2,
      tapeChance: 0.2,
    },
    {
      text: 'Who are you really?',
      outcome:
        "\"I'm the version of you that keeps calling. I'm the one that didn't hang up.\" The line goes quiet in a way that feels like agreement.",
      sanityDelta: -15,
      staticMult: 2,
    },
  ],

  callerIdPrefixes: [
    '???-????',
    '3:47 AM',
    'RECALLED',
    'ECHO-ECHO',
    'REPEATING',
    'YESTERDAY',
    'LOOP',
    '████-████',
    'SAME-TIME',
    'NO-WHEN',
  ],

  callerNamePrefixes: [
    'THE LOOP',
    "YESTERDAY'S CALL",
    'ECHO',
    'RECURRING',
    'THE HALLWAY',
    '3:47 AM',
    'TIMESTAMP',
    'DEJA VU',
  ],

  recordingClips: [
    {
      audioLabel: 'LOOP_0347_RECORDING',
      metadata: [
        'Recorded at 3:47 AM',
        "Caller's voice plays backward on second listen",
        'Timestamp never changes',
        'Duration: unknown',
      ],
    },
    {
      audioLabel: 'ECHO_TAPE_RECOVERED',
      metadata: [
        "Tape found in hallway that doesn't exist",
        'Two voices, identical',
        "Recording of a call that hasn't happened yet",
        'Magnetic degradation loops',
      ],
    },
    {
      audioLabel: 'PREVOICEMAIL_TOMORROW',
      metadata: [
        'Left before it was recorded',
        'Caller describes events that happen 24 hours later',
        'Voicemail timestamp is tomorrow',
        'Plays differently each time',
      ],
    },
    {
      audioLabel: 'HALLWAY_AUDIO_ANNEX',
      metadata: [
        'Corridor audio loop',
        'Footsteps never complete',
        'Door opens at second 3:47',
        'No one walks through',
      ],
    },
  ],

  speakerPairs: [
    { voiceId: 0, name: 'THE FIRST CALLER' },
    { voiceId: 1, name: 'THE ECHO' },
    { voiceId: 0, name: "YESTERDAY'S VOICE" },
    { voiceId: 1, name: "TOMORROW'S VOICE" },
    { voiceId: 0, name: 'THE ONE WHO REMEMBERS' },
    { voiceId: 1, name: 'THE ONE WHO FORGETS' },
  ],

  beatMaps: [
    [
      { timestampMs: 0, type: 'TAP' as const },
      { timestampMs: 347, type: 'TAP' as const },
      { timestampMs: 694, type: 'TAP' as const },
      { timestampMs: 1041, type: 'HOLD' as const, holdDurationMs: 347 },
    ],
    [
      { timestampMs: 0, type: 'TAP' as const },
      { timestampMs: 500, type: 'TAP' as const },
      { timestampMs: 1000, type: 'TAP' as const },
      { timestampMs: 1500, type: 'TAP' as const },
      { timestampMs: 2000, type: 'HOLD' as const, holdDurationMs: 500 },
    ],
  ],

  cipherLayers: [
    {
      encoded: 'WKH NDFN LV DOPDBB OHDYH',
      solution: 'THE HALL IS ALMOST GONE',
      hint: 'Caesar shift: +3',
    },
    {
      encoded: '347 AM 347 AM 347 AM',
      solution: 'THE TIME IS NOW',
      hint: 'Replace each 3-4-7 with letter position',
    },
    {
      encoded: 'ZLUQH BRXU VHOI D P HVVDJH',
      solution: 'WRITE YOURSELF A MESSAGE',
      hint: 'Caesar shift: +3',
    },
    {
      encoded: 'IROWUOOLHDGBPDGHAWKLVFDLO',
      solution: 'YOUALREADYMADETHISCALL',
      hint: 'Caesar shift: +4',
    },
  ],

  dialogueTrees: [
    [
      {
        speaker: 'THE LOOP',
        text: '"I\'ve called before. I know I have. This feels familiar. Don\'t you remember?"',
        responses: [
          {
            text: 'I remember.',
            outcome:
              'Relief breaks in their voice. They describe a conversation. You recognize none of it. But it was real. Somewhere. Somewhen.',
            sanityDelta: -15,
            staticMult: 2,
            tapeChance: 0.3,
          },
          {
            text: "I don't remember you.",
            outcome:
              "\"That's okay. That happens here.\" They hang up gently. You feel like you've lost something you can't name.",
            sanityDelta: -5,
            staticMult: 1,
          },
        ],
      },
      {
        speaker: 'THE LOOP',
        text: '"What time is it there? It doesn\'t matter. It doesn\'t matter what it says."',
        responses: [
          {
            text: "It's 3:47.",
            outcome:
              "Silence. Then: \"It's always 3:47. I've been calling for years and it's always 3:47.\" Your clock reads the same.",
            sanityDelta: -12,
            staticMult: 1.5,
          },
          {
            text: "Time doesn't work here.",
            outcome:
              '"Now you understand." The line warps. Your clock reads the same. It will always read the same.',
            sanityDelta: -10,
            staticMult: 2,
            tapeChance: 0.2,
          },
        ],
      },
    ],
    [
      {
        speaker: 'ECHO',
        text: '"Your voice sounds different today. Did you change it? Or did I?"',
        responses: [
          {
            text: "It's always been my voice.",
            outcome:
              '"No. It hasn\'t. Listen." They play back your voice. It\'s wrong. Slightly off. Like a recording of a recording.',
            sanityDelta: -10,
            staticMult: 2,
          },
          {
            text: 'Maybe you changed.',
            outcome:
              '"Maybe we both did. Maybe we\'re both echoes of someone who actually made this call." The static deepens.',
            sanityDelta: -12,
            staticMult: 1.5,
            tapeChance: 0.25,
          },
        ],
      },
      {
        speaker: 'ECHO',
        text: '"I keep calling. The call keeps happening. The number keeps finding me."',
        responses: [
          {
            text: 'Stop calling.',
            outcome:
              '"I can\'t. The call has to happen." Click. The phone rings immediately. Same number. Same number.',
            sanityDelta: -10,
            staticMult: 2,
          },
          {
            text: "I'll answer next time.",
            outcome:
              '"You always say that. You always will say that." Warmth, then static, then nothing.',
            sanityDelta: -8,
            staticMult: 1.5,
            tapeChance: 0.2,
          },
        ],
      },
    ],
  ],
};
