import { BANDS, bandById } from '../src/content/bands';
import { CALLS, CALL_COUNT, callsInBand } from '../src/content/calls';
import { DEFAULT_SAVE } from '../src/engine/save';
import {
  availableCalls,
  bandLockReason,
  defaultBandId,
  FREE_GENERATIONS,
  generationStatus,
  isBandUnlocked,
  progressSummary,
  unlockedBands,
} from '../src/engine/progression';

const owned = { baseUnlocked: true, infiniteUnlocked: false };
const nothing = { baseUnlocked: false, infiniteUnlocked: false };
const withDone = (n) => ({ ...DEFAULT_SAVE, done: CALLS.slice(0, n).map((c) => c.id) });

describe('isBandUnlocked', () => {
  it('always opens LIVING, bought or not', () => {
    expect(isBandUnlocked(bandById(0), DEFAULT_SAVE, nothing)).toBe(true);
  });

  it('keeps paid bands shut without the base purchase, however far you get', () => {
    expect(isBandUnlocked(bandById(1), withDone(18), nothing)).toBe(false);
  });

  it('still gates paid bands on progress after purchase', () => {
    // This is the v1 bug: buying the game unlocked all five bands at once and
    // made the unlock table in the README decorative.
    expect(isBandUnlocked(bandById(1), withDone(0), owned)).toBe(false);
    expect(isBandUnlocked(bandById(1), withDone(4), owned)).toBe(true);
    expect(isBandUnlocked(bandById(4), withDone(14), owned)).toBe(false);
    expect(isBandUnlocked(bandById(4), withDone(15), owned)).toBe(true);
  });

  it('opens every band by the time the base game is finished', () => {
    expect(unlockedBands(withDone(CALL_COUNT), owned)).toHaveLength(BANDS.length);
  });
});

describe('bandLockReason', () => {
  it('says nothing about an open band', () => {
    expect(bandLockReason(bandById(0), DEFAULT_SAVE, nothing)).toBeNull();
  });

  it('reports the paywall before the progress gate', () => {
    expect(bandLockReason(bandById(1), withDone(10), nothing)).toBe('LOCKED');
  });

  it('counts down remaining calls, with correct pluralisation', () => {
    expect(bandLockReason(bandById(1), withDone(2), owned)).toBe('2 MORE CALLS');
    expect(bandLockReason(bandById(1), withDone(3), owned)).toBe('1 MORE CALL');
  });
});

describe('availableCalls', () => {
  it('hides calls already logged', () => {
    const first = callsInBand(0)[0];
    const save = { ...DEFAULT_SAVE, done: [first.id] };
    expect(availableCalls(0, save).map((c) => c.id)).not.toContain(first.id);
    expect(availableCalls(0, save)).toHaveLength(callsInBand(0).length - 1);
  });
});

describe('generationStatus', () => {
  it('grants free generations, then stops', () => {
    expect(generationStatus(DEFAULT_SAVE, nothing)).toMatchObject({
      allowed: true,
      remaining: FREE_GENERATIONS,
    });
    const spent = { ...DEFAULT_SAVE, genCount: FREE_GENERATIONS };
    expect(generationStatus(spent, nothing)).toMatchObject({ allowed: false, remaining: 0 });
  });

  it('is unlimited once Infinite Signal is owned', () => {
    const spent = { ...DEFAULT_SAVE, genCount: 99 };
    expect(generationStatus(spent, { infiniteUnlocked: true })).toMatchObject({
      allowed: true,
      unlimited: true,
    });
  });
});

describe('defaultBandId', () => {
  it('starts on LIVING', () => {
    expect(defaultBandId(DEFAULT_SAVE, nothing)).toBe(0);
  });

  it('moves to the first open band that still has calls waiting', () => {
    expect(defaultBandId(withDone(4), owned)).toBe(1);
  });

  it('falls back to the last open band once everything reachable is logged', () => {
    expect(defaultBandId(withDone(CALL_COUNT), owned)).toBe(4);
  });
});

describe('progressSummary', () => {
  it('totals a fresh save', () => {
    expect(progressSummary(DEFAULT_SAVE, nothing)).toMatchObject({
      callsDone: 0,
      callsTotal: CALL_COUNT,
      tapesFound: 0,
      bandsOpen: 1,
      complete: false,
      percent: 0,
    });
  });

  it('reports completion at the end', () => {
    expect(progressSummary(withDone(CALL_COUNT), owned)).toMatchObject({
      complete: true,
      percent: 100,
    });
  });
});
