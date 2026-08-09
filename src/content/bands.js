/**
 * The five broadcast bands.
 *
 * `unlockAt` is the number of completed calls required to tune in. LIVING is
 * always open — it is the free tier. The other four are part of the base
 * purchase AND gated on progression, so buying the game does not dump every
 * frequency on the player at once.
 */
export const BANDS = [
  {
    id: 0,
    name: 'LIVING',
    freq: '88.7 FM',
    color: '#FF8C00',
    unlockAt: 0,
    paid: false,
    vibe: 'Eerily normal callers. Mundane conversations that reveal something deeply wrong in the last line. Suburban horror. The banal made sinister.',
  },
  {
    id: 1,
    name: 'LIMINAL',
    freq: '102.3 FM',
    color: '#CCFF00',
    unlockAt: 4,
    paid: true,
    vibe: 'Time loops, echoes, callers from repeated moments or wrong timelines. Liminal spaces between was and is.',
  },
  {
    id: 2,
    name: 'LOST',
    freq: '117.8 AM',
    color: '#00FFD0',
    unlockAt: 8,
    paid: true,
    vibe: 'The dead. The missing. Those who needed to say one last thing before they couldn’t. Emotional, devastating, and real.',
  },
  {
    id: 3,
    name: 'CLASSIFIED',
    freq: '███.█ FM',
    color: '#FF3366',
    unlockAt: 12,
    paid: true,
    vibe: 'Government black sites, rogue AI, whistleblowers, classified transmissions intercepted by accident.',
  },
  {
    id: 4,
    name: '████████',
    freq: '???.?',
    color: '#FFFFFF',
    unlockAt: 15,
    paid: true,
    vibe: 'Something ancient. The frequency itself gaining awareness. Transmissions from the dawn of radio. Things with no name.',
  },
];

export const bandById = (id) => BANDS.find((b) => b.id === id) || BANDS[0];
