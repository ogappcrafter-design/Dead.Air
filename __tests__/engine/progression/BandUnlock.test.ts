// __tests__/engine/progression/BandUnlock.test.ts
// Tests for the pure band-unlock helpers.

import {
  checkBandUnlock,
  getUnlockableBands,
  type BandUnlockRow,
} from '@/engine/progression/BandUnlock';
import type { Band } from '@/lib/constants';

const BANDS: readonly BandUnlockRow[] = [
  { id: 0, name: 'LIVING', unlockAt: 0 },
  { id: 1, name: 'LIMINAL', unlockAt: 4 },
  { id: 2, name: 'LOST', unlockAt: 8 },
  { id: 3, name: 'CLASSIFIED', unlockAt: 12 },
  { id: 4, name: '████████', unlockAt: 15 },
];

describe('checkBandUnlock', () => {
  it('returns band=null, canUnlock=false, progress=0 at 0 calls with only LIVING', () => {
    const result = checkBandUnlock(
      { callsReceived: 0, tapesCollected: 0, unlockedBands: ['LIVING'] },
      BANDS,
    );
    expect(result.band).toBeNull();
    expect(result.canUnlock).toBe(false);
    expect(result.progress).toBe(0);
  });

  it('unlocks LIMINAL at exactly 4 calls (canUnlock=true, callsRemaining=0)', () => {
    const result = checkBandUnlock(
      { callsReceived: 4, tapesCollected: 0, unlockedBands: ['LIVING'] },
      BANDS,
    );
    expect(result.band).toBe('LIMINAL');
    expect(result.canUnlock).toBe(true);
    expect(result.callsRemaining).toBe(0);
  });

  it('reports progress=0.75 and callsRemaining=1 at 3 calls', () => {
    const result = checkBandUnlock(
      { callsReceived: 3, tapesCollected: 0, unlockedBands: ['LIVING'] },
      BANDS,
    );
    expect(result.band).toBeNull();
    expect(result.canUnlock).toBe(false);
    expect(result.progress).toBe(0.75);
    expect(result.callsRemaining).toBe(1);
  });

  it('unlocks ████████ at 15 calls with first four unlocked (canUnlock=true)', () => {
    const result = checkBandUnlock(
      {
        callsReceived: 15,
        tapesCollected: 0,
        unlockedBands: ['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED'],
      },
      BANDS,
    );
    expect(result.band).toBe('████████');
    expect(result.canUnlock).toBe(true);
  });

  it('returns band=null, canUnlock=false when all bands already unlocked (100 calls)', () => {
    const all: Band[] = ['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED', '████████'];
    const result = checkBandUnlock(
      { callsReceived: 100, tapesCollected: 0, unlockedBands: all },
      BANDS,
    );
    expect(result.band).toBeNull();
    expect(result.canUnlock).toBe(false);
  });

  it('clamps progress to 1 when callsReceived exceeds next threshold', () => {
    // 10 calls, LOST unlocked, next is CLASSIFIED at 12 → 10/12 ≈ 0.833
    const result = checkBandUnlock(
      {
        callsReceived: 10,
        tapesCollected: 0,
        unlockedBands: ['LIVING', 'LIMINAL', 'LOST'],
      },
      BANDS,
    );
    expect(result.progress).toBeLessThanOrEqual(1);
    expect(result.progress).toBeCloseTo(10 / 12, 5);
    expect(result.callsRemaining).toBe(2);
  });

  it('respects BANDS row order — returns LIMINAL before LOST when both thresholds met', () => {
    // 8 calls meet LOST threshold too, but LIMINAL comes first and is still locked.
    const result = checkBandUnlock(
      { callsReceived: 8, tapesCollected: 0, unlockedBands: ['LIVING'] },
      BANDS,
    );
    expect(result.band).toBe('LIMINAL');
  });

  it('skips always-unlocked LIVING (unlockAt=0 is already in unlockedBands)', () => {
    // LIVING is in unlockedBands; next candidate is LIMINAL. Even with 0 calls,
    // progress should reflect LIMINAL's threshold (0/4 = 0).
    const result = checkBandUnlock(
      { callsReceived: 0, tapesCollected: 0, unlockedBands: ['LIVING'] },
      BANDS,
    );
    expect(result.band).toBeNull();
    expect(result.callsRemaining).toBe(4);
  });

  it('handles over-threshold calls gracefully (callsRemaining=0, canUnlock=true)', () => {
    const result = checkBandUnlock(
      { callsReceived: 20, tapesCollected: 0, unlockedBands: ['LIVING'] },
      BANDS,
    );
    expect(result.band).toBe('LIMINAL');
    expect(result.canUnlock).toBe(true);
    expect(result.callsRemaining).toBe(0);
    expect(result.progress).toBe(1);
  });
});

describe('getUnlockableBands', () => {
  it('returns [CLASSIFIED] at 12 calls with LIVING+LIMINAL+LOST unlocked', () => {
    const result = getUnlockableBands(
      {
        callsReceived: 12,
        tapesCollected: 0,
        unlockedBands: ['LIVING', 'LIMINAL', 'LOST'],
      },
      BANDS,
    );
    expect(result).toEqual(['CLASSIFIED']);
  });

  it('returns [] when no locked band meets threshold', () => {
    const result = getUnlockableBands(
      { callsReceived: 3, tapesCollected: 0, unlockedBands: ['LIVING'] },
      BANDS,
    );
    expect(result).toEqual([]);
  });

  it('returns [] when all bands already unlocked', () => {
    const all: Band[] = ['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED', '████████'];
    const result = getUnlockableBands(
      { callsReceived: 100, tapesCollected: 0, unlockedBands: all },
      BANDS,
    );
    expect(result).toEqual([]);
  });

  it('returns multiple bands when several thresholds met simultaneously', () => {
    // 15 calls, only LIVING unlocked → LIMINAL, LOST, CLASSIFIED, ████████ all qualify.
    const result = getUnlockableBands(
      { callsReceived: 15, tapesCollected: 0, unlockedBands: ['LIVING'] },
      BANDS,
    );
    expect(result).toEqual(['LIMINAL', 'LOST', 'CLASSIFIED', '████████']);
  });

  it('respects BANDS row order in the returned array', () => {
    // 8 calls, only LIVING unlocked → LIMINAL and LOST both qualify, in order.
    const result = getUnlockableBands(
      { callsReceived: 8, tapesCollected: 0, unlockedBands: ['LIVING'] },
      BANDS,
    );
    expect(result).toEqual(['LIMINAL', 'LOST']);
  });

  it('does not return already-unlocked bands even if threshold met', () => {
    const result = getUnlockableBands(
      {
        callsReceived: 12,
        tapesCollected: 0,
        unlockedBands: ['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED'],
      },
      BANDS,
    );
    // Only ████████ left, threshold 15 not met at 12.
    expect(result).toEqual([]);
  });
});
