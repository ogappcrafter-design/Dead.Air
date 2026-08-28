// engine/progression/NightShift.ts
// NightShift engine: drives a single play session ("night shift").
//
// A shift is a 4-hour in-game block compressed to ~20 minutes real-time.
// Calls are pre-computed at shift start and triggered at scheduled in-game
// minutes. The engine is framework-agnostic — the React hook (useNightShift)
// drives it via tick(deltaMs) on each animation frame.
//
// Pure DI: no store imports, no React, no Date.now. Fully testable in isolation.

import type { CallFrequency } from '../calls/CallScheduler';
import { realMsToInGameMinutes } from './TimeCompression';
import {
  DEFAULT_IN_GAME_MINUTES,
  DEFAULT_SHIFT_DURATION_MS,
  type NightShiftConfig,
} from './NightShiftConfig';

// --- Public types ---

export type ShiftPhase = 'off-air' | 'on-air' | 'break' | 'sign-off';

export interface ScheduledCall {
  /** In-game minute when this call triggers. */
  triggerMinute: number;
  /** Call ID from the registry. */
  callId: number;
}

export interface ShiftState {
  phase: ShiftPhase;
  /** In-game clock time in minutes (0-240 = 4 hours). */
  inGameMinutes: number;
  /** Real-time elapsed in ms since shift start. */
  realTimeMs: number;
  /** Calls scheduled this shift (pre-computed at shift start). */
  scheduledCalls: ScheduledCall[];
  /** Current call index (0-based). */
  nextCallIndex: number;
  /** True when shift has ended. */
  isComplete: boolean;
}

// --- Call-frequency → call-count mapping ---
//
// The brief: "more calls for 'high' than 'low'." We use a fixed per-frequency
// count, capped by the number of available call IDs. Numbers are tuned for a
// 240-minute in-game shift: low ≈ 1 call per in-game hour, medium ≈ 2, high ≈ 4.
const CALLS_PER_FREQUENCY: Record<CallFrequency, number> = {
  low: 4,
  medium: 8,
  high: 16,
};

// --- Phase thresholds (as fractions of inGameMinutes) ---
//
// The shift alternates on-air and break segments, ending with sign-off.
// 0.00–0.45  → on-air
// 0.45–0.55  → break (mid-shift breather)
// 0.55–1.00  → on-air
// 1.00+      → sign-off (complete)
const BREAK_START_FRACTION = 0.45;
const BREAK_END_FRACTION = 0.55;

// --- NightShift engine ---

export class NightShift {
  private readonly config: NightShiftConfig;
  private state: ShiftState;

  constructor(config: NightShiftConfig) {
    this.config = config;
    this.state = this.makeInitialState();
  }

  /** Start a new shift. Pre-computes call schedule. Returns initial state. */
  startShift(): ShiftState {
    const scheduledCalls = this.computeSchedule();
    this.state = {
      phase: 'on-air',
      inGameMinutes: 0,
      realTimeMs: 0,
      scheduledCalls,
      nextCallIndex: 0,
      isComplete: false,
    };
    return this.getState();
  }

  /**
   * Tick: advance in-game time by real-time delta. Returns updated state.
   *
   * - Converts deltaMs to in-game minutes using TimeCompression.
   * - Accumulates realTimeMs and inGameMinutes.
   * - Updates phase based on in-game time relative to total shift length.
   * - Marks complete + 'sign-off' once inGameMinutes reaches the shift length.
   * - No-op (returns current state) if the shift is already complete.
   */
  tick(deltaMs: number): ShiftState {
    if (this.state.isComplete) {
      return this.getState();
    }
    if (deltaMs <= 0) {
      return this.getState();
    }

    const newRealTimeMs = this.state.realTimeMs + deltaMs;
    const newInGameMinutes = realMsToInGameMinutes(
      newRealTimeMs,
      this.config.shiftDurationMs,
      this.config.inGameMinutes,
    );

    const isComplete = newInGameMinutes >= this.config.inGameMinutes;
    const phase = isComplete ? 'sign-off' : this.phaseForMinute(newInGameMinutes);

    this.state = {
      ...this.state,
      realTimeMs: newRealTimeMs,
      inGameMinutes: newInGameMinutes,
      phase,
      isComplete,
    };

    return this.getState();
  }

  /** Get current state (defensive copy). */
  getState(): ShiftState {
    return { ...this.state, scheduledCalls: [...this.state.scheduledCalls] };
  }

  /**
   * Is a call due to trigger now?
   * True when there is an unconsumed scheduled call whose triggerMinute
   * has been reached or passed by the current in-game clock.
   */
  shouldTriggerCall(): boolean {
    if (this.state.isComplete) {
      return false;
    }
    const next = this.state.scheduledCalls[this.state.nextCallIndex];
    if (next === undefined) {
      return false;
    }
    return this.state.inGameMinutes >= next.triggerMinute;
  }

  /**
   * Consume the next scheduled call (advances index).
   * @returns the consumed ScheduledCall, or null if none remain.
   */
  consumeCall(): ScheduledCall | null {
    const next = this.state.scheduledCalls[this.state.nextCallIndex];
    if (next === undefined) {
      return null;
    }
    this.state = {
      ...this.state,
      nextCallIndex: this.state.nextCallIndex + 1,
    };
    return next;
  }

  /** End the shift early (e.g. player quits). Marks complete, phase='sign-off'. */
  endShift(): ShiftState {
    this.state = {
      ...this.state,
      isComplete: true,
      phase: 'sign-off',
    };
    return this.getState();
  }

  // --- Internal helpers ---

  /** Build the initial (pre-start) state. */
  private makeInitialState(): ShiftState {
    return {
      phase: 'off-air',
      inGameMinutes: 0,
      realTimeMs: 0,
      scheduledCalls: [],
      nextCallIndex: 0,
      isComplete: false,
    };
  }

  /**
   * Pre-compute the call schedule for this shift.
   *
   * - Count = CALLS_PER_FREQUENCY[callFrequency], capped by availableCallIds.length.
   * - Calls are evenly spaced across the shift at:
   *   triggerMinute_i = round((i + 1) * inGameMinutes / (count + 1))
   *   This avoids a call at minute 0 and spaces calls deterministically.
   * - Call IDs are taken in order from availableCallIds (stable, predictable).
   * - If availableCallIds is empty, the schedule is empty (shift runs call-free).
   */
  private computeSchedule(): ScheduledCall[] {
    const desired = CALLS_PER_FREQUENCY[this.config.callFrequency];
    const count = Math.min(desired, this.config.availableCallIds.length);
    if (count <= 0) {
      return [];
    }
    const schedule: ScheduledCall[] = [];
    for (let i = 0; i < count; i++) {
      const triggerMinute = Math.round(((i + 1) * this.config.inGameMinutes) / (count + 1));
      const callId = this.config.availableCallIds[i];
      if (callId === undefined) {
        break;
      }
      schedule.push({ triggerMinute, callId });
    }
    return schedule;
  }

  /** Determine phase from in-game minute. */
  private phaseForMinute(minute: number): ShiftPhase {
    if (minute >= this.config.inGameMinutes) {
      return 'sign-off';
    }
    const breakStart = this.config.inGameMinutes * BREAK_START_FRACTION;
    const breakEnd = this.config.inGameMinutes * BREAK_END_FRACTION;
    if (minute >= breakStart && minute < breakEnd) {
      return 'break';
    }
    return 'on-air';
  }
}

// --- Module-level singleton (follows CallManager / CallScheduler pattern) ---

let nightShiftInstance: NightShift | null = null;

/** Get the singleton NightShift. Returns null if not yet initialized. */
export const getNightShift = (): NightShift | null => nightShiftInstance;

/** Initialize the singleton NightShift. Idempotent — safe to call once at boot. */
export const initNightShift = (config: NightShiftConfig): NightShift => {
  if (nightShiftInstance === null) {
    nightShiftInstance = new NightShift(config);
  }
  return nightShiftInstance;
};

/** Test-only: clear singleton. Allows fresh per-test instantiation. */
export const resetNightShift = (): void => {
  if (nightShiftInstance !== null) {
    nightShiftInstance.endShift();
    nightShiftInstance = null;
  }
};

// Re-export config defaults for convenience.
export { DEFAULT_SHIFT_DURATION_MS, DEFAULT_IN_GAME_MINUTES };
