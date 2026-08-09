// tests/engine/WeatherSystem.test.ts
// DEA-13: WeatherSystem determinism + signal-quality modifiers.

import {
  selectWeather,
  weatherSignalModifiers,
  weatherStaticAdd,
  weatherClarityMultiplier,
  WEATHER_STATES,
  type WeatherState,
} from '@/engine/progression/WeatherSystem';

describe('WeatherSystem', () => {
  describe('selectWeather determinism', () => {
    it('same shift number → same weather', () => {
      for (let shift = 1; shift <= 50; shift++) {
        const a = selectWeather(shift);
        const b = selectWeather(shift);
        expect(a).toBe(b);
      }
    });

    it('produces only valid WeatherState values', () => {
      const validStates: ReadonlySet<WeatherState> = new Set(WEATHER_STATES);
      for (let shift = 0; shift < 500; shift++) {
        const w = selectWeather(shift);
        expect(validStates.has(w)).toBe(true);
      }
    });

    it('distributes across multiple weather states over many shifts', () => {
      const counts = new Map<WeatherState, number>();
      for (let shift = 0; shift < 1000; shift++) {
        const w = selectWeather(shift);
        counts.set(w, (counts.get(w) ?? 0) + 1);
      }
      // Clear should be most common (weight 30/100), but at minimum several states appear
      expect(counts.size).toBeGreaterThanOrEqual(4);
      // Every state in the table should be reachable
      for (const state of WEATHER_STATES) {
        expect(counts.has(state)).toBe(true);
      }
    });
  });

  describe('WEATHER_STATES', () => {
    it('exposes all six weather states', () => {
      expect(WEATHER_STATES).toHaveLength(6);
      expect([...WEATHER_STATES].sort()).toEqual(
        ['clear', 'fog', 'rain', 'snow', 'storm', 'wind'].sort(),
      );
    });
  });

  describe('weatherSignalModifiers', () => {
    it('clear: no static, full clarity', () => {
      const m = weatherSignalModifiers('clear');
      expect(m.staticAdd).toBe(0);
      expect(m.clarityMultiplier).toBe(1.0);
    });

    it('storm: max static (20), min clarity (0.8)', () => {
      const m = weatherSignalModifiers('storm');
      expect(m.staticAdd).toBe(20);
      expect(m.clarityMultiplier).toBe(0.8);
    });

    it('all modifiers match documented table ranges', () => {
      for (const state of WEATHER_STATES) {
        const m = weatherSignalModifiers(state);
        expect(m.staticAdd).toBeGreaterThanOrEqual(0);
        expect(m.staticAdd).toBeLessThanOrEqual(20);
        expect(m.clarityMultiplier).toBeGreaterThan(0);
        expect(m.clarityMultiplier).toBeLessThanOrEqual(1.0);
      }
    });

    it('non-clear weather degrades clarity (< 1.0)', () => {
      for (const state of WEATHER_STATES) {
        if (state === 'clear') continue;
        expect(weatherSignalModifiers(state).clarityMultiplier).toBeLessThan(1.0);
      }
    });

    it('non-clear weather adds static (> 0)', () => {
      for (const state of WEATHER_STATES) {
        if (state === 'clear') continue;
        expect(weatherSignalModifiers(state).staticAdd).toBeGreaterThan(0);
      }
    });
  });

  describe('convenience helpers', () => {
    it('weatherStaticAdd matches modifiers', () => {
      for (const state of WEATHER_STATES) {
        expect(weatherStaticAdd(state)).toBe(weatherSignalModifiers(state).staticAdd);
      }
    });

    it('weatherClarityMultiplier matches modifiers', () => {
      for (const state of WEATHER_STATES) {
        expect(weatherClarityMultiplier(state)).toBe(
          weatherSignalModifiers(state).clarityMultiplier,
        );
      }
    });
  });
});
