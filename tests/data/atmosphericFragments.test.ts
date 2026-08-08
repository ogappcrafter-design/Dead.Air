// tests/data/atmosphericFragments.test.ts
// Tests for atmospheric DLC fragment quality and structure (DEA-30).

import { RAIN_NIGHT_FRAGMENTS } from '@/data/fragments/rainNight';
import { WINTER_STATIC_FRAGMENTS } from '@/data/fragments/winterStatic';
import { DEEP_SPACE_FRAGMENTS } from '@/data/fragments/deepSpace';
import type { FragmentLibrary } from '@/data/fragments/types';
import { BANDS, CALL_TYPES } from '@/lib/constants';

const ALL_FRAGMENTS: Array<{ name: string; lib: FragmentLibrary; minCalls: number }> = [
  { name: 'RAIN_NIGHT', lib: RAIN_NIGHT_FRAGMENTS, minCalls: 4 },
  { name: 'WINTER_STATIC', lib: WINTER_STATIC_FRAGMENTS, minCalls: 4 },
  { name: 'DEEP_SPACE', lib: DEEP_SPACE_FRAGMENTS, minCalls: 5 },
];

describe('Atmospheric DLC fragments', () => {
  for (const { name, lib, minCalls } of ALL_FRAGMENTS) {
    describe(`${name}`, () => {
      it('uses band 0 (LIVING)', () => {
        expect(lib.band).toBe(0);
      });

      it('has bandName LIVING', () => {
        expect(lib.bandName).toBe('LIVING');
      });

      it('has valid callTypes', () => {
        for (const ct of lib.callTypes) {
          expect(CALL_TYPES).toContain(ct);
        }
      });

      it('has at least 3 callTypes', () => {
        expect(lib.callTypes.length).toBeGreaterThanOrEqual(3);
      });

      it('has non-empty openings', () => {
        expect(lib.openings.length).toBeGreaterThanOrEqual(4);
        for (const o of lib.openings) {
          expect(o.length).toBeGreaterThan(10);
        }
      });

      it('has non-empty middles', () => {
        expect(lib.middles.length).toBeGreaterThanOrEqual(4);
        for (const m of lib.middles) {
          expect(m.length).toBeGreaterThan(10);
        }
      });

      it('has non-empty closings', () => {
        expect(lib.closings.length).toBeGreaterThanOrEqual(3);
        for (const c of lib.closings) {
          expect(c.length).toBeGreaterThan(10);
        }
      });

      it('has non-empty callerIdPrefixes', () => {
        expect(lib.callerIdPrefixes.length).toBeGreaterThanOrEqual(3);
      });

      it('has non-empty callerNamePrefixes', () => {
        expect(lib.callerNamePrefixes.length).toBeGreaterThanOrEqual(3);
      });

      it('has enough fragments to support min calls', () => {
        const maxCalls = Math.min(lib.openings.length, lib.closings.length);
        expect(maxCalls).toBeGreaterThanOrEqual(minCalls);
      });

      it('has responses for RIGHT_ANSWER if present in callTypes', () => {
        if (lib.callTypes.includes('RIGHT_ANSWER')) {
          expect(lib.responses.length).toBeGreaterThanOrEqual(3);
          for (const r of lib.responses) {
            expect(r.text.length).toBeGreaterThan(5);
            expect(r.outcome.length).toBeGreaterThan(5);
          }
        }
      });
    });
  }

  it('all atmospheric fragments use the LIVING band', () => {
    for (const { lib } of ALL_FRAGMENTS) {
      expect(lib.bandName).toBe('LIVING');
    }
  });
});
