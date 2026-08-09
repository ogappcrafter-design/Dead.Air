// tests/engine/latencyProfiler.test.ts
import { LatencyProfiler } from '@/engine/audio/LatencyProfiler';

describe('LatencyProfiler', () => {
  let profiler: LatencyProfiler;

  beforeEach(() => {
    profiler = new LatencyProfiler();
  });

  describe('getLatencyStats', () => {
    it('returns EMPTY_DETAILED_STATS when no samples', () => {
      const stats = profiler.getLatencyStats();
      expect(stats.samples).toBe(0);
      expect(stats.avg).toBe(0);
      expect(stats.p50).toBe(0);
      expect(stats.p90).toBe(0);
      expect(stats.p99).toBe(0);
    });

    it('returns p50/p90/p99 after recording samples', () => {
      // Record 5 calls — latency may be 0 in fast test environments
      for (let i = 0; i < 5; i++) {
        profiler.startCall(i);
        profiler.markFirstOutput();
        profiler.endCall(i);
      }
      const stats = profiler.getLatencyStats();
      expect(stats.samples).toBe(5);
      expect(stats.avg).toBeGreaterThanOrEqual(0);
      expect(stats.p50).toBeGreaterThanOrEqual(0);
      expect(stats.p90).toBeGreaterThanOrEqual(0);
      expect(stats.p99).toBeGreaterThanOrEqual(0);
      expect(stats.last).toBeGreaterThanOrEqual(0);
    });

    it('p50 <= p90 <= p99 for sorted data', () => {
      // Record enough samples to get meaningful percentiles
      for (let i = 0; i < 10; i++) {
        profiler.startCall(i);
        profiler.markFirstOutput();
        profiler.endCall(i);
      }
      const stats = profiler.getLatencyStats();
      expect(stats.p50).toBeLessThanOrEqual(stats.p90);
      expect(stats.p90).toBeLessThanOrEqual(stats.p99);
    });
  });

  describe('suggestLatencyHint', () => {
    it('returns null when fewer than 3 samples', () => {
      profiler.startCall(0);
      profiler.markFirstOutput();
      profiler.endCall(0);
      expect(profiler.suggestLatencyHint()).toBeNull();
    });

    it('returns a LatencyHint after 3+ samples', () => {
      for (let i = 0; i < 5; i++) {
        profiler.startCall(i);
        profiler.markFirstOutput();
        profiler.endCall(i);
      }
      const hint = profiler.suggestLatencyHint();
      // Real latencies in test are near-zero, so 'interactive' is expected
      expect(['interactive', 'balanced', 'playback']).toContain(hint);
    });
  });

  describe('existing API', () => {
    it('getStats returns LatencyStats with count', () => {
      profiler.startCall(0);
      profiler.markFirstOutput();
      profiler.endCall(0);
      const stats = profiler.getStats();
      expect(stats.count).toBe(1);
      expect(stats.meanMs).toBeGreaterThanOrEqual(0);
      expect(stats.minMs).toBeGreaterThanOrEqual(0);
      expect(stats.maxMs).toBeGreaterThanOrEqual(0);
      expect(stats.lastMs).toBeGreaterThanOrEqual(0);
    });

    it('exceededBudget returns false when no calls measured', () => {
      expect(profiler.exceededBudget(100)).toBe(false);
    });

    it('exceededBudget returns false when budget exceeds last call latency', () => {
      profiler.startCall(0);
      profiler.markFirstOutput();
      profiler.endCall(0);
      expect(profiler.exceededBudget(1000)).toBe(false);
    });

    it('endCall returns null for mismatched callId', () => {
      profiler.startCall(1);
      profiler.markFirstOutput();
      const result = profiler.endCall(99);
      expect(result).toBeNull();
    });

    it('endCall returns null when no startCall was called', () => {
      const result = profiler.endCall(0);
      expect(result).toBeNull();
    });

    it('isMeasuring returns true after startCall', () => {
      profiler.startCall(0);
      expect(profiler.isMeasuring()).toBe(true);
    });

    it('isMeasuring returns false after endCall', () => {
      profiler.startCall(0);
      profiler.markFirstOutput();
      profiler.endCall(0);
      expect(profiler.isMeasuring()).toBe(false);
    });
  });
});
