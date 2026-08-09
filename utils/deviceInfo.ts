// utils/deviceInfo.ts
// Device capability detection for performance auto-tuning.
// Wraps expo-device with safe fallbacks for non-available fields,
// SSR / test environments, and platforms where expo-device is absent.

/**
 * Performance tier inferred from device capabilities.
 * - 'low': <4 cores OR <2GB RAM
 * - 'mid': 4-6 cores OR 2-4GB RAM
 * - 'high': 6+ cores AND 4GB+ RAM
 */
export type PerformanceTier = 'low' | 'mid' | 'high';

export interface DeviceCapabilities {
  /** Number of logical CPU cores. Defaults to 4 if unavailable. */
  cpuCores: number;
  /** Total device memory in bytes. Defaults to 4GB if unavailable. */
  memoryBytes: number;
  /** Device model name, or 'unknown'. */
  modelName: string;
  /** OS platform: 'ios' | 'android' | 'web' | 'unknown'. */
  platform: string;
  /** Whether the values are from real device info or fallbacks. */
  isRealData: boolean;
}

/** 1 GB in bytes — used for memory thresholds. */
const GB = 1024 * 1024 * 1024;

/** Fallback capabilities for environments where expo-device is unavailable. */
const FALLBACK_CAPABILITIES: DeviceCapabilities = {
  cpuCores: 4,
  memoryBytes: 4 * GB,
  modelName: 'unknown',
  platform: 'unknown',
  isRealData: false,
};

let cachedCapabilities: DeviceCapabilities | null = null;

/**
 * Detect device capabilities using expo-device. Falls back to safe defaults
 * when expo-device is not available (SSR, test env, missing native module).
 * Results are cached after the first call.
 */
export function getDeviceCapabilities(): DeviceCapabilities {
  if (cachedCapabilities) {
    return cachedCapabilities;
  }

  try {
    // Dynamic require so this doesn't crash in environments without the native module.
    // Using require() is intentional — expo-device may not be linked in all contexts.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require('expo-device');

    const platform =
      Device.osName ?? (typeof Device.platform === 'string' ? Device.platform : 'unknown');

    const cpuCores =
      typeof Device.processorCount === 'number' && Device.processorCount > 0
        ? Device.processorCount
        : 4;

    const memoryBytes =
      typeof Device.totalMemory === 'number' && Device.totalMemory > 0
        ? Device.totalMemory
        : 4 * GB;

    const modelName = Device.modelName ?? 'unknown';

    cachedCapabilities = {
      cpuCores,
      memoryBytes,
      modelName,
      platform,
      isRealData: true,
    };
    return cachedCapabilities;
  } catch {
    cachedCapabilities = { ...FALLBACK_CAPABILITIES };
    return cachedCapabilities;
  }
}

/**
 * Classify the device into a performance tier based on CPU + memory.
 *
 * Thresholds:
 * - low:   <4 cores OR <2GB RAM
 * - mid:   4-6 cores OR 2-4GB RAM
 * - high:  6+ cores AND 4GB+ RAM
 */
export function getPerformanceTier(caps?: DeviceCapabilities): PerformanceTier {
  const c = caps ?? getDeviceCapabilities();
  const memGB = c.memoryBytes / GB;

  if (c.cpuCores >= 6 && memGB >= 4) {
    return 'high';
  }
  if (c.cpuCores < 4 || memGB < 2) {
    return 'low';
  }
  return 'mid';
}

/**
 * Recommended performance settings for a tier.
 * Returns the initial values for scanlineDensity, particleEffects, audioQuality.
 */
export function getRecommendedSettings(tier?: PerformanceTier): {
  scanlineDensity: ScanlineMode;
  particleEffects: boolean;
  audioQuality: AudioQuality;
} {
  const t = tier ?? getPerformanceTier();
  switch (t) {
    case 'low':
      return { scanlineDensity: 'off', particleEffects: false, audioQuality: 'low' };
    case 'mid':
      return {
        scanlineDensity: 'reduced',
        particleEffects: false,
        audioQuality: 'balanced',
      };
    case 'high':
      return { scanlineDensity: 'full', particleEffects: true, audioQuality: 'high' };
  }
}

// Re-export ScanlineMode and AudioQuality types so consumers can import from one place.
export type ScanlineMode = 'full' | 'reduced' | 'off';
export type AudioQuality = 'low' | 'balanced' | 'high';

/** Reset the capability cache — useful for tests. */
export function resetDeviceCache(): void {
  cachedCapabilities = null;
}
