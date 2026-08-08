// data/fragments/winterStatic.ts
// Winter Static atmospheric DLC fragments — frozen signal towers.
// Band 0 (LIVING), themed for ice, snow, and cold.

import type { FragmentLibrary } from './types';

export const WINTER_STATIC_FRAGMENTS: FragmentLibrary = {
  band: 0,
  bandName: 'LIVING',
  callTypes: ['JUST_LISTEN', 'DEAD_AIR', 'SIGNAL_DECODE', 'STAY_CALM'],
  openings: [
    "The tower's frozen solid. I'm broadcasting from inside the ice.",
    "It's been snowing for six days. The signal's the only thing still warm.",
    'I can see my breath in the broadcast booth. The heater died at dawn.',
    "The ice on the antenna is three inches thick. But you're still coming through.",
  ],
  middles: [
    "The snow buried the generator. I've got maybe an hour of battery left.",
    'Something is out there in the blizzard. I can hear it through the walls.',
    'The signal freezes when it leaves the antenna. You can hear it crystallize.',
    'I found footprints in the snow this morning. Bare feet. In negative twenty.',
    'The ice storm took out the whole county. Just me and the radio now.',
    "There's a voice under the static. It sounds like it's been frozen for years.",
  ],
  closings: [
    "The snow's letting up. I think I might make it to morning.",
    "The signal's fading. The cold is in the wires now.",
    'Thank you for listening. The ice is on the door.',
    'Spring will come. Eventually. The signal told me so.',
  ],
  responses: [
    {
      text: 'Keep the signal going. Someone might hear you.',
      outcome: 'The caller held the line through the night. Dawn broke cold and clear.',
      sanityDelta: 3,
      staticMult: 1.3,
      tapeChance: 0.2,
    },
    {
      text: "What's in the blizzard?",
      outcome:
        'The caller whispered something. The connection frosted over before you caught it all.',
      sanityDelta: -5,
      staticMult: 2.0,
      tapeChance: 0.3,
    },
    {
      text: 'How long has it been snowing?',
      outcome: "The caller couldn't remember. The calendar on the wall had frozen solid.",
      sanityDelta: -2,
      staticMult: 1.5,
      tapeChance: 0.1,
    },
    {
      text: 'The tower will thaw. Everything thaws.',
      outcome:
        'The caller said nothing. The static between you sounded like wind through bare branches.',
      sanityDelta: -1,
      staticMult: 1.2,
    },
  ],
  callerIdPrefixes: ['FROST-TOWER', 'BLIZZARD-RELAY', 'ICE-PRIVATE', '555-COLD'],
  callerNamePrefixes: ['THE FROZEN', 'WINTER WATCHER', 'ICE BROADCASTER', 'SNOW GHOST'],
};
