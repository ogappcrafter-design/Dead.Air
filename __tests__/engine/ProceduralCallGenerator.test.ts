import { ProceduralCallGenerator } from '@/engine/calls/ProceduralCallGenerator';
import { FragmentLibrary, ResponseOption, BandVariation } from '@/data/fragments/types';
import { ChoiceHistorySnapshot } from '@/store/choiceHistoryStore';

// --- Minimal mock data ---

function makeResponse(text: string, requiresChoiceKey?: string): ResponseOption {
  return {
    text,
    outcome: 'NEUTRAL' as never,
    requiresChoiceKey,
  };
}

const BASE_LIB: FragmentLibrary = {
  band: 0,
  bandName: 'LIVING',
  callTypes: ['JUST_LISTEN', 'RIGHT_ANSWER'],
  openings: ['Static opening.'],
  middles: ['Static middle.'],
  closings: ['Static closing.'],
  responses: [makeResponse('Response A'), makeResponse('Response B'), makeResponse('Response C')],
  callerIdPrefixes: ['CALLER'],
  callerNamePrefixes: ['Unknown'],
};

const BRANCH_LIB_A: FragmentLibrary = {
  ...BASE_LIB,
  requiresChoiceKey: 'BRANCH_A_KEY',
  branchId: 'branchA',
  responses: [
    makeResponse('Branch A Response 1', 'BRANCH_A_KEY'),
    makeResponse('Branch A Response 2', 'BRANCH_A_KEY'),
  ],
};

const BRANCH_LIB_B: FragmentLibrary = {
  ...BASE_LIB,
  requiresChoiceKey: 'BRANCH_B_KEY',
  branchId: 'branchB',
  responses: [
    makeResponse('Branch B Response 1', 'BRANCH_B_KEY'),
    makeResponse('Branch B Response 2', 'BRANCH_B_KEY'),
  ],
};

const ALL_LIBS = [BASE_LIB, BRANCH_LIB_A, BRANCH_LIB_B];

const VARIATIONS: BandVariation[] = [
  {
    band: 0,
    bandName: 'LIVING',
    staticRewardRange: [1, 3],
    sanityDeltaRange: [-2, 2],
    signalRange: [0, 1],
  },
];

// --- Helpers ---

function makeSnapshot(
  records: Array<{ callId: number; choiceKey: string; value: string | number }>,
): ChoiceHistorySnapshot {
  return {
    records,
    hasChoice: (key: string) => records.some((r) => r.choiceKey === key),
    getChoice: (key: string) => records.filter((r) => r.choiceKey === key).slice(-1)[0],
    getChoicesForCall: (callId: number) => records.filter((r) => r.callId === callId),
    hasChoicePattern: (regex: RegExp) => records.some((r) => regex.test(r.choiceKey)),
  };
}

describe('ProceduralCallGenerator', () => {
  let generator: ProceduralCallGenerator;

  beforeEach(() => {
    generator = new ProceduralCallGenerator(ALL_LIBS, VARIATIONS);
  });

  describe('getAvailableBranches', () => {
    it('returns unbranched libraries when choiceHistory is empty', () => {
      const snapshot = makeSnapshot([]);
      const branches = generator.getAvailableBranches(snapshot, 0);

      expect(branches).toHaveLength(1);
      expect(branches[0]).toBe(BASE_LIB);
    });

    it('returns branched libraries whose requiresChoiceKey is satisfied', () => {
      const snapshot = makeSnapshot([
        { callId: 1001, choiceKey: 'BRANCH_A_KEY', value: 'picked A' },
      ]);
      const branches = generator.getAvailableBranches(snapshot, 0);

      // Should include BASE_LIB (unbranched, always available as fallback)
      // and BRANCH_LIB_A (requiresChoiceKey satisfied)
      expect(branches.length).toBeGreaterThanOrEqual(1);
      expect(branches.some((lib) => lib.branchId === 'branchA')).toBe(true);
      expect(branches.some((lib) => lib.branchId === 'branchB')).toBe(false);
    });

    it('falls back to unbranched when no branch key matches', () => {
      const snapshot = makeSnapshot([{ callId: 1001, choiceKey: 'UNKNOWN_KEY', value: 'val' }]);
      const branches = generator.getAvailableBranches(snapshot, 0);

      expect(branches).toHaveLength(1);
      expect(branches[0]).toBe(BASE_LIB);
    });

    it('returns empty array for unknown band', () => {
      const snapshot = makeSnapshot([]);
      const branches = generator.getAvailableBranches(snapshot, 99);

      expect(branches).toEqual([]);
    });
  });

  describe('getGatedCallIds', () => {
    it('returns empty array when CHOICE_GATES is empty', () => {
      const snapshot = makeSnapshot([{ callId: 1001, choiceKey: 'ANY_KEY', value: 'val' }]);

      expect(generator.getGatedCallIds(snapshot)).toEqual([]);
    });

    it('returns empty array when choiceHistory is empty', () => {
      const snapshot = makeSnapshot([]);

      expect(generator.getGatedCallIds(snapshot)).toEqual([]);
    });
  });

  describe('generate with choiceHistory', () => {
    it('produces a call with valid structure', () => {
      const call = generator.generate(0);

      expect(call).toBeDefined();
      expect(call.id).toBeGreaterThanOrEqual(1000);
      expect(call.band).toBe(0);
      expect(call.type).toBeDefined();
      expect(call.lines).toBeDefined();
      expect(Array.isArray(call.lines)).toBe(true);
      expect(call.lines.length).toBeGreaterThan(0);
    });

    it('accepts optional choiceHistory without throwing', () => {
      const snapshot = makeSnapshot([
        { callId: 1001, choiceKey: 'BRANCH_A_KEY', value: 'picked A' },
      ]);

      expect(() => generator.generate(0, { choiceHistory: snapshot })).not.toThrow();
    });

    it('produces different call ids on successive calls', () => {
      const call1 = generator.generate(0);
      const call2 = generator.generate(0);

      expect(call1.id).not.toBe(call2.id);
    });

    it('reset() restarts id counter', () => {
      const call1 = generator.generate(0);
      generator.reset();
      const call2 = generator.generate(0);

      expect(call2.id).toBe(call1.id);
    });
  });
});
