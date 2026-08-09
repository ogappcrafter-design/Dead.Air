import { bandById } from '../src/content/bands';
import { CALL_TYPES } from '../src/content/callTypes';
import { SYM } from '../src/content/symbols';
import { normalizeGeneratedCall } from '../src/engine/generation';

const band = bandById(2);
const make = (payload) => normalizeGeneratedCall(payload, band, 1000);

describe('normalizeGeneratedCall', () => {
  it('produces a playable call from nothing at all', () => {
    const call = make(null);
    expect(call.type).toBe(CALL_TYPES.JUST_LISTEN);
    expect(call.lines).toEqual(['...']);
    expect(call.callerName).toBe('UNKNOWN');
    expect(call.band).toBe(band.id);
    expect(call.generated).toBe(true);
  });

  it('rejects an unknown call type rather than rendering a blank screen', () => {
    expect(make({ type: 'SUMMON_DEMON' }).type).toBe(CALL_TYPES.JUST_LISTEN);
  });

  it('clamps signal, reward and sanity into range', () => {
    const call = make({ signal: 99, staticReward: 100000, sanityDelta: -500 });
    expect(call.signal).toBe(5);
    expect(call.staticReward).toBe(400);
    expect(call.sanityDelta).toBe(-40);
  });

  it('drops empty lines but keeps a beat if that is all there is', () => {
    expect(make({ lines: ['a', '', 'b'] }).lines).toEqual(['a', 'b']);
    expect(make({ lines: [] }).lines).toEqual(['...']);
  });

  it('only attaches fields belonging to the chosen type', () => {
    const listen = make({ type: CALL_TYPES.JUST_LISTEN, waitSeconds: 12, choices: [] });
    expect(listen.waitSeconds).toBeUndefined();
    expect(listen.choices).toBeUndefined();
  });

  describe('DEAD_AIR', () => {
    it('bounds the hold', () => {
      expect(make({ type: CALL_TYPES.DEAD_AIR, waitSeconds: 999 }).waitSeconds).toBe(30);
      expect(make({ type: CALL_TYPES.DEAD_AIR }).waitSeconds).toBe(10);
    });
  });

  describe('STAY_CALM', () => {
    it('bounds duration and penalty', () => {
      const call = make({ type: CALL_TYPES.STAY_CALM, duration: 0, sanityPenalty: 900 });
      expect(call.duration).toBe(6);
      expect(call.sanityPenalty).toBe(40);
    });
  });

  describe('RIGHT_ANSWER', () => {
    it('substitutes a full set when the model returns too few choices', () => {
      const call = make({ type: CALL_TYPES.RIGHT_ANSWER, choices: [{ text: 'Only one' }] });
      expect(call.choices).toHaveLength(3);
      expect(call.choices[0].text).toBe('Understood.');
    });

    it('keeps three good choices and clamps their multipliers', () => {
      const call = make({
        type: CALL_TYPES.RIGHT_ANSWER,
        choices: [
          { text: 'A', outcome: 'a', sanityDelta: -5, staticMult: 99 },
          { text: 'B', outcome: 'b', sanityDelta: 0, staticMult: 1 },
          { text: 'C', outcome: 'c', sanityDelta: 5, staticMult: -3 },
        ],
      });
      expect(call.choices.map((c) => c.staticMult)).toEqual([4, 1, 0]);
      expect(call.choices.map((c) => c.text)).toEqual(['A', 'B', 'C']);
    });

    it('never lets a generated choice award an archive tape', () => {
      const call = make({
        type: CALL_TYPES.RIGHT_ANSWER,
        choices: [
          { text: 'A', tape: 'Tape #8 — Her Voice' },
          { text: 'B', tape: 'Tape #8 — Her Voice' },
          { text: 'C', tape: 'Tape #8 — Her Voice' },
        ],
      });
      call.choices.forEach((c) => expect(c.tape).toBeUndefined());
    });
  });

  describe('SIGNAL_DECODE', () => {
    it('always yields a five-glyph sequence inside the alphabet', () => {
      const short = make({ type: CALL_TYPES.SIGNAL_DECODE, sequence: [1, 2] });
      expect(short.sequence).toEqual([0, 1, 2, 3, 4]);

      const wild = make({ type: CALL_TYPES.SIGNAL_DECODE, sequence: [9, -4, 'x', 2, 1] });
      expect(wild.sequence).toHaveLength(5);
      wild.sequence.forEach((n) => {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThan(SYM.length);
      });
    });

    it('upper-cases the decoded message the UI renders letterspaced', () => {
      const call = make({ type: CALL_TYPES.SIGNAL_DECODE, decodedMessage: 'help me' });
      expect(call.decodedMessage).toBe('HELP ME');
    });
  });

  it('gives each generated call a distinct id', () => {
    const a = normalizeGeneratedCall({}, band, 1000);
    const b = normalizeGeneratedCall({}, band, 1000);
    expect(a.id).not.toBe(b.id);
  });
});
