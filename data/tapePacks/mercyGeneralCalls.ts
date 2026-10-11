// data/tapePacks/mercyGeneralCalls.ts
// Hand-authored DLC calls for the Mercy General Tape Pack.
// IDs 500–502, band 0 (LIVING), sourcePackId tags them for ownership filtering.

import type { CallData } from '../../engine/calls/types';

export const MERCY_GENERAL_DLC_CALLS: CallData[] = [
  {
    id: 500,
    band: 0,
    callerId: 'NURSE-PAGE-1',
    callerName: 'PAGE FOR 417',
    signal: 4,
    type: 'RIGHT_ANSWER',
    staticReward: 45,
    sourcePackId: 'com.deadair.tape_pack_mercy_general',
    lines: [
      'The intercom crackles to life. "Page for four-one-seven. Page for four-one-seven."',
      '"It has been using my voice for three days. I have not opened my mouth."',
      '"The other nurses left through the east exit. There is no east exit anymore. I checked. It is a wall. It has always been a wall."',
      '"It pages me to the stairwell. I do not go. I am not sure what happens if I do."',
    ],
    choices: [
      {
        text: 'Tell it to stop paging.',
        outcome:
          'The intercom clicks off mid-syllable. In the silence, you hear a monitor start counting, flat and steady, from a floor with no power.',
        sanityDelta: -8,
        staticMult: 2,
        tape: true,
        tapeName: 'Tape #35 — The Intercom Voice',
      },
      {
        text: 'Ask what employee 417 was in 1987.',
        outcome:
          '"A nurse. On the night shift. Like me." A pause. "The roster lists 417 nine times. All nine entries are the same night."',
        sanityDelta: -12,
        staticMult: 2.4,
        tape: false,
      },
      {
        text: 'Stay on the desk. I am logging your position.',
        outcome:
          'The caller stays still on the line. Through the static, a desk lamp hums and a monitor beeps — once, twice — then holds its breath.',
        sanityDelta: -3,
        staticMult: 1.2,
        tape: false,
      },
    ],
  },
  {
    id: 501,
    band: 0,
    callerId: 'WARD-4E-2',
    callerName: 'THE NIGHT SHIFT LOG',
    signal: 3,
    type: 'JUST_LISTEN',
    staticReward: 35,
    sanityDelta: -6,
    sourcePackId: 'com.deadair.tape_pack_mercy_general',
    lines: [
      'A woman reads from a paper log. "One fourteen a.m. Ward four quiet. Monitors nominal."',
      '"One fifty-two a.m. The lights dimmed in sequence. I counted nine panels. The corridor has six."',
      '"Two eleven a.m. The nurse from the radio visited. She is not afraid. That worries me most."',
      '"Two forty a.m. I am still here. The handwriting on this page is not mine. I am certain of that. I am even more certain it will be."',
      'The paper rustles. The reading ends before the last entry does.',
    ],
  },
  {
    id: 502,
    band: 0,
    callerId: 'ISOLATION-17',
    callerName: 'ROOM SEVENTEEN',
    signal: 2,
    type: 'RIGHT_ANSWER',
    staticReward: 55,
    sourcePackId: 'com.deadair.tape_pack_mercy_general',
    lines: [
      'A voice through a damaged speaker, too close to the microphone: "You can hear the isolation unit."',
      '"It was demolished in 1994. I watched. I was on the roof. I am still on the roof."',
      '"The patient is still being paged. The pages are getting shorter. One word now. My word."',
    ],
    choices: [
      {
        text: 'Ask what word it is paging now.',
        outcome:
          'The speaker distorts. The word it says is your name, but the stress is wrong — and you have never heard it said that way before.',
        sanityDelta: -15,
        staticMult: 2.6,
        tape: true,
        tapeName: 'Tape #33 — Patient Room 17',
      },
      {
        text: 'Tell the roof is not real anymore.',
        outcome:
          'A long breath. "The hospital is real. The demolition was. Only the roof is missing. That is how you know which of us is still standing."',
        sanityDelta: -10,
        staticMult: 2,
        tape: false,
      },
      {
        text: 'Stay on the roof. Do not come down.',
        outcome:
          '"Down is where the pages come from. I have been going up for thirty years. I am almost at the antenna now."',
        sanityDelta: -6,
        staticMult: 1.5,
        tape: false,
      },
    ],
  },
];
