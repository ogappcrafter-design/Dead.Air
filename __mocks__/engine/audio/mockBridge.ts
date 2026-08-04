// __mocks__/engine/audio/mockBridge.ts
// Mock PlatformBridge — captures all node ops + state for test assertions.

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
} from '../../../engine/audio/PlatformBridge';

type OpLog = Array<{ kind: string; args: unknown[] }>;

export interface MockNode extends BridgeAudioNode {
  readonly id: number;
  readonly ops: OpLog;
}

interface MockGain extends MockNode, BridgeGainNode {
  lastGain: number | null;
}
interface MockBufferSource extends MockNode, BridgeBufferSourceNode {
  lastLoop: boolean | null;
  started: boolean;
}
interface MockBiquad extends MockNode, BridgeBiquadNode {
  lastType: string | null;
  lastFreq: number | null;
  lastQ: number | null;
  lastGain: number | null;
}
interface MockShaper extends MockNode, BridgeWaveShaperNode {
  lastCurve: Float32Array | null;
  lastOversample: string | null;
}
interface MockConvolver extends MockNode, BridgeConvolverNode {
  lastBuffer: BridgeAudioBuffer | null;
}
interface MockPanner extends MockNode, BridgeStereoPannerNode {
  lastPan: number | null;
}
interface MockCompressor extends MockNode, BridgeDynamicsCompressorNode {
  lastThreshold: number | null;
  lastRatio: number | null;
}

let nodeCounter = 0;
const nextId = (): number => {
  nodeCounter += 1;
  return nodeCounter;
};

// Reset between tests
export const resetMockBridge = (): void => {
  nodeCounter = 0;
};

const makeNode = (kind: string): MockNode => ({
  id: nextId(),
  kind,
  ops: [],
  disconnect(): void {
    this.ops.push({ kind: 'disconnect', args: [] });
  },
});

export const makeMockBridge = (platform: 'web' | 'native' = 'web'): PlatformBridge => {
  const ctx: BridgeAudioContext = {
    sampleRate: 44100,
    currentTime: 0,
    state: 'running',
    async resume(): Promise<void> {},
    async suspend(): Promise<void> {},
    async close(): Promise<void> {},
  };

  return {
    platform,
    createContext: jest.fn(async (): Promise<BridgeAudioContext> => ctx),
    createMasterGain: jest.fn((_c: BridgeAudioContext): MockGain => {
      const n = makeNode('gain') as MockGain;
      n.lastGain = null;
      n.setGain = (v: number) => {
        n.lastGain = v;
        n.ops.push({ kind: 'setGain', args: [v] });
      };
      return n;
    }),
    createStaticSource: jest.fn(
      (_c: BridgeAudioContext, _ch: StaticCharacter): MockBufferSource => {
        const n = makeNode('source') as MockBufferSource;
        n.lastLoop = null;
        n.started = false;
        n.start = (when?: number) => {
          n.started = true;
          n.ops.push({ kind: 'start', args: [when] });
        };
        n.stop = (when?: number) => {
          n.started = false;
          n.ops.push({ kind: 'stop', args: [when] });
        };
        n.setLoop = (loop: boolean) => {
          n.lastLoop = loop;
          n.ops.push({ kind: 'setLoop', args: [loop] });
        };
        n.connect = (target: BridgeAudioNode) => {
          n.ops.push({
            kind: 'connect',
            args: [(target as MockNode).id, (target as MockNode).kind],
          });
        };
        return n;
      },
    ),
    createBiquad: jest.fn((_c: BridgeAudioContext, type: string): MockBiquad => {
      const n = makeNode('biquad') as MockBiquad;
      n.lastType = type;
      n.lastFreq = null;
      n.lastQ = null;
      n.lastGain = null;
      n.setType = (t: string) => {
        n.lastType = t;
        n.ops.push({ kind: 'setType', args: [t] });
      };
      n.setFrequency = (v: number) => {
        n.lastFreq = v;
        n.ops.push({ kind: 'setFrequency', args: [v] });
      };
      n.setQ = (v: number) => {
        n.lastQ = v;
        n.ops.push({ kind: 'setQ', args: [v] });
      };
      n.setGain = (v: number) => {
        n.lastGain = v;
        n.ops.push({ kind: 'setGain', args: [v] });
      };
      n.connect = (target: BridgeAudioNode) => {
        n.ops.push({ kind: 'connect', args: [(target as MockNode).id, (target as MockNode).kind] });
      };
      return n;
    }),
    createWaveShaper: jest.fn((_c: BridgeAudioContext): MockShaper => {
      const n = makeNode('shaper') as MockShaper;
      n.lastCurve = null;
      n.lastOversample = null;
      n.setCurve = (c: Float32Array) => {
        n.lastCurve = c;
        n.ops.push({ kind: 'setCurve', args: [c.length] });
      };
      n.setOversample = (v: string) => {
        n.lastOversample = v;
        n.ops.push({ kind: 'setOversample', args: [v] });
      };
      n.connect = (target: BridgeAudioNode) => {
        n.ops.push({ kind: 'connect', args: [(target as MockNode).id, (target as MockNode).kind] });
      };
      return n;
    }),
    createConvolver: jest.fn((_c: BridgeAudioContext): MockConvolver => {
      const n = makeNode('convolver') as MockConvolver;
      n.lastBuffer = null;
      n.setBuffer = (b: BridgeAudioBuffer) => {
        n.lastBuffer = b;
        n.ops.push({ kind: 'setBuffer', args: [b] });
      };
      n.connect = (target: BridgeAudioNode) => {
        n.ops.push({ kind: 'connect', args: [(target as MockNode).id, (target as MockNode).kind] });
      };
      return n;
    }),
    createStereoPanner: jest.fn((_c: BridgeAudioContext): MockPanner => {
      const n = makeNode('panner') as MockPanner;
      n.lastPan = null;
      n.setPan = (v: number) => {
        n.lastPan = v;
        n.ops.push({ kind: 'setPan', args: [v] });
      };
      n.connect = (target: BridgeAudioNode) => {
        n.ops.push({ kind: 'connect', args: [(target as MockNode).id, (target as MockNode).kind] });
      };
      return n;
    }),
    createCompressor: jest.fn((_c: BridgeAudioContext): MockCompressor => {
      const n = makeNode('compressor') as MockCompressor;
      n.lastThreshold = null;
      n.lastRatio = null;
      n.setThreshold = (v: number) => {
        n.lastThreshold = v;
        n.ops.push({ kind: 'setThreshold', args: [v] });
      };
      ((n.setKnee = (_v: number) => {}),
        (n.setRatio = (v: number) => {
          n.lastRatio = v;
          n.ops.push({ kind: 'setRatio', args: [v] });
        }));
      ((n.setAttack = (_v: number) => {}),
        (n.setRelease = (_v: number) => {}),
        (n.connect = (target: BridgeAudioNode) => {
          n.ops.push({
            kind: 'connect',
            args: [(target as MockNode).id, (target as MockNode).kind],
          });
        }));
      return n;
    }),
    createReverbBuffer: jest.fn(
      (_c: BridgeAudioContext, _dur: number, _dec: number): BridgeAudioBuffer => ({
        duration: 2.4,
        numberOfChannels: 2,
        length: 102400,
      }),
    ),
    createNoiseBuffer: jest.fn(
      (_c: BridgeAudioContext, _ch: StaticCharacter, _dur: number): BridgeAudioBuffer => ({
        duration: _dur,
        numberOfChannels: 1,
        length: 44100 * _dur,
      }),
    ),
    decodeAudio: jest.fn(
      async (_c: BridgeAudioContext, _d: ArrayBuffer | string): Promise<BridgeAudioBuffer> => ({
        duration: 1,
        numberOfChannels: 1,
        length: 44100,
      }),
    ),
    connect: jest.fn((_src: BridgeAudioNode, _dst: BridgeAudioNode): void => {}),
    connectToDestination: jest.fn((_src: BridgeAudioNode, _c: BridgeAudioContext): void => {}),
    disconnectAll: jest.fn((_n: BridgeAudioNode): void => {}),
  };
};
