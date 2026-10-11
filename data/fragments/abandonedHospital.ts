// data/fragments/abandonedHospital.ts
// Mercy General atmospheric DLC fragments — calls from the abandoned hospital.
// Band 0 (LIVING), themed for empty wards, night shifts, and the intercom.

import type { FragmentLibrary } from './types';

export const ABANDONED_HOSPITAL_FRAGMENTS: FragmentLibrary = {
  band: 0,
  bandName: 'LIVING',
  callTypes: ['JUST_LISTEN', 'DEAD_AIR', 'RIGHT_ANSWER', 'RECORDING', 'STAY_CALM'],
  openings: [
    "Nurse's station, four east. The lights went out again. You're the only one left on.",
    'I still take my rounds at 2 a.m. The hospital just never got the memo.',
    'The intercom picked up a page. It was my name. I am the only nurse on shift.',
    'Ward B has been locked since the fire. The door is open. The room is warm.',
  ],
  middles: [
    'The heart monitor on bed six is running. Bed six has no patient.',
    'I found the shift log. Every entry since 1987 is in my handwriting.',
    'The elevators open on floors the building does not have.',
    'Something is in the supply closet. It knows the count of the IV bags.',
    'The patient in isolation asked for water. The isolation unit was demolished in the nineties.',
    'My badge reader says I have worked here for nineteen years. I started last week.',
  ],
  closings: [
    'The intercom clicks off. Somewhere, a monitor flattens into a steady line. Not a flatline. A rest.',
    'Thank you for taking the call. Please keep the ward light on for me.',
    'The page came through again. This time it was your name.',
    'If the lights go out again, do not answer. Wait for me to come find you.',
  ],
  responses: [
    {
      text: 'Keep the ward light on. Keep your door unlocked.',
      outcome:
        'The caller switched on every light in four east. In the hallway beyond, something stopped moving.',
      sanityDelta: 2,
      staticMult: 1.4,
      tapeChance: 0.25,
    },
    {
      text: 'What does the shift log say for tonight?',
      outcome:
        'They read it in a steady voice: "2:00 a.m. — the nurse from the radio came by. She is fine. She is one of us now."',
      sanityDelta: -7,
      staticMult: 2.3,
      tapeChance: 0.35,
    },
    {
      text: 'Whose handwriting is in the log?',
      outcome: 'A long silence. "Mine. All of them. The ink is still wet on the 1987 pages."',
      sanityDelta: -5,
      staticMult: 1.9,
      tapeChance: 0.2,
    },
    {
      text: 'Stay where you are. I will send someone.',
      outcome:
        'The caller almost laughed. "You are the first person to send help in forty years. I am staying. So are you, eventually."',
      sanityDelta: -3,
      staticMult: 1.6,
      tapeChance: 0.1,
    },
    {
      text: 'Answer the intercom. Tell them to come out.',
      outcome:
        'The intercom crackled. A voice like a dial tone answered. It counted from one to nine. It never reached ten.',
      sanityDelta: -8,
      staticMult: 2.5,
      tapeChance: 0.3,
    },
  ],
  callerIdPrefixes: ['WARD-4E', 'NURSE-DESK', 'INTERCOM-17', '555-WARD'],
  callerNamePrefixes: ['NIGHT NURSE', 'WARD KEEPER', 'THE PAGER', 'MERCY CALLER'],
};
