// data/tapePacks/voicesBeyondCalls.ts
// Hand-authored DLC calls for the Voices From Beyond Tape Pack.
// IDs 400–402, band 2 (LOST), sourcePackId tags them for ownership filtering.

import type { CallData } from '../../engine/calls/types';

export const VOICES_BEYOND_DLC_CALLS: CallData[] = [
  {
    id: 400,
    band: 2,
    callerId: 'GHOST-STATION',
    callerName: 'GHOST STATION',
    signal: 3,
    type: 'DEAD_AIR',
    staticReward: 40,
    waitSeconds: 10,
    sourcePackId: 'com.deadair.tape_pack_voices_beyond',
    lines: [
      'The phone rings. You answer.',
      'Static. A distant hum. Something breathing.',
      'A voice from very far away: "Hello? Is anyone there? I\'ve been trying to reach..."',
      'The voice trails off. The static swells.',
      'Then, clearly: "I died on this frequency. I\'ve been calling from the other side for thirty years."',
      '"You\'re the first person who\'s answered."',
      "Silence. The static sounds like waves on a shore that doesn't exist.",
      '"Please don\'t hang up. I don\'t know what happens if you hang up."',
    ],
  },
  {
    id: 401,
    band: 2,
    callerId: 'SPIRIT-BOX',
    callerName: 'THE SPIRIT BOX',
    signal: 4,
    type: 'RIGHT_ANSWER',
    staticReward: 55,
    sourcePackId: 'com.deadair.tape_pack_voices_beyond',
    lines: [
      'Rapid-fire syllables from a spirit box: "ca-...n... hear... me...?"',
      'The fragments coalesce into a voice: "I used one of these when I was alive."',
      '"I\'m not alive anymore. But the box still finds me. The box finds everything."',
      '"There are others here. Hundreds. All trying to speak at once."',
      '"I can let one of them through. Choose carefully. They can\'t go back once they\'ve spoken."',
    ],
    choices: [
      {
        text: 'Let through the child.',
        outcome:
          "A small voice: \"Mom? I can't find you. It's dark here. It's been dark for so long.\" The static forms the shape of a room you've never seen. The voice fades.",
        sanityDelta: -15,
        staticMult: 2,
        tape: true,
        tapeName: 'Tape #26 — The Last Séance',
      },
      {
        text: 'Let through the old man.',
        outcome:
          '"I had so much to say. I had so much to say. I had so much to say." He repeats it until the static swallows him. You remember every unfinished conversation you\'ve ever had.',
        sanityDelta: -8,
        staticMult: 1.5,
        tape: false,
      },
      {
        text: 'Refuse. Close the box.',
        outcome:
          "The voices scatter like birds. One remains, whispering: \"You were right. We can't go back. Now we're here. Now we're here.\" The box is still on.",
        sanityDelta: -5,
        staticMult: 1,
        tape: false,
      },
    ],
  },
  {
    id: 402,
    band: 2,
    callerId: 'FROM-BEYOND',
    callerName: 'A MESSAGE FROM BEYOND',
    signal: 5,
    type: 'JUST_LISTEN',
    staticReward: 50,
    sanityDelta: -10,
    sourcePackId: 'com.deadair.tape_pack_voices_beyond',
    lines: [
      'A voice you almost recognize: "I have one message. I\'ve been saving it."',
      '"It\'s for you. It\'s always been for you."',
      '"I whispered it in your ear the night you were born."',
      '"You didn\'t hear it then. You won\'t hear it now."',
      '"But I\'ll keep trying. I\'ll keep calling until you hear it."',
      "The voice speaks. You can't make out the words. But something in your chest understands.",
      "The line goes dead. You are crying and you don't know why.",
      "The phone rings again. You answer. It's the same voice. It will always be the same voice.",
    ],
  },
];
