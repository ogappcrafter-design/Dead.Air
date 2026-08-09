// engine/audio/LatencyProfiler.ts
// Measures end-to-end audio latency from call start to first audio output.
// Provides rolling statistics and can be queried for performance budgets.
// Extended with p50/p90/p99 percentiles and preset auto-suggestion.

import type { LatencyHint } from './AudioPerformanceConfig';

/**
 * LatencyProfiler — lightweight timing instrumentation for audio paths.
 *
 * Contract:
 * - `startCall()` marks the entry point (e.g. CallManager.startCall).
 * - `markFirstOutput()` marks when the first sample reaches the destination.
 * - `endCall()` records the measurement and updates rolling stats.
 * - Stats persist across calls to track trends.
 * - All methods are real-time safe (no allocations on the hot path)
 *   except `endCall()` which updates the stats record.
 *
 * Usage:
 *   const profiler = new LatencyProfiler();
 *   profiler.startCall(42);     // callId
 *   // ... audio graph starts ...
 *   profiler.markFirstOutput(); // first frame audible
 *   const latency = profiler.endCall(42); // returns ms, updates stats
 */
export interface LatencyStats {
  /** Number of completed calls measured. */
  count: number;
  /** Mean latency in ms. */
  meanMs: number;
  /** Minimum latency observed. */
  minMs: number;
  /** Maximum latency observed. */
  maxMs: number;
  /** P95 latency (rolling, approximate). */
  p95Ms: number;
  /** Last recorded latency. */
  lastMs: number;
}

/**
 * Extended latency stats with p50/p90/p99 percentiles.
 * Returned by `getLatencyStats()`.
 */
export interface DetailedLatencyStats {
  /** Number of completed calls measured. */
  samples: number;
  /** Average latency in ms. */
  avg: number;
  /** P50 (median) latency in ms. */
  p50: number;
  /** P90 latency in ms. */
  p90: number;
  /** P99 latency in ms. */
  p99: number;
  /** P95 latency in ms (carried from legacy stats). */
  p95: number;
  /** Minimum latency in ms. */
  min: number;
  /** Maximum latency in ms. */
  max: number;
  /** Last recorded latency in ms. */
  last: number;
}

/** Initial empty stats. */
export const EMPTY_STATS: LatencyStats = {
  count: 0,
  meanMs: 0,
  minMs: Infinity,
  maxMs: 0,
  p95Ms: 0,
  lastMs: 0,
};

/** Initial empty detailed stats. */
export const EMPTY_DETAILED_STATS: DetailedLatencyStats = {
  samples: 0,
  avg: 0,
  p50: 0,
  p90: 0,
  p99: 0,
  p95: 0,
  min: 0,
  max: 0,
  last: 0,
};

/**
 * LatencyProfiler tracks per-call timing from call start to first audio output.
 * Thread-safe by single-threaded JS nature; not safe across JS realms.
 */
export class LatencyProfiler {
  private startTime: number | null = null;
  private firstOutputTime: number | null = null;
  private currentCallId: number | null = null;
  private stats: LatencyStats = { ...EMPTY_STATS };
  // Ring buffer for percentiles — keeps last 100 samples.
  private readonly samples: number[] = [];
  private static readonly MAX_SAMPLES = 100;

  // Monotonic high-resolution timer; falls back to Date.now() if performance
  // is unavailable (e.g. some SSR / non-browser runtimes).
  private static now(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  /** Mark start of a call. Resets any in-progress measurement. */
  startCall(callId: number): void {
    this.startTime = LatencyProfiler.now();
    this.firstOutputTime = null;
    this.currentCallId = callId;
  }

  /** Mark the first audio frame reaching output. No-op if startCall not called. */
  markFirstOutput(): void {
    if (this.startTime === null || this.firstOutputTime !== null) {
      return;
    }
    this.firstOutputTime = LatencyProfiler.now();
  }

  /**
   * End a call measurement. Returns latency in ms, or null if no valid measurement.
   * Updates rolling stats. Stale callIds are rejected without resetting the
   * current measurement so a delayed endCall for an older call cannot erase
   * a newer active measurement.
   */
  endCall(callId: number): number | null {
    if (this.currentCallId !== null && this.currentCallId !== callId) {
      return null;
    }
    if (this.startTime === null || this.firstOutputTime === null) {
      this.reset();
      return null;
    }
    const latency = this.firstOutputTime - this.startTime;
    this.updateStats(latency);
    this.reset();
    return latency;
  }

  /** Current stats snapshot. */
  getStats(): LatencyStats {
    return { ...this.stats };
  }

  /**
   * Detailed latency stats with p50/p90/p99 percentiles.
   * Returns a snapshot computed from the samples ring buffer.
   */
  getLatencyStats(): DetailedLatencyStats {
    if (this.samples.length === 0) {
      return { ...EMPTY_DETAILED_STATS };
    }
    return {
      samples: this.samples.length,
      avg: this.stats.meanMs,
      p50: this.percentile(50),
      p90: this.percentile(90),
      p99: this.percentile(99),
      p95: this.stats.p95Ms,
      min: this.stats.minMs === Infinity ? 0 : this.stats.minMs,
      max: this.stats.maxMs,
      last: this.stats.lastMs,
    };
  }

  /** True if a measurement is currently in progress. */
  isMeasuring(): boolean {
    return this.startTime !== null;
  }

  /**
   * Check if the last call's latency exceeded the budget (ms).
   * Returns false if no calls have been measured or the last one was invalid.
   */
  exceededBudget(budgetMs: number): boolean {
    return this.stats.count > 0 && this.stats.lastMs > budgetMs;
  }

  /**
   * Auto-suggest a latency hint based on observed p90 latency.
   * If p90 > 100ms, suggest 'playback' (prioritize stability over interactivity).
   * If p90 > 50ms, suggest 'balanced'.
   * Otherwise suggest 'interactive'.
   *
   * Returns null if not enough samples (<3) for a meaningful suggestion.
   */
  suggestLatencyHint(): LatencyHint | null {
    if (this.samples.length < 3) {
      return null;
    }
    const p90 = this.percentile(90);
    if (p90 > 100) {
      return 'playback';
    }
    if (p90 > 50) {
      return 'balanced';
    }
    return 'interactive';
  }

  /** Reset all measurements (not stats). Called internally after endCall. */
  private reset(): void {
    this.startTime = null;
    this.firstOutputTime = null;
    this.currentCallId = null;
  }

  /** Update rolling stats with a new sample. */
  private updateStats(latencyMs: number): void {
    this.samples.push(latencyMs);
    if (this.samples.length > LatencyProfiler.MAX_SAMPLES) {
      this.samples.shift();
    }
    const count = this.stats.count + 1;
    const meanMs = (this.stats.meanMs * this.stats.count + latencyMs) / count;
    const minMs = Math.min(this.stats.minMs, latencyMs);
    const maxMs = Math.max(this.stats.maxMs, latencyMs);
    const p95Ms = this.percentile(95);
    this.stats = {
      count,
      meanMs,
      minMs,
      maxMs,
      p95Ms,
      lastMs: latencyMs,
    };
  }

  /** Calculate a percentile from the samples buffer. */
  private percentile(p: number): number {
    if (this.samples.length === 0) {
      return 0;
    }
    const sorted = [...this.samples].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    const safeIdx = Math.max(0, Math.min(sorted.length - 1, idx));
    return sorted[safeIdx] as number;
  }
}
