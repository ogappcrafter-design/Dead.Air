import { hasInfiniteSignal, getCallPool } from '../../engine/progression/InfiniteSignal';
import type { CallData } from '../../engine/calls/types';
import { CALLS } from '../../data/calls';

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
      const pool = getCallPool(CALLS, false);
      expect(pool.length).toBe(CALLS.length);
      expect(pool).toEqual(expect.arrayContaining(CALLS));
    });

    it('returns sacred calls + procedural calls for owners', () => {
      const pool = getCallPool(CALLS, true);
      expect(pool.length).toBeGreaterThan(CALLS.length);
      expect(pool.slice(0, CALLS.length)).toEqual(expect.arrayContaining(CALLS));
      const procedural = pool.slice(CALLS.length);
      expect(procedural.length).toBeGreaterThan(0);
    });

    it('procedural calls have valid CallData structure', () => {
      const pool = getCallPool(CALLS, true);
      const procedural = pool.slice(CALLS.length);
      for (const call of procedural) {
        expect(call.id).toBeGreaterThanOrEqual(1000);
        expect(call.band).toBeGreaterThanOrEqual(0);
        expect(call.band).toBeLessThanOrEqual(4);
        expect(typeof call.callerId).toBe('string');
        expect(call.callerId.length).toBe(8);
        expect(typeof call.callerName).toBe('string');
        expect(call.signal).toBeGreaterThanOrEqual(0);
        expect(call.signal).toBeLessThanOrEqual(5);
        expect(call.staticReward).toBeGreaterThanOrEqual(1);
        expect(call.staticReward).toBeLessThanOrEqual(10);
        expect(Array.isArray(call.lines)).toBe(true);
        expect(call.lines!.length).toBe(3);
      }
    });

    it('returns different procedural calls on subsequent calls', () => {
      const pool1 = getCallPool(CALLS, true);
      const pool2 = getCallPool(CALLS, true);
      expect(pool1.slice(0, CALLS.length)).toEqual(pool2.slice(0, CALLS.length));
      const proc1 = pool1.slice(CALLS.length);
      const proc2 = pool2.slice(CALLS.length);
      expect(proc1).not.toEqual(proc2);
    });
  });
});
