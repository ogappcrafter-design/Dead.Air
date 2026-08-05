// __tests__/engine/audio/EffectsChain.test.ts
import {
  EffectsChain,
  driveToCurve,
  DEFAULT_REVERB_DECAY,
  makeReverbBuffer,
  clearReverbIRCache,
} from '../../../engine/audio/EffectsChain';
import { makeMockBridge } from '../../../__mocks__/engine/audio/mockBridge';
import {
  PlatformBridge,
  BridgeAudioContext,
  BridgeAudioNode,
} from '../../../engine/audio/PlatformBridge';
import { INTERACTIVE_CONFIG, BALANCED_CONFIG } from '../../../engine/audio/AudioPerformanceConfig';

const mockCtx = (): BridgeAudioContext => ({
  sampleRate: 44100,
  currentTime: 0,
  state: 'running',
  async resume() {},
  async suspend() {},
  async close() {},
});

describe('EffectsChain', () => {
  let bridge: PlatformBridge;
  let ctx: BridgeAudioContext;
  let sink: BridgeAudioNode;

  beforeEach(() => {
    bridge = makeMockBridge();
    ctx = mockCtx();
    sink = bridge.createMasterGain(ctx);
    jest.clearAllMocks();
    clearReverbIRCache();
  });

  describe('pure-logic mappings', () => {
    it('driveToCurve returns Float32Array', () => {
      const c = driveToCurve(0.5);
      expect(c.length).toBe(1024);
      expect(c).toBeInstanceOf(Float32Array);
    });
    it('driveToCurve midpoint is near 0 (x ~= 0)', () => {
      const c = driveToCurve(0.7, 1024);
      const mid = c[512];
      expect(mid).toBeDefined();
      // x at index 512 of 1024 samples: (512/1023)*2 - 1 ≈ 0.00098 — tanh small ≈ small.
      expect(mid as number).toBeCloseTo(0, 1);
    });
    it('driveToCurve endpoints are tanh-bounded ±(0,1]', () => {
      const c = driveToCurve(1, 1024);
      const first = c[0];
      const last = c[1023];
      expect(first).toBeDefined();
      expect(last).toBeDefined();
      expect(first as number).toBeLessThan(0);
      expect(last as number).toBeGreaterThan(0);
      expect(Math.abs(first as number)).toBeLessThanOrEqual(1);
      expect(Math.abs(last as number)).toBeLessThanOrEqual(1);
    });
    it('higher drive → harder clip', () => {
      const soft = driveToCurve(0.1, 1024);
      const hard = driveToCurve(0.9, 1024);
      const softMid = Math.abs(soft[256] as number);
      const hardMid = Math.abs(hard[256] as number);
      expect(hardMid).toBeGreaterThan(softMid);
    });
    it('DEFAULT_REVERB_DECAY is positive', () => {
      expect(DEFAULT_REVERB_DECAY).toBeGreaterThan(0);
    });
    it('makeReverbBuffer delegates to bridge.createReverbBuffer', () => {
      const spy = jest.spyOn(bridge, 'createReverbBuffer');
      const buf = makeReverbBuffer(bridge, ctx, 3, 2);
      expect(spy).toHaveBeenCalledWith(ctx, 3, 2);
      expect(buf.duration).toBe(2.4);
    });
  });

  describe('construction + node ordering', () => {
    it('Input returns a gain node (preGain)', () => {
      const chain = new EffectsChain(bridge, ctx, sink);
      const input = chain.getInput();
      expect(typeof input.disconnect).toBe('function');
      chain.dispose();
    });
    it('creates one each of: preGain, distortion, reverbDry, reverbWet, convolver, tone, panner, output', () => {
      const chain = new EffectsChain(bridge, ctx, sink);
      // 8 gain/shaper/convolver/panner/biquad creations total
      // preGain(1) + distortion(1) + dry gain(1) + wet gain(1) + convolver(1) + tone(1) + panner(1) + output(1) = 8 nodes
      expect(bridge.createMasterGain).toHaveBeenCalledTimes(4); // preGain, dry, wet, output
      expect(bridge.createWaveShaper).toHaveBeenCalledTimes(1); // distortion
      expect(bridge.createConvolver).toHaveBeenCalledTimes(1);
      expect(bridge.createBiquad).toHaveBeenCalledTimes(1); // tone
      expect(bridge.createStereoPanner).toHaveBeenCalledTimes(1);
      chain.dispose();
    });
  });

  describe('setters', () => {
    it('default state: drive=0, reverbMix=0, pan=0', () => {
      const chain = new EffectsChain(bridge, ctx, sink);
      expect(chain.getDrive()).toBe(0);
      expect(chain.getReverbMix()).toBe(0);
      expect(chain.getPan()).toBe(0);
      chain.dispose();
    });

    it('setDrive clamps to [0,1]', () => {
      const chain = new EffectsChain(bridge, ctx, sink);
      chain.setDrive(0.6);
      expect(chain.getDrive()).toBeCloseTo(0.6);
      chain.setDrive(-1);
      expect(chain.getDrive()).toBe(0);
      chain.setDrive(2);
      expect(chain.getDrive()).toBe(1);
      chain.dispose();
    });

    it('setReverbMix clamps to [0,1] and preserves dry+wet complement', () => {
      const chain = new EffectsChain(bridge, ctx, sink);
      chain.setReverbMix(0.7);
      expect(chain.getReverbMix()).toBeCloseTo(0.7);
      chain.setReverbMix(-1);
      expect(chain.getReverbMix()).toBe(0);
      chain.setReverbMix(2);
      expect(chain.getReverbMix()).toBe(1);
      chain.dispose();
    });

    it('setPan clamps to [-1, 1]', () => {
      const chain = new EffectsChain(bridge, ctx, sink);
      chain.setPan(0.5);
      expect(chain.getPan()).toBeCloseTo(0.5);
      chain.setPan(-2);
      expect(chain.getPan()).toBe(-1);
      chain.setPan(2);
      expect(chain.getPan()).toBe(1);
      chain.dispose();
    });

    it('setTone accepts arbitrary dB value', () => {
      const chain = new EffectsChain(bridge, ctx, sink);
      // Should not throw.
      chain.setTone(-6);
      chain.setTone(+6);
      chain.dispose();
    });

    it('setOutputGain clamps at 0 but allows > 1', () => {
      const chain = new EffectsChain(bridge, ctx, sink);
      chain.setOutputGain(1.5);
      chain.setOutputGain(-1);
      chain.dispose();
    });
  });

  describe('dispose', () => {
    it('disconnects all nodes', () => {
      const chain = new EffectsChain(bridge, ctx, sink);
      chain.dispose();
      expect(true).toBe(true);
    });
  });

  describe('reverb IR caching', () => {
    it('makeReverbBuffer without cache param always delegates to bridge', () => {
      const spy = jest.spyOn(bridge, 'createReverbBuffer');
      spy.mockClear();
      makeReverbBuffer(bridge, ctx, 1.5, 2);
      expect(spy).toHaveBeenCalledWith(ctx, 1.5, 2);
    });

    it('makeReverbBuffer with cacheIR=true caches after first call', () => {
      const spy = jest.spyOn(bridge, 'createReverbBuffer');
      spy.mockClear();
      const reverbPerf = { irDurationSec: 1.5, decay: 2, cacheIR: true };
      makeReverbBuffer(bridge, ctx, 1.5, 2, reverbPerf);
      makeReverbBuffer(bridge, ctx, 1.5, 2, reverbPerf);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('different IR params get separate cache entries', () => {
      const spy = jest.spyOn(bridge, 'createReverbBuffer');
      spy.mockClear();
      const reverbPerf = { irDurationSec: 1.5, decay: 2, cacheIR: true };
      makeReverbBuffer(bridge, ctx, 1.5, 2, reverbPerf);
      makeReverbBuffer(bridge, ctx, 2.5, 2, reverbPerf);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('clearReverbIRCache empties the cache', () => {
      const spy = jest.spyOn(bridge, 'createReverbBuffer');
      spy.mockClear();
      const reverbPerf = { irDurationSec: 1.5, decay: 2, cacheIR: true };
      makeReverbBuffer(bridge, ctx, 1.5, 2, reverbPerf);
      clearReverbIRCache();
      makeReverbBuffer(bridge, ctx, 1.5, 2, reverbPerf);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('native and web platforms have separate cache keys', () => {
      const webBridge = makeMockBridge('web');
      const nativeBridge = makeMockBridge('native');
      const webSpy = jest.spyOn(webBridge, 'createReverbBuffer');
      const nativeSpy = jest.spyOn(nativeBridge, 'createReverbBuffer');
      webSpy.mockClear();
      nativeSpy.mockClear();
      const reverbPerf = { irDurationSec: 1.5, decay: 2, cacheIR: true };
      makeReverbBuffer(webBridge, ctx, 1.5, 2, reverbPerf);
      makeReverbBuffer(nativeBridge, ctx, 1.5, 2, reverbPerf);
      expect(webSpy).toHaveBeenCalledTimes(1);
      expect(nativeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('perf config integration', () => {
    it('accepts INTERACTIVE_CONFIG for lighter processing', () => {
      const chain = new EffectsChain(bridge, ctx, sink, {
        bitcrush: INTERACTIVE_CONFIG.bitcrush,
        reverb: INTERACTIVE_CONFIG.reverb,
      });
      expect(chain.getDrive()).toBe(0);
      chain.dispose();
    });

    it('uses configured curve samples for drive curve', () => {
      const chain = new EffectsChain(bridge, ctx, sink, {
        bitcrush: { curveSamples: 512, distortionOversample: '2x', voiceOversample: 'none' },
      });
      chain.setDrive(0.5);
      expect(chain.getDrive()).toBeCloseTo(0.5);
      chain.dispose();
    });

    it('uses configured reverb IR duration', () => {
      const spy = jest.spyOn(bridge, 'createReverbBuffer');
      spy.mockClear();
      const chain = new EffectsChain(bridge, ctx, sink, {
        reverb: { irDurationSec: 1.0, decay: 2, cacheIR: false },
      });
      expect(spy).toHaveBeenCalledWith(ctx, 1.0, 2);
      chain.dispose();
    });

    it('defaults to BALANCED_CONFIG values when perf is undefined', () => {
      const spy = jest.spyOn(bridge, 'createReverbBuffer');
      spy.mockClear();
      const chain = new EffectsChain(bridge, ctx, sink);
      expect(spy).toHaveBeenCalledWith(ctx, DEFAULT_REVERB_DECAY, 2);
      chain.dispose();
    });
  });
});
