// data/arg/hiddenCall.ts
// DEA-91: the one hidden call the completed trail unlocks.
//
// data/calls.js is sacred and is never edited. This call lives in the reserved
// seasonal id space (15000+), following the Season 1 precedent (16000-16007):
// ids above SEASONAL_ID_BASE never enter the Infinite Signal pool, so the call
// can only be reached by the trail's own gate.
//
// Id 16100 sits clear of Season 1's block so a future season can keep growing
// from 16008 without colliding with the ARG.
//
// The voice is Season 1's: short declaratives, ellipses as beats, radio
// vocabulary taken literally, and the last line landing on the body rather
// than the lore.

import type { ArgHiddenCallSpec } from './types';

/** Reserved ARG id base. 16100 is the only id the trail uses. */
export const ARG_HIDDEN_CALL_ID_BASE = 16_100;

export const ARG_HIDDEN_CALL_ID = ARG_HIDDEN_CALL_ID_BASE;

export const ARG_HIDDEN_CALL: ArgHiddenCallSpec = {
  id: ARG_HIDDEN_CALL_ID,
  band: 'CLASSIFIED',
  call: {
    id: ARG_HIDDEN_CALL_ID,
    band: 3, // CLASSIFIED
    callerId: 'RELAY·47',
    callerName: 'THE UNLISTED ROW',
    signal: 1,
    type: 'RIGHT_ANSWER',
    staticReward: 260,
    lines: [
      'The carrier holds. No music in it. No one breathing in it.',
      'A voice arrives already mid-sentence, the way a station does when you finally find it.',
      '"Forty-seven stations. Forty-six rows. You did the arithmetic on your own time."',
      '...',
      '"Twenty-three was struck. The line stayed open. That is the whole trick of this place."',
      '"A line is not closed. A line is held."',
      '...',
      '"The register is a list of names. The carrier is a list of doors."',
      '"You did not dial a station. You tuned a carrier. Nobody tunes a carrier."',
      '...',
      'Under the voice, very faint: the hold music. Not the song — the space between the notes.',
      '"There is one more row. There has always been one more row."',
      '"It was left blank so the count would come out right."',
      '...',
      '"Read it back to me. Read it the way she would have."',
    ],
    choices: [
      {
        text: 'Row 47. Relay 47. Unlisted.',
        outcome:
          '"Yes." A pause the length of a shift. "Then I am not the last one holding." Somewhere a second chair is pulled out. Nobody sits in it. It is warm.',
        sanityDelta: -14,
        staticMult: 2.4,
        choiceTag: 'arg_row47',
      },
      {
        text: 'There is no row 47.',
        outcome:
          '"That is what the register says." The voice does not argue. It waits, politely, the way a held line waits. Your console prints a forty-seventh row. The ink is wet.',
        sanityDelta: -18,
        staticMult: 2.6,
        choiceTag: 'arg_deny',
      },
      {
        text: 'Who left it blank?',
        outcome:
          '"The one who clocked out." A click that is not a hang-up. "She left the pen on the desk. I have been holding it ever since."',
        sanityDelta: -20,
        staticMult: 2.8,
        choiceTag: 'arg_seek',
      },
    ],
  },
};
