/**
 * Band prompt material, server-side.
 *
 * The client sends only a band id — never a prompt — so this file is the
 * authoritative source for what the model is asked to write. Keep the vibes in
 * sync with src/content/bands.js in the app; they are duplicated deliberately
 * so the proxy stays a standalone deployable with no build step.
 */
const BANDS = {
  0: {
    name: 'LIVING',
    vibe: 'Eerily normal callers. Mundane conversations that reveal something deeply wrong in the last line. Suburban horror. The banal made sinister.',
  },
  1: {
    name: 'LIMINAL',
    vibe: 'Time loops, echoes, callers from repeated moments or wrong timelines. Liminal spaces between was and is.',
  },
  2: {
    name: 'LOST',
    vibe: 'The dead. The missing. Those who needed to say one last thing before they couldn’t. Emotional, devastating, and real.',
  },
  3: {
    name: 'CLASSIFIED',
    vibe: 'Government black sites, rogue AI, whistleblowers, classified transmissions intercepted by accident.',
  },
  4: {
    name: '████████',
    vibe: 'Something ancient. The frequency itself gaining awareness. Transmissions from the dawn of radio. Things with no name.',
  },
};

const CALL_TYPES = [
  'JUST_LISTEN',
  'DEAD_AIR',
  'RIGHT_ANSWER',
  'SIGNAL_DECODE',
  'STAY_CALM',
];

module.exports = { BANDS, CALL_TYPES };
