/// <reference types="jest" />
// __tests__/engine/calls/SanityEffectEngine.test.ts
// Unit tests for the pure computeSanityEffect function.

import { computeSanityEffect } from '@/engine/calls/SanityEffectEngine';
import type { SanityEffect } from '@/engine/calls/SanityEffectConfig';

const LOW_TIER_TEXTS = [
  "don't look behind you",
  'the signal is you',
  "they're all still here",
  'you never hung up',
];

const MID_TIER_TEXTS = ['did you hear that?', "it's still on the line"];

function within(value: number, lo: number, hi: number, tol = 1e-9): boolean {
  return value >= lo - tol && value <= hi + tol;
}

describe('computeSanityEffect', () => {
  it('returns all-zero SanityEffect at sanity=100', () => {
    const e = computeSanityEffect(100);
    expect(e.visualDistortion).toBe(0);
    expect(e.audioDistortion).toBe(0);
    expect(e.vignetteOpacity).toBe(0);
    expect(e.glitchProbability).toBe(0);
    expect(e.hallucinationTexts).toEqual([]);
  });

  it('returns all-zero SanityEffect at sanity=61 (just above high threshold)', () => {
    const e = computeSanityEffect(61);
    expect(e.visualDistortion).toBe(0);
    expect(e.audioDistortion).toBe(0);
    expect(e.vignetteOpacity).toBe(0);
    expect(e.glitchProbability).toBe(0);
    expect(e.hallucinationTexts).toEqual([]);
  });

  it('at sanity=50 yields visualDistortion ~0.17, audioDistortion 0, vignetteOpacity 0', () => {
    const e = computeSanityEffect(50);
    // visualDistortion = (60 - 50) / 60 = 10/60 = 0.1666...
    expect(e.visualDistortion).toBeCloseTo((60 - 50) / 60, 9);
    expect(e.audioDistortion).toBe(0); // zero above 40
    expect(e.vignetteOpacity).toBe(0); // zero above 50; at exactly 50 it's 0
    expect(e.hallucinationTexts).toEqual(MID_TIER_TEXTS);
  });

  it('at sanity=59 (just below visual threshold) yields visualDistortion ~0.0167', () => {
    const e = computeSanityEffect(59);
    expect(e.visualDistortion).toBeCloseTo((60 - 59) / 60, 9);
    expect(e.hallucinationTexts).toEqual(MID_TIER_TEXTS);
  });

  it('at sanity=25 yields visualDistortion ~0.583, audioDistortion ~0.375, low-tier hallucinations', () => {
    const e = computeSanityEffect(25);
    expect(e.visualDistortion).toBeCloseTo((60 - 25) / 60, 9); // 35/60 = 0.5833
    expect(e.audioDistortion).toBeCloseTo((40 - 25) / 40, 9); // 15/40 = 0.375
    expect(e.vignetteOpacity).toBeCloseTo((50 - 25) / 50, 9); // 25/50 = 0.5
    expect(e.glitchProbability).toBeCloseTo((30 - 25) / 100, 9); // 5/100 = 0.05
    expect(e.hallucinationTexts).toEqual(LOW_TIER_TEXTS);
  });

  it('at sanity=0 yields maxed intensities, low-tier hallucinations', () => {
    const e = computeSanityEffect(0);
    expect(e.visualDistortion).toBe(1); // (60-0)/60 = 1
    expect(e.audioDistortion).toBe(1); // (40-0)/40 = 1
    expect(e.vignetteOpacity).toBe(1); // (50-0)/50 = 1
    expect(e.glitchProbability).toBeCloseTo(30 / 100, 9); // 0.3 max
    expect(e.hallucinationTexts).toEqual(LOW_TIER_TEXTS);
  });

  it('at sanity=30 (mid tier inclusive lower bound) yields mid-tier hallucinations', () => {
    const e = computeSanityEffect(30);
    // s=30 is in mid tier (30..60 inclusive lower bound)
    expect(e.hallucinationTexts).toEqual(MID_TIER_TEXTS);
    // glitchProbability at s=30: (30-30)/100 = 0
    expect(e.glitchProbability).toBe(0);
    // visualDistortion: (60-30)/60 = 0.5
    expect(e.visualDistortion).toBeCloseTo(0.5, 9);
    // audioDistortion: (40-30)/40 = 0.25
    expect(e.audioDistortion).toBeCloseTo(0.25, 9);
    // vignetteOpacity: (50-30)/50 = 0.4
    expect(e.vignetteOpacity).toBeCloseTo(0.4, 9);
  });

  it('at sanity=29 (low tier) yields low-tier hallucinations and small glitch prob', () => {
    const e = computeSanityEffect(29);
    expect(e.hallucinationTexts).toEqual(LOW_TIER_TEXTS);
    // glitchProbability: (30-29)/100 = 0.01
    expect(e.glitchProbability).toBeCloseTo(0.01, 9);
  });

  it('clamps out-of-range sanity to [0, 100]', () => {
    const over = computeSanityEffect(999);
    expect(over).toEqual(computeSanityEffect(100));
    const under = computeSanityEffect(-50);
    expect(under).toEqual(computeSanityEffect(0));
  });

  it('returns hallucinationTexts as a fresh array (not a shared reference)', () => {
    const a = computeSanityEffect(20);
    const b = computeSanityEffect(20);
    expect(a.hallucinationTexts).not.toBe(b.hallucinationTexts);
    expect(a.hallucinationTexts).toEqual(b.hallucinationTexts);
  });

  it('produces all numeric intensities within valid ranges for a sweep', () => {
    for (let s = 0; s <= 100; s += 5) {
      const e: SanityEffect = computeSanityEffect(s);
      expect(within(e.visualDistortion, 0, 1)).toBe(true);
      expect(within(e.audioDistortion, 0, 1)).toBe(true);
      expect(within(e.vignetteOpacity, 0, 1)).toBe(true);
      // glitchProbability clamped to [0, 0.3]
      expect(within(e.glitchProbability, 0, 0.3)).toBe(true);
      expect(Array.isArray(e.hallucinationTexts)).toBe(true);
    }
  });

  it('is a pure function: same input → deep-equal output', () => {
    const a = computeSanityEffect(42);
    const b = computeSanityEffect(42);
    expect(a).toEqual(b);
  });

  it('does not return shared mutable hallucination arrays across tiers', () => {
    const high = computeSanityEffect(80);
    const mid = computeSanityEffect(45);
    const low = computeSanityEffect(10);
    expect(high.hallucinationTexts).toEqual([]);
    expect(mid.hallucinationTexts).toEqual(MID_TIER_TEXTS);
    expect(low.hallucinationTexts).toEqual(LOW_TIER_TEXTS);
    // Mutating one must not affect the others (defensive copy).
    mid.hallucinationTexts.push('contamination');
    expect(computeSanityEffect(45).hallucinationTexts).toEqual(MID_TIER_TEXTS);
  });

  // --- Difficulty-specific tests ---

  describe('night_owl (drain 0.7 → effects trigger later)', () => {
    it('at sanity=70 → effectiveSanity=100 → all-zero effect', () => {
      const e = computeSanityEffect(70, 'night_owl');
      expect(e.visualDistortion).toBe(0);
      expect(e.audioDistortion).toBe(0);
      expect(e.vignetteOpacity).toBe(0);
      expect(e.glitchProbability).toBe(0);
      expect(e.hallucinationTexts).toEqual([]);
    });

    it('at sanity=50 → effectiveSanity=71.4 → visualDistortion=0 (clamped), mid-tier hallucinations', () => {
      const e = computeSanityEffect(50, 'night_owl');
      // effectiveSanity = 50/0.7 ≈ 71.4 > 60 → visualDistortion clamped to 0
      expect(e.visualDistortion).toBe(0);
      expect(e.audioDistortion).toBe(0);
      expect(e.vignetteOpacity).toBe(0);
      // hallucination tier uses original sanity (50) → mid tier
      expect(e.hallucinationTexts).toEqual(MID_TIER_TEXTS);
    });

    it('at sanity=41 → effectiveSanity≈58.6 → visualDistortion>0, mid-tier hallucinations', () => {
      const e = computeSanityEffect(41, 'night_owl');
      // effectiveSanity = 41/0.7 ≈ 58.571, just below 60 threshold
      expect(e.visualDistortion).toBeCloseTo((60 - 41 / 0.7) / 60, 9);
      expect(e.audioDistortion).toBe(0);
      // hallucination tier uses original sanity (41) → mid tier
      expect(e.hallucinationTexts).toEqual(MID_TIER_TEXTS);
    });
  });

  describe('no_rest (drain 1.5 → effects trigger earlier)', () => {
    it('at sanity=60 → effectiveSanity=40 → visualDistortion≈0.333, audioDistortion=0, vignette≈0.2', () => {
      const e = computeSanityEffect(60, 'no_rest');
      // effectiveSanity = 60/1.5 = 40
      expect(e.visualDistortion).toBeCloseTo((60 - 40) / 60, 9);
      expect(e.audioDistortion).toBe(0); // exactly at 40 threshold → 0
      expect(e.vignetteOpacity).toBeCloseTo((50 - 40) / 50, 9);
      // hallucination tier uses original sanity (60): s > 60 false, s >= 30 true → mid tier
      expect(e.hallucinationTexts).toEqual(MID_TIER_TEXTS);
    });

    it('at sanity=45 → effectiveSanity=30 → visualDistortion=0.5, audioDistortion=0.25, mid-tier hallucinations', () => {
      const e = computeSanityEffect(45, 'no_rest');
      // effectiveSanity = 45/1.5 = 30
      expect(e.visualDistortion).toBeCloseTo((60 - 30) / 60, 9);
      expect(e.audioDistortion).toBeCloseTo((40 - 30) / 40, 9);
      expect(e.vignetteOpacity).toBeCloseTo((50 - 30) / 50, 9);
      expect(e.glitchProbability).toBe(0); // effectiveSanity = 30 → (30-30)/100 = 0
      // hallucination tier uses original sanity (45) → mid tier (30-60)
      expect(e.hallucinationTexts).toEqual(MID_TIER_TEXTS);
    });

    it('at sanity=30 → effectiveSanity=20 → strong effects, low-tier hallucinations', () => {
      const e = computeSanityEffect(30, 'no_rest');
      // effectiveSanity = 30/1.5 = 20
      expect(e.visualDistortion).toBeCloseTo((60 - 20) / 60, 9);
      expect(e.audioDistortion).toBeCloseTo((40 - 20) / 40, 9);
      expect(e.vignetteOpacity).toBeCloseTo((50 - 20) / 50, 9);
      expect(e.glitchProbability).toBeCloseTo((30 - 20) / 100, 9);
      // hallucination tier uses original sanity (30) → mid tier (>= 30)
      expect(e.hallucinationTexts).toEqual(MID_TIER_TEXTS);
    });

    it('at sanity=90 → effectiveSanity=60 → all-zero (at threshold boundary)', () => {
      const e = computeSanityEffect(90, 'no_rest');
      // effectiveSanity = 90/1.5 = 60, at threshold → visualDistortion = 0
      expect(e.visualDistortion).toBe(0);
      expect(e.audioDistortion).toBe(0);
      expect(e.vignetteOpacity).toBe(0);
      expect(e.glitchProbability).toBe(0);
      // hallucination uses original sanity (90) → high tier
      expect(e.hallucinationTexts).toEqual([]);
    });
  });

  it('insomniac (default) matches no-difficulty-param behavior', () => {
    const withParam = computeSanityEffect(42, 'insomniac');
    const withoutParam = computeSanityEffect(42);
    expect(withParam).toEqual(withoutParam);
  });
});
