// tests/store/settingsStore.performance.test.ts
import { useSettingsStore } from '@/store/useSettingsStore';

describe('useSettingsStore performance fields', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetSettings();
  });

  describe('initial state', () => {
    it('has scanlineDensity default to "full"', () => {
      expect(useSettingsStore.getState().scanlineDensity).toBe('full');
    });

    it('has particleEffects default to true', () => {
      expect(useSettingsStore.getState().particleEffects).toBe(true);
    });

    it('has audioQuality default to "balanced"', () => {
      expect(useSettingsStore.getState().audioQuality).toBe('balanced');
    });

    it('has autoDetectPerformance default to true', () => {
      expect(useSettingsStore.getState().autoDetectPerformance).toBe(true);
    });
  });

  describe('setScanlineDensity', () => {
    it('sets scanlineDensity to "reduced"', () => {
      useSettingsStore.getState().setScanlineDensity('reduced');
      expect(useSettingsStore.getState().scanlineDensity).toBe('reduced');
    });

    it('sets scanlineDensity to "off"', () => {
      useSettingsStore.getState().setScanlineDensity('off');
      expect(useSettingsStore.getState().scanlineDensity).toBe('off');
    });

    it('sets scanlineDensity back to "full"', () => {
      useSettingsStore.getState().setScanlineDensity('off');
      useSettingsStore.getState().setScanlineDensity('full');
      expect(useSettingsStore.getState().scanlineDensity).toBe('full');
    });
  });

  describe('setParticleEffects', () => {
    it('sets particleEffects to false', () => {
      useSettingsStore.getState().setParticleEffects(false);
      expect(useSettingsStore.getState().particleEffects).toBe(false);
    });

    it('sets particleEffects back to true', () => {
      useSettingsStore.getState().setParticleEffects(false);
      useSettingsStore.getState().setParticleEffects(true);
      expect(useSettingsStore.getState().particleEffects).toBe(true);
    });
  });

  describe('setAudioQuality', () => {
    it('sets audioQuality to "low"', () => {
      useSettingsStore.getState().setAudioQuality('low');
      expect(useSettingsStore.getState().audioQuality).toBe('low');
    });

    it('sets audioQuality to "high"', () => {
      useSettingsStore.getState().setAudioQuality('high');
      expect(useSettingsStore.getState().audioQuality).toBe('high');
    });

    it('sets audioQuality back to "balanced"', () => {
      useSettingsStore.getState().setAudioQuality('high');
      useSettingsStore.getState().setAudioQuality('balanced');
      expect(useSettingsStore.getState().audioQuality).toBe('balanced');
    });
  });

  describe('setAutoDetectPerformance', () => {
    it('sets autoDetectPerformance to false', () => {
      useSettingsStore.getState().setAutoDetectPerformance(false);
      expect(useSettingsStore.getState().autoDetectPerformance).toBe(false);
    });

    it('sets autoDetectPerformance back to true', () => {
      useSettingsStore.getState().setAutoDetectPerformance(false);
      useSettingsStore.getState().setAutoDetectPerformance(true);
      expect(useSettingsStore.getState().autoDetectPerformance).toBe(true);
    });
  });

  describe('resetSettings', () => {
    it('resets all performance fields to defaults', () => {
      useSettingsStore.getState().setScanlineDensity('off');
      useSettingsStore.getState().setParticleEffects(false);
      useSettingsStore.getState().setAudioQuality('low');
      useSettingsStore.getState().setAutoDetectPerformance(false);

      useSettingsStore.getState().resetSettings();

      expect(useSettingsStore.getState().scanlineDensity).toBe('full');
      expect(useSettingsStore.getState().particleEffects).toBe(true);
      expect(useSettingsStore.getState().audioQuality).toBe('balanced');
      expect(useSettingsStore.getState().autoDetectPerformance).toBe(true);
    });
  });

  describe('existing settings still work', () => {
    it('masterVolume still functions', () => {
      useSettingsStore.getState().setMasterVolume(0.5);
      expect(useSettingsStore.getState().masterVolume).toBe(0.5);
    });

    it('crtEnabled still functions', () => {
      useSettingsStore.getState().setCrtEnabled(false);
      expect(useSettingsStore.getState().crtEnabled).toBe(false);
    });

    it('reducedMotion still functions', () => {
      useSettingsStore.getState().setReducedMotion(true);
      expect(useSettingsStore.getState().reducedMotion).toBe(true);
    });
  });
});
