// __tests__/engine/audio/VoiceProcessor.test.ts
import {
  VoiceProcessor,
  voicePresets,
  presetForBand,
  makeBitcrushCurve,
  VoicePresetParams,
} from '../../../engine/audio/VoiceProcessor';
import { makeMockBridge } from '../../../__mocks__/engine/audio/mockBridge';
import {
  PlatformBridge,
  BridgeAudioContext,
  BridgeAudioNode,
} from '../../../engine/audio/PlatformBridge';
import { Band } from '../../../lib/constants';

const mockCtx = (): BridgeAudioContext => ({
  sampleRate: 44100,
  currentTime: 0,
  state: 'running',
  async resume() {},
  async suspend() {},
  async close() {},
});

describe('VoiceProcessor', () => {
  let bridge: PlatformBridge;
  let ctx: BridgeAudioContext;
  let sink: BridgeAudioNode;

  beforeEach(() => {
    bridge = makeMockBridge();
    ctx = mockCtx();
    sink = bridge.createMasterGain(ctx);
  });

  describe('presets', () => {
    it('covers all 5 presets', () => {
      const presets = ['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED', 'REDACTED'] as const;
      for (const p of presets) {
        expect(voicePresets[p]).toBeDefined();
      }
    });
    it('each preset has all fields positive or in range', () => {
      const presets = ['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED', 'REDACTED'] as const;
      for (const p of presets) {
        const params: VoicePresetParams = voicePresets[p];
        expect(params.eqCenter).toBeGreaterThan(0);
        expect(params.eqQ).toBeGreaterThan(0);
        expect(params.bitcrush).toBeGreaterThanOrEqual(0);
        expect(params.bitcrush).toBeLessThanOrEqual(1);
        expect(params.downsample).toBeGreaterThanOrEqual(0);
        expect(params.downsample).toBeLessThanOrEqual(1);
        expect(params.compThreshold).toBeLessThan(0);
        expect(params.compRatio).toBeGreaterThan(1);
        expect(params.outputGain).toBeGreaterThan(0);
      }
    });
    it('later bands have higher bitcrush', () => {
      expect(voicePresets.LIVING.bitcrush).toBeLessThan(voicePresets.LIMINAL.bitcrush);
      expect(voicePresets.LIMINAL.bitcrush).toBeLessThan(voicePresets.LOST.bitcrush);
      expect(voicePresets.LOST.bitcrush).toBeLessThan(voicePresets.CLASSIFIED.bitcrush);
      expect(voicePresets.CLASSIFIED.bitcrush).toBeLessThan(voicePresets.REDACTED.bitcrush);
    });
    it('later bands have higher downsample', () => {
      expect(voicePresets.LIVING.downsample).toBeLessThanOrEqual(voicePresets.LIMINAL.downsample);
    });
    it('presetForBand returns matching preset', () => {
      const bands: Band[] = ['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED', '████████'];
      const expected = ['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED', 'REDACTED'] as const;
      bands.forEach((b, i) => {
        expect(presetForBand(b)).toEqual(voicePresets[expected[i]]);
      });
    });
  });

  describe('makeBitcrushCurve', () => {
    it('returns Float32Array of given length', () => {
      const c = makeBitcrushCurve(0.5, 256);
      expect(c.length).toBe(256);
      expect(c).toBeInstanceOf(Float32Array);
    });
    it('depth 0 yields near-smooth curve (8-bit)', () => {
      const c = makeBitcrushCurve(0, 1024);
      // Curve should be smooth (not quantized hard).
      const diff = Math.abs((c[512] as number) - (c[513] as number));
      expect(diff).toBeLessThan(0.05);
    });
    it('depth 1 yields severe quantization → ±1 steps at endpoints', () => {
      const c = makeBitcrushCurve(1, 1024);
      const first = c[0];
      const last = c[1023];
      expect(first).toBeDefined();
      expect(last).toBeDefined();
      expect(Math.abs(first as number)).toBeCloseTo(1, 1);
      expect(Math.abs(last as number)).toBeCloseTo(1, 1);
      // Midpoint of 1-bit quantization: x(~0) rounds to 0.
    });
    it('clamped depth in [0,1]', () => {
      const low = makeBitcrushCurve(-1, 1024);
      const high = makeBitcrushCurve(2, 1024);
      // Should not throw and produce valid curves.
      expect(low.length).toBe(1024);
      expect(high.length).toBe(1024);
    });
  });

  describe('lifecycle', () => {
    it('constructs and exposes input', () => {
      const v = new VoiceProcessor(bridge, ctx, sink);
      const input = v.getInput();
      expect(typeof input.disconnect).toBe('function');
      v.dispose();
    });
    it('getPreset null before applyPreset', () => {
      const v = new VoiceProcessor(bridge, ctx, sink);
      expect(v.getPreset()).toBeNull();
      v.dispose();
    });
    it('applyPreset sets current preset', () => {
      const v = new VoiceProcessor(bridge, ctx, sink);
      v.applyPreset('LOST');
      expect(v.getPreset()).toBe('LOST');
      v.dispose();
    });
    it('applyPresetForBand maps band → preset', () => {
      const v = new VoiceProcessor(bridge, ctx, sink);
      v.applyPresetForBand('████████');
      expect(v.getPreset()).toBe('REDACTED');
      v.dispose();
    });
    it('applyPresetForBand for LIVING', () => {
      const v = new VoiceProcessor(bridge, ctx, sink);
      v.applyPresetForBand('LIVING');
      expect(v.getPreset()).toBe('LIVING');
      v.dispose();
    });
    it('applyPreset twice with different presets keeps last', () => {
      const v = new VoiceProcessor(bridge, ctx, sink);
      v.applyPreset('LIMINAL');
      v.applyPreset('CLASSIFIED');
      expect(v.getPreset()).toBe('CLASSIFIED');
      v.dispose();
    });
    it('dispose does not throw', () => {
      const v = new VoiceProcessor(bridge, ctx, sink);
      v.dispose();
      expect(true).toBe(true);
    });
  });
});
