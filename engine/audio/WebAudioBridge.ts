// engine/audio/WebAudioBridge.ts
// Concrete PlatformBridge for web — wraps the Web Audio API.
// SSR-safe: methods throw if used outside a browser; createContext rejects so
// AudioEngine can settle into its 'closed' state on the server.

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
} from './PlatformBridge';

// ---------------------------------------------------------------------------
// Web Audio type aliases — kept loose because the standard lib types vary by
// TS lib version and runtime (browser vs node), but the surface we touch is
// stable across all of them.
// ---------------------------------------------------------------------------
type WebAudioNode = {
  disconnect(): void;
  connect(destination: WebAudioNode): WebAudioNode;
};

type WebAudioParam = {
  value: number;
  setValueAtTime(value: number, startTime: number): void;
  linearRampToValueAtTime(value: number, endTime: number): void;
};

interface WebAudioContext {
  readonly sampleRate: number;
  readonly currentTime: number;
  readonly state: 'running' | 'suspended' | 'closed' | 'interrupted';
  readonly destination: WebAudioNode;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
  createGain(): WebAudioGainNode;
  createBufferSource(): WebAudioBufferSourceNode;
  createBiquadFilter(): WebAudioBiquadNode;
  createWaveShaper(): WebAudioWaveShaperNode;
  createConvolver(): WebAudioConvolverNode;
  createStereoPanner(): WebAudioStereoPannerNode;
  createDynamicsCompressor(): WebAudioCompressorNode;
  createBuffer(numberOfChannels: number, length: number, sampleRate: number): WebAudioBuffer;
  decodeAudioData(arrayBuffer: ArrayBuffer): Promise<WebAudioBuffer>;
}

interface WebAudioGainNode extends WebAudioNode {
  readonly gain: WebAudioParam;
}

interface WebAudioBufferSourceNode extends WebAudioNode {
  start(when?: number): void;
  stop(when?: number): void;
  loop: boolean;
  buffer: WebAudioBuffer | null;
  detune: number;
  playbackRate: WebAudioParam;
}

interface WebAudioBiquadNode extends WebAudioNode {
  type: string;
  frequency: WebAudioParam;
  Q: WebAudioParam;
  gain: WebAudioParam;
}

interface WebAudioWaveShaperNode extends WebAudioNode {
  curve: Float32Array | null;
  oversample: 'none' | '2x' | '4x';
}

interface WebAudioConvolverNode extends WebAudioNode {
  buffer: WebAudioBuffer | null;
}

interface WebAudioStereoPannerNode extends WebAudioNode {
  pan: WebAudioParam;
}

interface WebAudioCompressorNode extends WebAudioNode {
  threshold: WebAudioParam;
  knee: WebAudioParam;
  ratio: WebAudioParam;
  attack: WebAudioParam;
  release: WebAudioParam;
}

interface WebAudioBuffer {
  readonly duration: number;
  readonly numberOfChannels: number;
  readonly length: number;
  readonly sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

// ---------------------------------------------------------------------------
// BridgeAudioContext adapter — wraps a raw WebAudioContext.
// ---------------------------------------------------------------------------
class WebBridgeAudioContext implements BridgeAudioContext {
  constructor(private readonly ctx: WebAudioContext) {}

  get sampleRate(): number {
    return this.ctx.sampleRate;
  }
  get currentTime(): number {
    return this.ctx.currentTime;
  }
  get state(): 'running' | 'suspended' | 'closed' | 'interrupted' {
    return this.ctx.state;
  }
  resume(): Promise<void> {
    return this.ctx.resume();
  }
  suspend(): Promise<void> {
    return this.ctx.suspend();
  }
  close(): Promise<void> {
    return this.ctx.close();
  }
}

// ---------------------------------------------------------------------------
// Node adapters wrap the underlying Web Audio node into a Bridge handle.
// ---------------------------------------------------------------------------
class WebBridgeNode<T extends WebAudioNode> implements BridgeAudioNode {
  readonly kind: string;
  /** Underlying Web Audio node. Public so cross-cast siblings can connect. */
  readonly node: T;
  constructor(kind: string, node: T) {
    this.kind = kind;
    this.node = node;
  }
  disconnect(): void {
    try {
      this.node.disconnect();
    } catch {
      // disconnect is best-effort — calling twice or on a non-connected node
      // throws in some browsers.
    }
  }
}

class WebBridgeGain extends WebBridgeNode<WebAudioGainNode> implements BridgeGainNode {
  constructor(node: WebAudioGainNode) {
    super('gain', node);
  }
  setGain(value: number): void {
    this.node.gain.setValueAtTime(value, 0);
    this.node.gain.value = value;
  }
}

class WebBridgeBufferSource
  extends WebBridgeNode<WebAudioBufferSourceNode>
  implements BridgeBufferSourceNode
{
  constructor(
    node: WebAudioBufferSourceNode,
    private readonly ctx: WebAudioContext,
  ) {
    super('source', node);
  }
  start(when?: number): void {
    this.node.start(when ?? this.ctx.currentTime);
  }
  stop(when?: number): void {
    this.node.stop(when ?? this.ctx.currentTime);
  }
  setLoop(loop: boolean): void {
    this.node.loop = loop;
  }
  connect(node: BridgeAudioNode): void {
    this.node.connect((node as WebBridgeNode<WebAudioNode>).node);
  }
}

class WebBridgeBiquad extends WebBridgeNode<WebAudioBiquadNode> implements BridgeBiquadNode {
  constructor(node: WebAudioBiquadNode) {
    super('biquad', node);
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
    this.node.type = type;
  }
  setFrequency(value: number): void {
    this.node.frequency.setValueAtTime(value, 0);
    this.node.frequency.value = value;
  }
  setQ(value: number): void {
    this.node.Q.setValueAtTime(value, 0);
    this.node.Q.value = value;
  }
  setGain(value: number): void {
    this.node.gain.setValueAtTime(value, 0);
    this.node.gain.value = value;
  }
  connect(node: BridgeAudioNode): void {
    this.node.connect((node as WebBridgeNode<WebAudioNode>).node);
  }
}

class WebBridgeWaveShaper
  extends WebBridgeNode<WebAudioWaveShaperNode>
  implements BridgeWaveShaperNode
{
  constructor(node: WebAudioWaveShaperNode) {
    super('shaper', node);
  }
  setCurve(curve: Float32Array): void {
    this.node.curve = curve;
  }
  setOversample(value: 'none' | '2x' | '4x'): void {
    this.node.oversample = value;
  }
  connect(node: BridgeAudioNode): void {
    this.node.connect((node as WebBridgeNode<WebAudioNode>).node);
  }
}

class WebBridgeConvolver
  extends WebBridgeNode<WebAudioConvolverNode>
  implements BridgeConvolverNode
{
  constructor(node: WebAudioConvolverNode) {
    super('convolver', node);
  }
  setBuffer(buffer: BridgeAudioBuffer): void {
    this.node.buffer = (buffer as WebBridgeAudioBuffer).buffer;
  }
  connect(node: BridgeAudioNode): void {
    this.node.connect((node as WebBridgeNode<WebAudioNode>).node);
  }
}

class WebBridgeStereoPanner
  extends WebBridgeNode<WebAudioStereoPannerNode>
  implements BridgeStereoPannerNode
{
  constructor(node: WebAudioStereoPannerNode) {
    super('panner', node);
  }
  setPan(value: number): void {
    this.node.pan.setValueAtTime(value, 0);
    this.node.pan.value = value;
  }
  connect(node: BridgeAudioNode): void {
    this.node.connect((node as WebBridgeNode<WebAudioNode>).node);
  }
}

class WebBridgeCompressor
  extends WebBridgeNode<WebAudioCompressorNode>
  implements BridgeDynamicsCompressorNode
{
  constructor(node: WebAudioCompressorNode) {
    super('compressor', node);
  }
  setThreshold(value: number): void {
    this.node.threshold.setValueAtTime(value, 0);
    this.node.threshold.value = value;
  }
  setKnee(value: number): void {
    this.node.knee.setValueAtTime(value, 0);
    this.node.knee.value = value;
  }
  setRatio(value: number): void {
    this.node.ratio.setValueAtTime(value, 0);
    this.node.ratio.value = value;
  }
  setAttack(value: number): void {
    this.node.attack.setValueAtTime(value, 0);
    this.node.attack.value = value;
  }
  setRelease(value: number): void {
    this.node.release.setValueAtTime(value, 0);
    this.node.release.value = value;
  }
  connect(node: BridgeAudioNode): void {
    this.node.connect((node as WebBridgeNode<WebAudioNode>).node);
  }
}

class WebBridgeAudioBuffer implements BridgeAudioBuffer {
  constructor(readonly buffer: WebAudioBuffer) {}
  get duration(): number {
    return this.buffer.duration;
  }
  get numberOfChannels(): number {
    return this.buffer.numberOfChannels;
  }
  get length(): number {
    return this.buffer.length;
  }
}

// ---------------------------------------------------------------------------
// Noise buffer synthesis — Voss-McCartney pink approximation + brown.
// ---------------------------------------------------------------------------
function fillWhite(buf: WebAudioBuffer): void {
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
}

function fillPink(buf: WebAudioBuffer): void {
  // Voss-McCartney approximation via summed octaves.
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const data = buf.getChannelData(ch);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < data.length; i++) {
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
  }
}

function fillBrown(buf: WebAudioBuffer): void {
  // Brownian — leaky integrator.
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const data = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
}

// ---------------------------------------------------------------------------
// WebAudioBridge
// ---------------------------------------------------------------------------
export class WebAudioBridge implements PlatformBridge {
  readonly platform = 'web' as const;

  async createContext(
    latencyHint: 'interactive' | 'playback' | 'balanced',
  ): Promise<BridgeAudioContext> {
    if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
      throw new Error('WebAudioBridge: AudioContext unavailable (SSR or unsupported browser)');
    }
    // Standard ctor — latencyHint may be ignored by older browsers; that's OK.
    const hint =
      latencyHint === 'balanced' ? 'balanced' : (latencyHint as 'interactive' | 'playback');
    const Ctor = window.AudioContext;
    const ctx = new Ctor(
      latencyHint ? { latencyHint: hint } : undefined,
    ) as unknown as WebAudioContext;
    return new WebBridgeAudioContext(ctx);
  }

  createMasterGain(ctx: BridgeAudioContext): BridgeGainNode {
    return new WebBridgeGain(this.nativeCtx(ctx).createGain());
  }

  createStaticSource(ctx: BridgeAudioContext, character: StaticCharacter): BridgeBufferSourceNode {
    const native = this.nativeCtx(ctx);
    const source = native.createBufferSource();
    const buf = native.createBuffer(1, Math.ceil(native.sampleRate * 4), native.sampleRate);
    switch (character) {
      case 'white':
        fillWhite(buf);
        break;
      case 'pink':
        fillPink(buf);
        break;
      case 'brown':
        fillBrown(buf);
        break;
    }
    source.buffer = buf;
    return new WebBridgeBufferSource(source, native);
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
    const native = this.nativeCtx(ctx);
    const filter = native.createBiquadFilter();
    filter.type = type;
    return new WebBridgeBiquad(filter);
  }

  createWaveShaper(ctx: BridgeAudioContext): BridgeWaveShaperNode {
    const native = this.nativeCtx(ctx);
    return new WebBridgeWaveShaper(native.createWaveShaper());
  }

  createConvolver(ctx: BridgeAudioContext): BridgeConvolverNode {
    const native = this.nativeCtx(ctx);
    return new WebBridgeConvolver(native.createConvolver());
  }

  createStereoPanner(ctx: BridgeAudioContext): BridgeStereoPannerNode {
    const native = this.nativeCtx(ctx);
    return new WebBridgeStereoPanner(native.createStereoPanner());
  }

  createCompressor(ctx: BridgeAudioContext): BridgeDynamicsCompressorNode {
    const native = this.nativeCtx(ctx);
    return new WebBridgeCompressor(native.createDynamicsCompressor());
  }

  createReverbBuffer(
    ctx: BridgeAudioContext,
    durationSec: number,
    decay: number,
  ): BridgeAudioBuffer {
    const native = this.nativeCtx(ctx);
    const length = Math.max(1, Math.ceil(native.sampleRate * durationSec));
    const buf = native.createBuffer(2, length, native.sampleRate);
    // Noise-burst convolution IR: exponentially decaying white noise
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const t = i / data.length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return new WebBridgeAudioBuffer(buf);
  }

  createNoiseBuffer(
    ctx: BridgeAudioContext,
    character: StaticCharacter,
    durationSec: number,
  ): BridgeAudioBuffer {
    const native = this.nativeCtx(ctx);
    const length = Math.max(1, Math.ceil(native.sampleRate * durationSec));
    const buf = native.createBuffer(1, length, native.sampleRate);
    switch (character) {
      case 'white':
        fillWhite(buf);
        break;
      case 'pink':
        fillPink(buf);
        break;
      case 'brown':
        fillBrown(buf);
        break;
    }
    return new WebBridgeAudioBuffer(buf);
  }

  async decodeAudio(
    ctx: BridgeAudioContext,
    data: ArrayBuffer | string,
  ): Promise<BridgeAudioBuffer> {
    const native = this.nativeCtx(ctx);
    // decodeAudioData standardly takes an ArrayBuffer. Returning the
    // Promise form from the browser; node `accept()` may use a string URI for
    // native paths, but the web path already fetched bytes.
    if (typeof data === 'string') {
      throw new Error('WebAudioBridge.decodeAudio: string URI unsupported — provide ArrayBuffer');
    }
    const buf = await native.decodeAudioData(data);
    return new WebBridgeAudioBuffer(buf);
  }

  connect(src: BridgeAudioNode, dst: BridgeAudioNode): void {
    (src as WebBridgeNode<WebAudioNode>).node.connect((dst as WebBridgeNode<WebAudioNode>).node);
  }

  connectToDestination(src: BridgeAudioNode, ctx: BridgeAudioContext): void {
    (src as WebBridgeNode<WebAudioNode>).node.connect(this.nativeCtx(ctx).destination);
  }

  disconnectAll(node: BridgeAudioNode): void {
    try {
      (node as WebBridgeNode<WebAudioNode>).node.disconnect();
    } catch {
      // best-effort
    }
  }

  // --- internal ---
  private nativeCtx(ctx: BridgeAudioContext): WebAudioContext {
    if (ctx instanceof WebBridgeAudioContext) {
      return (ctx as unknown as { readonly ctx: WebAudioContext }).ctx;
    }
    throw new Error('WebAudioBridge: incompatible BridgeAudioContext — not from WebAudioBridge');
  }
}

/** Factory — matches the import path already used by the app. */
export const createWebAudioBridge = (): WebAudioBridge => new WebAudioBridge();
