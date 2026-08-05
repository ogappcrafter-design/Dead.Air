// __tests__/engine/calls/TapeProgression.test.ts
// Tests for the pure tape-progression helpers.

import {
  getTotalCallsReceived,
  shouldUnlockBand,
  getNextBandUnlock,
  formatTapeCount,
  type BandMetaRow,
} from '@/engine/calls/TapeProgression';
import type { Band } from '@/lib/constants';

const BANDS: readonly BandMetaRow[] = [
  { id: 0, name: 'LIVING', freq: '88.7 FM', color: '#FF8C00', unlockAt: 0 },
  { id: 1, name: 'LIMINAL', freq: '102.3 FM', color: '#CCFF00', unlockAt: 4 },
  { id: 2, name: 'LOST', freq: '117.8 AM', color: '#00FFD0', unlockAt: 8 },
  { id: 3, name: 'CLASSIFIED', freq: '███.█ FM', color: '#FF3366', unlockAt: 12 },
  { id: 4, name: '████████', freq: '???.?', color: '#FFFFFF', unlockAt: 15 },
];

describe('getTotalCallsReceived', () => {
  it('returns 0 for an empty list', () => {
    expect(getTotalCallsReceived([])).toBe(0);
  });

  it('returns the number of entries for distinct ids', () => {
    expect(getTotalCallsReceived([1, 2, 3, 4])).toBe(4);
  });

  it('dedupes repeated ids', () => {
    expect(getTotalCallsReceived([1, 1, 2, 2, 3, 3])).toBe(3);
  });

  it('counts an array of length 1 as 1', () => {
    expect(getTotalCallsReceived([42])).toBe(1);
  });
});

describe('shouldUnlockBand', () => {
  it('returns false when the band is already unlocked', () => {
    const liminal = BANDS[1];
    expect(shouldUnlockBand(liminal, ['LIVING', 'LIMINAL'], [1, 2, 3, 4])).toBe(false);
  });

  it('returns true when threshold met and band is not yet unlocked', () => {
    const liminal = BANDS[1];
    expect(shouldUnlockBand(liminal, ['LIVING'], [1, 2, 3, 4])).toBe(true);
  });

  it('returns false when threshold not met', () => {
    const liminal = BANDS[1];
    expect(shouldUnlockBand(liminal, ['LIVING'], [1, 2, 3])).toBe(false);
  });

  it('returns false for the always-unlocked band (unlockAt 0) when already unlocked', () => {
    const living = BANDS[0];
    expect(shouldUnlockBand(living, ['LIVING'], [])).toBe(false);
  });

  it('handles exactly-at-threshold as unlocked', () => {
    const lost = BANDS[2];
    expect(shouldUnlockBand(lost, ['LIVING', 'LIMINAL'], [1, 2, 3, 4, 5, 6, 7, 8])).toBe(true);
  });

  it('handles over-threshold as unlocked', () => {
    const lost = BANDS[2];
    expect(shouldUnlockBand(lost, ['LIVING', 'LIMINAL'], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(
      true,
    );
  });

  it('returns false for under-threshold even with many calls', () => {
    const classified = BANDS[3];
    expect(
      shouldUnlockBand(
        classified,
        ['LIVING', 'LIMINAL', 'LOST'],
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      ),
    ).toBe(false);
  });
});

describe('getNextBandUnlock', () => {
  it('returns LIMINAL when 4 calls received and only LIVING unlocked', () => {
    expect(getNextBandUnlock(['LIVING'], [1, 2, 3, 4], BANDS)).toBe('LIMINAL');
  });

  it('returns null when all bands unlocked', () => {
    const all: Band[] = ['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED', '████████'];
    expect(
      getNextBandUnlock(all, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], BANDS),
    ).toBeNull();
  });

  it('returns null when no threshold met', () => {
    expect(getNextBandUnlock(['LIVING'], [], BANDS)).toBeNull();
  });

  it('returns LOST when 8 calls received and LIVING+LIMINAL unlocked', () => {
    expect(getNextBandUnlock(['LIVING', 'LIMINAL'], [1, 2, 3, 4, 5, 6, 7, 8], BANDS)).toBe('LOST');
  });

  it('returns CLASSIFIED when 12 calls received and first three unlocked', () => {
    expect(
      getNextBandUnlock(
        ['LIVING', 'LIMINAL', 'LOST'],
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        BANDS,
      ),
    ).toBe('CLASSIFIED');
  });

  it('returns ████████ when 15 calls received and first four unlocked', () => {
    expect(
      getNextBandUnlock(
        ['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED'],
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        BANDS,
      ),
    ).toBe('████████');
  });

  it('returns LIMINAL when threshold reached with duplicate received ids (dedup)', () => {
    expect(getNextBandUnlock(['LIVING'], [1, 1, 2, 2, 3, 3, 4, 4], BANDS)).toBe('LIMINAL');
  });

  it('returns null when threshold not met even with many duplicate ids', () => {
    expect(getNextBandUnlock(['LIVING'], [1, 1, 1, 1, 1, 1, 1, 1], BANDS)).toBeNull();
  });

  it('skips over the always-unlocked LIVING band (unlockAt 0, already in unlockedBands)', () => {
    // LIVING is in unlockedBands by default, so the first candidate is LIMINAL.
    expect(getNextBandUnlock(['LIVING'], [1, 2, 3, 4, 5, 6, 7, 8], BANDS)).toBe('LIMINAL');
  });

  it('respects BANDS row order — returns LIMINAL before LOST even when LOST threshold met', () => {
    // 8 calls meet LOST threshold too, but LIMINAL comes first in BANDS.
    expect(getNextBandUnlock(['LIVING'], [1, 2, 3, 4, 5, 6, 7, 8], BANDS)).toBe('LIMINAL');
  });
});

describe('formatTapeCount', () => {
  it('formats 0 of 15', () => {
    expect(formatTapeCount([], 15)).toBe('0/15');
  });

  it('formats 3 of 15', () => {
    expect(formatTapeCount(['Tape #1', 'Tape #2', 'Tape #3'], 15)).toBe('3/15');
  });

  it('formats 15 of 15', () => {
    const all = Array.from({ length: 15 }, (_, i) => `Tape #${i + 1}`);
    expect(formatTapeCount(all, 15)).toBe('15/15');
  });

  it('uses array length, not deduped count (store contract guarantees uniqueness)', () => {
    // Two identical strings would produce length 2 — but the store dedupes,
    // so this is only a paranoid contract assertion: formatTapeCount does not
    // dedupe itself.
    expect(formatTapeCount(['Tape #1', 'Tape #1'], 15)).toBe('2/15');
  });
});
