// engine/progression/TimeCompression.ts
// Pure time-compression helper. Maps real-time ms to in-game minutes,
// given the full shift duration (real) and full shift length (in-game).
//
// Example: 20 min real = 240 min in-game → 12x compression.
// So 60_000 ms (1 real minute) → 12 in-game minutes.
//
// Pure, no state, no side effects. Safe to test in isolation.

/**
 * Convert real-time milliseconds to in-game minutes.
 *
 * The compression ratio is `inGameMinutes / shiftDurationMs` — i.e. how many
 * in-game minutes elapse per real-time millisecond. The result is clamped to
 * `[0, inGameMinutes]` so callers cannot overshoot the end of the shift by
 * over-ticking.
 *
 * @param realMs elapsed real-time ms (>= 0)
 * @param shiftDurationMs full real-time shift length in ms (must be > 0)
 * @param inGameMinutes full in-game shift length in minutes (>= 0)
 * @returns in-game minutes elapsed, clamped to [0, inGameMinutes]
 */
export function realMsToInGameMinutes(
  realMs: number,
  shiftDurationMs: number,
  inGameMinutes: number,
): number {
  if (shiftDurationMs <= 0) {
    // Defensive: no compression possible; clamp to 0 to avoid divide-by-zero.
    return 0;
  }
  if (realMs <= 0 || inGameMinutes <= 0) {
    return 0;
  }
  const ratio = inGameMinutes / shiftDurationMs;
  const minutes = realMs * ratio;
  return Math.max(0, Math.min(minutes, inGameMinutes));
}
