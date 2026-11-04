// engine/audio/tts/FormantSynthesizer.ts
// Pure on-device speech synthesis for the DEA-94 call voice.
//
// Source-filter model: a glottal pulse train (or noise for unvoiced sounds) is
// shaped by three parallel two-pole formant resonators. The result is mono PCM
// that the platform bridge plays through the existing VoiceProcessor chain
// (EQ → compressor → bitcrush), so synthesized voices inherit the same
// radio-grade treatment as recorded audio.
//
// Everything here is synchronous, allocation-bounded and deterministic given
// (segments, profile, seed): no Math.random, no network, no native module, no
// credentials. A ~2.5 s line renders in a few milliseconds on-device.

import { hashSeed } from '../../calls/SeededRNG';
import type { VoiceProfile } from './VoiceProfile';
import { phonemize, type PhonemeSegment } from './Phonemizer';

export interface SpeechRenderOptions {
  /** Output sample rate. Voice is band-limited anyway; 22-24 kHz is plenty. */
  sampleRate: number;
  /**
   * Fit the line into this window (ms). Used to align speech with the call
   * UI's existing line timers without changing those timers.
   */
  targetDurationMs?: number;
  /** Seed for the noise/jitter stream. Defaults to the profile seed. */
  seed?: string;
}

export interface RenderedSpeech {
  /** Mono PCM in [-1, 1]. */
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
  /** Number of articulatory segments rendered (0 for silent input). */
  segmentCount: number;
  /** True when the line was time-compressed/expanded to hit the target. */
  fitted: boolean;
}

/** Two-pole resonator coefficients. */
interface Resonator {
  a0: number;
  b1: number;
  b2: number;
  y1: number;
  y2: number;
}

const makeResonator = (freq: number, bandwidth: number, sampleRate: number): Resonator => {
  const nyquist = sampleRate * 0.45;
  const f = Math.max(60, Math.min(nyquist, freq));
  const bw = Math.max(30, Math.min(nyquist - f + 30, bandwidth));
  const r = Math.exp((-Math.PI * bw) / sampleRate);
  const theta = (2 * Math.PI * f) / sampleRate;
  return {
    a0: 1 - r,
    b1: 2 * r * Math.cos(theta),
    b2: -r * r,
    y1: 0,
    y2: 0,
  };
};

const runResonator = (res: Resonator, input: number): number => {
  const y = res.a0 * input + res.b1 * res.y1 + res.b2 * res.y2;
  res.y2 = res.y1;
  res.y1 = y;
  return y;
};

/** Attack/release envelope lengths per articulation class, in ms. */
const ENVELOPE_MS: Record<PhonemeSegment['kind'], readonly [number, number]> = {
  vowel: [22, 34],
  liquid: [16, 24],
  nasal: [16, 24],
  fricative: [12, 20],
  plosive: [3, 12],
  pause: [0, 0],
};

/** Per-formant mix weights; nasals attenuate the upper formants. */
const formantWeights = (kind: PhonemeSegment['kind']): readonly [number, number, number] =>
  kind === 'nasal' ? [1, 0.35, 0.15] : [1, 0.55, 0.3];

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Render a single line of text as PCM using the caller's voice profile.
 *
 * Deterministic: identical (text, profile, options) always returns identical
 * samples.
 */
export function renderSpeech(
  text: string,
  profile: VoiceProfile,
  options: SpeechRenderOptions,
): RenderedSpeech {
  const sampleRate = clamp(Math.round(options.sampleRate), 8000, 48000);
  const segments = phonemize(text);
  const seed = options.seed ?? profile.seed;

  // Inline mulberry32 stream: one closure call per sample was a measurable
  // share of the render cost, so the state lives in this scope.
  let rngState = hashSeed(`${seed}:${profile.pitchCents}:${text}`) >>> 0;
  const nextNoise = (): number => {
    rngState = (rngState + 0x6d2b79f5) | 0;
    let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  if (segments.length === 0) {
    return {
      samples: new Float32Array(0),
      sampleRate,
      durationSec: 0,
      segmentCount: 0,
      fitted: false,
    };
  }

  // --- Timeline: apply speaking rate, then fit to the requested window. ---
  const durations = segments.map((seg) => seg.durationMs / profile.rate);
  const naturalMs = durations.reduce((sum, d) => sum + d, 0);
  let fitScale = 1;
  if (options.targetDurationMs !== undefined && naturalMs > 0) {
    // Keep voices intelligible: never compress below ~0.45x or stretch past 1.7x.
    fitScale = clamp(options.targetDurationMs / naturalMs, 0.45, 1.7);
  }
  const fitted = fitScale !== 1;

  const tailSamples = Math.ceil(sampleRate * 0.02);
  const totalSamples = Math.ceil((naturalMs * fitScale * sampleRate) / 1000) + tailSamples;
  const samples = new Float32Array(Math.max(1, totalSamples));

  // --- Glottal source + formant state. ---
  const res1 = makeResonator(700, 90, sampleRate);
  const res2 = makeResonator(1200, 110, sampleRate);
  const res3 = makeResonator(2500, 160, sampleRate);

  let writeIndex = 0;
  let phase = 0;
  let contour = 0;
  let jitterState = 0;
  let elapsedSec = 0;

  const pitchBaseCents = profile.pitchCents;

  for (let segIndex = 0; segIndex < segments.length; segIndex++) {
    const seg = segments[segIndex];
    if (seg === undefined) continue;

    const segMs = (durations[segIndex] ?? 0) * fitScale;
    const segSamples = Math.round((segMs / 1000) * sampleRate);

    if (seg.kind === 'pause' || segSamples <= 0) {
      writeIndex += segSamples;
      continue;
    }

    // Slow intonation walk across the phrase, bounded by f0Range.
    contour = clamp(contour + (nextNoise() * 2 - 1) * 0.55, -profile.f0Range, profile.f0Range);
    // Phrase-final fall: a long pause follows → glide down.
    const next = segments[segIndex + 1];
    const phraseFinal = next !== undefined && next.kind === 'pause' && next.durationMs >= 300;
    const startContour = contour;
    const endContour = phraseFinal ? contour - 1.4 : contour;

    // Rebuild formant filters for this articulation.
    const scale = profile.formantScale;
    const f = seg.formants;
    const bw = seg.bandwidths;
    const r1 = makeResonator(f[0] * scale, bw[0], sampleRate);
    const r2 = makeResonator(f[1] * scale, bw[1], sampleRate);
    const r3 = makeResonator(f[2] * scale, bw[2], sampleRate);
    res1.a0 = r1.a0;
    res1.b1 = r1.b1;
    res1.b2 = r1.b2;
    res2.a0 = r2.a0;
    res2.b1 = r2.b1;
    res2.b2 = r2.b2;
    res3.a0 = r3.a0;
    res3.b1 = r3.b1;
    res3.b2 = r3.b2;

    const w = formantWeights(seg.kind);
    const [attackMs, releaseMs] = ENVELOPE_MS[seg.kind];
    const attackSamples = Math.max(1, Math.round((attackMs / 1000) * sampleRate));
    const releaseSamples = Math.max(1, Math.round((releaseMs / 1000) * sampleRate));

    // Pitch/vibrato move slowly: update them once per block instead of per
    // sample. This is the difference between ~200 ms and a few ms per line.
    const BLOCK = 64;
    let phaseStep = 0;

    for (let s = 0; s < segSamples; s++) {
      const idx = writeIndex + s;
      if (idx >= samples.length) break;

      if (s % BLOCK === 0) {
        jitterState = jitterState * 0.96 + (nextNoise() * 2 - 1) * profile.jitter;
        const vibrato =
          Math.sin(2 * Math.PI * profile.vibratoHz * elapsedSec) * profile.vibratoDepth;
        const progress = segSamples <= 1 ? 1 : s / (segSamples - 1);
        const contourNow = startContour + (endContour - startContour) * progress;
        const cents = pitchBaseCents + (contourNow + vibrato + jitterState) * 100;
        const f0 = clamp(profile.f0 * Math.pow(2, cents / 1200), 50, sampleRate * 0.4);
        phaseStep = f0 / sampleRate;
      }

      // Envelope.
      let env = 1;
      if (s < attackSamples) env = s / attackSamples;
      else if (s > segSamples - releaseSamples) {
        env = Math.max(0, (segSamples - s) / releaseSamples);
      }

      phase += phaseStep;
      if (phase >= 1) phase -= Math.floor(phase);

      // Source: sawtooth glottal pulse + noise.
      const saw = 2 * phase - 1;
      const noise = nextNoise() * 2 - 1;
      let source: number;
      if (seg.noise >= 1 && !seg.voiced) {
        source = noise;
      } else if (seg.noise >= 1) {
        // Voiced fricative: mostly noise with a glottal buzz underneath.
        source = noise * 0.78 + saw * 0.22;
      } else {
        source = saw + noise * profile.breathiness * 0.35;
      }

      // Parallel formant bank.
      const out =
        runResonator(res1, source) * w[0] +
        runResonator(res2, source) * w[1] +
        runResonator(res3, source) * w[2];

      samples[idx] = out * env * seg.amplitude;
      elapsedSec += 1 / sampleRate;
    }

    writeIndex += segSamples;
  }

  // --- Normalize + edges. ---
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] ?? 0;
    const abs = v < 0 ? -v : v;
    if (abs > peak) peak = abs;
  }
  if (peak > 0) {
    const norm = 0.85 / peak;
    for (let i = 0; i < samples.length; i++) {
      samples[i] = (samples[i] ?? 0) * norm * profile.gain;
    }
  }

  const fadeSamples = Math.min(Math.floor(samples.length / 2), Math.round(sampleRate * 0.008));
  for (let i = 0; i < fadeSamples; i++) {
    const g = i / fadeSamples;
    samples[i] = (samples[i] ?? 0) * g;
    const tail = samples.length - 1 - i;
    samples[tail] = (samples[tail] ?? 0) * g;
  }

  // Guard against NaN/Infinity from degenerate profiles.
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] ?? 0;
    samples[i] = Number.isFinite(v) ? v : 0;
  }

  return {
    samples,
    sampleRate,
    durationSec: samples.length / sampleRate,
    segmentCount: segments.length,
    fitted,
  };
}
