// __tests__/engine/audio/LatencyProfiler.test.ts
import { LatencyProfiler, EMPTY_STATS } from '../../../engine/audio/LatencyProfiler';
import {
  BALANCED_CONFIG,
  INTERACTIVE_CONFIG,
  PLAYBACK_CONFIG,
  configForHint,
  mergeConfig,
} from '../../../engine/audio/AudioPerformanceConfig';

describe('LatencyProfiler', () => {
  it('EMPTY_STATS has zeroed initial values', () => {
    expect(EMPTY_STATS.count).toBe(0);
    expect(EMPTY_STATS.meanMs).toBe(0);
    expect(EMPTY_STATS.minMs).toBe(Infinity);
    expect(EMPTY_STATS.maxMs).toBe(0);
    expect(EMPTY_STATS.p95Ms).toBe(0);
    expect(EMPTY_STATS.lastMs).toBe(0);
  });

  it('startCall marks measurement in progress', () => {
    const p = new LatencyProfiler();
    expect(p.isMeasuring()).toBe(false);
    p.startCall(1);
    expect(p.isMeasuring()).toBe(true);
  });

  it('endCall without markFirstOutput returns null and resets', () => {
    const p = new LatencyProfiler();
    p.startCall(1);
    const result = p.endCall(1);
    expect(result).toBeNull();
    expect(p.isMeasuring()).toBe(false);
  });

  it('endCall with mismatched callId returns null', () => {
    const p = new LatencyProfiler();
    p.startCall(1);
    p.markFirstOutput();
    const result = p.endCall(2);
    expect(result).toBeNull();
  });

  it('valid measurement returns non-negative latency and updates stats', () => {
    const p = new LatencyProfiler();
    p.startCall(1);
    p.markFirstOutput();
    const latency = p.endCall(1);
    expect(latency).not.toBeNull();
    expect(latency as number).toBeGreaterThanOrEqual(0);

    const stats = p.getStats();
    expect(stats.count).toBe(1);
    expect(stats.lastMs).toBe(latency);
    expect(stats.minMs).toBe(latency);
    expect(stats.maxMs).toBe(latency);
    expect(stats.meanMs).toBe(latency);
  });

  it('multiple measurements update rolling stats correctly', () => {
    const p = new LatencyProfiler();
    for (let i = 0; i < 3; i++) {
      p.startCall(i);
      p.markFirstOutput();
      p.endCall(i);
    }
    const stats = p.getStats();
    expect(stats.count).toBe(3);
    expect(stats.minMs).toBeGreaterThanOrEqual(0);
    expect(stats.maxMs).toBeGreaterThanOrEqual(stats.minMs);
    expect(stats.meanMs).toBeGreaterThanOrEqual(0);
  });

  it('markFirstOutput is idempotent within one call', () => {
    const p = new LatencyProfiler();
    p.startCall(1);
    p.markFirstOutput();
    p.markFirstOutput();
    const latency = p.endCall(1);
    expect(latency).not.toBeNull();
  });

  it('exceededBudget returns false when no measurements taken', () => {
    const p = new LatencyProfiler();
    expect(p.exceededBudget(100)).toBe(false);
  });

  it('exceededBudget returns true when last latency exceeds budget', () => {
    const p = new LatencyProfiler();
    p.startCall(1);
    p.markFirstOutput();
    p.endCall(1);
    expect(p.exceededBudget(-1)).toBe(true);
  });

  it('exceededBudget returns false when last latency within budget', () => {
    const p = new LatencyProfiler();
    p.startCall(1);
    p.markFirstOutput();
    p.endCall(1);
    expect(p.exceededBudget(10000)).toBe(false);
  });

  it('getStats returns a copy, not internal state', () => {
    const p = new LatencyProfiler();
    p.startCall(1);
    p.markFirstOutput();
    p.endCall(1);
    const s1 = p.getStats();
    p.startCall(2);
    p.markFirstOutput();
    p.endCall(2);
    const s2 = p.getStats();
    expect(s2.count).toBe(s1.count + 1);
    expect(s1.count).toBe(1);
  });
});

describe('AudioPerformanceConfig', () => {
  it('BALANCED_CONFIG has expected defaults', () => {
    expect(BALANCED_CONFIG.latencyHint).toBe('balanced');
    expect(BALANCED_CONFIG.bitcrush.curveSamples).toBe(1024);
    expect(BALANCED_CONFIG.bitcrush.distortionOversample).toBe('4x');
    expect(BALANCED_CONFIG.bitcrush.voiceOversample).toBe('2x');
    expect(BALANCED_CONFIG.reverb.cacheIR).toBe(true);
    expect(BALANCED_CONFIG.staticSynth.shaperOversample).toBe('2x');
  });

  it('INTERACTIVE_CONFIG has lower-latency values', () => {
    expect(INTERACTIVE_CONFIG.latencyHint).toBe('interactive');
    expect(INTERACTIVE_CONFIG.bitcrush.curveSamples).toBeLessThan(
      BALANCED_CONFIG.bitcrush.curveSamples,
    );
    expect(INTERACTIVE_CONFIG.bitcrush.distortionOversample).toBe('2x');
    expect(INTERACTIVE_CONFIG.bitcrush.voiceOversample).toBe('none');
    expect(INTERACTIVE_CONFIG.reverb.irDurationSec).toBeLessThan(
      BALANCED_CONFIG.reverb.irDurationSec,
    );
  });

  it('PLAYBACK_CONFIG has higher-quality values', () => {
    expect(PLAYBACK_CONFIG.latencyHint).toBe('playback');
    expect(PLAYBACK_CONFIG.bitcrush.curveSamples).toBeGreaterThan(
      BALANCED_CONFIG.bitcrush.curveSamples,
    );
    expect(PLAYBACK_CONFIG.bitcrush.voiceOversample).toBe('4x');
  });

  it('configForHint returns correct preset', () => {
    expect(configForHint('interactive')).toBe(INTERACTIVE_CONFIG);
    expect(configForHint('balanced')).toBe(BALANCED_CONFIG);
    expect(configForHint('playback')).toBe(PLAYBACK_CONFIG);
  });

  it('mergeConfig deep-merges nested objects', () => {
    const merged = mergeConfig(BALANCED_CONFIG, {
      bitcrush: { curveSamples: 256 },
    });
    expect(merged.bitcrush.curveSamples).toBe(256);
    expect(merged.bitcrush.distortionOversample).toBe(
      BALANCED_CONFIG.bitcrush.distortionOversample,
    );
    expect(merged.latencyHint).toBe(BALANCED_CONFIG.latencyHint);
  });

  it('mergeConfig overrides top-level primitives', () => {
    const merged = mergeConfig(BALANCED_CONFIG, { latencyHint: 'interactive' });
    expect(merged.latencyHint).toBe('interactive');
    expect(merged.bitcrush).toEqual(BALANCED_CONFIG.bitcrush);
  });
});
