// __tests__/lib/difficulty.test.ts
// Tests for difficulty mode configurations.

import {
  DIFFICULTY_CONFIGS,
  DIFFICULTY_ORDER,
  type DifficultyMode,
} from '@/lib/difficulty';

describe('DIFFICULTY_CONFIGS', () => {
  it('has configs for all three modes', () => {
    expect(DIFFICULTY_CONFIGS.night_owl).toBeDefined();
    expect(DIFFICULTY_CONFIGS.insomniac).toBeDefined();
    expect(DIFFICULTY_CONFIGS.no_rest).toBeDefined();
  });

  it('night_owl: drain 0.7, static 0.7, callFreq 1.3, no permadeath', () => {
    const cfg = DIFFICULTY_CONFIGS.night_owl;
    expect(cfg.sanityDrainMultiplier).toBe(0.7);
    expect(cfg.staticTolerance).toBe(0.7);
    expect(cfg.callFrequencyMultiplier).toBe(1.3);
    expect(cfg.permadeath).toBe(false);
  });

  it('insomniac: drain 1, static 1, callFreq 1, no permadeath', () => {
    const cfg = DIFFICULTY_CONFIGS.insomniac;
    expect(cfg.sanityDrainMultiplier).toBe(1);
    expect(cfg.staticTolerance).toBe(1);
    expect(cfg.callFrequencyMultiplier).toBe(1);
    expect(cfg.permadeath).toBe(false);
  });

  it('no_rest: drain 1.5, static 1.3, callFreq 0.75, permadeath true', () => {
    const cfg = DIFFICULTY_CONFIGS.no_rest;
    expect(cfg.sanityDrainMultiplier).toBe(1.5);
    expect(cfg.staticTolerance).toBe(1.3);
    expect(cfg.callFrequencyMultiplier).toBe(0.75);
    expect(cfg.permadeath).toBe(true);
  });

  it('all modes have label and description', () => {
    for (const mode of DIFFICULTY_ORDER) {
      const cfg = DIFFICULTY_CONFIGS[mode];
      expect(typeof cfg.label).toBe('string');
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(typeof cfg.description).toBe('string');
      expect(cfg.description.length).toBeGreaterThan(0);
    }
  });
});

describe('DIFFICULTY_ORDER', () => {
  it('contains all three modes in order: night_owl, insomniac, no_rest', () => {
    expect(DIFFICULTY_ORDER).toEqual(['night_owl', 'insomniac', 'no_rest']);
  });

  it('has exactly 3 entries', () => {
    expect(DIFFICULTY_ORDER).toHaveLength(3);
  });

  it('every entry is a valid DifficultyMode key in DIFFICULTY_CONFIGS', () => {
    for (const mode of DIFFICULTY_ORDER) {
      expect(DIFFICULTY_CONFIGS[mode as DifficultyMode]).toBeDefined();
    }
  });
});
