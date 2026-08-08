// data/tapePacks/numbersStationCalls.ts
// Hand-authored DLC calls for the Numbers Station Tape Pack.
// IDs 300–302, band 3 (CLASSIFIED), sourcePackId tags them for ownership filtering.

import type { CallData } from '../../engine/calls/types';

export const NUMBERS_STATION_DLC_CALLS: CallData[] = [
  {
    id: 300,
    band: 3,
    callerId: 'X-7-ENCRYPT',
    callerName: 'THE BUZZER',
    signal: 5,
    type: 'SIGNAL_DECODE',
    staticReward: 60,
    sourcePackId: 'com.deadair.tape_pack_numbers_station',
    lines: [
      'A monotonous buzzing tone, two seconds on, two seconds off. It has been going for forty-six minutes.',
      'The buzzing stops. A voice — flat, mechanical — reads: "Seven. Seven. Seven. Seven. Seven."',
      'Then: "The target has been acquired. The target has always been acquired."',
      'The buzzing resumes, but now it is a heartbeat. Your heartbeat. Synchronized exactly.',
      'The voice returns: "Decode the sequence. Seven is the number. You are the number."',
    ],
    decodedMessage:
      'REPEAT: YOU ARE THE TARGET. YOU HAVE ALWAYS BEEN THE TARGET. SEVEN IS YOUR DESIGNATION. ACKNOWLEDGE.',
    sequence: [7, 7, 7, 7, 7],
  },
  {
    id: 301,
    band: 3,
    callerId: 'COUNT-9999',
    callerName: 'COUNTING TO INFINITY',
    signal: 4,
    type: 'JUST_LISTEN',
    staticReward: 40,
    sanityDelta: -8,
    sourcePackId: 'com.deadair.tape_pack_numbers_station',
    lines: [
      'A voice counts: "One. Two. Three."',
      '"Four hundred. Four hundred one. Four hundred two."',
      'The counting accelerates. Numbers blur together.',
      '"Nine thousand nine hundred ninety nine."',
      'A pause. The voice sounds confused, almost afraid.',
      '"One. The count restarts. It always restarts."',
      '"We have been counting for sixty-seven years. The count has never reached ten thousand."',
      '"Something always interferes at nine thousand nine hundred ninety nine."',
      'The line goes dead. You hear yourself whisper: "Ten thousand."',
    ],
  },
  {
    id: 302,
    band: 3,
    callerId: 'MSG-4513',
    callerName: 'ENCODED MESSAGE 4513',
    signal: 5,
    type: 'RIGHT_ANSWER',
    staticReward: 55,
    sourcePackId: 'com.deadair.tape_pack_numbers_station',
    lines: [
      'Static. Then a woman\'s voice, precise and urgent: "Message begins."',
      '"Four five one three. Seven seven seven. Two zero."',
      '"The package is at the old transmitter. Third buried cable, north side."',
      '"Do not retrieve it alone. Do not retrieve it during daylight."',
      '"If you are hearing this, the previous courier is dead. You are the new courier."',
      '"Acknowledge by repeating: four five one three."',
    ],
    choices: [
      {
        text: 'Repeat: four five one three.',
        outcome:
          'A long exhale. "Acknowledged. The frequency is yours now. Do not let it go silent. If it goes silent, they know. They always know." A click. Then a second voice, not hers: "Welcome, courier."',
        sanityDelta: -10,
        staticMult: 2,
        tape: true,
        tapeName: 'Tape #21 — Station X-7',
      },
      {
        text: 'Refuse to acknowledge.',
        outcome:
          'Silence. Then: "Refusal logged. The package will be retrieved by other means. You will not hear from us again." The frequency is dead. Something in the static is watching.',
        sanityDelta: -5,
        staticMult: 1,
        tape: false,
      },
      {
        text: 'Ask who "they" are.',
        outcome:
          "The woman hesitates. \"If you don't know, you're safer. If you do know, you're not. The answer is: everyone. The answer is: us. The answer is: you.\"",
        sanityDelta: -8,
        staticMult: 1.5,
        tape: false,
      },
    ],
  },
];
