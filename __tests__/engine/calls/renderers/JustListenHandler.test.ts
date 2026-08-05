// __tests__/engine/calls/renderers/JustListenHandler.test.ts
// Unit tests for JUST_LISTEN call renderer — the simplest call type.
// data/calls.js is sacred; tests import its real CALLS array verbatim
// and assert on every JUST_LISTEN call (ids 3, 7, 8, 10, 11, 14, 15).

import {
  computeJustListenOutcome,
  JUST_LISTEN_RENDERER,
} from '@/engine/calls/renderers/JustListenHandler';
import { CALLS } from '@/data/calls';
import type { CallData, CallOutcome } from '@/engine/calls/types';

// Sanity: ensure the sacred data still surfaces the expected JUST_LISTEN calls.
const JUST_LISTEN_IDS = [3, 7, 8, 10, 11, 14, 15];

const justListenCalls: CallData[] = CALLS.filter((c) => c.type === 'JUST_LISTEN') as CallData[];

const findCall = (id: number): CallData => {
  const call = justListenCalls.find((c) => c.id === id);
  if (!call) {
    throw new Error(`JUST_LISTEN call id ${id} missing from data`);
  }
  return call;
};

describe('computeJustListenOutcome — pure renderer', () => {
  describe('sanityDelta', () => {
    it('returns the call.sanityDelta when negative (sanity loss)', () => {
      const call = findCall(3); // HAROLD, -8
      expect(computeJustListenOutcome(call).sanityDelta).toBe(-8);
    });

    it('returns the call.sanityDelta when positive (sanity gain)', () => {
      const call = findCall(8); // GUARDIAN, +10
      expect(computeJustListenOutcome(call).sanityDelta).toBe(10);
    });

    it('defaults to 0 when call.sanityDelta is absent', () => {
      const call: CallData = { ...findCall(3), sanityDelta: undefined };
      expect(computeJustListenOutcome(call).sanityDelta).toBe(0);
    });

    it('handles a large negative sanityDelta', () => {
      const call = findCall(15); // ORIGIN, -30
      expect(computeJustListenOutcome(call).sanityDelta).toBe(-30);
    });

    it('handles a large positive sanityDelta', () => {
      const call = findCall(10); // GRAND, +25
      expect(computeJustListenOutcome(call).sanityDelta).toBe(25);
    });
  });

  describe('staticReward', () => {
    it('echoes the call staticReward verbatim', () => {
      const call = findCall(3);
      expect(computeJustListenOutcome(call).staticReward).toBe(call.staticReward);
    });

    it('returns the higher staticReward for late-game calls', () => {
      const call = findCall(15);
      expect(computeJustListenOutcome(call).staticReward).toBe(300);
    });
  });

  describe('staticMultiplier', () => {
    it('is always 1 — JUST_LISTEN has no multiplier', () => {
      for (const call of justListenCalls) {
        expect(computeJustListenOutcome(call).staticMultiplier).toBe(1);
      }
    });
  });

  describe('tapeUnlocked', () => {
    it('returns the tapeName when call.tape === true', () => {
      const call = findCall(7); // ECHO
      expect(computeJustListenOutcome(call).tapeUnlocked).toBe('Tape #5 — Echo Chamber');
    });

    it('returns undefined when call.tape is false', () => {
      const call: CallData = { ...findCall(3), tape: false, tapeName: 'never' };
      expect(computeJustListenOutcome(call).tapeUnlocked).toBeUndefined();
    });

    it('returns undefined when call.tape is absent', () => {
      const call: CallData = { ...findCall(3) };
      delete (call as Partial<CallData>).tape;
      delete (call as Partial<CallData>).tapeName;
      expect(computeJustListenOutcome(call).tapeUnlocked).toBeUndefined();
    });

    it('still returns the tapeName even when sanityDelta is positive', () => {
      const call = findCall(11); // FREE SPIRIT, +20, tape
      expect(computeJustListenOutcome(call).tapeUnlocked).toBe('Tape #9 — Open Sky');
    });
  });

  describe('bandUnlocked', () => {
    it('is always undefined — JUST_LISTEN never unlocks a band', () => {
      for (const call of justListenCalls) {
        expect(computeJustListenOutcome(call).bandUnlocked).toBeUndefined();
      }
    });
  });

  describe('every JUST_LISTEN call from sacred data', () => {
    it('covers exactly the expected call IDs', () => {
      const ids = justListenCalls.map((c) => c.id).sort((a, b) => a - b);
      expect(ids).toEqual(JUST_LISTEN_IDS);
    });

    // Per-call snapshot of the full deterministic outcome. Each entry below
    // pins one real JUST_LISTEN call from data/calls.js to its outcome.
    const EXPECTED: Record<number, { sanityDelta: number; staticReward: number; tape?: string }> = {
      3: { sanityDelta: -8, staticReward: 30 }, // HAROLD — no tape
      7: { sanityDelta: -15, staticReward: 75, tape: 'Tape #5 — Echo Chamber' },
      8: { sanityDelta: 10, staticReward: 100, tape: 'Tape #6 — Signal From Guardian' },
      10: { sanityDelta: 25, staticReward: 150, tape: 'Tape #8 — Her Voice' },
      11: { sanityDelta: 20, staticReward: 120, tape: 'Tape #9 — Open Sky' },
      14: { sanityDelta: -20, staticReward: 130, tape: 'Tape #12 — The Network' },
      15: { sanityDelta: -30, staticReward: 300, tape: 'Tape #13 — First Transmission' },
    };

    for (const id of JUST_LISTEN_IDS) {
      it(`call id ${id} produces the expected outcome`, () => {
        const call = findCall(id);
        const outcome: CallOutcome = computeJustListenOutcome(call);
        const expected = EXPECTED[id];

        expect(outcome.sanityDelta).toBe(expected.sanityDelta);
        expect(outcome.staticReward).toBe(expected.staticReward);
        expect(outcome.staticMultiplier).toBe(1);
        expect(outcome.bandUnlocked).toBeUndefined();
        if (expected.tape) {
          expect(outcome.tapeUnlocked).toBe(expected.tape);
        } else {
          expect(outcome.tapeUnlocked).toBeUndefined();
        }
      });
    }
  });

  describe('registry entry', () => {
    it('exposes computeOutcome as computeJustListenOutcome', () => {
      expect(JUST_LISTEN_RENDERER.computeOutcome).toBe(computeJustListenOutcome);
    });

    it('produces identical results via the registry helper', () => {
      const call = findCall(7);
      const a = computeJustListenOutcome(call);
      const b = JUST_LISTEN_RENDERER.computeOutcome(call);
      expect(b).toEqual(a);
    });
  });

  describe('purity', () => {
    it('returns a fresh object on each call (no shared mutation)', () => {
      const call = findCall(3);
      const a = computeJustListenOutcome(call);
      const b = computeJustListenOutcome(call);
      expect(a).not.toBe(b); // different reference
      expect(a).toEqual(b); // same value
    });

    it('does not mutate the input call', () => {
      const call = findCall(7);
      const snapshot: CallData = { ...call };
      computeJustListenOutcome(call);
      expect(call).toEqual(snapshot);
    });
  });
});
