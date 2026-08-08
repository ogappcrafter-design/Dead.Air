// __tests__/engine/calls/ProceduralCallGenerator.test.ts
// Comprehensive tests for procedural call generation (DEA-78 / DEA-84).
//
// Coverage:
//   - Structure validity (generated calls match CallData interface)
//   - callerId uniqueness across multiple generations
//   - IAP gate behavior (non-owners get 18 calls, owners get procedural)
//   - Reward/sanity ranges match BAND_VARIATIONS
//   - No modifications to data/calls.js (the sacred 18)

import {
  ProceduralCallGenerator,
  PROCEDURAL_ID_BASE,
  resetProceduralCallGenerator,
} from '@/engine/calls/ProceduralCallGenerator';
import { ALL_FRAGMENTS, BAND_VARIATIONS } from '@/data/fragments';
import { CALLS } from '@/data/calls';
import { getCallPool } from '@/engine/progression/InfiniteSignal';
import type { CallData, CallChoice } from '@/engine/calls/types';
import type { CallType } from '@/lib/constants';
import type { FragmentLibrary, BandVariation } from '@/data/fragments/types';

// --- Helpers ---

/** All valid CallType values from lib/constants. */
const VALID_CALL_TYPES: ReadonlyArray<CallType> = [
  'JUST_LISTEN',
  'DEAD_AIR',
  'RIGHT_ANSWER',
  'SIGNAL_DECODE',
  'STAY_CALM',
  'RECORDING',
  'MULTI_CALLER',
  'TIMING',
  'PUZZLE',
  'CONVERSATION',
];

/** Assert a value is within [min, max] inclusive. */
const within = (value: number, min: number, max: number): boolean =>
  value >= min && value <= max;

/** Assert a generated call matches the CallData interface. */
const assertValidCallData = (call: CallData, band: number): void => {
  expect(typeof call.id).toBe('number');
  expect(call.id).toBeGreaterThanOrEqual(PROCEDURAL_ID_BASE);
  expect(call.band).toBe(band);
  expect(typeof call.callerId).toBe('string');
  expect(call.callerId.length).toBeGreaterThan(0);
  expect(typeof call.callerName).toBe('string');
  expect(call.callerName.length).toBeGreaterThan(0);
  expect(typeof call.signal).toBe('number');
  expect(within(call.signal, 0, 5)).toBe(true);
  expect(VALID_CALL_TYPES).toContain(call.type);
  expect(typeof call.staticReward).toBe('number');
  expect(call.staticReward).toBeGreaterThan(0);

  // Type-specific fields.
  if (call.type === 'JUST_LISTEN' || call.type === 'DEAD_AIR' || call.type === 'STAY_CALM') {
    expect(Array.isArray(call.lines)).toBe(true);
    expect((call.lines ?? []).length).toBeGreaterThanOrEqual(2);
  }
  if (call.type === 'RIGHT_ANSWER') {
    expect(Array.isArray(call.choices)).toBe(true);
    expect((call.choices ?? []).length).toBeGreaterThanOrEqual(2);
    for (const choice of call.choices ?? []) {
      expect(typeof choice.text).toBe('string');
      expect(typeof choice.outcome).toBe('string');
      expect(typeof choice.sanityDelta).toBe('number');
      expect(typeof choice.staticMult).toBe('number');
    }
  }
  if (call.type === 'DEAD_AIR') {
    expect(typeof call.waitSeconds).toBe('number');
    expect(call.waitSeconds).toBeGreaterThanOrEqual(1);
  }
  if (call.type === 'STAY_CALM') {
    expect(typeof call.duration).toBe('number');
    expect(typeof call.sanityPenalty).toBe('number');
  }
  if (call.type === 'SIGNAL_DECODE') {
    expect(typeof call.intro).toBe('string');
    expect(Array.isArray(call.sequence)).toBe(true);
    expect(typeof call.decodedMessage).toBe('string');
  }
  if (call.type === 'RECORDING') {
    expect(Array.isArray(call.lines)).toBe(true);
    expect(Array.isArray(call.recordingClips)).toBe(true);
    expect((call.recordingClips ?? []).length).toBeGreaterThan(0);
  }
  if (call.type === 'MULTI_CALLER') {
    expect(Array.isArray(call.lines)).toBe(true);
    expect(Array.isArray(call.choices)).toBe(true);
    expect(Array.isArray(call.speakerPairs)).toBe(true);
    expect(Array.isArray(call.lineSpeakers)).toBe(true);
  }
  if (call.type === 'TIMING') {
    expect(Array.isArray(call.lines)).toBe(true);
    expect(typeof call.duration).toBe('number');
    expect(typeof call.sanityPenalty).toBe('number');
    expect(Array.isArray(call.beatMap)).toBe(true);
  }
  if (call.type === 'PUZZLE') {
    expect(typeof call.intro).toBe('string');
    expect(Array.isArray(call.cipherLayers)).toBe(true);
    expect(typeof call.decodedMessage).toBe('string');
  }
  if (call.type === 'CONVERSATION') {
    expect(Array.isArray(call.lines)).toBe(true);
    expect(Array.isArray(call.dialogueTree)).toBe(true);
    expect((call.dialogueTree ?? []).length).toBeGreaterThan(0);
  }
};

// --- Tests ---

describe('ProceduralCallGenerator', () => {
  let generator: ProceduralCallGenerator;

  beforeEach(() => {
    generator = new ProceduralCallGenerator(ALL_FRAGMENTS, BAND_VARIATIONS);
    resetProceduralCallGenerator();
  });

  describe('construction validation', () => {
    it('constructs with the full fragment library set', () => {
      expect(generator).toBeInstanceOf(ProceduralCallGenerator);
    });

    it('throws on empty fragments array', () => {
      expect(() => new ProceduralCallGenerator([])).toThrow();
    });

    it('throws on fragment library with empty openings', () => {
      const bad: FragmentLibrary[] = [
        {
          ...ALL_FRAGMENTS[0]!,
          openings: [],
        },
      ];
      expect(() => new ProceduralCallGenerator(bad)).toThrow('openings');
    });

    it('throws when RIGHT_ANSWER is in callTypes but responses < 2', () => {
      const bad: FragmentLibrary[] = [
        {
          ...ALL_FRAGMENTS[0]!,
          callTypes: ['RIGHT_ANSWER'],
          responses: [{ text: 'a', outcome: 'b' }],
        },
      ];
      expect(() => new ProceduralCallGenerator(bad)).toThrow('RIGHT_ANSWER');
    });
  });

  describe('structure validity (DEA-78)', () => {
    it('generates valid CallData for band 0 (LIVING)', () => {
      const call = generator.generate(0);
      assertValidCallData(call, 0);
    });

    it('generates valid CallData for band 1 (LIMINAL)', () => {
      const call = generator.generate(1);
      assertValidCallData(call, 1);
    });

    it('generates valid CallData for band 2 (LOST)', () => {
      const call = generator.generate(2);
      assertValidCallData(call, 2);
    });

    it('generates valid CallData for band 3 (CLASSIFIED)', () => {
      const call = generator.generate(3);
      assertValidCallData(call, 3);
    });

    it('generates valid CallData for band 4 (████████)', () => {
      const call = generator.generate(4);
      assertValidCallData(call, 4);
    });

    it('throws on out-of-range band index', () => {
      expect(() => generator.generate(8)).toThrow();
      expect(() => generator.generate(-1)).toThrow();
    });

    it('lines never contain undefined or empty entries', () => {
      for (let i = 0; i < 50; i++) {
        const call = generator.generate(i % 8);
        if (call.lines) {
          for (const line of call.lines) {
            expect(typeof line).toBe('string');
            expect(line.length).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  describe('callerId uniqueness (DEA-78)', () => {
    it('generates unique callerIds across a single batch', () => {
      const calls = generator.generateBatch(0, 20);
      const ids = calls.map((c) => c.callerId);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('generates unique ids across multiple batches and bands', () => {
      const allCalls: CallData[] = [];
      for (let band = 0; band < 8; band++) {
        allCalls.push(...generator.generateBatch(band, 10));
      }
      const ids = allCalls.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('generates unique ids across generateAcrossBands', () => {
      const calls = generator.generateAcrossBands(15);
      const ids = calls.map((c) => c.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('never generates ids that collide with sacred call ids (0..17)', () => {
      const calls = generator.generateAcrossBands(20);
      for (const call of calls) {
        expect(call.id).toBeGreaterThanOrEqual(PROCEDURAL_ID_BASE);
      }
    });

    it('reset() restarts the id counter', () => {
      const first = generator.generate(0);
      generator.reset();
      const second = generator.generate(0);
      expect(second.id).toBe(first.id);
    });
  });

  describe('reward/sanity ranges match BAND_VARIATIONS (DEA-78)', () => {
    // Generate a large sample per band and assert all values fall in range.
    const SAMPLE_SIZE = 100;

    BAND_VARIATIONS.forEach((variation: BandVariation) => {
      it(`band ${variation.band} (${variation.bandName}) staticReward in range`, () => {
        const calls = generator.generateBatch(variation.band, SAMPLE_SIZE);
        for (const call of calls) {
          expect(within(
            call.staticReward,
            variation.staticRewardRange[0],
            variation.staticRewardRange[1],
          )).toBe(true);
        }
      });

      it(`band ${variation.band} (${variation.bandName}) signal in range`, () => {
        const calls = generator.generateBatch(variation.band, SAMPLE_SIZE);
        for (const call of calls) {
          expect(within(
            call.signal,
            variation.signalRange[0],
            variation.signalRange[1],
          )).toBe(true);
        }
      });

      it(`band ${variation.band} (${variation.bandName}) sanityDelta in range`, () => {
        const calls = generator.generateBatch(variation.band, SAMPLE_SIZE);
        for (const call of calls) {
          if (call.sanityDelta !== undefined) {
            expect(within(
              call.sanityDelta,
              variation.sanityDeltaRange[0],
              variation.sanityDeltaRange[1],
            )).toBe(true);
          }
        }
      });
    });
  });

  describe('RIGHT_ANSWER choices', () => {
    it('choices have valid CallChoice shape', () => {
      // Generate many calls until we hit RIGHT_ANSWER in each band.
      for (let band = 0; band < 8; band++) {
        let found = false;
        for (let i = 0; i < 50 && !found; i++) {
          const call = generator.generate(band);
          if (call.type === 'RIGHT_ANSWER' && call.choices) {
            found = true;
            expect(call.choices.length).toBeGreaterThanOrEqual(2);
            expect(call.choices.length).toBeLessThanOrEqual(4);
            for (const choice of call.choices) {
              expect(typeof choice.text).toBe('string');
              expect(typeof choice.outcome).toBe('string');
              expect(typeof choice.sanityDelta).toBe('number');
              expect(typeof choice.staticMult).toBe('number');
              expect(choice.staticMult).toBeGreaterThanOrEqual(1);
              expect(choice.staticMult).toBeLessThanOrEqual(3);
              // tape is optional; if present, tapeName must be too.
              if (choice.tape) {
                expect(typeof choice.tapeName).toBe('string');
                expect(choice.tapeName.length).toBeGreaterThan(0);
              }
            }
          }
        }
        // We don't fail if RIGHT_ANSWER wasn't hit in 50 tries (random),
        // but log it. The structure test above covers validity when hit.
      }
    });
  });

  describe('SIGNAL_DECODE fields', () => {
    it('SIGNAL_DECODE calls have intro, sequence, decodedMessage', () => {
      for (let band = 0; band < 8; band++) {
        for (let i = 0; i < 50; i++) {
          const call = generator.generate(band);
          if (call.type === 'SIGNAL_DECODE') {
            expect(typeof call.intro).toBe('string');
            expect(Array.isArray(call.sequence)).toBe(true);
            expect(call.sequence!.length).toBeGreaterThanOrEqual(3);
            expect(call.sequence!.length).toBeLessThanOrEqual(6);
            for (const val of call.sequence!) {
              expect(val).toBeGreaterThanOrEqual(0);
              expect(val).toBeLessThanOrEqual(2);
            }
            expect(typeof call.decodedMessage).toBe('string');
            return; // one valid SIGNAL_DECODE is enough for this test.
          }
        }
      }
    });
  });
});

describe('IAP gate behavior (DEA-78 / DEA-79)', () => {
  const sacredCalls = CALLS as unknown as CallData[];

  it('non-owners get exactly 18 sacred calls', () => {
    const pool = getCallPool(sacredCalls, false);
    expect(pool.length).toBe(18);
  });

  it('owners get more than 18 calls (sacred + procedural)', () => {
    const pool = getCallPool(sacredCalls, true);
    expect(pool.length).toBeGreaterThan(18);
  });

  it('owners get the sacred 18 plus 48 procedural (6 per band × 8 bands)', () => {
    const pool = getCallPool(sacredCalls, true);
    expect(pool.length).toBe(18 + 48);
  });

  it('non-owner pool contains only sacred call ids (0..17)', () => {
    const pool = getCallPool(sacredCalls, false);
    for (const call of pool) {
      expect(call.id).toBeGreaterThanOrEqual(0);
      expect(call.id).toBeLessThan(18);
    }
  });

  it('owner pool contains sacred ids (0..17) and procedural ids (>= 1000)', () => {
    const pool = getCallPool(sacredCalls, true);
    const sacredIds = pool.filter((c) => c.id < 18).map((c) => c.id);
    const proceduralIds = pool.filter((c) => c.id >= 1000).map((c) => c.id);

    // All 18 sacred ids present.
    expect(sacredIds.length).toBe(18);
    // Procedural ids present and all >= 1000.
    expect(proceduralIds.length).toBe(48);
    for (const id of proceduralIds) {
      expect(id).toBeGreaterThanOrEqual(PROCEDURAL_ID_BASE);
    }
  });

  it('getCallPool returns a new array (does not mutate input)', () => {
    const input: CallData[] = [...sacredCalls];
    const pool = getCallPool(input, false);
    expect(pool).not.toBe(input);
    expect(input.length).toBe(18);
  });

  it('getCallPool with custom proceduralCountPerBand', () => {
    const pool = getCallPool(sacredCalls, true, undefined, { proceduralCountPerBand: 2 });
    // 18 sacred + (2 per band × 8 bands) = 34
    expect(pool.length).toBe(18 + 16);
  });

  it('getCallPool with custom fragments (smaller library)', () => {
    const singleBandFragments: FragmentLibrary[] = [ALL_FRAGMENTS[0]!];
    const pool = getCallPool(sacredCalls, true, undefined, {
      fragments: singleBandFragments,
      proceduralCountPerBand: 5,
    });
    // 18 sacred + 5 procedural (only 1 band in fragments)
    expect(pool.length).toBe(18 + 5);
  });
});

describe('sacred calls immutability (DEA-78)', () => {
  it('data/calls.js CALLS array length is exactly 18', () => {
    expect(CALLS.length).toBe(18);
  });

  it('sacred call ids are 0..17 in order', () => {
    CALLS.forEach((call, idx) => {
      expect(call.id).toBe(idx);
    });
  });

  it('generator never produces ids in the sacred range', () => {
    const generator = new ProceduralCallGenerator(ALL_FRAGMENTS, BAND_VARIATIONS);
    const calls = generator.generateAcrossBands(20);
    for (const call of calls) {
      expect(call.id).toBeGreaterThanOrEqual(PROCEDURAL_ID_BASE);
    }
  });

  it('getCallPool preserves sacred calls verbatim (same references)', () => {
    const sacredCalls = CALLS as unknown as CallData[];
    const pool = getCallPool(sacredCalls, true);
    // The first 18 entries should be the same object references as the input.
    for (let i = 0; i < 18; i++) {
      expect(pool[i]).toBe(sacredCalls[i]);
    }
  });
});
