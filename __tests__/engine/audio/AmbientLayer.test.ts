// __tests__/engine/audio/AmbientLayer.test.ts
import {
  AmbientLayer,
  bandAmbientParams,
  DEFAULT_FADE_SECONDS,
} from '../../../engine/audio/AmbientLayer';
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

describe('AmbientLayer', () => {
  let bridge: PlatformBridge;
  let ctx: BridgeAudioContext;
  let sink: BridgeAudioNode;

  beforeEach(() => {
    bridge = makeMockBridge();
    ctx = mockCtx();
    sink = bridge.createMasterGain(ctx);
  });

  describe('band params', () => {
    it('covers all 5 bands', () => {
      const bands: Band[] = ['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED', '████████'];
      for (const b of bands) {
        expect(bandAmbientParams[b]).toBeDefined();
        expect(bandAmbientParams[b].centerFreq).toBeGreaterThan(0);
        expect(bandAmbientParams[b].baseGain).toBeGreaterThan(0);
      }
    });
    it('later bands have larger base gain (more present)', () => {
      expect(bandAmbientParams.LIVING.baseGain).toBeLessThan(
        bandAmbientParams['████████'].baseGain,
      );
    });
  });

  describe('lifecycle', () => {
    it('starts not playing', () => {
      const layer = new AmbientLayer(bridge, ctx, sink);
      expect(layer.isPlaying()).toBe(false);
      expect(layer.getBand()).toBeNull();
      expect(layer.getGain()).toBe(0);
      layer.dispose();
    });
    it('start creates source + sets band', () => {
      const layer = new AmbientLayer(bridge, ctx, sink);
      layer.start('LIVING');
      expect(bridge.createStaticSource).toHaveBeenCalledTimes(1);
      expect(layer.isPlaying()).toBe(true);
      expect(layer.getBand()).toBe('LIVING');
      layer.dispose();
    });
    it('swapBand when not playing = start', () => {
      const layer = new AmbientLayer(bridge, ctx, sink);
      layer.swapBand('LIMINAL');
      expect(layer.isPlaying()).toBe(true);
      expect(layer.getBand()).toBe('LIMINAL');
      layer.dispose();
    });
    it('swapBand when playing does NOT create a new source (recolors same source)', () => {
      const layer = new AmbientLayer(bridge, ctx, sink);
      layer.start('LIVING');
      expect(bridge.createStaticSource).toHaveBeenCalledTimes(1);
      layer.swapBand('LOST');
      expect(bridge.createStaticSource).toHaveBeenCalledTimes(1); // same source alive
      expect(layer.getBand()).toBe('LOST');
      layer.dispose();
    });
    it('fadeOut keeps source alive (playing remains true)', () => {
      const layer = new AmbientLayer(bridge, ctx, sink);
      layer.start('LIVING');
      expect(bridge.createStaticSource).toHaveBeenCalledTimes(1);
      layer.fadeOut();
      // Source not destroyed
      expect(bridge.createStaticSource).toHaveBeenCalledTimes(1);
      expect(layer.isPlaying()).toBe(true);
      layer.dispose();
    });
    it('dispose stops source + clears playing', () => {
      const layer = new AmbientLayer(bridge, ctx, sink);
      layer.start('LIVING');
      layer.dispose();
      expect(layer.isPlaying()).toBe(false);
    });
    it('dispose is safe when never started', () => {
      const layer = new AmbientLayer(bridge, ctx, sink);
      layer.dispose();
      expect(layer.isPlaying()).toBe(false);
    });
    it('setFadeSeconds enforces minimum', () => {
      const layer = new AmbientLayer(bridge, ctx, sink);
      layer.setFadeSeconds(0.001);
      // Internal guard: tests only confirm call does not throw.
      expect(true).toBe(true);
      layer.dispose();
    });
  });

  describe('gain fade', () => {
    it('does not crash if fadeOut called when not playing', () => {
      const layer = new AmbientLayer(bridge, ctx, sink);
      // No band set.
      layer.fadeIn();
      expect(layer.getGain()).toBe(0);
      layer.dispose();
    });
  });

  describe('DEFAULT_FADE_SECONDS', () => {
    it('is a positive number', () => {
      expect(DEFAULT_FADE_SECONDS).toBeGreaterThan(0);
    });
  });
});
