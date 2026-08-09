import {
  applyCallResult,
  clampSanity,
  DEFAULT_SAVE,
  migratePurchases,
  migrateSave,
  sanityState,
  SAVE_VERSION,
} from '../src/engine/save';
import { CALLS } from '../src/content/calls';
import { ALL_TAPES } from '../src/content/tapes';

const call = (id) => CALLS.find((c) => c.id === id);

describe('migrateSave', () => {
  it('returns defaults for junk input', () => {
    expect(migrateSave(null)).toEqual(DEFAULT_SAVE);
    expect(migrateSave('nope')).toEqual(DEFAULT_SAVE);
    expect(migrateSave(undefined).sanity).toBe(100);
  });

  it('converts v1 numeric call ids to stable string ids', () => {
    const migrated = migrateSave({ sanity: 80, bal: 120, done: [0, 3, 17], tapes: [], genCount: 1 });
    expect(migrated.done).toEqual(['living-disconnected', 'living-harold', 'unknown-dead-air']);
    expect(migrated.version).toBe(SAVE_VERSION);
  });

  it('keeps v2 string ids untouched and drops duplicates', () => {
    const migrated = migrateSave({ done: ['living-harold', 'living-harold', 'lost-grand'] });
    expect(migrated.done).toEqual(['living-harold', 'lost-grand']);
  });

  it('discards tapes that are not in the archive', () => {
    const migrated = migrateSave({ tapes: [ALL_TAPES[0], 'Tape #99 — Forged'] });
    expect(migrated.tapes).toEqual([ALL_TAPES[0]]);
  });

  it('clamps out-of-range values rather than trusting the file', () => {
    const migrated = migrateSave({ sanity: 9000, bal: -50, genCount: -3 });
    expect(migrated.sanity).toBe(100);
    expect(migrated.bal).toBe(0);
    expect(migrated.genCount).toBe(0);
  });
});

describe('migratePurchases', () => {
  it('coerces to booleans', () => {
    expect(migratePurchases({ baseUnlocked: 1, infiniteUnlocked: null })).toEqual({
      baseUnlocked: true,
      infiniteUnlocked: false,
    });
  });

  it('defaults to nothing owned', () => {
    expect(migratePurchases(null)).toEqual({ baseUnlocked: false, infiniteUnlocked: false });
  });
});

describe('clampSanity', () => {
  it('holds the 0..100 range', () => {
    expect(clampSanity(-10)).toBe(0);
    expect(clampSanity(140)).toBe(100);
    expect(clampSanity(55)).toBe(55);
    expect(clampSanity('nonsense')).toBe(0);
  });
});

describe('applyCallResult', () => {
  const harold = call('living-harold');

  it('pays out staticReward scaled by the choice multiplier', () => {
    const { save, gained } = applyCallResult(DEFAULT_SAVE, harold, { staticMult: 1.5 });
    expect(gained.payout).toBe(45); // 30 * 1.5
    expect(save.bal).toBe(45);
  });

  it('reports the sanity actually applied, not the requested delta', () => {
    const nearlyGone = { ...DEFAULT_SAVE, sanity: 5 };
    const { save, gained } = applyCallResult(nearlyGone, harold, { sanityDelta: -40 });
    expect(save.sanity).toBe(0);
    expect(gained.sanityDelta).toBe(-5);
  });

  it('logs the call so it drops off the dial', () => {
    const { save } = applyCallResult(DEFAULT_SAVE, harold, {});
    expect(save.done).toEqual(['living-harold']);
  });

  it('never logs the same call twice', () => {
    const once = applyCallResult(DEFAULT_SAVE, harold, {}).save;
    const twice = applyCallResult(once, harold, {}).save;
    expect(twice.done).toEqual(['living-harold']);
  });

  it('awards a tape once and only from the archive', () => {
    const first = applyCallResult(DEFAULT_SAVE, harold, { tape: ALL_TAPES[0] });
    expect(first.save.tapes).toEqual([ALL_TAPES[0]]);
    expect(first.gained.tape).toBe(ALL_TAPES[0]);

    const again = applyCallResult(first.save, call('living-collector'), { tape: ALL_TAPES[0] });
    expect(again.save.tapes).toEqual([ALL_TAPES[0]]);
    expect(again.gained.tape).toBeNull();

    const forged = applyCallResult(DEFAULT_SAVE, harold, { tape: 'Tape #99 — Forged' });
    expect(forged.save.tapes).toEqual([]);
  });

  it('burns a generation credit for generated calls without logging them', () => {
    const generated = { id: 'gen_1', generated: true, staticReward: 60, band: 0 };
    const { save } = applyCallResult(DEFAULT_SAVE, generated, {});
    expect(save.genCount).toBe(1);
    expect(save.done).toEqual([]);
  });

  it('does not mutate the save it was given', () => {
    const before = { ...DEFAULT_SAVE, done: [], tapes: [] };
    applyCallResult(before, harold, { tape: ALL_TAPES[0], staticMult: 2 });
    expect(before.done).toEqual([]);
    expect(before.bal).toBe(0);
  });

  it('treats a missing multiplier as 1x and a missing delta as 0', () => {
    const { gained } = applyCallResult(DEFAULT_SAVE, harold, {});
    expect(gained.payout).toBe(30);
    expect(gained.sanityDelta).toBe(0);
  });
});

describe('sanityState', () => {
  it('bands the readout', () => {
    expect(sanityState(100).label).toBe('STABLE');
    expect(sanityState(50).label).toBe('FRAYED');
    expect(sanityState(10).label).toBe('CRITICAL');
    expect(sanityState(0).label).toBe('DEAD AIR');
  });
});
