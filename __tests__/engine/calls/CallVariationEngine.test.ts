// __tests__/engine/calls/CallVariationEngine.test.ts
// Unit tests for CallVariationEngine — pure function, ranges, sanity-driven
// degradation, determinism under a seeded Math.random.

import { computeVariation } from '@/engine/calls/CallVariationEngine';
import type { CallVariation } from '@/engine/calls/VariationConfig';

describe('CallVariationEngine.computeVariation', () => {
  const originalRandom = Math.random;

  afterEach(() => {
    Math.random = originalRandom;
  });

  // --- Degradation ---

  it('sanity 100 → degradation 0, pitchShift 0', () => {
    Math.random = jest.fn(() => 0.5) as typeof Math.random;
    const v = computeVariation(100, 5);
    expect(v.degradation).toBe(0);
    expect(v.pitchShiftCents).toBe(0);
  });

  it('sanity 50 → degradation 0 (boundary)', () => {
    const v = computeVariation(50, 3);
    expect(v.degradation).toBe(0);
  });

  it('sanity 25 → degradation 0.5, pitchShift nonzero', () => {
    Math.random = jest.fn(() => 0.8) as typeof Math.random;
    const v = computeVariation(25, 1);
    expect(v.degradation).toBeCloseTo(0.5, 5);
    // pitchShift proportional to degradation: (0.8-0.5)*400*0.5 = 60
    expect(v.pitchShiftCents).not.toBe(0);
    expect(v.pitchShiftCents).toBe(60);
  });

  it('sanity 0 → degradation 1.0 (max drift)', () => {
    Math.random = jest.fn(() => 1) as typeof Math.random;
    const v = computeVariation(0, 0);
    expect(v.degradation).toBe(1);
    // (1 - 0.5) * 400 * 1 = 200 → max positive drift
    expect(v.pitchShiftCents).toBe(200);
  });

  it('sanity negative → degradation clamps to 1.0', () => {
    const v = computeVariation(-50, 0);
    expect(v.degradation).toBe(1);
  });

  it('sanity over 50 → degradation clamps to 0', () => {
    const v = computeVariation(200, 0);
    expect(v.degradation).toBe(0);
  });

  it('pitchShift is negative when random < 0.5 at low sanity', () => {
    Math.random = jest.fn(() => 0.1) as typeof Math.random;
    const v = computeVariation(0, 0);
    expect(v.pitchShiftCents).toBeLessThan(0);
    // (0.1 - 0.5) * 400 * 1 = -160
    expect(v.pitchShiftCents).toBe(-160);
  });

  // --- Ranges (sampled over many draws) ---

  it('introStaticMs in [200, 800) over 1000 draws', () => {
    Math.random = jest.fn(() => 0) as typeof Math.random;
    for (let i = 0; i < 1000; i++) {
      const v = computeVariation(100, 5);
      expect(v.introStaticMs).toBeGreaterThanOrEqual(200);
      expect(v.introStaticMs).toBeLessThan(800);
    }
    Math.random = jest.fn(() => 0.9999) as typeof Math.random;
    const vHigh = computeVariation(100, 5);
    expect(vHigh.introStaticMs).toBeLessThan(800);
  });

  it('outroStaticMs in [300, 1200) over 1000 draws', () => {
    Math.random = jest.fn(() => 0) as typeof Math.random;
    for (let i = 0; i < 1000; i++) {
      const v = computeVariation(100, 5);
      expect(v.outroStaticMs).toBeGreaterThanOrEqual(300);
      expect(v.outroStaticMs).toBeLessThan(1200);
    }
    Math.random = jest.fn(() => 0.9999) as typeof Math.random;
    const vHigh = computeVariation(100, 5);
    expect(vHigh.outroStaticMs).toBeLessThan(1200);
  });

  it('lineGapMs in [800, 2000) over 1000 draws', () => {
    Math.random = jest.fn(() => 0) as typeof Math.random;
    for (let i = 0; i < 1000; i++) {
      const v = computeVariation(100, 5);
      expect(v.lineGapMs).toBeGreaterThanOrEqual(800);
      expect(v.lineGapMs).toBeLessThan(2000);
    }
    Math.random = jest.fn(() => 0.9999) as typeof Math.random;
    const vHigh = computeVariation(100, 5);
    expect(vHigh.lineGapMs).toBeLessThan(2000);
  });

  it('exact bounds when random=0: min values', () => {
    Math.random = jest.fn(() => 0) as typeof Math.random;
    const v = computeVariation(100, 5);
    expect(v.introStaticMs).toBe(200);
    expect(v.outroStaticMs).toBe(300);
    expect(v.lineGapMs).toBe(800);
  });

  // --- Determinism under seeded Math.random ---

  it('deterministic: same random sequence → same output', () => {
    const seq = [0.3, 0.7, 0.5, 0.9];
    let i = 0;
    Math.random = jest.fn(() => {
      const r = seq[i % seq.length] as number;
      i++;
      return r;
    }) as typeof Math.random;

    const first = computeVariation(40, 2);
    i = 0;
    const second = computeVariation(40, 2);
    expect(second).toEqual(first);
  });

  it('different random sequence → different introStaticMs (when varied)', () => {
    Math.random = jest.fn(() => 0) as typeof Math.random;
    const low = computeVariation(100, 5);
    Math.random = jest.fn(() => 0.5) as typeof Math.random;
    const mid = computeVariation(100, 5);
    Math.random = jest.fn(() => 1) as typeof Math.random;
    const high = computeVariation(100, 5);
    expect(low.introStaticMs).toBe(200);
    expect(mid.introStaticMs).toBe(500);
    expect(high.introStaticMs).toBeCloseTo(800, 5);
  });

  // --- Return shape ---

  it('returns all five CallVariation fields', () => {
    const v: CallVariation = computeVariation(50, 3);
    expect(v).toHaveProperty('introStaticMs');
    expect(v).toHaveProperty('outroStaticMs');
    expect(v).toHaveProperty('lineGapMs');
    expect(v).toHaveProperty('degradation');
    expect(v).toHaveProperty('pitchShiftCents');
  });
});
