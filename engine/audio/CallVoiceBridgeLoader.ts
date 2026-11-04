// engine/audio/CallVoiceBridgeLoader.ts
// Lazy bridge loader for the DEA-94 call voice.
//
// Platform bridges are imported dynamically so the Web Audio bundle stays out of
// native builds and expo-audio stays out of the web bundle (same pattern as
// useTapeAudioPlayback). Extracted into its own module so the hook can be tested
// without exercising a real dynamic import.

import { Platform } from 'react-native';
import type { PlatformBridge } from './PlatformBridge';

/** Load the platform bridge for the current platform, or null when unavailable. */
export const loadCallVoiceBridge = async (): Promise<PlatformBridge | null> => {
  try {
    if (Platform.OS === 'web') {
      const mod = await import('./platform/web/WebPlatformBridge');
      return mod.createWebPlatformBridge();
    }
    const mod = await import('./platform/native/NativePlatformBridge');
    return mod.createNativePlatformBridge();
  } catch {
    return null;
  }
};
