// tests/engine/ProceduralCallGenerator.test.ts
// PR API tests for the procedural call generator (DEA-84).
// Covers band-keyed lookup so a reordered fragment library array cannot
// produce band-1 dialogue with band-0 rewards.

import {
  ProceduralCallGenerator,
  PROCEDURAL_ID_BASE,
} from '@/engine/calls/ProceduralCallGenerator';
import { ALL_FRAGMENTS, BAND_VARIATIONS } from '@/data/fragments';
import type { FragmentLibrary } from '@/data/fragments';

const BAND_COUNT = ALL_FRAGMENTS.length;

describe('ProceduralCallGenerator', () => {
  let generator: ProceduralCallGenerator;

  beforeEach(() => {
    generator = new ProceduralCallGenerator(ALL_FRAGMENTS);
  });

  describe('generate', () => {
    it('generates valid CallData for every band index', () => {
      for (let band = 0; band < BAND_COUNT; band++) {
        const call = generator.generate(band);
        expect(call).toBeDefined();
        expect(call.band).toBe(band);
        expect(call.id).toBeGreaterThanOrEqual(PROCEDURAL_ID_BASE);
        expect(typeof call.callerId).toBe('string');
        expect(typeof call.callerName).toBe('string');
        expect(typeof call.signal).toBe('number');
        expect(typeof call.staticReward).toBe('number');
        // SIGNAL_DECODE calls carry intro/sequence instead of lines.
        if (call.type === 'SIGNAL_DECODE') {
          expect(typeof call.intro).toBe('string');
          expect(Array.isArray(call.sequence)).toBe(true);
        } else {
          expect(Array.isArray(call.lines)).toBe(true);
          expect(call.lines!.length).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it('throws for an out-of-range band index', () => {
      expect(() => generator.generate(BAND_COUNT)).toThrow(/No fragment library/);
      expect(() => generator.generate(-1)).toThrow(/No fragment library/);
    });

    it('generates unique ids across calls', () => {
      const ids = new Set<number>();
      for (let i = 0; i < 50; i++) {
        const call = generator.generate(0);
        expect(ids.has(call.id)).toBe(false);
        ids.add(call.id);
      }
    });
  });

  describe('band-keyed lookup (reordered fragments)', () => {
    it('keeps dialogue and rewards aligned when fragments are reordered', () => {
      const reordered = [...ALL_FRAGMENTS].reverse() as FragmentLibrary[];
      expect(reordered.map((lib) => lib.band)).toEqual([
        BAND_COUNT - 1,
        BAND_COUNT - 2,
        BAND_COUNT - 3,
        BAND_COUNT - 4,
        0,
      ]);
      const gen = new ProceduralCallGenerator(reordered);
      for (let band = 0; band < BAND_COUNT; band++) {
        const call = gen.generate(band);
        const variation = BAND_VARIATIONS.find((v) => v.band === band);
        expect(variation).toBeDefined();
        // Rewards must come from the requested band's variation, not array position.
        expect(call.staticReward).toBeGreaterThanOrEqual(variation!.staticRewardRange[0]);
        expect(call.staticReward).toBeLessThanOrEqual(variation!.staticRewardRange[1]);
        expect(call.signal).toBeGreaterThanOrEqual(variation!.signalRange[0]);
        expect(call.signal).toBeLessThanOrEqual(variation!.signalRange[1]);
      }
    });
  });

  describe('generateAcrossBands', () => {
    it('generates countPerBand calls for every band', () => {
      const calls = generator.generateAcrossBands(2);
      expect(calls.length).toBe(2 * BAND_COUNT);
      const bands = new Set(calls.map((c) => c.band));
      expect(bands.size).toBe(BAND_COUNT);
    });
  });
});
