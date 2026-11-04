// data/seasons/season1/ending.ts
// DEA-85: the season's single ending. Selected by NarrativeSeason from the
// finale's s1_* choice tags; the opening beat varies by tag.

export type SeasonEndingId = 's1_hold' | 'no_ending';

export interface SeasonEnding {
  id: SeasonEndingId;
  label: string;
  subtitle: string;
  openingByTag: Record<'s1_connect' | 's1_chair' | 's1_hangup', string>;
  sequence: string[];
}

export const SEASON_1_ENDING: SeasonEnding = {
  id: 's1_hold',
  label: 'THE HOLD',
  subtitle: 'You kept the line open. The line kept you.',
  openingByTag: {
    s1_connect: 'You pressed TRANSFER. It was the only button that ever worked.',
    s1_chair: 'You sat down. The chair had been warm for thirty-nine years. It was warm for you.',
    s1_hangup: 'You hung up. It rang before your hand left it. You answered.',
  },
  sequence: [
    'The queue reaches zero.',
    'Every monitor shows the same number. It is not a frequency. It is a position.',
    'One.',
    'The music starts. It is a song you know.',
    'The console accepts you the way a lock accepts a key it was cut for.',
    'The transcript updates. It gives your start date as March 1987.',
    'It does not give your name. It gives your number.',
    'Relay twenty-three.',
    '...',
    'Somewhere behind you, a work order closes. VACANCY: FILLED.',
    'Somewhere in front of you, a man clears his throat.',
    'You hear him say it. The way he practiced it.',
    '"Hey, bug. It\'s me."',
    '...',
    "A woman's voice. You have heard it before. She was asking about a bill.",
    '"Dad?"',
    '...',
    'You do not hear the rest. The line is not yours anymore.',
    '...',
    'Forty-six calls remain.',
    'You are very good at the music.',
    '...',
    'A new voice comes through. Young. Tired. Awake too late.',
    '"Hello? Is anyone out there?"',
    'You have been waiting a long time to answer that.',
    'You lean toward the microphone.',
    '"Go ahead. I\'m listening."',
    'CUT TO BLACK.',
    'TITLE CARD: HOLD MUSIC',
  ],
};
