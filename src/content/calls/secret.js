import { CALL_TYPES } from '../callTypes';

/**
 * Transmissions that are not always there.
 *
 * A `window` puts a call on the dial only during certain local hours. It is
 * marked `secret`, which keeps it out of the completion counts — finding it
 * should feel like a reward for being awake at the wrong time, not a chore
 * standing between a player and 100%.
 *
 * The tease is earned: this only surfaces at all once the player has taken the
 * 3:47 AM call on LIMINAL, which is the one that tells them the hour matters.
 */
export const SECRET_CALLS = [
  {
    id: 'liminal-347-return',
    band: 1,
    callerId: '3:47 AM',
    callerName: 'IT IS 3:47 AM',
    signal: 0,
    type: CALL_TYPES.JUST_LISTEN,
    staticReward: 347,
    sanityDelta: -20,
    secret: true,
    /** Local hours, inclusive of `from`, exclusive of `to`. */
    window: { from: 3, to: 4 },
    requires: 'liminal-347',
    lines: [
      'You checked.',
      'You actually checked.',
      '...',
      '"Hello again."',
      '"I said it was always 3:47. I did not say it was always 3:47 for you."',
      '...',
      '"For me it has been 3:47 for a very long time."',
      '"You get to leave at 4."',
      '...',
      '"I wanted to see what someone looks like when they can leave."',
      '...',
      'The line does not click.',
      'It just stops being there.',
      '...',
      'Your clock reads 3:48.',
      'You do not remember the minute passing.',
    ],
  },
];
