// __tests__/engine/progression/TapeMastery.test.ts
// Tests for the pure Tape Mastery functions.

import {
  MASTERY_THRESHOLDS,
  MASTERY_LAYERS,
  getCurrentLayer,
  isLayerUnlocked,
  getNextLayerThreshold,
  incrementListenCount,
  checkLayerUnlock,
  getTapesAtLayer,
  getTotalLayersUnlocked,
} from '@/engine/progression/TapeMastery';

describe('constants', () => {
  it('MASTERY_THRESHOLDS has surface=1, depth=5, abyss=10', () => {
    expect(MASTERY_THRESHOLDS.surface).toBe(1);
    expect(MASTERY_THRESHOLDS.depth).toBe(5);
    expect(MASTERY_THRESHOLDS.abyss).toBe(10);
  });

  it('MASTERY_LAYERS is ordered surface, depth, abyss', () => {
    expect(MASTERY_LAYERS).toEqual(['surface', 'depth', 'abyss']);
  });
});

describe('getCurrentLayer', () => {
  it('returns null for 0 listens', () => {
    expect(getCurrentLayer(0)).toBeNull();
  });

  it('returns "surface" for 1-4 listens', () => {
    expect(getCurrentLayer(1)).toBe('surface');
    expect(getCurrentLayer(4)).toBe('surface');
  });

  it('returns "depth" for 5-9 listens', () => {
    expect(getCurrentLayer(5)).toBe('depth');
    expect(getCurrentLayer(9)).toBe('depth');
  });

  it('returns "abyss" for 10+ listens', () => {
    expect(getCurrentLayer(10)).toBe('abyss');
    expect(getCurrentLayer(100)).toBe('abyss');
  });
});

describe('isLayerUnlocked', () => {
  it('returns true for surface at 1 listen', () => {
    expect(isLayerUnlocked(1, 'surface')).toBe(true);
  });

  it('returns false for depth at 4 listens', () => {
    expect(isLayerUnlocked(4, 'depth')).toBe(false);
  });

  it('returns true for depth at 5 listens', () => {
    expect(isLayerUnlocked(5, 'depth')).toBe(true);
  });

  it('returns false for abyss at 9 listens', () => {
    expect(isLayerUnlocked(9, 'abyss')).toBe(false);
  });

  it('returns true for abyss at 10 listens', () => {
    expect(isLayerUnlocked(10, 'abyss')).toBe(true);
  });
});

describe('getNextLayerThreshold', () => {
  it('returns surface with remaining=1 at 0 listens', () => {
    const result = getNextLayerThreshold(0);
    expect(result).toEqual({ layer: 'surface', listensRemaining: 1 });
  });

  it('returns depth with remaining=4 at 1 listen', () => {
    const result = getNextLayerThreshold(1);
    expect(result).toEqual({ layer: 'depth', listensRemaining: 4 });
  });

  it('returns depth with remaining=1 at 4 listens', () => {
    const result = getNextLayerThreshold(4);
    expect(result).toEqual({ layer: 'depth', listensRemaining: 1 });
  });

  it('returns abyss with remaining=1 at 9 listens', () => {
    const result = getNextLayerThreshold(9);
    expect(result).toEqual({ layer: 'abyss', listensRemaining: 1 });
  });

  it('returns null at 10 listens (already at abyss)', () => {
    expect(getNextLayerThreshold(10)).toBeNull();
  });

  it('returns null at 100 listens (already at abyss)', () => {
    expect(getNextLayerThreshold(100)).toBeNull();
  });
});

describe('incrementListenCount', () => {
  it('increments an existing tape from 1 to 2', () => {
    const counts = { 'tape-001': 1 };
    const result = incrementListenCount(counts, 'tape-001');
    expect(result['tape-001']).toBe(2);
  });

  it('initializes a new tape to 1', () => {
    const counts: Record<string, number> = {};
    const result = incrementListenCount(counts, 'tape-001');
    expect(result['tape-001']).toBe(1);
  });

  it('does not mutate the input record', () => {
    const counts = { 'tape-001': 3 };
    const result = incrementListenCount(counts, 'tape-001');
    expect(counts['tape-001']).toBe(3);
    expect(result).not.toBe(counts);
  });

  it('preserves other tapes in the record', () => {
    const counts = { 'tape-001': 2, 'tape-002': 5 };
    const result = incrementListenCount(counts, 'tape-001');
    expect(result['tape-002']).toBe(5);
  });
});

describe('checkLayerUnlock', () => {
  it('returns "surface" when going from 0 to 1 listen', () => {
    expect(checkLayerUnlock(0)).toBe('surface');
  });

  it('returns null when going from 1 to 2 listens (same layer)', () => {
    expect(checkLayerUnlock(1)).toBeNull();
  });

  it('returns "depth" when going from 4 to 5 listens', () => {
    expect(checkLayerUnlock(4)).toBe('depth');
  });

  it('returns null when going from 5 to 6 listens (same layer)', () => {
    expect(checkLayerUnlock(5)).toBeNull();
  });

  it('returns "abyss" when going from 9 to 10 listens', () => {
    expect(checkLayerUnlock(9)).toBe('abyss');
  });

  it('returns null when going from 10 to 11 listens (already at abyss)', () => {
    expect(checkLayerUnlock(10)).toBeNull();
  });
});

describe('getTapesAtLayer', () => {
  it('returns tapes with count >= surface threshold (1)', () => {
    const counts = { 'tape-001': 0, 'tape-002': 1, 'tape-003': 5 };
    const result = getTapesAtLayer(counts, 'surface');
    expect(result).toContain('tape-002');
    expect(result).toContain('tape-003');
    expect(result).not.toContain('tape-001');
  });

  it('returns tapes with count >= depth threshold (5)', () => {
    const counts = { 'tape-001': 3, 'tape-002': 5, 'tape-003': 10 };
    const result = getTapesAtLayer(counts, 'depth');
    expect(result).toEqual(['tape-002', 'tape-003']);
  });

  it('returns tapes with count >= abyss threshold (10)', () => {
    const counts = { 'tape-001': 10, 'tape-002': 5, 'tape-003': 15 };
    const result = getTapesAtLayer(counts, 'abyss');
    expect(result).toEqual(['tape-001', 'tape-003']);
  });

  it('returns empty array when no tapes meet threshold', () => {
    const counts = { 'tape-001': 1, 'tape-002': 3 };
    const result = getTapesAtLayer(counts, 'depth');
    expect(result).toEqual([]);
  });

  it('returns empty array for empty counts', () => {
    const result = getTapesAtLayer({}, 'surface');
    expect(result).toEqual([]);
  });
});

describe('getTotalLayersUnlocked', () => {
  it('returns all zeros for empty counts', () => {
    const result = getTotalLayersUnlocked({});
    expect(result).toEqual({ surface: 0, depth: 0, abyss: 0 });
  });

  it('counts surface only for a tape with 1-4 listens', () => {
    const result = getTotalLayersUnlocked({ 'tape-001': 3 });
    expect(result.surface).toBe(1);
    expect(result.depth).toBe(0);
    expect(result.abyss).toBe(0);
  });

  it('counts surface+depth for a tape with 5-9 listens', () => {
    const result = getTotalLayersUnlocked({ 'tape-001': 7 });
    expect(result.surface).toBe(1);
    expect(result.depth).toBe(1);
    expect(result.abyss).toBe(0);
  });

  it('counts all three for a tape with 10+ listens', () => {
    const result = getTotalLayersUnlocked({ 'tape-001': 15 });
    expect(result.surface).toBe(1);
    expect(result.depth).toBe(1);
    expect(result.abyss).toBe(1);
  });

  it('aggregates correctly across multiple tapes', () => {
    const counts = {
      'tape-001': 3,  // surface
      'tape-002': 7,  // surface + depth
      'tape-003': 12, // surface + depth + abyss
      'tape-004': 0,  // nothing
    };
    const result = getTotalLayersUnlocked(counts);
    expect(result.surface).toBe(3);
    expect(result.depth).toBe(2);
    expect(result.abyss).toBe(1);
  });
});
