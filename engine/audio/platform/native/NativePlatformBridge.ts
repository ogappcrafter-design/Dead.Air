// engine/audio/platform/native/NativePlatformBridge.ts
// expo-audio implementation of PlatformBridge — DEA-94 native call voices.
//
// Native has no Web Audio graph, so this bridge implements the contract as an
// offline graph (see NativeAudioGraph): PCM sources render their downstream
// VoiceProcessor chain once into a mono buffer, which is encoded as a 16-bit
// WAV data URI and played through expo-audio.
//
// Scope: the synthesized call-voice path (PCM playback + the EQ / compressor /
// bitcrush / gain nodes it uses). Ambient/static/noise/IR/decode operations are
// not part of that path and throw `NativeAudioUnsupportedError` rather than
// pretending to work.

import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';

import type {
  PlatformBridge,
  BridgeAudioContext,
  BridgeAudioNode,
  BridgeGainNode,
  BridgeBufferSourceNode,
  BridgeBiquadNode,
  BridgeWaveShaperNode,
  BridgeConvolverNode,
  BridgeStereoPannerNode,
  BridgeDynamicsCompressorNode,
  BridgeAudioBuffer,
  StaticCharacter,
} from '../../PlatformBridge';
import {
  NativeAudioUnsupportedError,
  NativeBiquadNode,
  NativeCompressorNode,
  NativeGainNode,
  NativeGraphNode,
  NativeStereoPannerNode,
  NativeWaveShaperNode,
  renderNativeChain,
  type NativeBiquadType,
} from './NativeAudioGraph';
import { encodeWavDataUri } from './wavEncoder';

/**
 * Native synthesis rate. The voice is band-limited by the radio chain, so
 * 24 kHz matches CallVoiceEngine's render cap and keeps buffers small.
 */
export const NATIVE_SAMPLE_RATE = 24000;

/** Minimal player surface the bridge needs; injectable for tests. */
export interface NativePcmPlayerHandle {
  play(): void;
  pause(): void;
  remove(): void;
  loop: boolean;
  volume: number;
}

export type NativePcmPlayerFactory = (uri: string) => NativePcmPlayerHandle;

const createExpoAudioPcmPlayer: NativePcmPlayerFactory = (uri) => {
  const player = createAudioPlayer({ uri });
  return {
    play: () => player.play(),
    pause: () => player.pause(),
    remove: () => player.remove(),
    get loop(): boolean {
      return player.loop;
    },
    set loop(value: boolean) {
      player.loop = value;
    },
    get volume(): number {
      return player.volume;
    },
    set volume(value: number) {
      player.volume = value;
    },
  };
};

class NativeAudioContext implements BridgeAudioContext {
  readonly sampleRate = NATIVE_SAMPLE_RATE;

  private readonly startedAt = Date.now();
  private currentState: 'running' | 'suspended' | 'closed' | 'interrupted' = 'running';

  get currentTime(): number {
    return (Date.now() - this.startedAt) / 1000;
  }

  get state(): 'running' | 'suspended' | 'closed' | 'interrupted' {
    return this.currentState;
  }

  async resume(): Promise<void> {
    if (this.currentState !== 'closed') this.currentState = 'running';
  }

  async suspend(): Promise<void> {
    if (this.currentState === 'running') this.currentState = 'suspended';
  }

  async close(): Promise<void> {
    this.currentState = 'closed';
  }
}

/**
 * Playback source backed by a rendered WAV buffer. `start()` renders the
 * connected chain first, because CallVoiceEngine wires the source after
 * creating it and before starting it.
 */
class NativePcmSourceNode extends NativeGraphNode implements BridgeBufferSourceNode {
  readonly kind = 'pcm-source';

  private player: NativePcmPlayerHandle | null = null;
  private loop = false;
  private started = false;
  private stopped = false;

  constructor(
    private readonly samples: Float32Array,
    private readonly sampleRate: number,
    private readonly createPlayer: NativePcmPlayerFactory,
  ) {
    super();
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.samples.length === 0) return;

    const rendered = renderNativeChain(this, this.samples, this.sampleRate);
    const uri = encodeWavDataUri(rendered, this.sampleRate);

    // Playback failures propagate: CallVoiceEngine treats a refused source as
    // "not played" and the call stays text-only instead of breaking.
    const player = this.createPlayer(uri);
    player.loop = this.loop;
    player.volume = 1;
    this.player = player;
    try {
      player.play();
    } catch (error) {
      this.player = null;
      try {
        player.remove();
      } catch {
        // Best effort.
      }
      throw error;
    }
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    const player = this.player;
    if (player === null) return;
    try {
      player.pause();
    } catch {
      // Already stopped/released — best effort.
    }
  }

  setLoop(loop: boolean): void {
    this.loop = loop;
    if (this.player !== null) {
      try {
        this.player.loop = loop;
      } catch {
        // Best effort.
      }
    }
  }

  /** The offline graph renders once; there is no live source to transform. */
  process(samples: Float32Array): Float32Array {
    return new Float32Array(samples);
  }

  override disconnect(): void {
    this.stop();
    const player = this.player;
    this.player = null;
    if (player !== null) {
      try {
        player.remove();
      } catch {
        // Best effort.
      }
    }
    super.disconnect();
  }
}

export interface NativePlatformBridgeOptions {
  /** Override the expo-audio player factory (tests / diagnostics). */
  createPlayer?: NativePcmPlayerFactory;
}

export class NativePlatformBridge implements PlatformBridge {
  readonly platform = 'native' as const;

  private readonly createPlayer: NativePcmPlayerFactory;

  constructor(options: NativePlatformBridgeOptions = {}) {
    this.createPlayer = options.createPlayer ?? createExpoAudioPcmPlayer;
  }

  async createContext(
    _latencyHint?: 'interactive' | 'playback' | 'balanced',
  ): Promise<BridgeAudioContext> {
    await this.configureAudioSession();
    return new NativeAudioContext();
  }

  createMasterGain(_ctx: BridgeAudioContext): BridgeGainNode {
    return new NativeGainNode(1);
  }

  createStaticSource(
    _ctx: BridgeAudioContext,
    _character: StaticCharacter,
  ): BridgeBufferSourceNode {
    throw new NativeAudioUnsupportedError('createStaticSource');
  }

  createBiquad(_ctx: BridgeAudioContext, type: NativeBiquadType): BridgeBiquadNode {
    const node = new NativeBiquadNode();
    node.setType(type);
    return node;
  }

  createWaveShaper(_ctx: BridgeAudioContext): BridgeWaveShaperNode {
    return new NativeWaveShaperNode();
  }

  createConvolver(_ctx: BridgeAudioContext): BridgeConvolverNode {
    throw new NativeAudioUnsupportedError('createConvolver');
  }

  createStereoPanner(_ctx: BridgeAudioContext): BridgeStereoPannerNode {
    return new NativeStereoPannerNode();
  }

  createCompressor(_ctx: BridgeAudioContext): BridgeDynamicsCompressorNode {
    return new NativeCompressorNode();
  }

  createReverbBuffer(
    _ctx: BridgeAudioContext,
    _durationSec: number,
    _decay: number,
  ): BridgeAudioBuffer {
    throw new NativeAudioUnsupportedError('createReverbBuffer');
  }

  createNoiseBuffer(
    _ctx: BridgeAudioContext,
    _character: StaticCharacter,
    _durationSec: number,
  ): BridgeAudioBuffer {
    throw new NativeAudioUnsupportedError('createNoiseBuffer');
  }

  async decodeAudio(
    _ctx: BridgeAudioContext,
    _data: ArrayBuffer | string,
  ): Promise<BridgeAudioBuffer> {
    throw new NativeAudioUnsupportedError('decodeAudio');
  }

  /** DEA-94: build a playable source from raw mono PCM. */
  createPcmSource(
    _ctx: BridgeAudioContext,
    samples: Float32Array,
    sampleRate: number,
  ): BridgeBufferSourceNode {
    return new NativePcmSourceNode(samples, Math.max(1, Math.round(sampleRate)), this.createPlayer);
  }

  connect(src: BridgeAudioNode, dst: BridgeAudioNode): void {
    if (!(src instanceof NativeGraphNode) || !(dst instanceof NativeGraphNode)) {
      throw new NativeAudioUnsupportedError('connect (foreign node)');
    }
    src.connect(dst);
  }

  connectToDestination(src: BridgeAudioNode, _ctx: BridgeAudioContext): void {
    // The chain renderer stops at the last node with no downstream edge, so a
    // terminal connection only needs to be a no-op. Reject foreign nodes
    // loudly so bridge mixing fails at wiring time rather than silently.
    if (!(src instanceof NativeGraphNode)) {
      throw new NativeAudioUnsupportedError('connectToDestination (foreign node)');
    }
  }

  disconnectAll(node: BridgeAudioNode): void {
    if (node instanceof NativeGraphNode) node.disconnect();
  }

  private async configureAudioSession(): Promise<void> {
    try {
      await setIsAudioActiveAsync(true);
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
    } catch {
      // Audio session setup is best-effort; playback still attempts to start.
    }
  }
}

export const createNativePlatformBridge = (
  options: NativePlatformBridgeOptions = {},
): PlatformBridge => new NativePlatformBridge(options);
