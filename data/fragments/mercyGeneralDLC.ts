// data/fragments/mercyGeneralDLC.ts
// Mercy General tape pack fragments — the abandoned hospital arc.
// Band 0 (LIVING), themed for wards, intercoms, and the night shift.

import type { FragmentLibrary } from './types';

export const MERCY_GENERAL_DLC_FRAGMENTS: FragmentLibrary = {
  band: 0,
  bandName: 'LIVING',
  callTypes: ['JUST_LISTEN', 'DEAD_AIR', 'RIGHT_ANSWER', 'STAY_CALM', 'RECORDING'],
  openings: [
    'This is Mercy General. Four east, night shift. You should not be hearing this channel.',
    'The paging system works on its own now. It has my voice on it. I have not spoken in days.',
    'I am the last nurse on the ward. The others went out through the east exit. The east exit is gone.',
    'The order came through at two a.m. Code gray, ward four. There has been no code gray here since 1987.',
  ],
  middles: [
    'The monitors are still running on bed six. I unplugged the whole floor. The monitors are still running.',
    'I found the shift log in the supply closet. The handwriting on every page is mine. The ink is fresh.',
    'The elevators went down past the basement. I counted the floors. The building has three.',
    'The patient in room seventeen asked for water. Room seventeen is brick now. The request came through the intercom.',
    'My badge reader says I am employee four-one-seven. I am employee four-one-seven in the 1987 roster too.',
    'The corridor lights dim in sequence, away from me. Like something is walking down the hall with them.',
  ],
  closings: [
    'The intercom clicks off. The monitors keep going. Please keep this channel open.',
    'If you hear a page for your name, do not answer. If you do not answer, we will be alright.',
    'Thank you for taking the call. I will see you on the night shift.',
    'The lights are back. The ward is quiet. Quiet is not the same as empty.',
  ],
  responses: [
    {
      text: 'Keep moving. Do not stop in the corridor.',
      outcome:
        'The caller moved through the dark ward, one footstep at a time. The corridor light followed, one panel behind them.',
      sanityDelta: 2,
      staticMult: 1.3,
      tapeChance: 0.2,
    },
    {
      text: 'Read me the shift log entry for tonight.',
      outcome:
        'They read it in a level voice: "2:11 a.m. — the nurse from the radio visited. She is not afraid. That worries me most."',
      sanityDelta: -7,
      staticMult: 2.2,
      tapeChance: 0.35,
    },
    {
      text: 'Stay on the nurse desk. I am logging your position.',
      outcome:
        'The caller stayed still. Through the static you could hear the desk lamp, the monitor, and something breathing in the stairwell.',
      sanityDelta: -2,
      staticMult: 1.5,
      tapeChance: 0.1,
    },
    {
      text: 'Unplug the monitors. Cut the power at the panel.',
      outcome:
        'The breaker threw with a sound like a door closing. For eleven seconds the ward was truly silent. Then the monitors resumed.',
      sanityDelta: -5,
      staticMult: 1.9,
      tapeChance: 0.25,
    },
    {
      text: 'Answer the page. Tell it to show itself.',
      outcome:
        'The intercom crackled. A voice like a dial tone answered, and began counting the floors in a language that had no numbers.',
      sanityDelta: -9,
      staticMult: 2.6,
      tapeChance: 0.3,
    },
  ],
  callerIdPrefixes: ['MERCY-4E', 'NURSE-PAGE', 'INTERCOM-17', '555-CODE'],
  callerNamePrefixes: ['NIGHT NURSE', 'WARD KEEPER', 'THE PAGER', 'EMPLOYEE 417'],
};
