// tests/engine/DailyCallGenerator.test.ts
// Determinism, streak-tier scaling, and exclusivity for daily mystery calls.

import { DailyCallGenerator, DAILY_ID_BASE, getTodayUTC } from '@/engine/calls/DailyCallGenerator';
import { ALL_FRAGMENTS, BAND_VARIATIONS } from '@/data/fragments';

describe('DailyCallGenerator', () => {
  let generator: DailyCallGenerator;

  beforeEach(() => {
    generator = new DailyCallGenerator();
  });

  describe('getTodayUTC', () => {
    it('returns YYYY-MM-DD format', () => {
      const today = getTodayUTC();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('determinism', () => {
    it('same date + same streak → identical call', () => {
      const a = generator.generate({ streak: 0, dateStr: '2026-08-08' });
      const b = generator.generate({ streak: 0, dateStr: '2026-08-08' });
      expect(a.call.id).toBe(b.call.id);
      expect(a.call.callerId).toBe(b.call.callerId);
      expect(a.call.callerName).toBe(b.call.callerName);
      expect(a.call.type).toBe(b.call.type);
      expect(a.call.band).toBe(b.call.band);
      expect(a.call.lines).toEqual(b.call.lines);
      expect(a.isExclusive).toBe(b.isExclusive);
    });

    it('different dates → different calls (different IDs)', () => {
      const a = generator.generate({ streak: 0, dateStr: '2026-08-08' });
      const b = generator.generate({ streak: 0, dateStr: '2026-08-09' });
      expect(a.call.id).not.toBe(b.call.id);
    });

    it('same date within same tier → same call', () => {
      const a = generator.generate({ streak: 0, dateStr: '2026-08-08' });
      const b = generator.generate({ streak: 5, dateStr: '2026-08-08' });
      expect(a.call.id).toBe(b.call.id);
      expect(a.call.type).toBe(b.call.type);
    });

    it('different tiers → potentially different call types', () => {
      const tier0Types = ['JUST_LISTEN', 'DEAD_AIR', 'RIGHT_ANSWER'];
      // Across multiple dates, different tiers should produce different call types
      // at least once — higher tiers unlock more types, but lower-tier types remain
      // available, so a single date is not guaranteed to differ.
      let anyDiff = false;
      for (let d = 1; d <= 31; d++) {
        const dateStr = `2026-01-${String(d).padStart(2, '0')}`;
        const tier0 = generator.generate({ streak: 0, dateStr });
        const tier2 = generator.generate({ streak: 30, dateStr });
        expect(tier0Types).toContain(tier0.call.type);
        if (tier0.call.type !== tier2.call.type) anyDiff = true;
      }
      expect(anyDiff).toBe(true);
    });
  });

  describe('ID stability', () => {
    it('IDs are >= DAILY_ID_BASE', () => {
      const result = generator.generate({ streak: 0, dateStr: '2026-08-08' });
      expect(result.call.id).toBeGreaterThanOrEqual(DAILY_ID_BASE);
    });

    it('same date → same ID regardless of streak', () => {
      const a = generator.generate({ streak: 0, dateStr: '2026-08-08' });
      const b = generator.generate({ streak: 50, dateStr: '2026-08-08' });
      expect(a.call.id).toBe(b.call.id);
    });

    it('IDs do not collide with sacred (0-17) or procedural (>= 1000)', () => {
      for (let d = 1; d <= 31; d++) {
        const dateStr = `2026-01-${String(d).padStart(2, '0')}`;
        const result = generator.generate({ streak: 0, dateStr });
        expect(result.call.id).toBeGreaterThanOrEqual(DAILY_ID_BASE);
        expect(result.call.id).toBeLessThan(DAILY_ID_BASE + 10000);
      }
    });
  });

  describe('streak tier scaling', () => {
    it('tier 0 (streak 0-6) uses basic call types only', () => {
      const basicTypes = ['JUST_LISTEN', 'DEAD_AIR', 'RIGHT_ANSWER'];
      for (let s = 0; s <= 6; s++) {
        const result = generator.generate({ streak: s, dateStr: '2026-08-08' });
        expect(basicTypes).toContain(result.call.type);
      }
    });

    it('tier 1 (streak 7-29) unlocks SIGNAL_DECODE, STAY_CALM, RECORDING', () => {
      const expandedTypes = [
        'JUST_LISTEN',
        'DEAD_AIR',
        'RIGHT_ANSWER',
        'SIGNAL_DECODE',
        'STAY_CALM',
        'RECORDING',
      ];
      for (let s = 7; s <= 29; s++) {
        const result = generator.generate({ streak: s, dateStr: '2026-08-08' });
        expect(expandedTypes).toContain(result.call.type);
      }
    });

    it('tier 2 (streak 30+) unlocks all types', () => {
      const allTypes = [
        'JUST_LISTEN',
        'DEAD_AIR',
        'RIGHT_ANSWER',
        'SIGNAL_DECODE',
        'STAY_CALM',
        'RECORDING',
        'MULTI_CALLER',
        'TIMING',
        'PUZZLE',
        'CONVERSATION',
      ];
      for (let s = 30; s <= 100; s += 10) {
        const result = generator.generate({ streak: s, dateStr: '2026-08-08' });
        expect(allTypes).toContain(result.call.type);
      }
    });
  });

  describe('exclusivity', () => {
    it('exclusive flag is boolean', () => {
      const result = generator.generate({ streak: 0, dateStr: '2026-08-08' });
      expect(typeof result.isExclusive).toBe('boolean');
    });

    it('exclusive calls use special caller names', () => {
      const exclusiveNames = ['The Broadcaster', 'Daily Signal', 'Midnight Caller'];
      let foundExclusive = false;
      for (let d = 1; d <= 31; d++) {
        const dateStr = `2026-01-${String(d).padStart(2, '0')}`;
        const result = generator.generate({ streak: 5, dateStr });
        if (result.isExclusive) {
          foundExclusive = true;
          expect(exclusiveNames).toContain(result.call.callerName);
        }
      }
      // ~35% chance, very likely to hit at least one in 31 days
      expect(foundExclusive).toBe(true);
    });
  });

  describe('call data validity', () => {
    it('produces valid band index', () => {
      const result = generator.generate({ streak: 0, dateStr: '2026-08-08' });
      expect(result.call.band).toBeGreaterThanOrEqual(0);
      expect(result.call.band).toBeLessThan(ALL_FRAGMENTS.length);
    });

    it('produces valid signal (0-5)', () => {
      const result = generator.generate({ streak: 0, dateStr: '2026-08-08' });
      expect(result.call.signal).toBeGreaterThanOrEqual(0);
      expect(result.call.signal).toBeLessThanOrEqual(5);
    });

    it('produces non-empty callerId and callerName', () => {
      const result = generator.generate({ streak: 0, dateStr: '2026-08-08' });
      expect(result.call.callerId.length).toBeGreaterThan(0);
      expect(result.call.callerName.length).toBeGreaterThan(0);
    });

    it('returns dateStr in result', () => {
      const result = generator.generate({ streak: 0, dateStr: '2026-08-08' });
      expect(result.dateStr).toBe('2026-08-08');
    });
  });

  describe('constructor injection', () => {
    it('accepts custom fragments, variations, and idBase', () => {
      const customIdBase = 60_000;
      const gen = new DailyCallGenerator(ALL_FRAGMENTS, BAND_VARIATIONS, customIdBase);
      const result = gen.generate({ streak: 0, dateStr: '2026-08-08' });
      expect(result.call.id).toBeGreaterThanOrEqual(customIdBase);
    });
  });
});
