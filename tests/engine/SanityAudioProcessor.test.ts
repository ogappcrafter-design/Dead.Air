// tests/engine/SanityAudioProcessor.test.ts
// DEA-13: SanityAudioProcessor behavior via mock PlatformBridge.
// Verifies whisper layer, warble modulation, distortion, and lifecycle.

import { SanityAudioProcessor, type SanityAudioUpdate } from '@/engine/audio/SanityAudioProcessor';
import type {
  PlatformBridge,
  BridgeAudioContext,
  BridgeAudioNode,
  BridgeBufferSourceNode,
  BridgeBiquadNode,
  BridgeGainNode,
  BridgeWaveShaperNode,
} from '@/engine/audio/PlatformBridge';

// ─── Mock node helpers ─────────────────────────────────────

interface MockNode extends BridgeAudioNode {
  kind: string;
  connections: MockNode[];
  gain: number;
  freq: number;
  q: number;
  curve: Float32Array | null;
  oversample: string;
  started: boolean;
  stopped: boolean;
  loop: boolean;
}

function makeNode(kind: string): MockNode {
  return {
    kind,
    connections: [],
    gain: 0,
    freq: 0,
    q: 0,
    curve: null,
    oversample: 'none',
    started: false,
    stopped: false,
    loop: false,
    disconnect() {
      this.connections = [];
    },
  };
}

function makeGainNode(): BridgeGainNode & MockNode {
  const n = makeNode('gain');
  return Object.assign(n, {
    setGain(v: number) {
      this.gain = v;
    },
  });
}

function makeBiquadNode(): BridgeBiquadNode & MockNode {
  const n = makeNode('biquad');
  return Object.assign(n, {
    setType() {},
    setFrequency(v: number) {
      this.freq = v;
    },
    setQ(v: number) {
      this.q = v;
    },
    setGain() {},
    connect(dst: BridgeAudioNode) {
      this.connections.push(dst as MockNode);
    },
  });
}

function makeWaveShaperNode(): BridgeWaveShaperNode & MockNode {
  const n = makeNode('waveshaper');
  return Object.assign(n, {
    setCurve(c: Float32Array) {
      this.curve = c;
    },
    setOversample(v: 'none' | '2x' | '4x') {
      this.oversample = v;
    },
    connect(dst: BridgeAudioNode) {
      this.connections.push(dst as MockNode);
    },
  });
}

function makeSourceNode(): BridgeBufferSourceNode & MockNode {
  const n = makeNode('source');
  return Object.assign(n, {
    start() {
      this.started = true;
    },
    stop() {
      this.stopped = true;
    },
    setLoop(l: boolean) {
      this.loop = l;
    },
    connect(dst: BridgeAudioNode) {
      this.connections.push(dst as MockNode);
    },
  });
}

// ─── Mock bridge ────────────────────────────────────────────

function makeMockBridge(): PlatformBridge {
  return {
    platform: 'web',
    createContext: jest.fn(async () => makeCtx() as unknown as BridgeAudioContext),
    createMasterGain: jest.fn(() => makeGainNode()),
    createStaticSource: jest.fn(() => makeSourceNode() as unknown as BridgeBufferSourceNode),
    createBiquad: jest.fn(() => makeBiquadNode() as unknown as BridgeBiquadNode),
    createWaveShaper: jest.fn(() => makeWaveShaperNode() as unknown as BridgeWaveShaperNode),
    createConvolver: jest.fn(),
    createStereoPanner: jest.fn(),
    createCompressor: jest.fn(),
    createReverbBuffer: jest.fn(),
    createNoiseBuffer: jest.fn(),
    decodeAudio: jest.fn(),
    connect: jest.fn((src: BridgeAudioNode, dst: BridgeAudioNode) => {
      (src as MockNode).connections.push(dst as MockNode);
    }),
    connectToDestination: jest.fn(),
    disconnectAll: jest.fn((node: BridgeAudioNode) => {
      (node as MockNode).connections = [];
    }),
  };
}

function makeCtx(): BridgeAudioContext {
  return {
    sampleRate: 44100,
    currentTime: 0,
    state: 'running',
    resume: jest.fn(async () => {}),
    suspend: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe('SanityAudioProcessor', () => {
  let bridge: PlatformBridge;
  let ctx: BridgeAudioContext;
  let dest: MockNode;
  let proc: SanityAudioProcessor;

  beforeEach(() => {
    jest.useFakeTimers();
    bridge = makeMockBridge();
    ctx = makeCtx();
    dest = makeNode('destination');
    proc = new SanityAudioProcessor(bridge, ctx, dest as unknown as BridgeAudioNode);
  });

  afterEach(() => {
    proc.dispose();
    jest.useRealTimers();
  });

  describe('construction', () => {
    it('creates whisper filter with bandpass center 850 Hz, Q 1.8', () => {
      expect(bridge.createBiquad).toHaveBeenCalled();
      const filter = (bridge.createBiquad as jest.Mock).mock.results[0].value as MockNode;
      expect(filter.freq).toBe(850);
      expect(filter.q).toBe(1.8);
    });

    it('creates whisper gain starting at 0', () => {
      const gain = (bridge.createMasterGain as jest.Mock).mock.results[0].value as MockNode;
      expect(gain.gain).toBe(0);
    });

    it('creates distortion waveshaper with 2x oversample and initial flat curve', () => {
      const shaper = (bridge.createWaveShaper as jest.Mock).mock.results[0].value as MockNode;
      expect(shaper.oversample).toBe('2x');
      expect(shaper.curve).not.toBeNull();
      expect(shaper.curve!.length).toBe(1024);
    });

    it('distortion output starts at 0', () => {
      const outGain = (bridge.createMasterGain as jest.Mock).mock.results[2].value as MockNode;
      expect(outGain.gain).toBe(0);
    });
  });

  describe('start', () => {
    it('creates a pink noise source, loops it, and starts', () => {
      proc.start();
      expect(bridge.createStaticSource).toHaveBeenCalledWith(ctx, 'pink');
      const src = (bridge.createStaticSource as jest.Mock).mock.results[0].value as MockNode;
      expect(src.loop).toBe(true);
      expect(src.started).toBe(true);
    });

    it('isActive returns true after start', () => {
      expect(proc.isActive()).toBe(false);
      proc.start();
      expect(proc.isActive()).toBe(true);
    });

    it('start is idempotent — does not create a second source', () => {
      proc.start();
      proc.start();
      expect(bridge.createStaticSource as jest.Mock).toHaveBeenCalledTimes(1);
    });
  });

  describe('update — high sanity (no distortion)', () => {
    it('sanity 100 → zero whisper target, zero distortion', () => {
      proc.start();
      const update: SanityAudioUpdate = {
        sanity: 100,
        weatherStaticAdd: 0,
        weatherClarityMultiplier: 1.0,
      };
      proc.update(update);
      const whisperGain = (bridge.createMasterGain as jest.Mock).mock.results[0].value as MockNode;
      // No warble tick yet — gain stays at initial 0
      expect(whisperGain.gain).toBe(0);
      const distOut = (bridge.createMasterGain as jest.Mock).mock.results[2].value as MockNode;
      expect(distOut.gain).toBe(0);
    });
  });

  describe('update — low sanity (distortion active)', () => {
    it('sanity 0, clear weather → max whisper target and nonzero distortion gain', () => {
      proc.start();
      proc.update({ sanity: 0, weatherStaticAdd: 0, weatherClarityMultiplier: 1.0 });
      const distOut = (bridge.createMasterGain as jest.Mock).mock.results[2].value as MockNode;
      expect(distOut.gain).toBeGreaterThan(0);
      // After a warble tick, whisper gain should be set
      jest.advanceTimersByTime(60);
      const whisperGain = (bridge.createMasterGain as jest.Mock).mock.results[0].value as MockNode;
      expect(whisperGain.gain).toBeGreaterThan(0);
    });

    it('sanity 0 + storm weather → higher distortion than clear weather', () => {
      proc.start();
      // Clear weather
      proc.update({ sanity: 0, weatherStaticAdd: 0, weatherClarityMultiplier: 1.0 });
      const distOutClear = (bridge.createMasterGain as jest.Mock).mock.results[2].value as MockNode;
      const clearGain = distOutClear.gain;

      // Storm weather
      proc.update({ sanity: 0, weatherStaticAdd: 20, weatherClarityMultiplier: 0.8 });
      const distOutStorm = (bridge.createMasterGain as jest.Mock).mock.results[2].value as MockNode;
      expect(distOutStorm.gain).toBeGreaterThanOrEqual(clearGain);
    });

    it('distortion waveshaper curve is updated on update()', () => {
      proc.start();
      proc.update({ sanity: 10, weatherStaticAdd: 0, weatherClarityMultiplier: 1.0 });
      const shaper = (bridge.createWaveShaper as jest.Mock).mock.results[0].value as MockNode;
      expect(shaper.curve).not.toBeNull();
      // Curve should differ from flat (non-zero amount)
      const flat = new Float32Array(1024);
      const isDifferent = Array.from(shaper.curve!).some((v, i) => v !== flat[i]);
      expect(isDifferent).toBe(true);
    });
  });

  describe('warble modulation', () => {
    it('whisper gain oscillates over time at low sanity', () => {
      proc.start();
      proc.update({ sanity: 0, weatherStaticAdd: 0, weatherClarityMultiplier: 1.0 });
      const whisperGain = (bridge.createMasterGain as jest.Mock).mock.results[0].value as MockNode;

      const gains: number[] = [];
      for (let i = 0; i < 20; i++) {
        jest.advanceTimersByTime(50);
        gains.push(whisperGain.gain);
      }
      // Not all values identical → oscillating
      const unique = new Set(gains);
      expect(unique.size).toBeGreaterThan(1);
      // All gains non-negative
      for (const g of gains) {
        expect(g).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('fadeOut', () => {
    it('ramps whisper and distortion gain toward 0 over the fade duration', () => {
      proc.start();
      proc.update({ sanity: 0, weatherStaticAdd: 20, weatherClarityMultiplier: 0.8 });
      jest.advanceTimersByTime(100); // let warble set a nonzero gain

      const whisperGain = (bridge.createMasterGain as jest.Mock).mock.results[0].value as MockNode;
      const distOut = (bridge.createMasterGain as jest.Mock).mock.results[2].value as MockNode;
      const startWhisper = whisperGain.gain;
      const startDist = distOut.gain;

      proc.fadeOut(0.5); // 500ms
      // advance past the fade duration (500ms / 50ms = 10 ticks)
      jest.advanceTimersByTime(600);

      expect(whisperGain.gain).toBe(0);
      expect(distOut.gain).toBe(0);
      expect(startWhisper).toBeGreaterThan(0);
      expect(startDist).toBeGreaterThan(0);
    });

    it('stops the warble timer during fadeOut', () => {
      proc.start();
      proc.update({ sanity: 0, weatherStaticAdd: 10, weatherClarityMultiplier: 0.9 });
      proc.fadeOut(0.3);
      const whisperGain = (bridge.createMasterGain as jest.Mock).mock.results[0].value as MockNode;
      const beforeFade = whisperGain.gain;
      // advance well past fade — no more warble ticks should fire
      jest.advanceTimersByTime(2000);
      // gain stays at 0 (set at end of fade)
      expect(whisperGain.gain).toBe(0);
      expect(beforeFade).toBeGreaterThanOrEqual(0);
    });
  });

  describe('dispose', () => {
    it('stops the whisper source and clears timers', () => {
      proc.start();
      const src = (bridge.createStaticSource as jest.Mock).mock.results[0].value as MockNode;
      proc.dispose();
      expect(src.stopped).toBe(true);
      expect(proc.isActive()).toBe(false);
    });

    it('dispose is idempotent', () => {
      proc.start();
      proc.dispose();
      expect(() => proc.dispose()).not.toThrow();
    });

    it('update after dispose is a no-op', () => {
      proc.start();
      proc.dispose();
      const distOut = (bridge.createMasterGain as jest.Mock).mock.results[2].value as MockNode;
      const before = distOut.gain;
      proc.update({ sanity: 0, weatherStaticAdd: 20, weatherClarityMultiplier: 0.8 });
      expect(distOut.gain).toBe(before);
    });

    it('start after dispose is a no-op', () => {
      proc.dispose();
      proc.start();
      // Should NOT create a new source after dispose
      expect(bridge.createStaticSource as jest.Mock).not.toHaveBeenCalled();
    });
  });
});
