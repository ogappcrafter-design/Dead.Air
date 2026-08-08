// tests/engine/SeededRNG.test.ts
// Determinism and helper behavior for the seeded mulberry32 PRNG.

import { SeededRNG, hashSeed, mulberry32 } from '@/engine/calls/SeededRNG';

describe('hashSeed', () => {
  it('produces a 32-bit unsigned integer', () => {
    const h = hashSeed('2026-08-08');
    expect(typeof h).toBe('number');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it('is deterministic — same input same output', () => {
    expect(hashSeed('dead-air')).toBe(hashSeed('dead-air'));
  });

  it('differs for different inputs', () => {
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});

describe('mulberry32', () => {
  it('produces floats in [0, 1)', () => {
    const next = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('same seed → same sequence', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 50; i++) {
      expect(a()).toBe(b());
    }
  });

  it('different seeds → different sequences', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let anyDiff = false;
    for (let i = 0; i < 10; i++) {
      if (a() !== b()) anyDiff = true;
    }
    expect(anyDiff).toBe(true);
  });
});

describe('SeededRNG', () => {
  describe('determinism', () => {
    it('same seed produces same next() sequence', () => {
      const a = new SeededRNG('daily:2026-08-08:t0');
      const b = new SeededRNG('daily:2026-08-08:t0');
      for (let i = 0; i < 20; i++) {
        expect(a.next()).toBe(b.next());
      }
    });

    it('different seeds produce different sequences', () => {
      const a = new SeededRNG('seed-a');
      const b = new SeededRNG('seed-b');
      let anyDiff = false;
      for (let i = 0; i < 10; i++) {
        if (a.next() !== b.next()) anyDiff = true;
      }
      expect(anyDiff).toBe(true);
    });
  });

  describe('int', () => {
    it('produces integers in [min, max] inclusive', () => {
      const rng = new SeededRNG('int-test');
      for (let i = 0; i < 100; i++) {
        const v = rng.int(3, 7);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(3);
        expect(v).toBeLessThanOrEqual(7);
      }
    });

    it('same seed → same int sequence', () => {
      const a = new SeededRNG('int-seq');
      const b = new SeededRNG('int-seq');
      for (let i = 0; i < 10; i++) {
        expect(a.int(0, 100)).toBe(b.int(0, 100));
      }
    });

    it('throws when max < min', () => {
      const rng = new SeededRNG('err');
      expect(() => rng.int(5, 2)).toThrow();
    });
  });

  describe('pick', () => {
    it('returns an element from the array', () => {
      const rng = new SeededRNG('pick-test');
      const arr = ['a', 'b', 'c', 'd'];
      for (let i = 0; i < 20; i++) {
        expect(arr).toContain(rng.pick(arr));
      }
    });

    it('same seed → same picks', () => {
      const a = new SeededRNG('pick-seq');
      const b = new SeededRNG('pick-seq');
      const arr = ['x', 'y', 'z'];
      for (let i = 0; i < 10; i++) {
        expect(a.pick(arr)).toBe(b.pick(arr));
      }
    });

    it('throws on empty array', () => {
      const rng = new SeededRNG('empty');
      expect(() => rng.pick([])).toThrow();
    });
  });

  describe('pickN', () => {
    it('returns n distinct elements', () => {
      const rng = new SeededRNG('pickn-test');
      const arr = ['a', 'b', 'c', 'd', 'e'];
      const result = rng.pickN(arr, 3);
      expect(result).toHaveLength(3);
      const unique = new Set(result);
      expect(unique.size).toBe(3);
      result.forEach((item) => expect(arr).toContain(item));
    });

    it('same seed → same pickN result', () => {
      const a = new SeededRNG('pickn-seq');
      const b = new SeededRNG('pickn-seq');
      const arr = [1, 2, 3, 4, 5];
      expect(a.pickN(arr, 3)).toEqual(b.pickN(arr, 3));
    });

    it('throws when n > array length', () => {
      const rng = new SeededRNG('pickn-err');
      expect(() => rng.pickN([1, 2], 5)).toThrow();
    });
  });

  describe('shuffle', () => {
    it('returns same elements in potentially different order', () => {
      const rng = new SeededRNG('shuffle-test');
      const arr = [1, 2, 3, 4, 5, 6, 7, 8];
      const shuffled = rng.shuffle(arr);
      expect(shuffled).toHaveLength(arr.length);
      expect(shuffled.sort()).toEqual(arr.sort());
    });

    it('same seed → same shuffle', () => {
      const a = new SeededRNG('shuffle-seq');
      const b = new SeededRNG('shuffle-seq');
      const arr = [1, 2, 3, 4, 5];
      expect(a.shuffle(arr)).toEqual(b.shuffle(arr));
    });

    it('does not mutate original array', () => {
      const rng = new SeededRNG('immutable');
      const arr = [1, 2, 3];
      const original = [...arr];
      rng.shuffle(arr);
      expect(arr).toEqual(original);
    });
  });

  describe('chance', () => {
    it('returns boolean', () => {
      const rng = new SeededRNG('chance-test');
      for (let i = 0; i < 20; i++) {
        expect(typeof rng.chance(0.5)).toBe('boolean');
      }
    });

    it('p=1 always true, p=0 always false', () => {
      const rng = new SeededRNG('chance-edge');
      expect(rng.chance(1)).toBe(true);
      expect(rng.chance(0)).toBe(false);
    });
  });
});
