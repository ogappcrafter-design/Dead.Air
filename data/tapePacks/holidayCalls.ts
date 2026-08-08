// data/tapePacks/holidayCalls.ts
// Hand-authored DLC calls for the Holiday Tape Pack.
// IDs 200–202, band 0 (LIVING), sourcePackId tags them for ownership filtering.

import type { CallData } from '../../engine/calls/types';

export const HOLIDAY_DLC_CALLS: CallData[] = [
  {
    id: 200,
    band: 0,
    callerId: 'NORTH-POLE-1',
    callerName: "SANTA'S LAST CALL",
    signal: 4,
    type: 'RIGHT_ANSWER',
    staticReward: 45,
    sourcePackId: 'com.deadair.tape_pack_holiday',
    lines: [
      'A hoarse voice clears its throat. "Is this... is this the station?"',
      '"I\'ve been driving all night. The sleigh broke down on Route 9."',
      '"The reindeer are gone. Scattered. I think they\'re afraid of something in the woods."',
      '"I\'ve got one gift left in the back. It\'s addressed to you."',
      '"Can you... can you take it? I don\'t think I can deliver it myself."',
    ],
    choices: [
      {
        text: 'Take the gift.',
        outcome:
          'You unwrap it. Inside is a photograph of yourself, sleeping, taken from outside your window last Christmas Eve.',
        sanityDelta: -12,
        staticMult: 2,
        tape: true,
        tapeName: 'Tape #16 — Christmas Eve Broadcast',
      },
      {
        text: 'Refuse the gift.',
        outcome:
          "\"That's wise. I don't remember wrapping it. I don't remember putting your name on it.\" He drives away. The sleigh bells fade into static.",
        sanityDelta: -3,
        staticMult: 1,
        tape: false,
      },
      {
        text: 'Ask what happened to the reindeer.',
        outcome:
          'He goes quiet. "They saw what was in the bag. Not this bag. The other one. The one I don\'t open anymore."',
        sanityDelta: -8,
        staticMult: 1.5,
        tape: false,
      },
    ],
  },
  {
    id: 201,
    band: 0,
    callerId: 'NYE-RESOLVE',
    callerName: 'NEW YEAR RESOLUTIONS',
    signal: 5,
    type: 'JUST_LISTEN',
    staticReward: 35,
    sanityDelta: -6,
    sourcePackId: 'com.deadair.tape_pack_holiday',
    lines: [
      'A voice reads from a list. "Resolution one: be kinder to strangers."',
      '"Resolution two: stop calling the station at midnight."',
      '"Resolution three: remember what happened last New Year."',
      '"Resolution four: ..."',
      'Long silence.',
      '"I don\'t remember what happened last New Year. Do you?"',
      '"I\'ve been calling every year to ask if you remember."',
      '"Nobody remembers. Nobody ever remembers."',
      'Auld Lang Syne plays faintly, backwards. The line goes dead.',
    ],
  },
  {
    id: 202,
    band: 0,
    callerId: 'TRICK-TREAT-9',
    callerName: 'TRICK OR TREAT',
    signal: 3,
    type: 'RIGHT_ANSWER',
    staticReward: 50,
    sourcePackId: 'com.deadair.tape_pack_holiday',
    lines: [
      'A child\'s voice, too calm for its age: "Trick or treat."',
      '"You didn\'t put out candy this year. That\'s okay. I brought some."',
      "The sound of small objects being placed on a table. They're warm.",
      '"I\'m at every house tonight. Every house that didn\'t prepare."',
      '"Mine has a prize inside. Can you guess which one?"',
    ],
    choices: [
      {
        text: 'Eat the candy.',
        outcome:
          'It tastes like your childhood bedroom. You remember a Halloween you never lived. You are wearing a mask you cannot remove.',
        sanityDelta: -15,
        staticMult: 2,
        tape: true,
        tapeName: 'Tape #18 — Halloween Séance',
      },
      {
        text: 'Refuse the candy.',
        outcome:
          '"Smart. The prize is inside the candy. The prize is always inside." The child giggles and is gone. The candy remains on the table.',
        sanityDelta: -5,
        staticMult: 1,
        tape: false,
      },
      {
        text: 'Ask what the prize is.',
        outcome:
          "The child whispers: \"It's you. You're the prize. You've always been the prize.\" The candies are teeth. They are still warm.",
        sanityDelta: -10,
        staticMult: 1.5,
        tape: false,
      },
    ],
  },
];
