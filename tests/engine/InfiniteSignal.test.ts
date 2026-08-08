// tests/engine/InfiniteSignal.test.ts
// Tests for the Infinite Signal IAP call pool (DEA-84).

import { hasInfiniteSignal, getCallPool } from '@/engine/progression/InfiniteSignal';
import type { CallData } from '@/engine/calls/types';
import { CALLS } from '@/data/calls';

const CALLS_TYPED = CALLS as unknown as CallData[];

describe('InfiniteSignal', () => {
  describe('hasInfiniteSignal', () => {
    it('returns false when not owned', () => {
      expect(hasInfiniteSignal({ hasInfiniteSignal: false })).toBe(false);
    });

    it('returns true when owned', () => {
      expect(hasInfiniteSignal({ hasInfiniteSignal: true })).toBe(true);
    });
  });

  describe('getCallPool', () => {
    it('returns only sacred calls for non-owners', () => {
      const pool = getCallPool(CALLS_TYPED, false);
      expect(pool.length).toBe(CALLS_TYPED.length);
      expect(pool).toEqual(expect.arrayContaining(CALLS_TYPED));
    });

    it('returns sacred calls + procedural calls for owners', () => {
      const pool = getCallPool(CALLS_TYPED, true);
      expect(pool.length).toBeGreaterThan(CALLS_TYPED.length);
      expect(pool.slice(0, CALLS_TYPED.length)).toEqual(expect.arrayContaining(CALLS_TYPED));
      const procedural = pool.slice(CALLS_TYPED.length);
      expect(procedural.length).toBeGreaterThan(0);
    });

    it('procedural calls have valid CallData structure', () => {
      const pool = getCallPool(CALLS_TYPED, true);
      const procedural = pool.slice(CALLS_TYPED.length);
      for (const call of procedural) {
        expect(call.id).toBeGreaterThanOrEqual(1000);
        expect(call.band).toBeGreaterThanOrEqual(0);
        expect(call.band).toBeLessThanOrEqual(7);
        expect(typeof call.callerId).toBe('string');
        expect(typeof call.callerName).toBe('string');
        expect(typeof call.signal).toBe('number');
        expect(typeof call.staticReward).toBe('number');
        // RIGHT_ANSWER/JUST_LISTEN/DEAD_AIR/STAY_CALM/RECORDING/MULTI_CALLER/TIMING/CONVERSATION carry lines;
        // SIGNAL_DECODE carries intro/sequence;
        // PUZZLE carries intro/cipherLayers.
        if (call.type === 'SIGNAL_DECODE' || call.type === 'PUZZLE') {
          expect(typeof call.intro).toBe('string');
        } else {
          expect(Array.isArray(call.lines)).toBe(true);
          expect(call.lines!.length).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it('returns different procedural calls on subsequent calls', () => {
      const pool1 = getCallPool(CALLS_TYPED, true);
      const pool2 = getCallPool(CALLS_TYPED, true);
      expect(pool1.slice(0, CALLS_TYPED.length)).toEqual(pool2.slice(0, CALLS_TYPED.length));
      const proc1 = pool1.slice(CALLS_TYPED.length);
      const proc2 = pool2.slice(CALLS_TYPED.length);
      expect(proc1).not.toEqual(proc2);
    });
  });
});
