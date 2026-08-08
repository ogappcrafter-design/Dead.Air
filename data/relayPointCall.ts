// data/relayPointCall.ts
// DEA-59: Relay Point narrative call. Replaces/extends the "WHISTLEBLOWER"
// content (call #14) when the player has satisfied the meta-narrative
// trigger conditions. The call reveals that the player is "a relay point"
// in a network of 47 stations, and that the calls are structured
// infrastructure rather than coincidence. The player's choice here drives
// the ending variant via the `choiceTag` → ChoiceHistory → MetaNarrative
// pipeline.
//
// `data/calls.js` is sacred (never modified); this module exports a single
// CallData object the runtime can swap in for call #14 when the meta
// narrative arc is active. The id is kept at 14 so the unlock graph,
// receivedCalls log, and meta-chain id references all stay consistent.

import type { CallData } from '../engine/calls/types';

export const RELAY_POINT_CALL_ID = 14;

export const RELAY_POINT_CALL: CallData = {
  id: RELAY_POINT_CALL_ID,
  band: 3,
  callerId: 'SECURE-LINE',
  callerName: 'THE WHISTLEBLOWER',
  signal: 5,
  type: 'RIGHT_ANSWER',
  staticReward: 90,
  lines: [
    'Channel open. You have questions.',
    'I have answers. But not for free.',
    'You think this is hobby. Late night. Insomnia. Looking for voices in the snow.',
    'It is not. You were selected.',
    'Across the country — across the decades — forty-seven stations.',
    'Each one operated by someone like you. Listening. Recording. Relaying.',
    'Do you understand what I am telling you?',
    'You are not the audience.',
    'You are the relay point.',
  ],
  choices: [
    {
      text: 'I will keep the signal alive.',
      outcome:
        'You accept the contract. The static settles into a rhythm only you can hear. Somewhere, another station — #48 — starts its first shift.',
      sanityDelta: -25,
      staticMult: 2.5,
      choiceTag: 'cooperate',
    },
    {
      text: 'I refuse. Tell me how to stop.',
      outcome:
        'The whistleblower goes quiet. When they return, their voice is older by thirty years. "Stop? You can stop listening. The network will simply find someone else. They always do."',
      sanityDelta: -15,
      staticMult: 1.0,
      choiceTag: 'refuse',
    },
    {
      text: 'Who selected me? Why?',
      outcome:
        'A long silence. Then: "The Origin. Before the stations. Before the licenses. Before radio itself. They wanted to be heard. You — all of you — are how." The line cuts to dead air.',
      sanityDelta: -35,
      staticMult: 1.5,
      choiceTag: 'seek_truth',
    },
    {
      text: 'Then I protect myself. I have heard enough.',
      outcome:
        'You power down the rig. Outside, the night is ordinary. But every radio in the house — every one — turns itself on at 3:07 AM, tuned to a band that does not exist.',
      sanityDelta: -20,
      staticMult: 0.5,
      choiceTag: 'protect_self',
    },
  ],
};
