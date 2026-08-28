// engine/audio/platform/web/WebPlatformBridge.ts
// Web Audio API implementation of PlatformBridge.
// Wraps browser AudioContext + nodes to satisfy the bridge contract.

import {
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

// --- Internal node wrappers ---

class WebAudioContext implements BridgeAudioContext {
  constructor(private readonly ctx: AudioContext) {}

  get sampleRate(): number {
    return this.ctx.sampleRate;
  }

  get currentTime(): number {
    return this.ctx.currentTime;
  }

  get state(): 'running' | 'suspended' | 'closed' | 'interrupted' {
    return this.ctx.state as 'running' | 'suspended' | 'closed' | 'interrupted';
  }

  async resume(): Promise<void> {
    await this.ctx.resume();
  }

  async suspend(): Promise<void> {
    await this.ctx.suspend();
  }

  async close(): Promise<void> {
    await this.ctx.close();
  }

  /** Access the underlying AudioContext for internal operations. */
  getNativeContext(): AudioContext {
    return this.ctx;
  }
}

class WebAudioNode implements BridgeAudioNode {
  constructor(
    readonly kind: string,
    readonly node: AudioNode,
  ) {}

  disconnect(): void {
    this.node.disconnect();
  }
}

class WebGainNode extends WebAudioNode implements BridgeGainNode {
  private readonly gainNode: GainNode;

  constructor(node: GainNode) {
    super('gain', node);
    this.gainNode = node;
  }

  setGain(value: number): void {
    this.gainNode.gain.setValueAtTime(value, this.gainNode.context.currentTime);
  }
}

class WebBufferSourceNode extends WebAudioNode implements BridgeBufferSourceNode {
  private readonly src: AudioBufferSourceNode;

  constructor(node: AudioBufferSourceNode) {
    super('source', node);
    this.src = node;
  }

  start(when?: number): void {
    if (when !== undefined) {
      this.src.start(when);
    } else {
      this.src.start();
    }
  }

  stop(when?: number): void {
    if (when !== undefined) {
      this.src.stop(when);
    } else {
      this.src.stop();
    }
  }

  setLoop(loop: boolean): void {
    this.src.loop = loop;
  }

  connect(node: BridgeAudioNode): void {
    if (node instanceof WebAudioNode) {
      this.src.connect(node.node);
    }
  }
}

class WebBiquadNode extends WebAudioNode implements BridgeBiquadNode {
  private readonly filter: BiquadFilterNode;

  constructor(node: BiquadFilterNode) {
    super('biquad', node);
    this.filter = node;
  }

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
  ): void {
    this.filter.type = type;
  }

  setFrequency(value: number): void {
    this.filter.frequency.setValueAtTime(value, this.filter.context.currentTime);
  }

  setQ(value: number): void {
    this.filter.Q.setValueAtTime(value, this.filter.context.currentTime);
  }

  setGain(value: number): void {
    this.filter.gain.setValueAtTime(value, this.filter.context.currentTime);
  }

  connect(node: BridgeAudioNode): void {
    if (node instanceof WebAudioNode) {
      this.filter.connect(node.node);
    }
  }
}

class WebWaveShaperNode extends WebAudioNode implements BridgeWaveShaperNode {
  private readonly shaper: WaveShaperNode;

  constructor(node: WaveShaperNode) {
    super('shaper', node);
    this.shaper = node;
  }

  setCurve(curve: Float32Array): void {
    this.shaper.curve = new Float32Array(curve);
  }

  setOversample(value: 'none' | '2x' | '4x'): void {
    this.shaper.oversample = value;
  }

  connect(node: BridgeAudioNode): void {
    if (node instanceof WebAudioNode) {
      this.shaper.connect(node.node);
    }
  }
}

class WebConvolverNode extends WebAudioNode implements BridgeConvolverNode {
  private readonly convolver: ConvolverNode;

  constructor(node: ConvolverNode) {
    super('convolver', node);
    this.convolver = node;
  }

  setBuffer(buffer: BridgeAudioBuffer): void {
    if (buffer instanceof WebAudioBuffer) {
      this.convolver.buffer = buffer.buffer;
    }
  }

  connect(node: BridgeAudioNode): void {
    if (node instanceof WebAudioNode) {
      this.convolver.connect(node.node);
    }
  }
}

class WebStereoPannerNode extends WebAudioNode implements BridgeStereoPannerNode {
  private readonly panner: StereoPannerNode;

  constructor(node: StereoPannerNode) {
    super('panner', node);
    this.panner = node;
  }

  setPan(value: number): void {
    this.panner.pan.setValueAtTime(value, this.panner.context.currentTime);
  }

  connect(node: BridgeAudioNode): void {
    if (node instanceof WebAudioNode) {
      this.panner.connect(node.node);
    }
  }
}

class WebDynamicsCompressorNode extends WebAudioNode implements BridgeDynamicsCompressorNode {
  private readonly compressor: DynamicsCompressorNode;

  constructor(node: DynamicsCompressorNode) {
    super('compressor', node);
    this.compressor = node;
  }

  setThreshold(value: number): void {
    this.compressor.threshold.setValueAtTime(value, this.compressor.context.currentTime);
  }

  setKnee(value: number): void {
    this.compressor.knee.setValueAtTime(value, this.compressor.context.currentTime);
  }

  setRatio(value: number): void {
    this.compressor.ratio.setValueAtTime(value, this.compressor.context.currentTime);
  }

  setAttack(value: number): void {
    this.compressor.attack.setValueAtTime(value, this.compressor.context.currentTime);
  }

  setRelease(value: number): void {
    this.compressor.release.setValueAtTime(value, this.compressor.context.currentTime);
  }

  connect(node: BridgeAudioNode): void {
    if (node instanceof WebAudioNode) {
      this.compressor.connect(node.node);
    }
  }
}

class WebAudioBuffer implements BridgeAudioBuffer {
  constructor(
    readonly duration: number,
    readonly numberOfChannels: number,
    readonly length: number,
    readonly buffer: AudioBuffer,
  ) {}
}

// --- Noise buffer generation ---

const generateNoiseBuffer = (
  ctx: AudioContext,
  character: StaticCharacter,
  durationSec: number,
): AudioBuffer => {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  if (character === 'white') {
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  } else if (character === 'pink') {
    // Paul Kellet's pink noise filter
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  } else {
    // brown
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      const val = (lastOut + 0.02 * white) / 1.02;
      lastOut = val;
      data[i] = val * 3.5;
    }
  }

  return buffer;
};

const generateReverbBuffer = (
  ctx: AudioContext,
  durationSec: number,
  decay: number,
): AudioBuffer => {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const channels = 2;
  const buffer = ctx.createBuffer(channels, length, sampleRate);

  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }

  return buffer;
};

// --- PlatformBridge implementation ---

export class WebPlatformBridge implements PlatformBridge {
  readonly platform = 'web' as const;

  async createContext(
    latencyHint?: 'interactive' | 'playback' | 'balanced',
  ): Promise<BridgeAudioContext> {
    const ctx = new AudioContext({
      latencyHint: latencyHint ?? 'balanced',
      sampleRate: 44100,
    });
    return new WebAudioContext(ctx);
  }

  createMasterGain(ctx: BridgeAudioContext): BridgeGainNode {
    const audioCtx = (ctx as WebAudioContext).getNativeContext();
    const gain = audioCtx.createGain();
    return new WebGainNode(gain);
  }

  createStaticSource(ctx: BridgeAudioContext, character: StaticCharacter): BridgeBufferSourceNode {
    const audioCtx = (ctx as WebAudioContext).getNativeContext();
    const buffer = generateNoiseBuffer(audioCtx, character, 4);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return new WebBufferSourceNode(source);
  }

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
  ): BridgeBiquadNode {
    const audioCtx = (ctx as WebAudioContext).getNativeContext();
    const filter = audioCtx.createBiquadFilter();
    filter.type = type;
    return new WebBiquadNode(filter);
  }

  createWaveShaper(ctx: BridgeAudioContext): BridgeWaveShaperNode {
    const audioCtx = (ctx as WebAudioContext).getNativeContext();
    const shaper = audioCtx.createWaveShaper();
    return new WebWaveShaperNode(shaper);
  }

  createConvolver(ctx: BridgeAudioContext): BridgeConvolverNode {
    const audioCtx = (ctx as WebAudioContext).getNativeContext();
    const convolver = audioCtx.createConvolver();
    return new WebConvolverNode(convolver);
  }

  createStereoPanner(ctx: BridgeAudioContext): BridgeStereoPannerNode {
    const audioCtx = (ctx as WebAudioContext).getNativeContext();
    const panner = audioCtx.createStereoPanner();
    return new WebStereoPannerNode(panner);
  }

  createCompressor(ctx: BridgeAudioContext): BridgeDynamicsCompressorNode {
    const audioCtx = (ctx as WebAudioContext).getNativeContext();
    const compressor = audioCtx.createDynamicsCompressor();
    return new WebDynamicsCompressorNode(compressor);
  }

  createReverbBuffer(
    ctx: BridgeAudioContext,
    durationSec: number,
    decay: number,
  ): BridgeAudioBuffer {
    const audioCtx = (ctx as WebAudioContext).getNativeContext();
    const buffer = generateReverbBuffer(audioCtx, durationSec, decay);
    return new WebAudioBuffer(buffer.duration, buffer.numberOfChannels, buffer.length, buffer);
  }

  createNoiseBuffer(
    ctx: BridgeAudioContext,
    character: StaticCharacter,
    durationSec: number,
  ): BridgeAudioBuffer {
    const audioCtx = (ctx as WebAudioContext).getNativeContext();
    const buffer = generateNoiseBuffer(audioCtx, character, durationSec);
    return new WebAudioBuffer(buffer.duration, buffer.numberOfChannels, buffer.length, buffer);
  }

  async decodeAudio(
    ctx: BridgeAudioContext,
    data: ArrayBuffer | string,
  ): Promise<BridgeAudioBuffer> {
    const audioCtx = (ctx as WebAudioContext).getNativeContext();
    if (typeof data === 'string') {
      const response = await fetch(data);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      return new WebAudioBuffer(
        audioBuffer.duration,
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer,
      );
    }
    const audioBuffer = await audioCtx.decodeAudioData(data);
    return new WebAudioBuffer(
      audioBuffer.duration,
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer,
    );
  }

  connect(src: BridgeAudioNode, dst: BridgeAudioNode): void {
    if (src instanceof WebAudioNode && dst instanceof WebAudioNode) {
      src.node.connect(dst.node);
    }
  }

  connectToDestination(src: BridgeAudioNode, ctx: BridgeAudioContext): void {
    if (src instanceof WebAudioNode) {
      const audioCtx = (ctx as WebAudioContext).getNativeContext();
      src.node.connect(audioCtx.destination);
    }
  }

  disconnectAll(node: BridgeAudioNode): void {
    if (node instanceof WebAudioNode) {
      node.node.disconnect();
    }
  }
}

// --- Factory ---

export const createWebPlatformBridge = (): PlatformBridge => new WebPlatformBridge();
