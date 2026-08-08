// engine/audio/PlatformBridge.ts
// Abstraction layer: web uses Web Audio API directly, native uses expo-av.
// Engine talks only to bridge — never to platform APIs directly.

import { Band } from '../../lib/constants';

/**
 * Minimal AudioContext-shaped surface the bridge exposes to the engine.
 * Implementations wrap either Web Audio API (web) or expo-av (native).
 */
export interface BridgeAudioContext {
  readonly sampleRate: number;
  readonly currentTime: number;
  readonly state: 'running' | 'suspended' | 'closed' | 'interrupted';
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Minimal node handle the bridge returns. Opaque to engine — only
 * passed back to bridge for connection / disposal.
 */
export interface BridgeAudioNode {
  /** Bridge-defined identifier; engine never inspects. */
  readonly kind: string;
  /** Dispose native resources. Idempotent. */
  disconnect(): void;
}

export interface BridgeGainNode extends BridgeAudioNode {
  setGain(value: number): void;
}

export interface BridgeBufferSourceNode extends BridgeAudioNode {
  start(when?: number): void;
  stop(when?: number): void;
  /** Loop the buffer. */
  setLoop(loop: boolean): void;
  /** Connect to another bridge node. */
  connect(node: BridgeAudioNode): void;
}

export interface BridgeBiquadNode extends BridgeAudioNode {
  setType(
    type:
      | 'lowpass'
      | 'highpass'
      | 'bandpass'
      | 'lowshelf'
      | 'highshelf'
      | 'peaking'
      | 'notch'
      | 'allpass',
  ): void;
  setFrequency(value: number): void;
  setQ(value: number): void;
  setGain(value: number): void;
  connect(node: BridgeAudioNode): void;
}

export interface BridgeWaveShaperNode extends BridgeAudioNode {
  setCurve(curve: Float32Array): void;
  setOversample(value: 'none' | '2x' | '4x'): void;
  connect(node: BridgeAudioNode): void;
}

export interface BridgeConvolverNode extends BridgeAudioNode {
  setBuffer(buffer: BridgeAudioBuffer): void;
  connect(node: BridgeAudioNode): void;
}

export interface BridgeStereoPannerNode extends BridgeAudioNode {
  setPan(value: number): void;
  connect(node: BridgeAudioNode): void;
}

export interface BridgeDynamicsCompressorNode extends BridgeAudioNode {
  setThreshold(value: number): void;
  setKnee(value: number): void;
  setRatio(value: number): void;
  setAttack(value: number): void;
  setRelease(value: number): void;
  connect(node: BridgeAudioNode): void;
}

export interface BridgeAudioBuffer {
  readonly duration: number;
  readonly numberOfChannels: number;
  readonly length: number;
}

export type StaticCharacter = 'white' | 'pink' | 'brown';

export type VoicePreset = 'LIVING' | 'LIMINAL' | 'LOST' | 'CLASSIFIED' | 'REDACTED';

/** Static character chosen for a band (off-station = harsher). */
export const bandStaticCharacter = (band: Band): StaticCharacter => {
  switch (band) {
    case 'LIVING':
      return 'white';
    case 'LIMINAL':
      return 'pink';
    case 'LOST':
      return 'brown';
    case 'CLASSIFIED':
      return 'white';
    case '████████':
      return 'pink';
    case 'WEATHER':
      return 'brown';
    case 'PIRATE':
      return 'white';
    case 'HISTORICAL':
      return 'pink';
    default: {
      // Exhaustive: switch is total over Band. Default unreachable but
      // required for runtime safety if Band is widened elsewhere.
      const _exhaustive: never = band;
      return _exhaustive as StaticCharacter;
    }
  }
};

/** Voice preset keyed to band. */
export const bandVoicePreset = (band: Band): VoicePreset => {
  switch (band) {
    case 'LIVING':
      return 'LIVING';
    case 'LIMINAL':
      return 'LIMINAL';
    case 'LOST':
      return 'LOST';
    case 'CLASSIFIED':
      return 'CLASSIFIED';
    case '████████':
      return 'REDACTED';
    case 'WEATHER':
      return 'LIVING';
    case 'PIRATE':
      return 'CLASSIFIED';
    case 'HISTORICAL':
      return 'LOST';
    default: {
      const _exhaustive: never = band;
      return _exhaustive as VoicePreset;
    }
  }
};

/**
 * Platform bridge — abstracts Web Audio API vs expo-av.
 * Implementations live in `platform/` (web) and `platform/native/`.
 * The engine holds exactly one bridge instance.
 */
export interface PlatformBridge {
  /**
   * Lazy-create + return the underlying AudioContext-shaped handle.
   * Optional latency hint lets the bridge pick internal buffer sizes:
   * - 'interactive' → smallest buffers, lowest latency (may glitch under load)
   * - 'playback' → larger buffers, smoother output
   * - 'balanced' → default; bridge decides
   * Bridges that don't support hints ignore the arg.
   */
  createContext(latencyHint?: 'interactive' | 'playback' | 'balanced'): Promise<BridgeAudioContext>;

  /** Master gain node connected to destination. */
  createMasterGain(ctx: BridgeAudioContext): BridgeGainNode;

  /** Persistent static noise source (looped buffer). */
  createStaticSource(ctx: BridgeAudioContext, character: StaticCharacter): BridgeBufferSourceNode;

  /** Biquad filter node. */
  createBiquad(
    ctx: BridgeAudioContext,
    type:
      | 'lowpass'
      | 'highpass'
      | 'bandpass'
      | 'lowshelf'
      | 'highshelf'
      | 'peaking'
      | 'notch'
      | 'allpass',
  ): BridgeBiquadNode;

  /** WaveShaper for distortion / bitcrush. */
  createWaveShaper(ctx: BridgeAudioContext): BridgeWaveShaperNode;

  /** Convolver for reverb (algo or IR-based). */
  createConvolver(ctx: BridgeAudioContext): BridgeConvolverNode;

  /** Stereo panner for spatial placement. */
  createStereoPanner(ctx: BridgeAudioContext): BridgeStereoPannerNode;

  /** Dynamics compressor for voice treatment. */
  createCompressor(ctx: BridgeAudioContext): BridgeDynamicsCompressorNode;

  /** Generate an IR-style buffer for reverb decay length. */
  createReverbBuffer(
    ctx: BridgeAudioContext,
    durationSec: number,
    decay: number,
  ): BridgeAudioBuffer;

  /** Generate a noise buffer of given character + length. */
  createNoiseBuffer(
    ctx: BridgeAudioContext,
    character: StaticCharacter,
    durationSec: number,
  ): BridgeAudioBuffer;

  /** Decode an encoded audio asset (loaded from a URI/path) into a buffer. */
  decodeAudio(ctx: BridgeAudioContext, data: ArrayBuffer | string): Promise<BridgeAudioBuffer>;

  /** Connect src → dst. Both must originate from this bridge. */
  connect(src: BridgeAudioNode, dst: BridgeAudioNode): void;

  /** Connect src → destination (speakers). */
  connectToDestination(src: BridgeAudioNode, ctx: BridgeAudioContext): void;

  /** Disconnect a node from everything downstream. */
  disconnectAll(node: BridgeAudioNode): void;

  /** Platform identifier — for logging / branching. */
  readonly platform: 'web' | 'native';
}

/**
 * Type guard: bridge is web platform.
 */
export const isWebBridge = (b: PlatformBridge): boolean => b.platform === 'web';

/**
 * Type guard: bridge is native platform.
 */
export const isNativeBridge = (b: PlatformBridge): boolean => b.platform === 'native';
