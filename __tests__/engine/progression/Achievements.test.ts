// __tests__/engine/progression/Achievements.test.ts
// Pure-function tests for the milestone engine.

import {
  checkAchievements,
  getAchievementStatus,
  type PlayerStats,
} from '@/engine/progression/Achievements';

const BASE_STATS: PlayerStats = {
  callsReceived: 0,
  bandsUnlocked: 1,
  tapesCollected: 0,
  sanityLowest: 100,
  shiftsCompleted: 0,
  longestCallSurvivedMs: 0,
  difficultyMode: 'insomniac',
  shiftsCompletedByDifficulty: {},
};

const withStats = (over: Partial<PlayerStats>): PlayerStats => ({
  ...BASE_STATS,
  ...over,
});

describe('checkAchievements', () => {
  it('returns ["first_call"] at exactly 1 received call with no prior unlocks', () => {
    const result = checkAchievements(withStats({ callsReceived: 1 }), []);
    expect(result).toEqual(['first_call']);
  });

  it('unlocks survivor_10 when callsReceived=10 and first_call already unlocked', () => {
    const result = checkAchievements(withStats({ callsReceived: 10 }), ['first_call']);
    expect(result).toEqual(['survivor_10']);
  });

  it('returns [] when callsReceived=10 but survivor_10 already unlocked', () => {
    const result = checkAchievements(withStats({ callsReceived: 10 }), [
      'first_call',
      'survivor_10',
    ]);
    expect(result).toEqual([]);
  });

  it('unlocks collector + band achievements in ACHIEVEMENTS order when many thresholds met', () => {
    // 15 tapes + 5 bands + 1 call — many achievements satisfy at once.
    const result = checkAchievements(
      withStats({
        tapesCollected: 15,
        bandsUnlocked: 5,
        callsReceived: 1,
      }),
      [],
    );
    // Per ACHIEVEMENTS order:
    //   first_call (calls>=1), collector_5 (tapes>=5), collector_all (tapes>=15),
    //   band_3 (bands>=4), band_5 (bands>=5)
    // Note: survivor_* stay locked (calls=1) and low_sanity/night_owl/long_call
    // stay locked (defaults). The brief expects ordering:
    expect(result).toEqual(['first_call', 'collector_5', 'collector_all', 'band_3', 'band_5']);
  });

  it('handles partial unlocks (collector_5, collector_all, band_3, band_5) without first_call', () => {
    // When first_call already unlocked, it's omitted; only new ones surface.
    const result = checkAchievements(
      withStats({
        tapesCollected: 15,
        bandsUnlocked: 5,
        callsReceived: 1,
      }),
      ['first_call'],
    );
    expect(result).toEqual(['collector_5', 'collector_all', 'band_3', 'band_5']);
  });

  it('survivor_25 unlocks at exactly 25 received calls', () => {
    const result = checkAchievements(withStats({ callsReceived: 25 }), [
      'first_call',
      'survivor_10',
    ]);
    expect(result).toEqual(['survivor_25']);
  });

  it('low_sanity unlocks at sanity below 10', () => {
    const result = checkAchievements(withStats({ sanityLowest: 9 }), []);
    expect(result).toContain('low_sanity');
  });

  it('low_sanity does NOT unlock at sanity exactly 10', () => {
    const result = checkAchievements(withStats({ sanityLowest: 10 }), []);
    expect(result).not.toContain('low_sanity');
  });

  it('night_owl unlocks at 5 completed shifts', () => {
    const result = checkAchievements(withStats({ shiftsCompleted: 5 }), []);
    expect(result).toContain('night_owl');
  });

  it('long_call unlocks at exactly 2 minutes (120000 ms)', () => {
    const result = checkAchievements(withStats({ longestCallSurvivedMs: 120000 }), []);
    expect(result).toContain('long_call');
  });

  it('long_call does NOT unlock at 119999 ms', () => {
    const result = checkAchievements(withStats({ longestCallSurvivedMs: 119999 }), []);
    expect(result).not.toContain('long_call');
  });

  it('no_rest_complete unlocks after a shift completed on no_rest', () => {
    const result = checkAchievements(
      withStats({
        difficultyMode: 'no_rest',
        shiftsCompleted: 1,
        shiftsCompletedByDifficulty: { no_rest: 1 },
      }),
      [],
    );
    expect(result).toContain('no_rest_complete');
  });

  it('no_rest_complete does NOT unlock on insomniac even with shifts', () => {
    const result = checkAchievements(
      withStats({
        difficultyMode: 'insomniac',
        shiftsCompleted: 10,
        shiftsCompletedByDifficulty: {},
      }),
      [],
    );
    expect(result).not.toContain('no_rest_complete');
  });

  it('no_rest_complete does NOT unlock when shifts were completed on another difficulty (Greptile repro)', () => {
    const result = checkAchievements(
      withStats({
        difficultyMode: 'no_rest',
        shiftsCompleted: 1,
        shiftsCompletedByDifficulty: { night_owl: 1 },
      }),
      [],
    );
    expect(result).not.toContain('no_rest_complete');
  });
});

describe('getAchievementStatus', () => {
  it('marks first_call unlocked when present in unlocked list, others false', () => {
    const result = getAchievementStatus(withStats({ callsReceived: 5 }), ['first_call']);
    const first = result.find((r) => r.id === 'first_call');
    const survivor10 = result.find((r) => r.id === 'survivor_10');
    expect(first?.unlocked).toBe(true);
    expect(survivor10?.unlocked).toBe(false);
  });

  it('marks an achievement unlocked when check passes (even if not yet persisted)', () => {
    // callsReceived=10 satisfies first_call AND survivor_10 even if unlocked=[].
    const result = getAchievementStatus(withStats({ callsReceived: 10 }), []);
    const first = result.find((r) => r.id === 'first_call');
    const survivor = result.find((r) => r.id === 'survivor_10');
    expect(first?.unlocked).toBe(true);
    expect(survivor?.unlocked).toBe(true);
    // Survivor_25 not yet at threshold.
    const vet = result.find((r) => r.id === 'survivor_25');
    expect(vet?.unlocked).toBe(false);
  });

  it('returns an entry per ACHIEVEMENTS row, in stable order', () => {
    const result = getAchievementStatus(BASE_STATS, []);
    const ids = result.map((r) => r.id);
    expect(ids).toEqual([
      'first_call',
      'survivor_10',
      'survivor_25',
      'collector_5',
      'collector_all',
      'band_3',
      'band_5',
      'low_sanity',
      'night_owl',
      'long_call',
      'no_rest_complete',
    ]);
  });

  it('all unlocked when thresholds met even if unlocked list is empty', () => {
    const maxedStats = withStats({
      callsReceived: 25,
      bandsUnlocked: 5,
      tapesCollected: 15,
      sanityLowest: 5,
      shiftsCompleted: 5,
      longestCallSurvivedMs: 180000,
      difficultyMode: 'no_rest',
      shiftsCompletedByDifficulty: { no_rest: 5, insomniac: 5, night_owl: 5 },
    });
    const result = getAchievementStatus(maxedStats, []);
    expect(result.every((r) => r.unlocked)).toBe(true);
  });
});
