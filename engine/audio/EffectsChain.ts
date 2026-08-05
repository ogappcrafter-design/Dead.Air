// engine/audio/EffectsChain.ts
// Node graph: input → distortion → reverb (convolver) → spatial (StereoPanner) → output.
// Settable drive, reverb mix, pan.

import {
  PlatformBridge,
  BridgeAudioContext,
  BridgeAudioNode,
  BridgeWaveShaperNode,
  BridgeConvolverNode,
  BridgeStereoPannerNode,
  BridgeGainNode,
  BridgeBiquadNode,
  BridgeAudioBuffer,
} from './PlatformBridge';
import type { BitcrushPerfParams, ReverbPerfParams } from './AudioPerformanceConfig';

/** Reverb IR cache key — matches params used to generate the buffer. */
interface IRCacheKey {
  readonly duration: number;
  readonly decay: number;
  readonly platform: 'web' | 'native';
}

/**
 * Module-level reverb IR cache scoped per audio context (ctx-bound buffers
 * cannot be reused across contexts with different identities or sample
 * rates). Inner map keyed by `${platform}:${duration}:${decay}`.
 */
let reverbIRCache: WeakMap<BridgeAudioContext, Map<string, BridgeAudioBuffer>> = new WeakMap();

const irCacheKey = (key: IRCacheKey): string => `${key.platform}:${key.duration}:${key.decay}`;

/** Drive (0..1) → waveshaper curve shape. Heavier drive = harder clip. */
export const driveToCurve = (drive: number, samples = 1024): Float32Array => {
  const curve = new Float32Array(samples);
  const k = 1 + drive * 50; // aggressive range for call/voice treatment
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x);
  }
  return curve;
};

/** Default reverb decay (seconds). Longer = bigger space. */
export const DEFAULT_REVERB_DECAY = 2.4;

/**
 * Build an IR-style noise buffer for algorithmic reverb.
 * Uses module-level cache when `reverbPerf.cacheIR` is true; skips cache otherwise.
 * Always delegates to bridge.createReverbBuffer for the actual buffer generation,
 * preserving the existing contract.
 */
export const makeReverbBuffer = (
  bridge: PlatformBridge,
  ctx: BridgeAudioContext,
  durationSec: number,
  decay: number,
  reverbPerf?: ReverbPerfParams,
): BridgeAudioBuffer => {
  const useCache = reverbPerf?.cacheIR ?? false;
  if (useCache) {
    const key = irCacheKey({ duration: durationSec, decay, platform: bridge.platform });
    let inner = reverbIRCache.get(ctx);
    if (inner === undefined) {
      inner = new Map<string, BridgeAudioBuffer>();
      reverbIRCache.set(ctx, inner);
    }
    const cached = inner.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const buf = bridge.createReverbBuffer(ctx, durationSec, decay);
    inner.set(key, buf);
    return buf;
  }
  return bridge.createReverbBuffer(ctx, durationSec, decay);
};

/** Clear the reverb IR cache (test utility). Swaps to a fresh WeakMap. */
export const clearReverbIRCache = (): void => {
  reverbIRCache = new WeakMap<BridgeAudioContext, Map<string, BridgeAudioBuffer>>();
};

export interface EffectsChainPerfParams {
  /** Bitcrush/perf config for distortion oversampling + curve samples. */
  bitcrush?: BitcrushPerfParams;
  /** Reverb perf config for IR duration + caching. */
  reverb?: ReverbPerfParams;
}

/**
 * EffectsChain — fixed-order node graph for processing any input.
 * Order: distortion → reverb (parallel wet/dry) → stereo panner → output.
 *
 * The chain exposes a single `input` node — callers connect their source
 * into it. The chain internally routes to `output`, which callers
 * connect downstream (e.g. to master gain).
 *
 * Setters are real-time safe.
 */
export class EffectsChain {
  private readonly bridge: PlatformBridge;
  private readonly ctx: BridgeAudioContext;

  private readonly preGain: BridgeGainNode;
  private readonly distortion: BridgeWaveShaperNode;

  private readonly reverbDry: BridgeGainNode;
  private readonly reverbWet: BridgeGainNode;
  private readonly convolver: BridgeConvolverNode;

  private readonly panner: BridgeStereoPannerNode;

  private readonly tone: BridgeBiquadNode;

  private readonly output: BridgeGainNode;

  private drive = 0;
  private reverbMix = 0;
  private pan = 0;
  private readonly curveSamples: number;

  constructor(
    bridge: PlatformBridge,
    ctx: BridgeAudioContext,
    destination: BridgeAudioNode,
    perf?: EffectsChainPerfParams,
  ) {
    this.bridge = bridge;
    this.ctx = ctx;

    const distortionOversample = perf?.bitcrush?.distortionOversample ?? '4x';
    const curveSamples = perf?.bitcrush?.curveSamples ?? 1024;
    this.curveSamples = curveSamples;
    const reverbPerf = perf?.reverb;
    const irDuration = reverbPerf?.irDurationSec ?? DEFAULT_REVERB_DECAY;
    const irDecay = reverbPerf?.decay ?? 2;

    this.preGain = bridge.createMasterGain(ctx);
    this.preGain.setGain(1);

    this.distortion = bridge.createWaveShaper(ctx);
    this.distortion.setCurve(driveToCurve(0, curveSamples));
    this.distortion.setOversample(distortionOversample);

    this.reverbDry = bridge.createMasterGain(ctx);
    this.reverbDry.setGain(1);

    this.reverbWet = bridge.createMasterGain(ctx);
    this.reverbWet.setGain(0);

    this.convolver = bridge.createConvolver(ctx);
    this.convolver.setBuffer(makeReverbBuffer(bridge, ctx, irDuration, irDecay, reverbPerf));

    this.tone = bridge.createBiquad(ctx, 'highshelf');
    this.tone.setFrequency(2000);
    this.tone.setGain(0);

    this.panner = bridge.createStereoPanner(ctx);
    this.panner.setPan(0);

    this.output = bridge.createMasterGain(ctx);
    this.output.setGain(1);

    bridge.connect(this.preGain, this.distortion);
    bridge.connect(this.distortion, this.tone);
    bridge.connect(this.tone, this.reverbDry);
    bridge.connect(this.tone, this.convolver);
    bridge.connect(this.convolver, this.reverbWet);
    bridge.connect(this.reverbDry, this.panner);
    bridge.connect(this.reverbWet, this.panner);
    bridge.connect(this.panner, this.output);
    bridge.connect(this.output, destination);
  }

  /** Input node — connect sources INTO this node. */
  getInput(): BridgeAudioNode {
    return this.preGain;
  }

  /** Set distortion drive (0..1). 0 = clean pass-through. */
  setDrive(value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.drive = clamped;
    this.distortion.setCurve(driveToCurve(clamped, this.curveSamples));
  }

  /** Set reverb wet/dry mix (0..1). 0 = dry, 1 = fully wet. */
  setReverbMix(value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.reverbMix = clamped;
    this.reverbDry.setGain(1 - clamped);
    this.reverbWet.setGain(clamped);
  }

  /** Set stereo pan (-1..1). 0 = center. */
  setPan(value: number): void {
    const clamped = Math.max(-1, Math.min(1, value));
    this.pan = clamped;
    this.panner.setPan(clamped);
  }

  /** High-shelf tone above 2kHz (dB cut/boost). Default 0. */
  setTone(value: number): void {
    this.tone.setGain(value);
  }

  /** Output gain (0..1+). Default 1. */
  setOutputGain(value: number): void {
    this.output.setGain(Math.max(0, value));
  }

  /** Get drive (0..1). */
  getDrive(): number {
    return this.drive;
  }

  /** Get reverb mix (0..1). */
  getReverbMix(): number {
    return this.reverbMix;
  }

  /** Get pan (-1..1). */
  getPan(): number {
    return this.pan;
  }

  /** Tear down. After dispose, instance is unusable. */
  dispose(): void {
    this.preGain.disconnect();
    this.distortion.disconnect();
    this.tone.disconnect();
    this.reverbDry.disconnect();
    this.reverbWet.disconnect();
    this.convolver.disconnect();
    this.panner.disconnect();
    this.output.disconnect();
  }
}
