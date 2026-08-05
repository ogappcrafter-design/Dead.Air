// engine/audio/VoiceProcessor.ts
// Call audio treatment: EQ band-pass, compression, lo-fi downsampling/bitcrush.
// Presets keyed to call vibe (band). data/calls.js is untouched.

import {
  PlatformBridge,
  BridgeAudioContext,
  BridgeAudioNode,
  BridgeAudioBuffer,
  BridgeBiquadNode,
  BridgeDynamicsCompressorNode,
  BridgeWaveShaperNode,
  BridgeGainNode,
  VoicePreset,
} from './PlatformBridge';
import { Band } from '../../lib/constants';
import { bandVoicePreset } from './PlatformBridge';
import type { BitcrushPerfParams } from './AudioPerformanceConfig';

/** Preset params per band. */
export interface VoicePresetParams {
  /** Band-pass center (Hz). Lower = muddier. */
  eqCenter: number;
  /** Band-pass Q. Higher = narrower. */
  eqQ: number;
  /** Bitcrush depth (0..1). 0 = none, 1 = severe. */
  bitcrush: number;
  /** Sample-rate reduction factor (0..1). 0 = none, 1 = heavy. */
  downsample: number;
  /** Compressor threshold (dB). */
  compThreshold: number;
  /** Compressor ratio (N:1). */
  compRatio: number;
  /** Output gain (0..1). */
  outputGain: number;
}

/** Per-band voice preset — lo-fi character matches the band vibe. */
export const voicePresets: Record<VoicePreset, VoicePresetParams> = {
  LIVING: {
    eqCenter: 1800,
    eqQ: 0.8,
    bitcrush: 0.05,
    downsample: 0.05,
    compThreshold: -24,
    compRatio: 3,
    outputGain: 0.85,
  },
  LIMINAL: {
    eqCenter: 1200,
    eqQ: 1.2,
    bitcrush: 0.2,
    downsample: 0.2,
    compThreshold: -20,
    compRatio: 4,
    outputGain: 0.8,
  },
  LOST: {
    eqCenter: 900,
    eqQ: 1.5,
    bitcrush: 0.4,
    downsample: 0.35,
    compThreshold: -18,
    compRatio: 5,
    outputGain: 0.75,
  },
  CLASSIFIED: {
    eqCenter: 2500,
    eqQ: 2,
    bitcrush: 0.6,
    downsample: 0.5,
    compThreshold: -16,
    compRatio: 6,
    outputGain: 0.7,
  },
  REDACTED: {
    eqCenter: 500,
    eqQ: 3,
    bitcrush: 0.85,
    downsample: 0.75,
    compThreshold: -14,
    compRatio: 8,
    outputGain: 0.65,
  },
};

/** Get preset params for a Band. Convenience wrapper. */
export const presetForBand = (band: Band): VoicePresetParams => voicePresets[bandVoicePreset(band)];

/**
 * Bitcrush curve — quantizes amplitude into N levels.
 * bits = 1 + (1 - depth) * 7 → depth 0 = 8 bits, depth 1 = 1 bit.
 */
export const makeBitcrushCurve = (depth: number, samples = 1024): Float32Array => {
  const clamped = Math.max(0, Math.min(1, depth));
  const levels = Math.max(2, Math.round(Math.pow(2, 8 - clamped * 7)));
  const step = 2 / levels;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.round(x / step) * step;
  }
  return curve;
};

/**
 * VoiceProcessor — applies lo-fi treatment to call audio.
 *
 * Chain: input → EQ band-pass → compressor → bitcrush → output.
 * (Downsample is achieved via bitcrusher + output rate, modeled here
 * as part of the bitcrush curve for the bridge abstraction.)
 *
 * The engine connects call audio sources into `getInput()`; the
 * processor handles the rest.
 */
export class VoiceProcessor {
  private readonly bridge: PlatformBridge;
  private readonly ctx: BridgeAudioContext;

  private readonly eq: BridgeBiquadNode;
  private readonly compressor: BridgeDynamicsCompressorNode;
  private readonly bitcrush: BridgeWaveShaperNode;
  private readonly output: BridgeGainNode;

  private preset: VoicePreset | null = null;
  private readonly curveSamples: number;
  private readonly voiceOversample: 'none' | '2x' | '4x';
  private preloadedPreset: VoicePreset | null = null;

  constructor(
    bridge: PlatformBridge,
    ctx: BridgeAudioContext,
    destination: BridgeAudioNode,
    perf?: BitcrushPerfParams,
  ) {
    this.bridge = bridge;
    this.ctx = ctx;
    this.curveSamples = perf?.curveSamples ?? 1024;
    this.voiceOversample = perf?.voiceOversample ?? '2x';

    this.eq = bridge.createBiquad(ctx, 'bandpass');
    this.eq.setFrequency(1800);
    this.eq.setQ(0.8);

    this.compressor = bridge.createCompressor(ctx);
    this.compressor.setThreshold(-24);
    this.compressor.setKnee(30);
    this.compressor.setRatio(3);
    this.compressor.setAttack(0.003);
    this.compressor.setRelease(0.25);

    this.bitcrush = bridge.createWaveShaper(ctx);
    this.bitcrush.setCurve(makeBitcrushCurve(0.05, this.curveSamples));
    this.bitcrush.setOversample(this.voiceOversample);

    this.output = bridge.createMasterGain(ctx);
    this.output.setGain(0.85);

    bridge.connect(this.eq, this.compressor);
    bridge.connect(this.compressor, this.bitcrush);
    bridge.connect(this.bitcrush, this.output);
    bridge.connect(this.output, destination);
  }

  /** Input node — connect call audio sources INTO this. */
  getInput(): BridgeAudioNode {
    return this.eq;
  }

  /** Apply a named preset (reconfigures entire chain). */
  applyPreset(preset: VoicePreset): void {
    const params = voicePresets[preset];
    this.preset = preset;
    const hadPreload = this.preloadedPreset === preset;
    this.preloadedPreset = null;
    this.eq.setFrequency(params.eqCenter);
    this.eq.setQ(params.eqQ);
    this.compressor.setThreshold(params.compThreshold);
    this.compressor.setRatio(params.compRatio);
    // Skip curve rebuild when a matching preload already set the bitcrush curve.
    if (!hadPreload) {
      this.bitcrush.setCurve(makeBitcrushCurve(params.bitcrush, this.curveSamples));
    }
    this.output.setGain(params.outputGain);
  }

  /**
   * Preload a voice preset ahead of the actual call start. Pre-bakes the
   * bitcrush curve and stores it so that `applyPreset` becomes a cheap
   * no-allocation swap on the hot path. If `applyPreset` is called with a
   * different preset after preload, preload is discarded.
   */
  preloadVoice(preset: VoicePreset): void {
    const params = voicePresets[preset];
    const curve = makeBitcrushCurve(params.bitcrush, this.curveSamples);
    this.bitcrush.setCurve(curve);
    this.preloadedPreset = preset;
  }

  /** Apply preset for a given Band. */
  applyPresetForBand(band: Band): void {
    this.applyPreset(bandVoicePreset(band));
  }

  /** Preload preset for a given Band ahead of call start. */
  preloadVoiceForBand(band: Band): void {
    this.preloadVoice(bandVoicePreset(band));
  }

  /** True if a preset has been preloaded and matches the given preset. */
  hasPreloadedPreset(preset: VoicePreset): boolean {
    return this.preloadedPreset === preset;
  }

  /** Current preset (or null if none applied). */
  getPreset(): VoicePreset | null {
    return this.preset;
  }

  /** Tear down. After dispose, instance is unusable. */
  dispose(): void {
    this.eq.disconnect();
    this.compressor.disconnect();
    this.bitcrush.disconnect();
    this.output.disconnect();
  }
}
