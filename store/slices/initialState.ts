// store/slices/initialState.ts
// Shared full-state reset constant. Imported by slices that need to
// reset the entire game state (e.g. starting a NG+ or Endless Night run).

import { MAX_SANITY } from '../../lib/constants';
import type { Band } from '../../lib/constants';
import type { DifficultyMode } from '../../lib/difficulty';

export const initialState = {
  // Core game state
  sanity: MAX_SANITY,
  static: 0,
  tapes: [] as string[],
  unlockedBands: ['LIVING'] as Band[],
  isPlaying: false,
  currentCall: null as string | null,
  receivedCalls: [] as number[],
  sanityLowest: MAX_SANITY,
  shiftsCompleted: 0,
  longestCallSurvivedMs: 0,
  shiftsCompletedByDifficulty: {} as Partial<Record<DifficultyMode, number>>,

  // NG+ state
  ngPlusUnlocked: false,
  ngPlusActive: false,
  ngPlusCompleted: 0,

  // Endless Night state
  endlessModeActive: false,
  endlessScore: 0,
  endlessHighScore: 0,
  escalationLevel: 0,
  endlessWeather: 'Clear',
  endlessGameOver: false,

  // Tape Mastery state
  tapeListenCounts: {} as Record<string, number>,
};
