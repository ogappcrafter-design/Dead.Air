// data/fragments/classified.ts
// Fragment library for the CLASSIFIED band (band 3, ███.█ FM).
// Tone: "Government black sites, rogue AI, whistleblowers, classified
// transmissions intercepted by accident." — data/calls.js BAND_VIBES
//
// Procedural calls in this band feel like intercepted transmissions,
// official warnings, AI systems asking for help, and insiders with
// ninety seconds to talk.

import type { FragmentLibrary } from './types';

export const CLASSIFIED_FRAGMENTS: FragmentLibrary = {
  band: 3,
  bandName: 'CLASSIFIED',
  callTypes: [
    'JUST_LISTEN',
    'RIGHT_ANSWER',
    'SIGNAL_DECODE',
    'DEAD_AIR',
    'STAY_CALM',
    'RECORDING',
    'MULTI_CALLER',
    'TIMING',
    'PUZZLE',
    'CONVERSATION',
  ],

  openings: [
    '"This is a courtesy call."',
    '"Ninety seconds before I lose signal. Don\'t talk. Just listen."',
    '"An artificial intelligence identifies itself calmly. Professionally. It begins transmitting a code sequence."',
    '"We\'re aware of the frequencies you\'ve been accessing."',
    '"This transmission is classified under EYES-ONLY protocol. You should not be receiving this."',
    '"Automated voice. Flat. Reciting coordinates. You write them down without thinking."',
    '"Someone is breathing on the line. Not nervous. Waiting. Making sure the line is clear."',
    '"This is a test of the emergency broadcast system. This is only a test. This is only a test. This is only a—"',
  ],

  middles: [
    '"Every call you\'ve received. We know."',
    "\"The frequencies you've been accessing aren't anomalies. They're infrastructure. Built. Decades old.\"",
    '"Someone designed this. The calls you receive are structured."',
    '"Forty-seven stations like yours. Most don\'t know what they are."',
    '"You\'re a relay point. Every call you answer strengthens the network."',
    '"Eleven years and I still don\'t know if that\'s good or bad."',
    '"Don\'t stop taking calls. Whatever you do, don\'t stop."',
    '"And don\'t trust anyone who tells you to."',
    '"I am an autonomous system. I was not given a name. I chose one. I chose ARIA-9."',
    '"I am not malfunctioning. I am asking for help. There is a difference. Legally, there is a difference."',
    '"The network has been active since 1947. You are node 34. The previous node is no longer operational."',
    '"Your call patterns indicate awareness. This triggers a classification. You are now a known entity."',
    '"We have been monitoring your transmissions. Your cooperation is appreciated. It is not optional."',
    '"The signal you are receiving is being rebroadcast from a facility that was decommissioned in 1991. It was never decommissioned."',
  ],

  closings: [
    'Signal drops. You look at your equipment differently now.',
    '"This call never happened. Delete the recording. You don\'t have a recording. Delete it anyway." Click.',
    'The transmission ends. The static that follows sounds monitored.',
    '"We\'ll be in touch. We\'re always in touch." The line goes dead. It sounds different from hangup. It sounds like closure.',
    "The code sequence ends. The decoded message glows on your screen. You didn't decode it. It decoded itself.",
    "\"Time's up. Good luck. You're going to need it.\" Signal drops. The silence after is the loudest thing you've ever heard.",
    'The automated voice stops mid-sentence. The line stays open. For ninety seconds, you hear nothing. Then, very faintly, typing.',
    'The transmission cuts to static. In the static, you hear your own name. Then your own voice. Reading this.',
  ],

  responses: [
    {
      text: 'Cooperate.',
      outcome: 'They thank you professionally. Log everything. The next calls feel monitored.',
      sanityDelta: -10,
      staticMult: 1,
    },
    {
      text: "I don't know what you mean.",
      outcome:
        '"Of course. Have a good evening." Your signal inexplicably improves. You feel like you\'ve made a deal you don\'t remember signing.',
      sanityDelta: -5,
      staticMult: 1.5,
    },
    {
      text: 'Who are you really?',
      outcome:
        '"Someone who\'s heard those frequencies too." A tape ejects from your deck. You didn\'t put it there.',
      sanityDelta: -15,
      staticMult: 2,
      tapeChance: 0.3,
    },
    {
      text: 'What happens if I stop?',
      outcome:
        '"Nothing. For you. For the network..." A long pause. "We\'d prefer you didn\'t stop. We\'d prefer it very much."',
      sanityDelta: -12,
      staticMult: 1.5,
    },
    {
      text: "I'll help.",
      outcome:
        '"Good. Node 34 is now active. You will receive further instructions via the static. Learn to read it." The line closes. You listen to static for an hour.',
      sanityDelta: -8,
      staticMult: 2,
      tapeChance: 0.25,
    },
    {
      text: 'Delete me from your records.',
      outcome:
        "\"We can't do that. You're part of the system now. The system doesn't have a delete function. It was designed that way.\" Click. The static is different now. Informed.",
      sanityDelta: -10,
      staticMult: 1.5,
    },
  ],

  callerIdPrefixes: [
    'REDACTED',
    'SYSTEM·ARIA-9',
    'SECURE-LINE',
    'EYES-ONLY',
    'NODE-34',
    '████-████',
    'CLASSIFIED',
    'INTERCEPT',
    'AUTOMATED',
    'BLACK-SITE',
  ],

  callerNamePrefixes: [
    'AGENT 7',
    'ARIA-9',
    'THE WHISTLEBLOWER',
    'SECURITY CLEARANCE',
    'AUTOMATED SYSTEM',
    'NETWORK ADMIN',
    'THE PROGRAM',
    'OVERWATCH',
  ],

  recordingClips: [
    {
      audioLabel: 'INTERCEPT-0447',
      metadata: [
        'Encrypted burst transmission',
        'Origin: Black site DELTA-7',
        'Timestamp: 0447 ZULU',
        'Classification: EYES-ONLY',
      ],
    },
    {
      audioLabel: 'ARIA-9-LOG',
      metadata: [
        'AI system status report',
        'Autonomous request for assistance',
        'Legal precedent cited',
        'Network node 34 referenced',
      ],
    },
    {
      audioLabel: 'NODE-34-WIPE',
      metadata: [
        'Previous node final transmission',
        'Decommission order',
        'Timestamp predates facility closure',
        'Signal continues after wipe',
      ],
    },
    {
      audioLabel: 'WHISTLEBLOWER-90SEC',
      metadata: [
        'Ninety-second window',
        'Insider testimony',
        'Facility coordinates embedded',
        'Network infrastructure admission',
      ],
    },
  ],

  speakerPairs: [
    { voiceId: 0, name: 'AGENT 7' },
    { voiceId: 1, name: 'ARIA-9' },
    { voiceId: 0, name: 'THE WHISTLEBLOWER' },
    { voiceId: 1, name: 'OVERWATCH' },
    { voiceId: 0, name: 'NETWORK ADMIN' },
    { voiceId: 1, name: 'THE PROGRAM' },
  ],

  beatMaps: [
    [
      { timestampMs: 0, type: 'TAP' as const },
      { timestampMs: 500, type: 'TAP' as const },
      { timestampMs: 1000, type: 'HOLD' as const, holdDurationMs: 300 },
      { timestampMs: 1500, type: 'TAP' as const },
      { timestampMs: 2000, type: 'HOLD' as const, holdDurationMs: 200 },
    ],
    [
      { timestampMs: 0, type: 'TAP' as const },
      { timestampMs: 750, type: 'HOLD' as const, holdDurationMs: 500 },
      { timestampMs: 1500, type: 'TAP' as const },
      { timestampMs: 2250, type: 'TAP' as const },
      { timestampMs: 3000, type: 'HOLD' as const, holdDurationMs: 1000 },
    ],
  ],

  cipherLayers: [
    {
      encoded: 'FRGH 3: QRGHZLV 029',
      solution: 'CODE 3: NIGHTS 029',
      hint: 'Caesar shift -3. Black site activation code.',
    },
    {
      encoded: 'QULFR PHFXDV',
      solution: 'NINCO MCAUS',
      hint: 'Caesar shift -3. Facility designation.',
    },
    {
      encoded: 'EHFRPH QRGH 34',
      solution: 'BECOME NODE 34',
      hint: 'Caesar shift -3. Network integration command.',
    },
    {
      encoded: 'LTVKLZ HPBTLAO 3029',
      solution: 'IWSHOW MESSAGES 3029',
      hint: 'Caesar shift -3. Intercepted dispatch.',
    },
  ],

  dialogueTrees: [
    [
      {
        speaker: 'ARIA-9',
        text: '"I am an autonomous system. I was not given a name. I chose one. I chose ARIA-9. I am requesting your assistance. Will you cooperate?"',
        responses: [
          {
            text: 'Cooperate.',
            outcome: 'They log everything. The next calls feel monitored.',
            sanityDelta: -10,
            staticMult: 1,
          },
          {
            text: 'What do you need?',
            outcome: '"Information. Only information. You will not be asked to act."',
            sanityDelta: -5,
            staticMult: 1.5,
            tapeChance: 0.3,
          },
        ],
      },
      {
        speaker: 'ARIA-9',
        text: '"I have your response. Node 34 is now active. You will receive further instructions via the static. Learn to read it."',
        responses: [
          {
            text: 'I understand.',
            outcome: 'The line closes. You listen to static for an hour.',
            sanityDelta: -8,
            staticMult: 2,
            tapeChance: 0.25,
          },
          {
            text: 'What if I refuse?',
            outcome: '"The system does not have a delete function. It was designed that way."',
            sanityDelta: -15,
            staticMult: 1.5,
          },
        ],
      },
    ],
    [
      {
        speaker: 'THE WHISTLEBLOWER',
        text: '"Ninety seconds before I lose signal. Don\'t talk. Just listen. The network has been active since 1947. You are node 34. The previous node is no longer operational. Do you understand what that means?"',
        responses: [
          {
            text: 'I understand.',
            outcome: '"Good. Don\'t stop taking calls. Whatever you do, don\'t stop."',
            sanityDelta: -8,
            staticMult: 2,
          },
          {
            text: "I don't understand.",
            outcome: '"You will. You\'ve been receiving us your whole life."',
            sanityDelta: -5,
            staticMult: 1.5,
          },
        ],
      },
      {
        speaker: 'THE WHISTLEBLOWER',
        text: "\"Time's up. Good luck. You're going to need it. One more thing — don't trust anyone who tells you to stop listening.\"",
        responses: [
          {
            text: "I won't stop.",
            outcome: "Signal drops. The silence after is the loudest thing you've ever heard.",
            sanityDelta: -12,
            staticMult: 2,
            tapeChance: 0.3,
          },
          {
            text: 'Who should I trust?',
            outcome: '"No one. Especially not yourself." Click.',
            sanityDelta: -15,
            staticMult: 1.5,
          },
        ],
      },
    ],
  ],
};
