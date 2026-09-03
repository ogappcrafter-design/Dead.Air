import { BANDS, bandById } from '../src/content/bands';
import { CALLS, CALL_COUNT, STORY_CALLS, callById } from '../src/content/calls';
import {
  DEFAULT_SAVE,
  EMERGENCY_RESTORE,
  STABILISE_COST,
  STABILISE_RESTORE,
  isOffAir,
  stabilise,
  stabiliseQuote,
} from '../src/engine/save';
import {
  CALM_ABOVE,
  flickerIntervalMs,
  interference,
  interferenceBurstMs,
  scanlineOpacity,
  signalPenalty,
  vignetteBoost,
} from '../src/engine/interference';
import {
  availableCalls,
  isCallAvailable,
  nextBandId,
  progressSummary,
  teasedCalls,
} from '../src/engine/progression';
import { lineTiming } from '../src/hooks/useTranscript';

const owned = { baseUnlocked: true, infiniteUnlocked: false };
const at = (hour) => new Date(2026, 8, 3, hour, 30, 0);
const save = (over = {}) => ({ ...DEFAULT_SAVE, ...over });

describe('interference', () => {
  it('is nothing at all while the DJ is holding together', () => {
    [100, 90, CALM_ABOVE].forEach((s) => expect(interference(s)).toBe(0));
  });

  it('builds slowly at first and falls apart at the end', () => {
    // The dread should ramp, not switch on: half sanity is still mild.
    expect(interference(50)).toBeLessThan(0.15);
    expect(interference(20)).toBeGreaterThan(0.4);
    expect(interference(0)).toBe(1);
  });

  it('never leaves 0..1', () => {
    [-50, 0, 35, 100, 999].forEach((s) => {
      expect(interference(s)).toBeGreaterThanOrEqual(0);
      expect(interference(s)).toBeLessThanOrEqual(1);
    });
  });

  it('rises monotonically as sanity falls', () => {
    const readings = [100, 80, 60, 40, 20, 0].map(interference);
    readings.forEach((v, i) => i && expect(v).toBeGreaterThanOrEqual(readings[i - 1]));
  });

  it('keeps scanline opacity under 1, which RN would clamp', () => {
    [100, 50, 0].forEach((s) => {
      expect(scanlineOpacity(s)).toBeGreaterThan(0);
      expect(scanlineOpacity(s)).toBeLessThanOrEqual(1);
    });
  });

  it('flickers more often the worse it gets', () => {
    expect(flickerIntervalMs(0)).toBeLessThan(flickerIntervalMs(100));
    expect(flickerIntervalMs(0)).toBeGreaterThan(1000); // never a strobe
  });

  it('only interrupts a call once things are genuinely bad', () => {
    expect(interferenceBurstMs(100)).toBeNull();
    expect(interferenceBurstMs(60)).toBeNull();
    expect(interferenceBurstMs(0)).toBeGreaterThan(3000);
  });

  it('closes the vignette in and drops a signal bar when critical', () => {
    expect(vignetteBoost(100)).toBe(0);
    expect(vignetteBoost(0)).toBeGreaterThan(0);
    expect(signalPenalty(100)).toBe(0);
    expect(signalPenalty(5)).toBe(1);
  });
});

describe('going off air', () => {
  it('is exactly the zero point', () => {
    expect(isOffAir(save({ sanity: 1 }))).toBe(false);
    expect(isOffAir(save({ sanity: 0 }))).toBe(true);
  });
});

describe('stabilise', () => {
  it('is not offered on a full meter', () => {
    expect(stabiliseQuote(save({ sanity: 100, bal: 500 })).available).toBe(false);
  });

  it('trades static for sanity at the advertised rate', () => {
    const before = save({ sanity: 40, bal: 300 });
    const { save: after, spent, restored } = stabilise(before);
    expect(spent).toBe(STABILISE_COST);
    expect(restored).toBe(STABILISE_RESTORE);
    expect(after.bal).toBe(300 - STABILISE_COST);
    expect(after.sanity).toBe(40 + STABILISE_RESTORE);
  });

  it('gives a partial restore for partial payment', () => {
    const { spent, restored } = stabilise(save({ sanity: 40, bal: 50 }));
    expect(spent).toBe(50);
    expect(restored).toBe(Math.round(STABILISE_RESTORE / 2));
  });

  it('never overfills the meter', () => {
    expect(stabilise(save({ sanity: 95, bal: 500 })).save.sanity).toBe(100);
  });

  it('cannot strand a broke player off air', () => {
    // Spending everything and then taking one bad call must not be a softlock.
    const broke = save({ sanity: 0, bal: 0 });
    const quote = stabiliseQuote(broke);
    expect(quote.available).toBe(true);
    expect(quote.emergency).toBe(true);

    const { save: after, spent, restored } = stabilise(broke);
    expect(spent).toBe(0);
    expect(restored).toBe(EMERGENCY_RESTORE);
    expect(isOffAir(after)).toBe(false);
  });

  it('charges everything a nearly-broke player has when at zero', () => {
    const { save: after, spent } = stabilise(save({ sanity: 0, bal: 20 }));
    expect(spent).toBe(20);
    expect(after.bal).toBe(0);
    expect(isOffAir(after)).toBe(false);
  });

  it('does not mutate the save it was handed', () => {
    const before = save({ sanity: 40, bal: 300 });
    stabilise(before);
    expect(before).toEqual({ ...DEFAULT_SAVE, sanity: 40, bal: 300 });
  });
});

describe('windowed and gated calls', () => {
  const secret = CALLS.find((c) => c.secret);
  const done = (...ids) => save({ done: ids });

  it('ships one, gated behind the call that hints at it', () => {
    expect(secret).toBeDefined();
    expect(secret.requires).toBe('liminal-347');
    expect(callById(secret.requires)).toBeTruthy();
  });

  it('stays hidden until its prerequisite is logged, even in the window', () => {
    expect(isCallAvailable(secret, save(), at(3))).toBe(false);
  });

  it('appears only inside its hour', () => {
    const ready = done('liminal-347');
    expect(isCallAvailable(secret, ready, at(3))).toBe(true);
    expect(isCallAvailable(secret, ready, at(2))).toBe(false);
    expect(isCallAvailable(secret, ready, at(4))).toBe(false);
    expect(isCallAvailable(secret, ready, at(23))).toBe(false);
  });

  it('disappears again once taken', () => {
    expect(isCallAvailable(secret, done('liminal-347', secret.id), at(3))).toBe(false);
  });

  it('handles a window that wraps past midnight', () => {
    const nightly = { id: 'x', window: { from: 23, to: 2 } };
    [23, 0, 1].forEach((h) => expect(isCallAvailable(nightly, save(), at(h))).toBe(true));
    [2, 12, 22].forEach((h) => expect(isCallAvailable(nightly, save(), at(h))).toBe(false));
  });

  it('is teased outside the window, but only once earned', () => {
    expect(teasedCalls(secret.band, save(), at(12))).toEqual([]);
    expect(teasedCalls(secret.band, done('liminal-347'), at(12))).toHaveLength(1);
    // Inside the window it is a real card, not a tease.
    expect(teasedCalls(secret.band, done('liminal-347'), at(3))).toEqual([]);
  });

  it('keeps the dial free of it at every other hour', () => {
    const ready = done('liminal-347');
    const ids = (h) => availableCalls(secret.band, ready, at(h)).map((c) => c.id);
    expect(ids(3)).toContain(secret.id);
    expect(ids(13)).not.toContain(secret.id);
  });
});

describe('completion counts', () => {
  it('excludes secrets, so 100% never depends on being awake at 3am', () => {
    expect(CALL_COUNT).toBe(STORY_CALLS.length);
    expect(STORY_CALLS.every((c) => !c.secret)).toBe(true);
    expect(CALLS.length).toBeGreaterThan(CALL_COUNT);
  });

  it('reads 100% with every story call logged and the secret missed', () => {
    const all = save({ done: STORY_CALLS.map((c) => c.id) });
    expect(progressSummary(all, owned)).toMatchObject({ complete: true, percent: 100 });
  });

  it('does not read over 100% when the secret is also logged', () => {
    const everything = save({ done: CALLS.map((c) => c.id) });
    const summary = progressSummary(everything, owned);
    expect(summary.callsDone).toBe(CALL_COUNT);
    expect(summary.percent).toBe(100);
  });
});

describe('nextBandId', () => {
  const clearBand = (id) => availableCalls(id, save()).map((c) => c.id);

  it('stays put while the current band still has calls', () => {
    expect(nextBandId(0, save(), owned)).toBeNull();
  });

  it('moves on once the current band is cleared', () => {
    const cleared = save({ done: clearBand(0) });
    expect(nextBandId(0, cleared, owned)).toBe(1);
  });

  it('does not move to a band the player has not bought', () => {
    const cleared = save({ done: clearBand(0) });
    expect(nextBandId(0, cleared, { baseUnlocked: false })).toBeNull();
  });

  it('returns null at the end of the game rather than looping', () => {
    const finished = save({ done: STORY_CALLS.map((c) => c.id) });
    const last = BANDS[BANDS.length - 1].id;
    expect(nextBandId(last, finished, owned)).toBeNull();
  });
});

describe('lineTiming', () => {
  it('does not type a beat — it holds', () => {
    const { typeMs, holdMs } = lineTiming('...');
    expect(typeMs).toBe(0);
    expect(holdMs).toBeGreaterThan(800);
  });

  it('scales typing with length', () => {
    expect(lineTiming('short').typeMs).toBeLessThan(lineTiming('a'.repeat(80)).typeMs);
  });

  it('reads at a human pace, not a teletype', () => {
    // A 60-character line should land in roughly a second or so.
    const { typeMs } = lineTiming('a'.repeat(60));
    expect(typeMs).toBeGreaterThan(700);
    expect(typeMs).toBeLessThan(2200);
  });

  it('holds longer on a line that trails off than one that lands', () => {
    const trails = lineTiming('"I don\'t know how to say this..."');
    const lands = lineTiming('"I don\'t know how to say this."');
    expect(trails.holdMs).toBeGreaterThan(lands.holdMs);
  });

  it('holds longer on an unanswered question', () => {
    expect(lineTiming('"Are you still there?"').holdMs).toBeGreaterThan(
      lineTiming('"I am still here."').holdMs,
    );
  });

  it('caps the pause so a long line never stalls the call', () => {
    expect(lineTiming('a'.repeat(400)).holdMs).toBeLessThanOrEqual(2000);
  });

  it('survives junk', () => {
    [null, undefined, '', 0].forEach((v) => {
      const t = lineTiming(v);
      expect(Number.isFinite(t.typeMs)).toBe(true);
      expect(Number.isFinite(t.holdMs)).toBe(true);
    });
  });
});

describe('the secret transmission itself', () => {
  const secret = CALLS.find((c) => c.secret);

  it('lives on a band the player can reach long before the endgame', () => {
    expect(bandById(secret.band).unlockAt).toBeLessThanOrEqual(4);
  });

  it('pays well enough to be worth being awake for', () => {
    const typical = STORY_CALLS.reduce((sum, c) => sum + c.staticReward, 0) / STORY_CALLS.length;
    expect(secret.staticReward).toBeGreaterThan(typical);
  });

  it('awards no tape, so the archive is completable without it', () => {
    expect(secret.tape).toBeUndefined();
  });
});
