// engine/calls/CallScheduler.ts
// Determines WHEN to trigger a call (based on user callFrequency setting)
// and WHICH call to trigger (based on current band + cycle-before-repeat).
// The radio screen calls shouldTriggerCall(now) on a tick interval, then
// selectCall() to get a call ID to pass to CallManager.startCall(id).

import type { Band } from '../../lib/constants';
import type { CallData } from './types';

/** User-callable frequency setting from useSettingsStore. */
export type CallFrequency = 'low' | 'medium' | 'high';

/** Config injected from stores. Injectable for tests. */
export interface SchedulingConfig {
  frequency: CallFrequency;
  currentBand: Band;
  /** Bands the player has unlocked (gates which calls are selectable). */
  unlockedBands: Band[];
  /** Call IDs already received this cycle (to avoid immediate repeats). */
  receivedCallIds: number[];
}

/** Call registry — same shape CallManager uses. Injectable for tests. */
export type SchedulerCallRegistry = ReadonlyArray<CallData>;

/** Map band → band index 0..4 (for matching call.band field). */
const bandIndex = (band: Band): number => {
  switch (band) {
    case 'LIVING':
      return 0;
    case 'LIMINAL':
      return 1;
    case 'LOST':
      return 2;
    case 'CLASSIFIED':
      return 3;
    case '████████':
      return 4;
    case 'WEATHER':
      return 5;
    case 'PIRATE':
      return 6;
    case 'HISTORICAL':
      return 7;
    default: {
      // Exhaustive: switch is total over Band.
      const _exhaustive: never = band;
      return _exhaustive as number;
    }
  }
};

/**
 * Per-frequency timing bands [minMs, maxMs].
 * Per brief: low ~60-90s, medium ~30-45s, high ~15-20s.
 * Each cycle picks a random deadline within the band so pacing
 * varies call-to-call instead of always using the lower bound.
 */
const FREQUENCY_BANDS_MS: Record<CallFrequency, [number, number]> = {
  low: [60_000, 90_000],
  medium: [30_000, 45_000],
  high: [15_000, 20_000],
};

/**
 * CallScheduler — timing + call selection.
 *
 * Contract:
 * - `configure(config)`: snapshot current band, frequency, unlocks, received.
 * - `shouldTriggerCall(now)`: true if at least one interval has elapsed since
 *   the last trigger (or since construction) AND a call is available for the
 *   current band. Does not itself trigger — caller decides.
 * - `selectCall()`: returns a call ID for the current band, cycling through all
 *   band calls before repeating. Returns null if no calls available for the
 *   current band (e.g. band not unlocked, or registry empty for that band).
 * - `markReceived(callId)`: track that a call was received; resets the cycle
 *   once all band calls have been received.
 * - `reset()`: clear received list + lastTrigger timestamp.
 *
 * The scheduler is deliberately stateless across sessions — `receivedCallIds`
 * comes from the caller (typically useGameStore's receivedCalls). The
 * scheduler's own `received` set is a working copy that markReceived mutates;
 * the caller is responsible for persisting received calls if desired.
 */
export class CallScheduler {
  private registry: SchedulerCallRegistry;
  private frequency: CallFrequency = 'medium';
  private currentBand: Band = 'LIVING';
  private unlockedBands: Band[] = ['LIVING'];
  private received: Set<number> = new Set();
  private lastTriggerAt: number = Number.NEGATIVE_INFINITY;
  /** Current randomized interval for the active frequency band. */
  private currentIntervalMs: number;

  constructor(registry: SchedulerCallRegistry) {
    this.registry = registry;
    this.currentIntervalMs = this.pickInterval();
  }

  /** Pick a random interval within the current frequency's [min, max] band. */
  private pickInterval(): number {
    const [min, max] = FREQUENCY_BANDS_MS[this.frequency];
    return min + Math.random() * (max - min);
  }

  /** Update config from stores. Safe to call any time. */
  configure(config: SchedulingConfig): void {
    const oldFrequency = this.frequency;
    this.frequency = config.frequency;
    this.currentBand = config.currentBand;
    this.unlockedBands = config.unlockedBands;
    this.received = new Set(config.receivedCallIds);
    if (oldFrequency !== config.frequency) {
      this.currentIntervalMs = this.pickInterval();
    }
  }

  /**
   * True if enough time has passed since the last trigger for the current
   * frequency setting. Does NOT check call availability — use selectCall()
   * for that. Use shouldTriggerCall() first to gate tick-driven triggers.
   * @param now current timestamp in ms (e.g. Date.now())
   */
  shouldTriggerCall(now: number): boolean {
    return now - this.lastTriggerAt >= this.currentIntervalMs;
  }

  /**
   * Select a call ID for the current band, cycling through all band calls
   * before repeating. Returns null if:
   * - current band is not unlocked, or
   * - registry has no calls for the current band.
   *
   * Cycle logic: filter calls for the current band, exclude received ones.
   * If all band calls have been received, reset the cycle (clear received
   * for this band) and pick from the full set again. Pick the first
   * un-received call (stable order = data order).
   */
  selectCall(): number | null {
    const bandIdx = bandIndex(this.currentBand);
    if (!this.isBandUnlocked(this.currentBand)) {
      return null;
    }
    const bandCallIds = this.callsForBand(bandIdx);
    if (bandCallIds.length === 0) {
      return null;
    }
    // Find un-received calls in stable data order.
    const unreceived = bandCallIds.filter((id) => !this.received.has(id));
    if (unreceived.length === 0) {
      // All received — reset cycle for this band, pick first.
      for (const id of bandCallIds) {
        this.received.delete(id);
      }
      return bandCallIds[0] ?? null;
    }
    return unreceived[0] ?? null;
  }

  /** Mark a call as received (so it won't be selected again this cycle). */
  markReceived(callId: number): void {
    this.received.add(callId);
    this.lastTriggerAt = Date.now();
    this.currentIntervalMs = this.pickInterval();
  }

  /** Get a snapshot of received call IDs (for caller to persist). */
  getReceivedCalls(): number[] {
    return Array.from(this.received).sort((a, b) => a - b);
  }

  /** Reset: clear received list + lastTrigger timestamp + re-randomize interval. */
  reset(): void {
    this.received = new Set();
    this.lastTriggerAt = Number.NEGATIVE_INFINITY;
    this.currentIntervalMs = this.pickInterval();
  }

  /** Replace the call registry (e.g. if Infinite Signal appends AI calls). */
  setRegistry(registry: SchedulerCallRegistry): void {
    this.registry = registry;
  }

  // --- Internal helpers ---

  /** True if the band is in the player's unlockedBands list. */
  private isBandUnlocked(band: Band): boolean {
    return this.unlockedBands.includes(band);
  }

  /** All call IDs whose `band` field matches the given band index, in data order. */
  private callsForBand(bandIdx: number): number[] {
    const ids: number[] = [];
    for (const call of this.registry) {
      if (call.band === bandIdx) {
        ids.push(call.id);
      }
    }
    return ids;
  }
}

// --- Module-level singleton ---

let callSchedulerInstance: CallScheduler | null = null;

/** Get the singleton scheduler. Returns null if not initialized. */
export const getCallScheduler = (): CallScheduler | null => callSchedulerInstance;

/** Initialize singleton scheduler. Idempotent. */
export const initCallScheduler = (registry: SchedulerCallRegistry): CallScheduler => {
  if (callSchedulerInstance === null) {
    callSchedulerInstance = new CallScheduler(registry);
  }
  return callSchedulerInstance;
};

/** Test-only: clear singleton. */
export const resetCallScheduler = (): void => {
  if (callSchedulerInstance !== null) {
    callSchedulerInstance.reset();
    callSchedulerInstance = null;
  }
};
