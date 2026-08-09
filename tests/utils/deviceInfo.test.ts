// tests/utils/deviceInfo.test.ts
import {
  getDeviceCapabilities,
  getPerformanceTier,
  getRecommendedSettings,
  resetDeviceCache,
  type DeviceCapabilities,
} from '@/utils/deviceInfo';

describe('deviceInfo', () => {
  beforeEach(() => {
    resetDeviceCache();
  });

  describe('getDeviceCapabilities', () => {
    it('returns fallback capabilities when expo-device is unavailable', () => {
      const caps = getDeviceCapabilities();
      expect(caps).toBeDefined();
      expect(caps.cpuCores).toBeGreaterThan(0);
      expect(caps.memoryBytes).toBeGreaterThan(0);
      expect(typeof caps.modelName).toBe('string');
      expect(typeof caps.platform).toBe('string');
      expect(typeof caps.isRealData).toBe('boolean');
    });

    it('caches results across calls', () => {
      const first = getDeviceCapabilities();
      const second = getDeviceCapabilities();
      expect(second).toBe(first);
    });

    it('returns a fresh object after cache reset', () => {
      const first = getDeviceCapabilities();
      resetDeviceCache();
      const second = getDeviceCapabilities();
      expect(second).not.toBe(first);
      expect(second.cpuCores).toBe(first.cpuCores);
    });
  });

  describe('getPerformanceTier', () => {
    it('returns "low" for <4 cores', () => {
      const caps: DeviceCapabilities = {
        cpuCores: 2,
        memoryBytes: 8 * 1024 * 1024 * 1024,
        modelName: 'test',
        platform: 'ios',
        isRealData: true,
      };
      expect(getPerformanceTier(caps)).toBe('low');
    });

    it('returns "low" for <2GB RAM', () => {
      const caps: DeviceCapabilities = {
        cpuCores: 8,
        memoryBytes: 1 * 1024 * 1024 * 1024,
        modelName: 'test',
        platform: 'android',
        isRealData: true,
      };
      expect(getPerformanceTier(caps)).toBe('low');
    });

    it('returns "mid" for 4-6 cores with adequate RAM', () => {
      const caps: DeviceCapabilities = {
        cpuCores: 4,
        memoryBytes: 3 * 1024 * 1024 * 1024,
        modelName: 'test',
        platform: 'ios',
        isRealData: true,
      };
      expect(getPerformanceTier(caps)).toBe('mid');
    });

    it('returns "high" for 6+ cores AND 4GB+ RAM', () => {
      const caps: DeviceCapabilities = {
        cpuCores: 8,
        memoryBytes: 8 * 1024 * 1024 * 1024,
        modelName: 'test',
        platform: 'ios',
        isRealData: true,
      };
      expect(getPerformanceTier(caps)).toBe('high');
    });

    it('returns "mid" not "high" when only cores are high but RAM is <4GB', () => {
      const caps: DeviceCapabilities = {
        cpuCores: 8,
        memoryBytes: 3 * 1024 * 1024 * 1024,
        modelName: 'test',
        platform: 'android',
        isRealData: true,
      };
      expect(getPerformanceTier(caps)).toBe('mid');
    });
  });

  describe('getRecommendedSettings', () => {
    it('returns off/false/low for low tier', () => {
      const settings = getRecommendedSettings('low');
      expect(settings.scanlineDensity).toBe('off');
      expect(settings.particleEffects).toBe(false);
      expect(settings.audioQuality).toBe('low');
    });

    it('returns reduced/false/balanced for mid tier', () => {
      const settings = getRecommendedSettings('mid');
      expect(settings.scanlineDensity).toBe('reduced');
      expect(settings.particleEffects).toBe(false);
      expect(settings.audioQuality).toBe('balanced');
    });

    it('returns full/true/high for high tier', () => {
      const settings = getRecommendedSettings('high');
      expect(settings.scanlineDensity).toBe('full');
      expect(settings.particleEffects).toBe(true);
      expect(settings.audioQuality).toBe('high');
    });
  });
});
