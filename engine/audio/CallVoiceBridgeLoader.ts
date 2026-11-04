// engine/audio/CallVoiceBridgeLoader.ts
// Lazy bridge loader for the DEA-94 call voice.
//
// The web bridge is imported dynamically so the Web Audio bundle stays out of
// native builds (same pattern as useTapeAudioPlayback). Extracted into its own
// module so the hook can be tested without exercising a real dynamic import.

import { Platform } from 'react-native';
import type { PlatformBridge } from './PlatformBridge';

/** Load the web platform bridge, or null when unavailable (native/SSR). */
export const loadCallVoiceBridge = async (): Promise<PlatformBridge | null> => {
  if (Platform.OS !== 'web') return null;
  try {
    const mod = await import('./platform/web/WebPlatformBridge');
    return mod.createWebPlatformBridge();
  } catch {
    return null;
  }
};
