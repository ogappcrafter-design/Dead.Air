/**
 * The archive. Tapes are awarded by specific calls and specific choices —
 * a full set requires taking the right branch on every branching call.
 */
export const ALL_TAPES = [
  'Tape #1 — The Wrong Number',
  "Tape #2 — The Collector's Archive",
  'Tape #3 — The 3:47 Sessions',
  "Tape #4 — Yesterday's Frequency",
  'Tape #5 — Echo Chamber',
  'Tape #6 — Signal From Guardian',
  'Tape #7 — Found Signal',
  'Tape #8 — Her Voice',
  'Tape #9 — Open Sky',
  'Tape #10 — Courtesy Call',
  'Tape #11 — ARIA-9 Transcript',
  'Tape #12 — The Network',
  'Tape #13 — First Transmission',
  'Tape #14 — The Choice',
  'Tape #15 — What Answered',
];

export const TAPE_COUNT = ALL_TAPES.length;

/** Redacted label shown for a tape the player has not earned yet. */
export const maskedTape = (index) => `Tape #${index + 1} — ${'█'.repeat(12)}`;
