/**
 * WeatherSystem — deterministic per-shift weather selection + signal effects.
 *
 * Weather is seeded by shift number so the same shift always gets the same weather.
 * Each weather state affects:
 *   - Ambient sound (layered on top of room tone + band ambient)
 *   - Signal quality (static increases, audio clarity drops)
 */

// ─── Types ────────────────────────────────────────────────

export type WeatherState = 'clear' | 'rain' | 'storm' | 'snow' | 'wind' | 'fog';

export interface WeatherSignalModifiers {
  /** Additional static points (0-100 scale) the weather contributes. */
  readonly staticAdd: number;
  /** Multiplier applied to voice clarity (1 = normal, <1 = degraded). */
  readonly clarityMultiplier: number;
}

// ─── Weather table ─────────────────────────────────────────

interface WeatherEntry {
  readonly id: WeatherState;
  readonly weight: number;
  readonly staticAdd: number;
  readonly clarityMultiplier: number;
}

const WEATHER_TABLE: readonly WeatherEntry[] = [
  { id: 'clear', weight: 30, staticAdd: 0, clarityMultiplier: 1.0 },
  { id: 'rain', weight: 22, staticAdd: 8, clarityMultiplier: 0.92 },
  { id: 'storm', weight: 12, staticAdd: 20, clarityMultiplier: 0.8 },
  { id: 'snow', weight: 12, staticAdd: 5, clarityMultiplier: 0.95 },
  { id: 'wind', weight: 14, staticAdd: 12, clarityMultiplier: 0.88 },
  { id: 'fog', weight: 10, staticAdd: 10, clarityMultiplier: 0.85 },
] as const;

const TOTAL_WEIGHT = WEATHER_TABLE.reduce((sum, w) => sum + w.weight, 0);

// ─── Seeded PRNG (mulberry32) ───────────────────────────────

/**
 * Small deterministic PRNG — mulberry32.
 * Returns a function that produces a pseudo-random float in [0, 1).
 */
function createPrng(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Deterministically select a weather state for a given shift number.
 * The same shift number always yields the same weather.
 */
export function selectWeather(shiftNumber: number): WeatherState {
  const rng = createPrng(shiftNumber * 2654435761);
  const roll = rng() * TOTAL_WEIGHT;

  let cumulative = 0;
  for (const entry of WEATHER_TABLE) {
    cumulative += entry.weight;
    if (roll < cumulative) {
      return entry.id;
    }
  }
  // Fallback (should never reach here due to floating-point, but type-safe)
  return 'clear';
}

/**
 * Get the signal-quality modifiers for a weather state.
 */
export function weatherSignalModifiers(weather: WeatherState): WeatherSignalModifiers {
  const entry = WEATHER_TABLE.find((w) => w.id === weather);
  if (!entry) {
    return { staticAdd: 0, clarityMultiplier: 1.0 };
  }
  return { staticAdd: entry.staticAdd, clarityMultiplier: entry.clarityMultiplier };
}

/**
 * Convenience: static points added by weather (0-100 scale).
 */
export function weatherStaticAdd(weather: WeatherState): number {
  return weatherSignalModifiers(weather).staticAdd;
}

/**
 * Convenience: clarity multiplier for weather (1 = normal, <1 = degraded).
 */
export function weatherClarityMultiplier(weather: WeatherState): number {
  return weatherSignalModifiers(weather).clarityMultiplier;
}

/**
 * All possible weather states (for iteration / testing).
 */
export const WEATHER_STATES: readonly WeatherState[] = WEATHER_TABLE.map((w) => w.id);
