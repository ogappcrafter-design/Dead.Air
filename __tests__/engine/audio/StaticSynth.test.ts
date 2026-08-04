// __tests__/engine/audio/StaticSynth.test.ts
import {
  StaticSynth,
  characterCenterFreq,
  intensityToQ,
  intensityToBandwidth,
  intensityToDrive,
  makeDriveCurve,
} from '../../../engine/audio/StaticSynth';
import { makeMockBridge } from '../../../__mocks__/engine/audio/mockBridge';
import {
  PlatformBridge,
  BridgeAudioContext,
  BridgeAudioNode,
} from '../../../engine/audio/PlatformBridge';

const mockCtx = (): BridgeAudioContext => ({
  sampleRate: 44100,
  currentTime: 0,
  state: 'running',
  async resume() {},
  async suspend() {},
  async close() {},
});

describe('StaticSynth', () => {
  let bridge: PlatformBridge;
  let ctx: BridgeAudioContext;
  let sink: BridgeAudioNode;

  beforeEach(() => {
    bridge = makeMockBridge();
    ctx = mockCtx();
    sink = bridge.createMasterGain(ctx);
  });

  describe('pure-logic mappings', () => {
    it('characterCenterFreq returns distinct freqs per character', () => {
      expect(characterCenterFreq.white).toBe(6000);
      expect(characterCenterFreq.pink).toBe(3000);
      expect(characterCenterFreq.brown).toBe(800);
    });
    it('intensityToQ spans [0.7, 5.0]', () => {
      expect(intensityToQ(0)).toBeCloseTo(0.7);
      expect(intensityToQ(1)).toBeCloseTo(5.0);
      expect(intensityToQ(0.5)).toBeCloseTo(2.85);
    });
    it('intensityToQ clamps outside [0,1]', () => {
      expect(intensityToQ(-1)).toBeCloseTo(0.7);
      expect(intensityToQ(2)).toBeCloseTo(5.0);
    });
    it('intensityToBandwidth is widest at 0, narrowest at 1', () => {
      const wide = intensityToBandwidth(0, 1000);
      const narrow = intensityToBandwidth(1, 1000);
      expect(wide).toBeCloseTo(700);
      expect(narrow).toBeCloseTo(50);
    });
    it('intensityToBandwidth clamps intensity', () => {
      expect(intensityToBandwidth(-1, 1000)).toBeCloseTo(700);
      expect(intensityToBandwidth(2, 1000)).toBeCloseTo(50);
    });
    it('intensityToDrive is identity in [0,1]', () => {
      expect(intensityToDrive(0.42)).toBeCloseTo(0.42);
    });
    it('intensityToDrive clamps', () => {
      expect(intensityToDrive(-1)).toBe(0);
      expect(intensityToDrive(2)).toBe(1);
    });
    it('makeDriveCurve returns Float32Array of given length', () => {
      const c = makeDriveCurve(0.5, 512);
      expect(c.length).toBe(512);
      expect(c).toBeInstanceOf(Float32Array);
    });
    it('makeDriveCurve midpoint is near 0 (x ~= 0)', () => {
      const c = makeDriveCurve(0.5, 1024);
      const mid = c[512];
      expect(mid).toBeDefined();
      // x at index 512 of 1024 samples: (512/1023)*2 - 1 ≈ 0.00098 — tanh small ≈ small.
      expect(mid as number).toBeCloseTo(0, 1);
    });
    it('makeDriveCurve endpoints are tanh-bounded', () => {
      const c = makeDriveCurve(0.5, 1024);
      // x=-1 → tanh(-k), x=+1 → tanh(k)
      const first = c[0];
      const last = c[1023];
      expect(first).toBeDefined();
      expect(last).toBeDefined();
      expect(first as number).toBeLessThan(0);
      expect(last as number).toBeGreaterThan(0);
      expect(Math.abs(first as number)).toBeLessThanOrEqual(1);
      expect(Math.abs(last as number)).toBeLessThanOrEqual(1);
    });
    it('higher drive yields harder clip', () => {
      const soft = makeDriveCurve(0.1, 1024);
      const hard = makeDriveCurve(1, 1024);
      // Higher k pushes toward ±1 more aggressively
      const softMid = Math.abs(soft[256] as number); // x=-0.5
      const hardMid = Math.abs(hard[256] as number);
      expect(hardMid).toBeGreaterThan(softMid);
    });
  });

  describe('lifecycle', () => {
    it('starts not playing', () => {
      const s = new StaticSynth(bridge, ctx, sink);
      expect(s.isStarted()).toBe(false);
      expect(s.getCharacter()).toBe('white');
      expect(s.getIntensity()).toBe(0.5);
    });

    it('start triggers source creation + connect + loop', () => {
      const s = new StaticSynth(bridge, ctx, sink);
      s.start();
      expect(bridge.createStaticSource).toHaveBeenCalledTimes(1);
      expect(s.isStarted()).toBe(true);
    });

    it('start is idempotent', () => {
      const s = new StaticSynth(bridge, ctx, sink);
      s.start();
      s.start();
      expect(bridge.createStaticSource).toHaveBeenCalledTimes(1);
    });

    it('stop clears source', () => {
      const s = new StaticSynth(bridge, ctx, sink);
      s.start();
      s.stop();
      expect(s.isStarted()).toBe(false);
    });

    it('stop is no-op when not started', () => {
      const s = new StaticSynth(bridge, ctx, sink);
      s.stop();
      expect(s.isStarted()).toBe(false);
    });

    it('setIntensity updates current intensity (clamped)', () => {
      const s = new StaticSynth(bridge, ctx, sink);
      s.setIntensity(0.8);
      expect(s.getIntensity()).toBeCloseTo(0.8);
      s.setIntensity(-1);
      expect(s.getIntensity()).toBe(0);
      s.setIntensity(2);
      expect(s.getIntensity()).toBe(1);
    });

    it('setCharacter updates band-pass filter freq', () => {
      const s = new StaticSynth(bridge, ctx, sink);
      s.setCharacter('brown');
      expect(s.getCharacter()).toBe('brown');
    });

    it('setCharacter is no-op when same', () => {
      const s = new StaticSynth(bridge, ctx, sink);
      s.setCharacter('white');
      expect(bridge.createStaticSource).not.toHaveBeenCalled();
    });

    it('setCharacter restarts source when started', () => {
      const s = new StaticSynth(bridge, ctx, sink);
      s.start();
      expect(bridge.createStaticSource).toHaveBeenCalledTimes(1);
      s.setCharacter('pink');
      expect(bridge.createStaticSource).toHaveBeenCalledTimes(2);
      expect(s.getCharacter()).toBe('pink');
      expect(s.isStarted()).toBe(true);
    });

    it('setCharacter does not start source when stopped', () => {
      const s = new StaticSynth(bridge, ctx, sink);
      s.setCharacter('brown');
      expect(bridge.createStaticSource).not.toHaveBeenCalled();
      expect(s.isStarted()).toBe(false);
    });

    it('dispose stops source if started', () => {
      const s = new StaticSynth(bridge, ctx, sink);
      s.start();
      s.dispose();
      expect(s.isStarted()).toBe(false);
    });

    it('dispose is safe when never started', () => {
      const s = new StaticSynth(bridge, ctx, sink);
      s.dispose();
      expect(s.isStarted()).toBe(false);
    });
  });
});
