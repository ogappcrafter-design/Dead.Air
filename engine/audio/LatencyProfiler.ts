// engine/audio/LatencyProfiler.ts
// Measures end-to-end audio latency from call start to first audio output.
// Provides rolling statistics and can be queried for performance budgets.

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

/** Initial empty stats. */
export const EMPTY_STATS: LatencyStats = {
  count: 0,
  meanMs: 0,
  minMs: Infinity,
  maxMs: 0,
  p95Ms: 0,
  lastMs: 0,
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
  // Ring buffer for p95 — keeps last 100 samples.
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
