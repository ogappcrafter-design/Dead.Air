// __tests__/data/dlcFragments.test.ts
// Tests for DLC fragment library quality and structure.

import { HOLIDAY_DLC_FRAGMENTS } from '../../data/fragments/holidayDLC';
import { NUMBERS_STATION_DLC_FRAGMENTS } from '../../data/fragments/numbersStationDLC';
import { VOICES_BEYOND_DLC_FRAGMENTS } from '../../data/fragments/voicesBeyondDLC';
import type { FragmentLibrary } from '../../data/fragments/types';

const ALL_DLC_FRAGMENT_LIBS: FragmentLibrary[] = [
  HOLIDAY_DLC_FRAGMENTS,
  NUMBERS_STATION_DLC_FRAGMENTS,
  VOICES_BEYOND_DLC_FRAGMENTS,
];

describe('DLC fragment libraries', () => {
  it('contains exactly 3 fragment libraries', () => {
    expect(ALL_DLC_FRAGMENT_LIBS).toHaveLength(3);
  });

  it('each library has a valid band index', () => {
    for (const lib of ALL_DLC_FRAGMENT_LIBS) {
      expect(lib.band).toBeGreaterThanOrEqual(0);
      expect(lib.band).toBeLessThanOrEqual(7);
    }
  });

  it('each library has a bandName', () => {
    for (const lib of ALL_DLC_FRAGMENT_LIBS) {
      expect(lib.bandName).toBeTruthy();
      expect(typeof lib.bandName).toBe('string');
    }
  });

  it('Holiday fragments use band 0 (LIVING)', () => {
    expect(HOLIDAY_DLC_FRAGMENTS.band).toBe(0);
    expect(HOLIDAY_DLC_FRAGMENTS.bandName).toBe('LIVING');
  });

  it('Numbers Station fragments use band 3 (CLASSIFIED)', () => {
    expect(NUMBERS_STATION_DLC_FRAGMENTS.band).toBe(3);
    expect(NUMBERS_STATION_DLC_FRAGMENTS.bandName).toBe('CLASSIFIED');
  });

  it('Voices Beyond fragments use band 2 (LOST)', () => {
    expect(VOICES_BEYOND_DLC_FRAGMENTS.band).toBe(2);
    expect(VOICES_BEYOND_DLC_FRAGMENTS.bandName).toBe('LOST');
  });
});

describe('DLC fragment content quality', () => {
  for (const lib of ALL_DLC_FRAGMENT_LIBS) {
    const label = `${lib.bandName} (band ${lib.band})`;

    describe(`${label}`, () => {
      it('has at least 6 openings', () => {
        expect(lib.openings.length).toBeGreaterThanOrEqual(6);
      });

      it('has at least 10 middles', () => {
        expect(lib.middles.length).toBeGreaterThanOrEqual(10);
      });

      it('has at least 6 closings', () => {
        expect(lib.closings.length).toBeGreaterThanOrEqual(6);
      });

      it('has at least 6 responses', () => {
        expect(lib.responses.length).toBeGreaterThanOrEqual(6);
      });

      it('has at least 3 callerIdPrefixes', () => {
        expect(lib.callerIdPrefixes.length).toBeGreaterThanOrEqual(3);
      });

      it('has at least 3 callerNamePrefixes', () => {
        expect(lib.callerNamePrefixes.length).toBeGreaterThanOrEqual(3);
      });

      it('has at least 1 callType', () => {
        expect(lib.callTypes.length).toBeGreaterThanOrEqual(1);
      });

      it('all openings are non-empty strings', () => {
        for (const s of lib.openings) {
          expect(typeof s).toBe('string');
          expect(s.length).toBeGreaterThan(0);
        }
      });

      it('all middles are non-empty strings', () => {
        for (const s of lib.middles) {
          expect(typeof s).toBe('string');
          expect(s.length).toBeGreaterThan(0);
        }
      });

      it('all closings are non-empty strings', () => {
        for (const s of lib.closings) {
          expect(typeof s).toBe('string');
          expect(s.length).toBeGreaterThan(0);
        }
      });

      it('all responses have text and outcome', () => {
        for (const r of lib.responses) {
          expect(r.text).toBeTruthy();
          expect(r.outcome).toBeTruthy();
        }
      });
    });
  }
});

describe('DLC fragment uniqueness', () => {
  it('Holiday openings are unique', () => {
    expect(new Set(HOLIDAY_DLC_FRAGMENTS.openings).size).toBe(
      HOLIDAY_DLC_FRAGMENTS.openings.length,
    );
  });

  it('Numbers Station openings are unique', () => {
    expect(new Set(NUMBERS_STATION_DLC_FRAGMENTS.openings).size).toBe(
      NUMBERS_STATION_DLC_FRAGMENTS.openings.length,
    );
  });

  it('Voices Beyond openings are unique', () => {
    expect(new Set(VOICES_BEYOND_DLC_FRAGMENTS.openings).size).toBe(
      VOICES_BEYOND_DLC_FRAGMENTS.openings.length,
    );
  });

  it('DLC fragment libraries target different bands', () => {
    const bands = ALL_DLC_FRAGMENT_LIBS.map((f) => f.band);
    expect(new Set(bands).size).toBe(bands.length);
  });
});
