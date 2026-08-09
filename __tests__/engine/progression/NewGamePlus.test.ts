// __tests__/engine/progression/NewGamePlus.test.ts
// Tests for the pure New Game+ helpers.

import {
  NG_PLUS_MODIFIERS,
  checkNewGamePlusUnlock,
  startNewGamePlus,
  endNewGamePlus,
  getNgPlusUnlockedBands,
  getNgPlusDifficultyConfig,
} from '@/engine/progression/NewGamePlus';
import { BANDS } from '@/lib/constants';
import { DIFFICULTY_CONFIGS } from '@/lib/difficulty';

describe('NG_PLUS_MODIFIERS', () => {
  it('has callFrequencyMultiplier=1.5, sanityDrainMultiplier=1.3, staticGainMultiplier=1.2', () => {
    expect(NG_PLUS_MODIFIERS.callFrequencyMultiplier).toBe(1.5);
    expect(NG_PLUS_MODIFIERS.sanityDrainMultiplier).toBe(1.3);
    expect(NG_PLUS_MODIFIERS.staticGainMultiplier).toBe(1.2);
  });
});

describe('checkNewGamePlusUnlock', () => {
  it('returns ngPlusUnlocked=true when metaEndingUnlocked is true', () => {
    const result = checkNewGamePlusUnlock({ metaEndingUnlocked: true });
    expect(result.ngPlusUnlocked).toBe(true);
  });

  it('returns ngPlusUnlocked=false when metaEndingUnlocked is false', () => {
    const result = checkNewGamePlusUnlock({ metaEndingUnlocked: false });
    expect(result.ngPlusUnlocked).toBe(false);
  });
});

describe('startNewGamePlus', () => {
  it('returns state with ngPlusUnlocked=true and ngPlusActive=true', () => {
    const result = startNewGamePlus({ ngPlusUnlocked: false, ngPlusActive: false });
    expect(result.ngPlusUnlocked).toBe(true);
    expect(result.ngPlusActive).toBe(true);
  });

  it('returns a new object (does not mutate input)', () => {
    const input = { ngPlusUnlocked: true, ngPlusActive: false };
    const result = startNewGamePlus(input);
    expect(result).not.toBe(input);
    expect(input.ngPlusActive).toBe(false);
  });
});

describe('endNewGamePlus', () => {
  it('sets ngPlusActive=false but preserves ngPlusUnlocked=true', () => {
    const result = endNewGamePlus({ ngPlusUnlocked: true, ngPlusActive: true });
    expect(result.ngPlusUnlocked).toBe(true);
    expect(result.ngPlusActive).toBe(false);
  });

  it('preserves ngPlusUnlocked=false if it was false', () => {
    const result = endNewGamePlus({ ngPlusUnlocked: false, ngPlusActive: true });
    expect(result.ngPlusUnlocked).toBe(false);
    expect(result.ngPlusActive).toBe(false);
  });
});

describe('getNgPlusUnlockedBands', () => {
  it('returns all bands from BANDS constant', () => {
    const result = getNgPlusUnlockedBands();
    expect(result).toEqual([...BANDS]);
  });

  it('returns a new array (does not return the BANDS reference)', () => {
    const result = getNgPlusUnlockedBands();
    expect(result).not.toBe(BANDS);
  });
});

describe('getNgPlusDifficultyConfig', () => {
  it('stacks NG+ modifiers on night_owl base config', () => {
    const base = DIFFICULTY_CONFIGS.night_owl;
    const result = getNgPlusDifficultyConfig('night_owl');
    expect(result.sanityDrainMultiplier).toBeCloseTo(
      base.sanityDrainMultiplier * NG_PLUS_MODIFIERS.sanityDrainMultiplier,
      5,
    );
    expect(result.staticTolerance).toBeCloseTo(
      base.staticTolerance / NG_PLUS_MODIFIERS.staticGainMultiplier,
      5,
    );
    expect(result.callFrequencyMultiplier).toBeCloseTo(
      base.callFrequencyMultiplier / NG_PLUS_MODIFIERS.callFrequencyMultiplier,
      5,
    );
    expect(result.permadeath).toBe(base.permadeath);
  });

  it('stacks NG+ modifiers on no_rest base config (permadeath preserved)', () => {
    const base = DIFFICULTY_CONFIGS.no_rest;
    const result = getNgPlusDifficultyConfig('no_rest');
    expect(result.permadeath).toBe(true);
    expect(result.sanityDrainMultiplier).toBeCloseTo(
      base.sanityDrainMultiplier * NG_PLUS_MODIFIERS.sanityDrainMultiplier,
      5,
    );
  });

  it('appends "+" to the base label', () => {
    const result = getNgPlusDifficultyConfig('insomniac');
    expect(result.label).toBe(`${DIFFICULTY_CONFIGS.insomniac.label}+`);
  });

  it('includes NG+ in the description', () => {
    const result = getNgPlusDifficultyConfig('night_owl');
    expect(result.description).toContain('NG+');
  });
});
