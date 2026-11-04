// hooks/useVoiceFlinch.ts
// DEA-90 — microphone-driven "stay calm": speaking flinches the player.
//
// The hook owns the whole optional path: load the platform capture, ask for
// permission (lazily, only while a STAY_CALM countdown is running), stream
// levels into the pure VoiceActivityDetector, and call `onVoiceDetected` once
// when speech latches. Every failure — no device, refused permission, capture
// error, missing platform module — is swallowed so the call keeps working with
// its tap-only mechanic. It never blocks or nags the player.
//
// The caller is responsible for making `onVoiceDetected` behave exactly like a
// tap; this hook only reports that a voice was heard.

import { useEffect, useRef } from 'react';

import type { MicrophoneCapture } from '../engine/audio/capture/MicrophoneCapture';
import { requestMicrophonePermission } from '../engine/audio/capture/MicrophoneCapture';
import { loadMicrophoneCapture } from '../engine/audio/capture/MicrophoneCaptureLoader';
import {
  VoiceActivityDetector,
  type VoiceActivityConfig,
} from '../engine/audio/capture/VoiceActivityDetector';

export interface VoiceFlinchOptions {
  /** Capture runs only while this is true (the STAY_CALM countdown). */
  active: boolean;
  /** Called once per activation when speech is detected. */
  onVoiceDetected: () => void;
  /** Injectable capture loader; defaults to the platform loader. */
  loadCapture?: () => Promise<MicrophoneCapture | null>;
  /** Injectable VAD tuning; read once per activation. */
  vadConfig?: Partial<VoiceActivityConfig>;
}

/**
 * Listen for the player's voice while `active`. Safe to call on every render:
 * capture starts and stops with `active` and the callback is kept fresh
 * through a ref, so a changing callback never restarts the microphone.
 */
export function useVoiceFlinch(options: VoiceFlinchOptions): void {
  const { active, onVoiceDetected } = options;
  const loadCapture = options.loadCapture ?? loadMicrophoneCapture;

  const onVoiceDetectedRef = useRef(onVoiceDetected);
  onVoiceDetectedRef.current = onVoiceDetected;

  // Read the tuning once per activation so an inline config object does not
  // churn the effect (and restart capture) on every render.
  const vadConfigRef = useRef(options.vadConfig);
  vadConfigRef.current = options.vadConfig;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let capture: MicrophoneCapture | null = null;
    const detector = new VoiceActivityDetector(vadConfigRef.current);

    void (async () => {
      try {
        const loaded = await loadCapture();
        if (loaded === null || cancelled) return;
        capture = loaded;
        if (!loaded.isAvailable()) return;

        const permission = await requestMicrophonePermission(loaded);
        if (permission !== 'granted' || cancelled) return;

        const started = await loaded.start((rms) => {
          if (cancelled) return;
          if (!detector.pushRms(rms).speaking) return;
          // One voice flinch per activation: release the mic immediately.
          cancelled = true;
          loaded.stop();
          onVoiceDetectedRef.current();
        });

        if (!started) {
          loaded.stop();
          capture = null;
        }
      } catch {
        // Voice detection is optional — release anything half-started and stay
        // on the tap-only path.
        capture?.stop();
        capture = null;
      }
    })();

    return () => {
      cancelled = true;
      capture?.stop();
      capture = null;
    };
  }, [active, loadCapture]);
}
