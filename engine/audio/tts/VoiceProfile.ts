// engine/audio/tts/VoiceProfile.ts
// Deterministic per-caller voice profiles for the DEA-94 call voice.
//
// A profile is the prosody + timbre "identity" of a caller: fundamental pitch,
// pitch range, speaking rate, vocal-tract scale (formant shift), breathiness,
// jitter and vibrato. It is derived from the call's stable identifiers with
// SeededRNG, so:
//   - the same call always sounds like the same caller,
//   - two procedural variants (distinct callerId) always sound different,
//   - multi-caller calls get distinct voices per speaker,
//   - tests can assert exact values without stubbing Math.random.
//
// Band and signal strength color the voice (lower bands = darker/slower, weak
// signal = breathier) without changing any call mechanics.

import { SeededRNG, hashSeed } from '../../calls/SeededRNG';

/** Minimal call shape needed to derive a voice. */
export interface VoiceProfileSource {
  id: number;
  callerId: string;
  callerName?: string;
  /** Band index 0-4 as stored on CallData. */
  band: number;
  /** Signal strength 0-5. */
  signal: number;
}

/** Prosody + timbre parameters consumed by the formant synthesizer. */
export interface VoiceProfile {
  /** Stable seed string; also keys the synthesis cache. */
  seed: string;
  /** Base fundamental frequency in Hz. */
  f0: number;
  /** Intonation range in semitones (peak deviation from f0). */
  f0Range: number;
  /** Speaking-rate multiplier. >1 = faster. */
  rate: number;
  /** Vocal-tract scale. >1 = shorter tract (brighter, higher formants). */
  formantScale: number;
  /** Breath noise mixed into voiced segments (0..1). */
  breathiness: number;
  /** Cycle-to-cycle pitch jitter (0..1, small values). */
  jitter: number;
  /** Vibrato frequency in Hz. */
  vibratoHz: number;
  /** Vibrato depth in semitones. */
  vibratoDepth: number;
  /** Static pitch offset in cents (sanity-driven drift). */
  pitchCents: number;
  /** Output gain 0..1. */
  gain: number;
}

export interface VoiceProfileOptions {
  /** Speaker index for MULTI_CALLER lines (0 or 1). */
  speakerIndex?: number;
  /** Player sanity 0..100. Below 50 adds deterministic pitch drift. */
  sanity?: number;
  /** Extra discriminator (e.g. procedural variant id). */
  variant?: string;
}

/** Base f0 per band index — later bands sound older/lower and stranger. */
const BAND_BASE_F0: readonly number[] = [128, 116, 104, 138, 92];

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Map a CallData band index to a Band name (defensive for out-of-range data). */
const bandIndexFor = (band: number): number => clamp(Math.round(band), 0, BAND_BASE_F0.length - 1);

/**
 * Build the deterministic voice profile for a call (and optional speaker).
 *
 * Pure: identical arguments always produce an identical profile.
 */
export function voiceProfileFor(
  source: VoiceProfileSource,
  options: VoiceProfileOptions = {},
): VoiceProfile {
  const speakerIndex = options.speakerIndex ?? 0;
  const variant = options.variant ?? 'base';
  const sanity = options.sanity ?? 100;
  const seed = `dea94:${source.id}:${source.callerId}:${variant}:${speakerIndex}`;
  const rng = new SeededRNG(seed);

  const bandIndex = bandIndexFor(source.band);
  const baseF0 = BAND_BASE_F0[bandIndex] ?? 120;

  // Speaker separation for two-person calls: one lower, one higher.
  const speakerPitchMult =
    speakerIndex === 0 ? 1 : speakerIndex === 1 ? 1.17 : 1 + 0.09 * speakerIndex;
  const speakerFormantMult =
    speakerIndex === 0 ? 1 : speakerIndex === 1 ? 1.05 : 1 + 0.03 * speakerIndex;

  const f0 = clamp((baseF0 + (rng.next() - 0.5) * 52) * speakerPitchMult, 65, 240);
  const formantScale = clamp((0.92 + rng.next() * 0.16) * speakerFormantMult, 0.85, 1.15);
  const rate = clamp(0.92 + rng.next() * 0.22, 0.8, 1.2);
  const signal = clamp(Math.round(source.signal), 0, 5);
  const breathiness = clamp(0.05 + rng.next() * 0.2 + (5 - signal) * 0.03, 0, 0.6);
  const jitter = 0.004 + rng.next() * 0.01;
  const vibratoHz = 3.6 + rng.next() * 2.4;
  const vibratoDepth = 0.15 + rng.next() * 0.35;
  const f0Range = 1.2 + rng.next() * 1.4;

  // Sanity-driven pitch drift: 0 at/above 50, up to ±200 cents at 0.
  // Mirrors CallVariationEngine's degradation curve, but seeded so the voice
  // for a given call + sanity is reproducible.
  const degradation = clamp((50 - sanity) / 50, 0, 1);
  const pitchCents = Math.round((rng.next() - 0.5) * 400 * degradation);

  return {
    seed,
    f0,
    f0Range,
    rate,
    formantScale,
    breathiness,
    jitter,
    vibratoHz,
    vibratoDepth,
    pitchCents,
    gain: 0.85,
  };
}

/** Seed hash helper exposed for the synthesizer's noise stream. */
export const profileHash = (profile: VoiceProfile, text: string): number =>
  hashSeed(`${profile.seed}:${profile.pitchCents}:${text}`);
