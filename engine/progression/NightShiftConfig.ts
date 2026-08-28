// engine/progression/NightShiftConfig.ts
// Configuration for a NightShift. All fields are injected at construction
// time so tests can substitute any values without touching stores.

import type { CallFrequency } from '../calls/CallScheduler';

/**
 * Configuration for a single night shift.
 *
 * Defaults match the brief: a 4-hour in-game shift compressed to ~20 minutes
 * real-time (12x compression). The caller is responsible for sourcing
 * `availableCallIds` (typically from CallScheduler.selectCall) and
 * `callFrequency` (from useSettingsStore).
 */
export interface NightShiftConfig {
  /** Real-time duration of a full shift in ms (default: 1_200_000 = 20 min). */
  shiftDurationMs: number;
  /** In-game shift length in minutes (default: 240 = 4 hours). */
  inGameMinutes: number;
  /** Call frequency setting from useSettingsStore. */
  callFrequency: CallFrequency;
  /** Available call IDs for this shift (from CallScheduler.selectCall). */
  availableCallIds: readonly number[];
}

/** Default config values — used by NightShift when a caller omits a field. */
export const DEFAULT_SHIFT_DURATION_MS = 1_200_000; // 20 minutes real-time
export const DEFAULT_IN_GAME_MINUTES = 240; // 4 hours in-game

/**
 * Fill missing fields with defaults, returning a complete config object.
 * Does not mutate the input.
 */
export function resolveConfig(
  partial: Partial<NightShiftConfig> & Pick<NightShiftConfig, 'callFrequency' | 'availableCallIds'>,
): NightShiftConfig {
  return {
    shiftDurationMs: partial.shiftDurationMs ?? DEFAULT_SHIFT_DURATION_MS,
    inGameMinutes: partial.inGameMinutes ?? DEFAULT_IN_GAME_MINUTES,
    callFrequency: partial.callFrequency,
    availableCallIds: partial.availableCallIds,
  };
}
