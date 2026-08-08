import type { FragmentLibrary } from './types';

export const HALLOWEEN_FRAGMENTS: FragmentLibrary = {
  band: 0,
  bandName: 'LIVING',
  callTypes: ['JUST_LISTEN', 'DEAD_AIR', 'RIGHT_ANSWER'],
  openings: [
    "There's a knock at the door but the door is missing. It is October 31st.",
    'A child\u2019s voice in a mask says through the speaker: "Trick or treat? Trick or TREAT."',
    'The porch light is on. The porch is not attached to the house.',
    'Counting candy. The candy has eyes. The candy has always had eyes.',
    'A broadcast from the local church steeple, except the steeple has been down for fifty years.',
    '— all Hallow\u2019s Eve advisory — do NOT answer the door after nine —',
  ],
  middles: [
    'The jack-o-lantern guttered out three hours ago. It is speaking. It says: I am still here.',
    'A ghost takes off its sheet. Underneath the sheet there is nothing. Underneath the nothing is you.',
    'Masks are asked to be worn inside the house. Masks cannot be removed. Masks cannot be removed.',
    'A masked figure whose face you can see approaches without moving. It will be the doorbell-ringer.',
    'The trick-or-treaters have not arrived in two hours. The trick-or-treaters never arrive. The trick-or-treaters always arrive.',
    'A droning commercial for a savings bank whose logo is carved into a pumpkin.',
  ],
  closings: [
    'Stay inside. Lock the masks in place. Answer only to your shadow.',
    'The broadcast is over. The doorbell is not.',
    'A bowl of candy sits untouched. The candy will be eaten by no one for a while.',
    'Lock the door. Lock the door. Lock the door. Lock the door.',
    "Happy Halloween. Don't look behind the caller.",
  ],
  responses: [
    {
      text: 'Answer the door.',
      outcome:
        'No one is there. A bowl of candy on the porch. A child\u2019s voice from inside the bowl.',
      sanityDelta: -10,
      staticMult: 2,
      tapeChance: 0.25,
    },
    {
      text: 'Leave the candy out and lock the door.',
      outcome: 'The lock clicks. The candy begins to laugh.',
      sanityDelta: -5,
      staticMult: 1,
      tapeChance: 0.1,
    },
    {
      text: 'Take off the mask.',
      outcome:
        'You are not wearing a mask. You have never been wearing a mask. The mask is wearing you.',
      sanityDelta: -15,
      staticMult: 2,
      tapeChance: 0.3,
    },
  ],
  callerIdPrefixes: [
    'HALLOWEEN-XXX',
    'OCT-31',
    'TRICK-OR-TREAT',
    'STEEPLE-DOWN',
    'PUMPKIN-VOID',
    'MASK-LINE',
  ],
  callerNamePrefixes: [
    'THE TRICK OR TREAT',
    'THE UNMASKED',
    'THE JACK O LANTERN',
    'THE STEEPLE VOICE',
    'THE CANDY RETURN',
  ],
};

export const CHRISTMAS_FRAGMENTS: FragmentLibrary = {
  band: 0,
  bandName: 'LIVING',
  callTypes: ['JUST_LISTEN', 'DEAD_AIR', 'RIGHT_ANSWER'],
  openings: [
    "A choir somewhere begins 'Silent Night' and stops at the word 'night'.",
    'A department store Santa\u2019s breath fogs the phone: "Ho, ho, ho..." the third ho arrives one minute later.',
    'A bell rings outside. The bell is already inside. The bell has always been inside.',
    '— emergency broadcast — Santa is extraterrestrial — repeat — Santa is extraterrestrial —',
    'A child\u2019s letter to the North Pole broadcast aloud, followed by an adult voice reading the reply.',
    'A crackling fire, then a voice: "Is it the fire warming you, or you warming the fire?"',
  ],
  middles: [
    'The Angel atop the tree has begun to smile. The smile is not far enough down the face.',
    'A music box plays "O Come All Ye Faithful." A second music box plays in reverse. They are duetting.',
    'The reindeer on the rooftop are spelling your name wrong.',
    '— Santa begins — he sees you when you\u2019re sleeping — he knows when you\u2019re awake — he has been at your window since 1987 —',
    'A wrapping-paper rustle from behind the sofa. The wrapping paper is not for any present.',
    'A toy train circling the tree. The tree is gone. The train will not stop circling.',
  ],
  closings: [
    'Merry Christmas. The presents are wrapped around something else.',
    'Do not put out cookies for Santa. He has already eaten. He has eaten too much.',
    'Merry Christmas. We will be here. We will be here. We will be here.',
    'Happy holidays. All holidays. All at once. Forever.',
    'This has been a televised Christmas message. There is no television. There is no Christmas.',
  ],
  responses: [
    {
      text: 'Open the presents.',
      outcome: 'Each box contains another, smaller, sealed with your own name on the tag.',
      sanityDelta: -8,
      staticMult: 2,
      tapeChance: 0.25,
    },
    {
      text: 'Put cookies out for Santa.',
      outcome: 'The cookies are gone by morning. The plate is gone by then too.',
      sanityDelta: -4,
      staticMult: 1,
      tapeChance: 0.1,
    },
    {
      text: 'Tell the doorbell to come in.',
      outcome:
        'A small voice thanks you. The fire is brighter. The tree is darker. The angel has not always been there.',
      sanityDelta: 5,
      staticMult: 1,
      tapeChance: 0.15,
    },
  ],
  callerIdPrefixes: [
    'XMAS-XXX',
    'DEC-25',
    'NORTH-POLE',
    'JINGLE-BELL',
    'CHIMNEY-VOID',
    'GIFT-WRAP',
  ],
  callerNamePrefixes: [
    'THE SHOPPER SANTA',
    'THE MUSIC BOX',
    'THE ANGEL ON THE TREE',
    'THE CHRISTMAS VOICE',
    'THE EXTENDED SEASON',
  ],
};

export const NEWYEAR_FRAGMENTS: FragmentLibrary = {
  band: 1,
  bandName: 'LIMINAL',
  callTypes: ['JUST_LISTEN', 'DEAD_AIR', 'RIGHT_ANSWER'],
  openings: [
    "A countdown begins at three but the word 'three' takes a full minute.",
    'A crowd gathering at midnight. The crowd does not arrive. The midnight does.',
    'Auld Lang Syne badly sung. Then perfectly sung. Then sung backwards.',
    'It is midnight in three time zones at once. You are listening from inside two of them.',
    'A broadcast from last New Year is being rebroadcast as next New Year. It is also this New Year.',
    'A ball drops. The ball is not above the floor. The ball is below the floor.',
  ],
  middles: [
    'Everyone promises to be better. The promise is the only thing changing.',
    'The year that just ended is still in the room, refusing to leave.',
    'A bell rings 12 times. The bell rings for the year ahead, the year that just ended, and the year that did not start.',
    'Auld Lang Syne reversed. The crowd applauds ringing out the past year. The crowd applauds ringing out the year ahead. The crowd applauds.',
    'A resolution is broadcast. It is your name, your face, your worst day, a year ago.',
  ],
  closings: [
    'Happy New Year. The year is the same year dressed up.',
    'Stay tuned for the year ahead. We have been tuned to it since 1999.',
    'The broadcast ends with the countdown. Another countdown is starting. It will end around midnight.',
    'Merry New Year. Happy Christmas. The dates merge here.',
  ],
  responses: [
    {
      text: 'Count down with the broadcast.',
      outcome: 'You say "three" before they do. Your voice is in the broadcast.',
      sanityDelta: -5,
      staticMult: 2,
      tapeChance: 0.2,
    },
    {
      text: "Make a resolution you didn't make.",
      outcome: "The resolution you didn't make is being kept by someone. The someone is not you.",
      sanityDelta: -10,
      staticMult: 2,
      tapeChance: 0.25,
    },
    {
      text: 'Open the champagne.',
      outcome:
        'The pop is muffled. The cork is still in the bottle. The bottle has been open for thirty years.',
      sanityDelta: -3,
      staticMult: 1,
      tapeChance: 0.1,
    },
  ],
  callerIdPrefixes: ['NYE-XXX', 'JAN-1', 'BALL-DROP', 'COUNTDOWN-9', 'AULD-LANG', 'MIDNIGHT-9X'],
  callerNamePrefixes: [
    'THE NEW YEARS VOICE',
    'THE COUNTDOWN',
    'THE MIDNIGHT CHOIR',
    'THE YEAR AHEAD',
    'THE YEAR BEHIND',
  ],
};

export const SEASONAL_FRAGMENTS: Record<string, FragmentLibrary[]> = {
  halloween: [HALLOWEEN_FRAGMENTS],
  christmas: [CHRISTMAS_FRAGMENTS],
  newyear: [NEWYEAR_FRAGMENTS],
};
