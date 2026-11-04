// engine/audio/platform/native/NativeAudioGraph.ts
// Offline node graph backing the native (expo-audio) PlatformBridge.
//
// expo-audio plays whole files — it has no realtime node stream like Web Audio.
// The native bridge therefore implements the bridge contract as an *offline*
// graph: nodes record their parameters and connections, and a PCM source
// renders its downstream chain once into a mono buffer when it starts. That
// keeps `VoiceProcessor` (EQ → compressor → bitcrush → gain) working unchanged
// on native while producing a buffer expo-audio can actually play.
//
// The renderer follows a linear chain (one output per node), which is exactly
// the shape of the call-voice path. Branching graphs are not used on native.

import type {
  BridgeAudioNode,
  BridgeGainNode,
  BridgeBiquadNode,
  BridgeWaveShaperNode,
  BridgeStereoPannerNode,
  BridgeDynamicsCompressorNode,
} from '../../PlatformBridge';

export type NativeBiquadType =
  'lowpass' | 'highpass' | 'bandpass' | 'lowshelf' | 'highshelf' | 'peaking' | 'notch' | 'allpass';

/** Thrown by bridge factories the native (offline) graph does not implement. */
export class NativeAudioUnsupportedError extends Error {
  constructor(operation: string) {
    super(`NativePlatformBridge does not implement ${operation}() (offline PCM graph only)`);
    this.name = 'NativeAudioUnsupportedError';
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Base class: a node in the offline graph. `outputs` records downstream edges
 * in connect order; the renderer walks the first edge of each node.
 */
export abstract class NativeGraphNode implements BridgeAudioNode {
  abstract readonly kind: string;

  readonly outputs: NativeGraphNode[] = [];

  /** Transform a mono buffer at `sampleRate`. Must not mutate the input. */
  abstract process(samples: Float32Array, sampleRate: number): Float32Array;

  connect(node: BridgeAudioNode): void {
    if (node instanceof NativeGraphNode && !this.outputs.includes(node)) {
      this.outputs.push(node);
    }
  }

  disconnect(): void {
    this.outputs.length = 0;
  }
}

/** Walk `source`'s downstream chain once and return the rendered buffer. */
export const renderNativeChain = (
  source: NativeGraphNode,
  samples: Float32Array,
  sampleRate: number,
): Float32Array => {
  let buffer = samples;
  let node = source;
  const visited = new Set<NativeGraphNode>([source]);

  for (;;) {
    const next = node.outputs[0];
    if (next === undefined || visited.has(next)) break;
    visited.add(next);
    buffer = next.process(buffer, sampleRate);
    node = next;
  }

  return buffer;
};

// --- Gain ---

export class NativeGainNode extends NativeGraphNode implements BridgeGainNode {
  readonly kind = 'gain';

  private value: number;

  constructor(initial = 1) {
    super();
    this.value = initial;
  }

  setGain(value: number): void {
    this.value = Number.isFinite(value) ? value : 0;
  }

  getGain(): number {
    return this.value;
  }

  process(samples: Float32Array): Float32Array {
    const out = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) out[i] = (samples[i] ?? 0) * this.value;
    return out;
  }
}

// --- Biquad filter (RBJ cookbook) ---

interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

const biquadCoefficients = (
  type: NativeBiquadType,
  frequency: number,
  q: number,
  gainDb: number,
  sampleRate: number,
): BiquadCoefficients => {
  const fs = Math.max(1, sampleRate);
  const f = clamp(frequency, 10, fs * 0.45);
  const w0 = (2 * Math.PI * f) / fs;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const quality = clamp(q, 0.0001, 1000);
  const alpha = sin / (2 * quality);
  const a = Math.pow(10, gainDb / 40);

  let b0 = 1;
  let b1 = 0;
  let b2 = 0;
  let a0 = 1;
  let a1 = 0;
  let a2 = 0;

  switch (type) {
    case 'lowpass':
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = (1 - cos) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cos;
      a2 = 1 - alpha;
      break;
    case 'highpass':
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = (1 + cos) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cos;
      a2 = 1 - alpha;
      break;
    case 'bandpass':
      // Constant 0 dB peak gain.
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
      a0 = 1 + alpha;
      a1 = -2 * cos;
      a2 = 1 - alpha;
      break;
    case 'notch':
      b0 = 1;
      b1 = -2 * cos;
      b2 = 1;
      a0 = 1 + alpha;
      a1 = -2 * cos;
      a2 = 1 - alpha;
      break;
    case 'allpass':
      b0 = 1 - alpha;
      b1 = -2 * cos;
      b2 = 1 + alpha;
      a0 = 1 + alpha;
      a1 = -2 * cos;
      a2 = 1 - alpha;
      break;
    case 'peaking':
      b0 = 1 + alpha * a;
      b1 = -2 * cos;
      b2 = 1 - alpha * a;
      a0 = 1 + alpha / a;
      a1 = -2 * cos;
      a2 = 1 - alpha / a;
      break;
    case 'lowshelf': {
      const twoSqrtAAlpha = 2 * Math.sqrt(a) * alpha;
      b0 = a * (a + 1 - (a - 1) * cos + twoSqrtAAlpha);
      b1 = 2 * a * (a - 1 - (a + 1) * cos);
      b2 = a * (a + 1 - (a - 1) * cos - twoSqrtAAlpha);
      a0 = a + 1 + (a - 1) * cos + twoSqrtAAlpha;
      a1 = -2 * (a - 1 + (a + 1) * cos);
      a2 = a + 1 + (a - 1) * cos - twoSqrtAAlpha;
      break;
    }
    case 'highshelf': {
      const twoSqrtAAlpha = 2 * Math.sqrt(a) * alpha;
      b0 = a * (a + 1 + (a - 1) * cos + twoSqrtAAlpha);
      b1 = -2 * a * (a - 1 + (a + 1) * cos);
      b2 = a * (a + 1 + (a - 1) * cos - twoSqrtAAlpha);
      a0 = a + 1 - (a - 1) * cos + twoSqrtAAlpha;
      a1 = 2 * (a - 1 - (a + 1) * cos);
      a2 = a + 1 - (a - 1) * cos - twoSqrtAAlpha;
      break;
    }
  }

  const norm = a0 === 0 ? 1 : 1 / a0;
  return {
    b0: b0 * norm,
    b1: b1 * norm,
    b2: b2 * norm,
    a1: a1 * norm,
    a2: a2 * norm,
  };
};

export class NativeBiquadNode extends NativeGraphNode implements BridgeBiquadNode {
  readonly kind = 'biquad';

  private type: NativeBiquadType = 'bandpass';
  private frequency = 1800;
  private quality = 0.8;
  private gainDb = 0;

  setType(type: NativeBiquadType): void {
    this.type = type;
  }

  setFrequency(value: number): void {
    this.frequency = Number.isFinite(value) ? value : this.frequency;
  }

  setQ(value: number): void {
    this.quality = Number.isFinite(value) ? value : this.quality;
  }

  setGain(value: number): void {
    this.gainDb = Number.isFinite(value) ? value : 0;
  }

  process(samples: Float32Array, sampleRate: number): Float32Array {
    const c = biquadCoefficients(this.type, this.frequency, this.quality, this.gainDb, sampleRate);
    const out = new Float32Array(samples.length);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;

    for (let i = 0; i < samples.length; i++) {
      const x = samples[i] ?? 0;
      const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      out[i] = Number.isFinite(y) ? y : 0;
    }

    return out;
  }
}

// --- Wave shaper (bitcrush) ---

export class NativeWaveShaperNode extends NativeGraphNode implements BridgeWaveShaperNode {
  readonly kind = 'shaper';

  private curve: Float32Array | null = null;
  private oversample: 'none' | '2x' | '4x' = 'none';

  setCurve(curve: Float32Array): void {
    this.curve = new Float32Array(curve);
  }

  /**
   * Stored for parity with the bridge contract. The offline renderer applies
   * the curve once at the context rate, so oversampling is not modelled — the
   * bitcrush preset already encodes the downsampling character.
   */
  setOversample(value: 'none' | '2x' | '4x'): void {
    this.oversample = value;
  }

  getOversample(): 'none' | '2x' | '4x' {
    return this.oversample;
  }

  process(samples: Float32Array): Float32Array {
    const curve = this.curve;
    const out = new Float32Array(samples.length);
    if (curve === null || curve.length === 0) {
      out.set(samples);
      return out;
    }

    const lastIndex = curve.length - 1;
    for (let i = 0; i < samples.length; i++) {
      const x = clamp(samples[i] ?? 0, -1, 1);
      const position = ((x + 1) / 2) * lastIndex;
      const lower = Math.floor(position);
      const upper = Math.min(lastIndex, lower + 1);
      const fraction = position - lower;
      const a = curve[lower] ?? 0;
      const b = curve[upper] ?? 0;
      out[i] = a + (b - a) * fraction;
    }

    return out;
  }
}

// --- Dynamics compressor ---

export class NativeCompressorNode extends NativeGraphNode implements BridgeDynamicsCompressorNode {
  readonly kind = 'compressor';

  private thresholdDb = -24;
  private kneeDb = 30;
  private ratio = 3;
  private attackSec = 0.003;
  private releaseSec = 0.25;

  setThreshold(value: number): void {
    this.thresholdDb = Number.isFinite(value) ? value : this.thresholdDb;
  }

  setKnee(value: number): void {
    this.kneeDb = Math.max(0, Number.isFinite(value) ? value : this.kneeDb);
  }

  setRatio(value: number): void {
    this.ratio = Math.max(1, Number.isFinite(value) ? value : this.ratio);
  }

  setAttack(value: number): void {
    this.attackSec = Math.max(0.0001, Number.isFinite(value) ? value : this.attackSec);
  }

  setRelease(value: number): void {
    this.releaseSec = Math.max(0.0001, Number.isFinite(value) ? value : this.releaseSec);
  }

  process(samples: Float32Array, sampleRate: number): Float32Array {
    const fs = Math.max(1, sampleRate);
    const attack = Math.exp(-1 / (fs * this.attackSec));
    const release = Math.exp(-1 / (fs * this.releaseSec));
    const slope = 1 - 1 / this.ratio;
    const knee = this.kneeDb;

    const out = new Float32Array(samples.length);
    let envelope = 0;
    let gain = 1;

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i] ?? 0;
      const magnitude = Math.abs(sample);

      envelope =
        magnitude > envelope
          ? attack * envelope + (1 - attack) * magnitude
          : release * envelope + (1 - release) * magnitude;

      const levelDb = 20 * Math.log10(Math.max(envelope, 1e-6));
      const over = levelDb - this.thresholdDb;

      let reductionDb = 0;
      if (knee > 0 && over > -knee / 2 && over < knee / 2) {
        const t = over + knee / 2;
        reductionDb = (slope * t * t) / (2 * knee);
      } else if (over >= knee / 2) {
        reductionDb = over * slope;
      }

      const targetGain = Math.pow(10, -reductionDb / 20);
      gain =
        targetGain < gain
          ? attack * gain + (1 - attack) * targetGain
          : release * gain + (1 - release) * targetGain;

      out[i] = sample * gain;
    }

    return out;
  }
}

// --- Stereo panner ---

export class NativeStereoPannerNode extends NativeGraphNode implements BridgeStereoPannerNode {
  readonly kind = 'panner';

  private pan = 0;

  setPan(value: number): void {
    this.pan = clamp(Number.isFinite(value) ? value : 0, -1, 1);
  }

  getPan(): number {
    return this.pan;
  }

  /**
   * The native voice path is mono and expo-audio plays a mono file, so panning
   * has nothing to place. The value is retained for parity with the contract.
   */
  process(samples: Float32Array): Float32Array {
    return new Float32Array(samples);
  }
}
