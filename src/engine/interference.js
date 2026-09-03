import { clampSanity } from './save';

/**
 * How badly the station is holding together.
 *
 * Sanity used to be a number that went down and did nothing. This turns it
 * into the thing the whole presentation hangs off: one 0–1 value that scales
 * the scanlines, the static, the signal meter and the readout, so a failing DJ
 * can *see* the broadcast coming apart instead of reading about it.
 *
 * Pure, so the curve can be tuned and tested without a device.
 */

/** Above this, the station looks fine. Interference starts below it. */
export const CALM_ABOVE = 70;

/**
 * 0 at full sanity, 1 at zero. Squared so the first few points of damage are
 * barely noticeable and the last stretch falls apart quickly — the dread
 * should build, not switch on.
 */
export function interference(sanity) {
  const s = clampSanity(sanity);
  if (s >= CALM_ABOVE) return 0;
  const t = (CALM_ABOVE - s) / CALM_ABOVE;
  return Math.min(1, t * t);
}

/**
 * Scanline weight for the CRT overlay.
 *
 * Kept under 1 on purpose: RN clamps opacity there, and a value that saturates
 * would flatten the tube's slow breathing exactly when things are worst.
 */
export const scanlineOpacity = (sanity) => 0.84 + interference(sanity) * 0.16;

/** Extra darkness crowding in from the edges as the DJ frays. */
export const vignetteBoost = (sanity) => interference(sanity) * 0.3;

/** Seconds between the CRT's dropped frames — frequent when things are bad. */
export const flickerIntervalMs = (sanity) => {
  const i = interference(sanity);
  return Math.round(9000 - i * 7200); // 9s calm → 1.8s critical
};

/**
 * Milliseconds between uninvited bursts of static during a live call, or null
 * when the station is steady enough not to have any.
 */
export function interferenceBurstMs(sanity) {
  const i = interference(sanity);
  if (i < 0.25) return null;
  return Math.round(14000 - i * 9000); // 14s → 5s
}

/** How many bars the meter drops while the signal is degraded. */
export const signalPenalty = (sanity) => (interference(sanity) >= 0.55 ? 1 : 0);
