// data/fragments/trainStation.ts
// Last Train atmospheric DLC fragments — calls from the platform.
// Band 0 (LIVING), themed for midnight departures and empty trains.

import type { FragmentLibrary } from './types';

export const TRAIN_STATION_FRAGMENTS: FragmentLibrary = {
  band: 0,
  bandName: 'LIVING',
  callTypes: ['JUST_LISTEN', 'DEAD_AIR', 'RIGHT_ANSWER', 'STAY_CALM', 'SIGNAL_DECODE'],
  openings: [
    "You're still on the platform, aren't you? The last train's due in four minutes.",
    'The station closed in 1994. I keep that schedule running anyway.',
    "The conductor called my name tonight. It wasn't my name. I answered.",
    'Platform two. No trains for thirty years. But the track lights are on.',
  ],
  middles: [
    'The doors open on an empty train. The seats are warm.',
    "I've been counting the departures. There's one more on the board than there should be.",
    'The ticket booth light is on. Nobody has worked that booth in decades.',
    'Someone left a suitcase on my seat. It fits my body exactly.',
    'The train announces the next station. The station does not exist.',
    'My reflection on the window is one second late. It has always been one second late.',
  ],
  closings: [
    'The train is leaving. The platform is empty. You can hear the doors.',
    "The departure board flickers. One more station, then it's gone.",
    'Thank you for staying on the platform. The lights will hold for you.',
    'Last train out. If you missed it, wait. It always comes back.',
  ],
  responses: [
    {
      text: 'Stay on the platform. Do not board the train.',
      outcome:
        'The caller nodded slowly. The doors closed on an empty carriage. The train left without them.',
      sanityDelta: 3,
      staticMult: 1.3,
      tapeChance: 0.2,
    },
    {
      text: 'What was written on the departure board?',
      outcome: 'They read it back to you. The destination was your own street. The time was now.',
      sanityDelta: -6,
      staticMult: 2.1,
      tapeChance: 0.3,
    },
    {
      text: 'Who is running the station?',
      outcome: 'A long pause. "I am. I have been. The schedule never says when you get to leave."',
      sanityDelta: -4,
      staticMult: 1.7,
      tapeChance: 0.15,
    },
    {
      text: 'The next train will come. It always does.',
      outcome:
        'The caller laughed, tired. "Yes. And I will be on it. That is the part I cannot explain."',
      sanityDelta: -2,
      staticMult: 1.4,
      tapeChance: 0.1,
    },
    {
      text: 'Put the suitcase down. Walk away from the tracks.',
      outcome:
        'The click of a latch. Then footsteps, slow and deliberate, moving toward the light at the end of the platform.',
      sanityDelta: 1,
      staticMult: 1.5,
      tapeChance: 0.25,
    },
  ],
  callerIdPrefixes: ['PLATFORM-2', 'NIGHT-SCHED', 'TRACK-RELAY', '555-DEPT'],
  callerNamePrefixes: ['THE CONDUCTOR', 'NIGHT PLATFORM', 'LAST TRAIN CALLER', 'STATION KEEPER'],
};
