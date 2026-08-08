/**
 * SeededRNG — deterministic mulberry32 PRNG.
 *
 * Same seed → same sequence of numbers, always.
 * Used by DailyCallGenerator to produce identical daily calls
 * for all players on the same calendar date.
 */

/**
 * Hash a string seed into a 32-bit unsigned integer.
 * Uses xfnv1a variant — fast, good distribution for short strings.
 */
export function hashSeed(str: string): number {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  // Force unsigned 32-bit
  return h >>> 0;
}

/**
 * Mulberry32 seeded PRNG.
 *
 * Returns a function that produces floats in [0, 1).
 * Pure — no global state, no I/O, no side effects.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;

  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * SeededRNG — wraps mulberry32 with convenient picking helpers.
 *
 * Usage:
 *   const rng = new SeededRNG('2026-08-08');
 *   rng.next()         // float [0, 1)
 *   rng.int(2, 5)      // int [2, 5]
 *   rng.pick(arr)      // random element
 *   rng.shuffle(arr)   // shuffled copy
 */
export class SeededRNG {
  private readonly _next: () => number;
  readonly seed: string;
  readonly seedHash: number;

  constructor(seed: string) {
    this.seed = seed;
    this.seedHash = hashSeed(seed);
    this._next = mulberry32(this.seedHash);
  }

  /** Float in [0, 1). */
  next(): number {
    return this._next();
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max < min) {
      throw new Error(`int: max (${max}) < min (${min})`);
    }
    return min + Math.floor(this._next() * (max - min + 1));
  }

  /** Random element from a non-empty array. */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) {
      throw new Error('pick: empty array');
    }
    return arr[Math.floor(this._next() * arr.length)] as T;
  }

  /** Pick n distinct elements from arr (without replacement). Returns a new array. */
  pickN<T>(arr: readonly T[], n: number): T[] {
    if (n > arr.length) {
      throw new Error(`pickN: requested ${n} from array of length ${arr.length}`);
    }
    const pool = [...arr];
    const result: T[] = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(this._next() * pool.length);
      const item = pool[idx];
      if (item === undefined) {
        throw new Error('pickN: unexpected undefined');
      }
      result.push(item);
      pool.splice(idx, 1);
    }
    return result;
  }

  /** Fisher-Yates shuffle, returns a new array. */
  shuffle<T>(arr: readonly T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this._next() * (i + 1));
      const a = result[i];
      const b = result[j];
      if (a !== undefined && b !== undefined) {
        result[i] = b;
        result[j] = a;
      }
    }
    return result;
  }

  /** True with probability p (0..1). */
  chance(p: number): boolean {
    return this._next() < p;
  }
}
