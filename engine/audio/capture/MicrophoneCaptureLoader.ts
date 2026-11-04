// engine/audio/capture/MicrophoneCaptureLoader.ts
// DEA-90 — lazy platform loader for microphone capture.
//
// Mirrors CallVoiceBridgeLoader: implementations are imported dynamically so
// the browser API stays out of native bundles and expo-audio stays out of the
// web bundle. A missing module or a broken platform import resolves to null,
// which the caller treats as "no microphone" (tap-only fallback).

import { Platform } from 'react-native';

import type { MicrophoneCapture } from './MicrophoneCapture';

/** Load the capture implementation for the current platform, or null. */
export const loadMicrophoneCapture = async (): Promise<MicrophoneCapture | null> => {
  try {
    if (Platform.OS === 'web') {
      const mod = await import('./platform/web/WebMicrophoneCapture');
      return mod.createWebMicrophoneCapture();
    }
    const mod = await import('./platform/native/NativeMicrophoneCapture');
    return mod.createNativeMicrophoneCapture();
  } catch {
    return null;
  }
};
