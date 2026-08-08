import {
  getActiveSeason,
  generateSeasonalCalls,
  Season,
} from '@/engine/progression/SeasonalCallInjector';

describe('SeasonalCallInjector', () => {
  describe('getActiveSeason', () => {
    it('returns halloween during Oct 24-31', () => {
      expect(getActiveSeason(new Date(2026, 9, 24))).toBe('halloween');
      expect(getActiveSeason(new Date(2026, 9, 31, 23, 59, 0))).toBe('halloween');
    });

    it('returns christmas during Dec 18-26', () => {
      expect(getActiveSeason(new Date(2026, 11, 18))).toBe('christmas');
      expect(getActiveSeason(new Date(2026, 11, 25))).toBe('christmas');
      expect(getActiveSeason(new Date(2026, 11, 26, 23, 59, 0))).toBe('christmas');
    });

    it('returns newyear during Dec 29 - Jan 6', () => {
      expect(getActiveSeason(new Date(2026, 11, 30))).toBe('newyear');
      expect(getActiveSeason(new Date(2027, 0, 1))).toBe('newyear');
      expect(getActiveSeason(new Date(2027, 0, 6, 12, 0, 0))).toBe('newyear');
    });

    it('returns none outside seasonal windows', () => {
      expect(getActiveSeason(new Date(2026, 5, 15))).toBe('none');
      expect(getActiveSeason(new Date(2026, 9, 23))).toBe('none');
      expect(getActiveSeason(new Date(2026, 11, 27))).toBe('none');
      expect(getActiveSeason(new Date(2027, 0, 7))).toBe('none');
    });
  });

  describe('generateSeasonalCalls', () => {
    it('returns empty array for none season', () => {
      expect(generateSeasonalCalls('none')).toEqual([]);
    });

    it('generates calls for halloween', () => {
      const calls = generateSeasonalCalls('halloween' as Season);
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call.id).toBeGreaterThanOrEqual(1000);
        expect(typeof call.callerId).toBe('string');
        expect(typeof call.callerName).toBe('string');
        expect(typeof call.signal).toBe('number');
        expect(typeof call.staticReward).toBe('number');
        if (call.type === 'SIGNAL_DECODE') {
          expect(typeof call.intro).toBe('string');
        } else {
          expect(Array.isArray(call.lines)).toBe(true);
          expect(call.lines!.length).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it('generates calls for christmas', () => {
      const calls = generateSeasonalCalls('christmas' as Season);
      expect(calls.length).toBeGreaterThan(0);
    });

    it('generates calls for newyear', () => {
      const calls = generateSeasonalCalls('newyear' as Season);
      expect(calls.length).toBeGreaterThan(0);
    });
  });
});
