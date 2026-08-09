import { BANDS } from '../src/content/bands';
import { CALLS, CALL_COUNT, callsInBand } from '../src/content/calls';
import { CALL_TYPES, isCallType } from '../src/content/callTypes';
import { SYM } from '../src/content/symbols';
import { ALL_TAPES, TAPE_COUNT } from '../src/content/tapes';

/** Every tape a call can award, from both flat and per-choice fields. */
const awardableTapes = () => {
  const tapes = [];
  CALLS.forEach((call) => {
    if (call.tape) tapes.push(call.tape);
    (call.choices || []).forEach((choice) => {
      if (choice.tape) tapes.push(choice.tape);
    });
  });
  return tapes;
};

describe('the broadcast', () => {
  it('ships the 18 calls and 15 tapes the store listing promises', () => {
    expect(CALL_COUNT).toBe(18);
    expect(TAPE_COUNT).toBe(15);
    expect(BANDS).toHaveLength(5);
  });

  it('gives every call a unique id', () => {
    const ids = CALLS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('assigns every call to a real band', () => {
    const bandIds = new Set(BANDS.map((b) => b.id));
    CALLS.forEach((call) => expect(bandIds.has(call.band)).toBe(true));
  });

  it('leaves no band without calls', () => {
    BANDS.forEach((band) => expect(callsInBand(band.id).length).toBeGreaterThan(0));
  });

  it('opens the free band with enough calls to reach the first paid unlock', () => {
    expect(callsInBand(0).length).toBeGreaterThanOrEqual(BANDS[1].unlockAt);
  });

  it('keeps band unlock thresholds inside what the content can satisfy', () => {
    BANDS.forEach((band) => expect(band.unlockAt).toBeLessThanOrEqual(CALL_COUNT));
  });
});

describe('every call', () => {
  CALLS.forEach((call) => {
    describe(call.id, () => {
      it('has a valid type and signal', () => {
        expect(isCallType(call.type)).toBe(true);
        expect(call.signal).toBeGreaterThanOrEqual(0);
        expect(call.signal).toBeLessThanOrEqual(5);
      });

      it('pays something', () => {
        expect(call.staticReward).toBeGreaterThan(0);
      });

      it('carries the fields its type needs', () => {
        if (call.type === CALL_TYPES.SIGNAL_DECODE) {
          expect(call.sequence).toHaveLength(5);
          call.sequence.forEach((n) => {
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThan(SYM.length);
          });
          expect(call.decodedMessage).toBeTruthy();
        } else {
          expect(Array.isArray(call.lines)).toBe(true);
          expect(call.lines.length).toBeGreaterThan(0);
        }

        if (call.type === CALL_TYPES.DEAD_AIR) expect(call.waitSeconds).toBeGreaterThan(0);
        if (call.type === CALL_TYPES.STAY_CALM) {
          expect(call.duration).toBeGreaterThan(0);
          expect(call.sanityPenalty).toBeGreaterThan(0);
        }
        if (call.type === CALL_TYPES.RIGHT_ANSWER) {
          expect(call.choices).toHaveLength(3);
          call.choices.forEach((choice) => {
            expect(choice.text).toBeTruthy();
            expect(choice.outcome).toBeTruthy();
            expect(choice.staticMult).toBeGreaterThan(0);
          });
        }
      });
    });
  });
});

describe('the archive', () => {
  it('names only tapes that exist', () => {
    awardableTapes().forEach((tape) => expect(ALL_TAPES).toContain(tape));
  });

  it('makes every tape reachable in a single playthrough', () => {
    const reachable = new Set(awardableTapes());
    const unreachable = ALL_TAPES.filter((t) => !reachable.has(t));
    expect(unreachable).toEqual([]);
  });

  it('never awards the same tape from two places', () => {
    const awarded = awardableTapes();
    expect(new Set(awarded).size).toBe(awarded.length);
  });
});
