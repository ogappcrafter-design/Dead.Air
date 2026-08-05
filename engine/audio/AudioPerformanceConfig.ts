// engine/audio/AudioPerformanceConfig.ts
// Centralized tunable params for audio latency optimization.
// All values are platform-agnostic; bridges translate hints to native equivalents.

/** Latency hint categorizes the use-case rather than prescribing ms values. */
export type LatencyHint = 'interactive' | 'playback' | 'balanced';

/** Sample rate reduction factor for the bitcrush path. Lower = faster. */
export interface BitcrushPerfParams {
  /** Curve resolution. Default 1024; reduce for faster waveshaper cost. */
  curveSamples: number;
  /** Oversample mode. '4x' = best quality, '2x' = balanced, 'none' = fastest. */
  distortionOversample: 'none' | '2x' | '4x';
  /** Oversample for voice bitcrush. '2x' default. */
  voiceOversample: 'none' | '2x' | '4x';
}

/** Reverb IR parameters controlling convolver cost. */
export interface ReverbPerfParams {
  /** IR duration in seconds. Shorter = lower CPU. Default 2.4. */
  irDurationSec: number;
  /** Decay exponent. Lower = smoother tail but less CPU difference. Default 2. */
  decay: number;
  /** Whether to cache the IR buffer across constructions. Default true. */
  cacheIR: boolean;
}

/** Static synth performance: oscillator startup cost. */
export interface StaticSynthPerfParams {
  /** Oversample for the noise shaper. Default '2x'. */
  shaperOversample: 'none' | '2x' | '4x';
}

/** Aggregated performance config consumed by audio modules. */
export interface AudioPerformanceConfig {
  /** Latency hint bridges use to pick internal buffer sizes. */
  latencyHint: LatencyHint;
  /** Bitcrush / distortion tuning. */
  bitcrush: BitcrushPerfParams;
  /** Reverb IR tuning. */
  reverb: ReverbPerfParams;
  /** Static synth tuning. */
  staticSynth: StaticSynthPerfParams;
}

/** Balanced defaults — good quality, moderate latency. Suitable for most cases. */
export const BALANCED_CONFIG: AudioPerformanceConfig = {
  latencyHint: 'balanced',
  bitcrush: {
    curveSamples: 1024,
    distortionOversample: '4x',
    voiceOversample: '2x',
  },
  reverb: {
    irDurationSec: 2.4,
    decay: 2,
    cacheIR: true,
  },
  staticSynth: {
    shaperOversample: '2x',
  },
};

/** Interactive config — lowest latency, lighter processing. */
export const INTERACTIVE_CONFIG: AudioPerformanceConfig = {
  latencyHint: 'interactive',
  bitcrush: {
    curveSamples: 512,
    distortionOversample: '2x',
    voiceOversample: 'none',
  },
  reverb: {
    irDurationSec: 1.2,
    decay: 2,
    cacheIR: true,
  },
  staticSynth: {
    shaperOversample: 'none',
  },
};

/** Playback config — highest quality, relaxed latency. */
export const PLAYBACK_CONFIG: AudioPerformanceConfig = {
  latencyHint: 'playback',
  bitcrush: {
    curveSamples: 2048,
    distortionOversample: '4x',
    voiceOversample: '4x',
  },
  reverb: {
    irDurationSec: 3.0,
    decay: 2,
    cacheIR: true,
  },
  staticSynth: {
    shaperOversample: '4x',
  },
};

/**
 * Merge a partial config override onto a base config.
 * Deep-merges nested objects; primitives override.
 */
export const mergeConfig = (
  base: AudioPerformanceConfig,
  overrides: Partial<AudioPerformanceConfig>,
): AudioPerformanceConfig => ({
  latencyHint: overrides.latencyHint ?? base.latencyHint,
  bitcrush: {
    ...base.bitcrush,
    ...overrides.bitcrush,
  },
  reverb: {
    ...base.reverb,
    ...overrides.reverb,
  },
  staticSynth: {
    ...base.staticSynth,
    ...overrides.staticSynth,
  },
});

/** Convenience: get config for a given latency hint. */
export const configForHint = (hint: LatencyHint): AudioPerformanceConfig => {
  switch (hint) {
    case 'interactive':
      return INTERACTIVE_CONFIG;
    case 'playback':
      return PLAYBACK_CONFIG;
    case 'balanced':
      return BALANCED_CONFIG;
  }
};
