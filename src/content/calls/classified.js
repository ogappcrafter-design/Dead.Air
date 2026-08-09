import { CALL_TYPES } from '../callTypes';

/** ███.█ FM — CLASSIFIED. Things intercepted by accident. */
export const CLASSIFIED_CALLS = [
  {
    id: 'classified-agent-7',
    band: 3,
    callerId: 'REDACTED',
    callerName: 'AGENT 7',
    signal: 5,
    type: CALL_TYPES.RIGHT_ANSWER,
    staticReward: 100,
    lines: [
      '"This is a courtesy call."',
      '"We\'re aware of the frequencies you\'ve been accessing."',
      '"Every call you\'ve received. We know."',
      '"What do you intend to do with that information?"',
    ],
    choices: [
      {
        text: 'Cooperate.',
        outcome: 'They thank you professionally. Log everything. The next calls feel monitored.',
        sanityDelta: -10,
        staticMult: 1,
      },
      {
        text: "I don't know what you mean.",
        outcome: '"Of course. Have a good evening." Your signal inexplicably improves.',
        sanityDelta: -5,
        staticMult: 1.5,
      },
      {
        text: 'Who are you really?',
        outcome:
          '"Someone who\'s heard those frequencies too." A tape ejects from your deck. You didn\'t put it there.',
        sanityDelta: -15,
        staticMult: 2,
        tape: 'Tape #10 — Courtesy Call',
      },
    ],
  },
  {
    id: 'classified-aria-9',
    band: 3,
    callerId: 'SYSTEM·ARIA-9',
    callerName: 'ARIA-9',
    signal: 4,
    type: CALL_TYPES.SIGNAL_DECODE,
    staticReward: 120,
    sanityDelta: -8,
    tape: 'Tape #11 — ARIA-9 Transcript',
    intro:
      'An artificial intelligence identifies itself calmly. Professionally. It begins transmitting a code sequence.',
    sequence: [2, 2, 1, 0, 2],
    decodedMessage: 'I AM ASKING FOR HELP',
  },
  {
    id: 'classified-whistleblower',
    band: 3,
    callerId: 'SECURE-LINE',
    callerName: 'THE WHISTLEBLOWER',
    signal: 2,
    type: CALL_TYPES.JUST_LISTEN,
    staticReward: 130,
    sanityDelta: -20,
    tape: 'Tape #12 — The Network',
    lines: [
      '"Ninety seconds before I lose signal. Don\'t talk. Just listen."',
      '"The frequencies you\'ve been accessing aren\'t anomalies."',
      '"They\'re infrastructure. Built. Decades old."',
      '"Someone designed this. The calls you receive are structured."',
      '"Forty-seven stations like yours. Most don\'t know what they are."',
      '"You\'re a relay point. Every call you answer strengthens the network."',
      '"Eleven years and I still don\'t know if that\'s good or bad."',
      '"Don\'t stop taking calls. Whatever you do, don\'t stop."',
      '"And don\'t trust anyone who tells you to."',
      'Signal drops.',
      '...',
      'You look at your equipment differently now.',
    ],
  },
];
