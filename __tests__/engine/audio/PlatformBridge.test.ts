// __tests__/engine/audio/PlatformBridge.test.ts
import {
  bandStaticCharacter,
  bandVoicePreset,
  isWebBridge,
  isNativeBridge,
  StaticCharacter,
  VoicePreset,
} from '../../../engine/audio/PlatformBridge';
import { makeMockBridge } from '../../../__mocks__/engine/audio/mockBridge';
import { Band } from '../../../lib/constants';

describe('PlatformBridge contract', () => {
  describe('bandStaticCharacter', () => {
    it('maps LIVING → white', () => {
      expect(bandStaticCharacter('LIVING')).toBe('white');
    });
    it('maps LIMINAL → pink', () => {
      expect(bandStaticCharacter('LIMINAL')).toBe('pink');
    });
    it('maps LOST → brown', () => {
      expect(bandStaticCharacter('LOST')).toBe('brown');
    });
    it('maps CLASSIFIED → white', () => {
      expect(bandStaticCharacter('CLASSIFIED')).toBe('white');
    });
    it('maps ████████ → pink', () => {
      expect(bandStaticCharacter('████████')).toBe('pink');
    });
    it('covers all 5 bands', () => {
      const bands: Band[] = ['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED', '████████'];
      for (const b of bands) {
        const c = bandStaticCharacter(b);
        expect(['white', 'pink', 'brown']).toContain(c);
      }
    });
  });

  describe('bandVoicePreset', () => {
    it('maps LIVING → LIVING preset', () => {
      expect(bandVoicePreset('LIVING')).toBe('LIVING');
    });
    it('maps ████████ → REDACTED preset', () => {
      expect(bandVoicePreset('████████')).toBe('REDACTED');
    });
    it('covers all 5 bands', () => {
      const bands: Band[] = ['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED', '████████'];
      for (const b of bands) {
        const p = bandVoicePreset(b);
        expect(['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED', 'REDACTED']).toContain(p);
      }
    });
  });

  describe('isWebBridge / isNativeBridge', () => {
    it('isWebBridge true for web bridge', () => {
      const b = makeMockBridge('web');
      expect(isWebBridge(b)).toBe(true);
      expect(isNativeBridge(b)).toBe(false);
    });
    it('isNativeBridge true for native bridge', () => {
      const b = makeMockBridge('native');
      expect(isWebBridge(b)).toBe(false);
      expect(isNativeBridge(b)).toBe(true);
    });
  });

  describe('mock bridge', () => {
    it('provides a context with required fields', async () => {
      const b = makeMockBridge('web');
      const ctx = await b.createContext();
      expect(ctx.sampleRate).toBe(44100);
      expect(ctx.state).toBe('running');
      expect(typeof ctx.resume).toBe('function');
      expect(typeof ctx.suspend).toBe('function');
      expect(typeof ctx.close).toBe('function');
    });

    it('createMasterGain returns setter', () => {
      const b = makeMockBridge('web');
      const gain = b.createMasterGain({
        sampleRate: 44100,
        currentTime: 0,
        state: 'running',
        async resume() {},
        async suspend() {},
        async close() {},
      });
      gain.setGain(0.5);
      // gain node mock captures last value
      expect(typeof gain.disconnect).toBe('function');
    });

    it('createBiquad returns setter', () => {
      const b = makeMockBridge('web');
      const mockCtx = {
        sampleRate: 44100,
        currentTime: 0,
        state: 'running' as const,
        async resume() {},
        async suspend() {},
        async close() {},
      };
      const n = b.createBiquad(mockCtx, 'bandpass');
      n.setFrequency(2000);
      n.setQ(1.5);
      n.setGain(3);
      expect(typeof n.disconnect).toBe('function');
    });
  });
});
