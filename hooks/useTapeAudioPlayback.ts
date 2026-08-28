// hooks/useTapeAudioPlayback.ts
// Real audio playback for tapes via PlatformBridge + TapeAudioSynthesizer.
// Falls back to timer-based simulation when AudioContext unavailable (SSR).

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Band } from '../lib/constants';
import {
  TapeAudioSynthesizer,
  createTapeAudioSynthesizer,
} from '../engine/audio/TapeAudioSynthesizer';
import { PlatformBridge } from '../engine/audio/PlatformBridge';

export interface TapeAudioPlayback {
  isPlaying: boolean;
  progress: number; // 0..1
  play: () => void;
  stop: () => void;
}

const TICK_MS = 100; // fallback timer tick

/**
 * Lazy-load the web bridge — keeps the Web Audio bundle out of native builds.
 */
const loadWebBridge = async (): Promise<PlatformBridge | null> => {
  if (Platform.OS !== 'web') return null;
  try {
    const mod = await import('../engine/audio/platform/web/WebPlatformBridge');
    return mod.createWebPlatformBridge();
  } catch {
    return null;
  }
};

export function useTapeAudioPlayback(
  durationSec: number,
  onComplete?: () => void,
  band: Band = 'LIVING',
): TapeAudioPlayback {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const synthRef = useRef<TapeAudioSynthesizer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  const usingRealAudioRef = useRef(false);

  // Keep callback ref fresh
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (synthRef.current !== null) {
        synthRef.current.dispose();
        synthRef.current = null;
      }
    };
  }, []);

  const startFallbackTimer = useCallback(() => {
    if (intervalRef.current !== null) return;
    intervalRef.current = setInterval(() => {
      elapsedRef.current += TICK_MS / 1000;
      const p = Math.min(1, elapsedRef.current / durationSec);
      setProgress(p);
      if (p >= 1) {
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsPlaying(false);
        elapsedRef.current = 0;
        setProgress(0);
        onCompleteRef.current?.();
      }
    }, TICK_MS);
  }, [durationSec]);

  const stopFallbackTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (usingRealAudioRef.current && synthRef.current !== null) {
      synthRef.current.stop();
      synthRef.current.dispose();
      synthRef.current = null;
      usingRealAudioRef.current = false;
    } else {
      stopFallbackTimer();
    }
    setIsPlaying(false);
    setProgress(0);
    elapsedRef.current = 0;
  }, [stopFallbackTimer]);

  const play = useCallback(async () => {
    // Already running — no-op (idempotent).
    if (isPlaying || synthRef.current !== null || intervalRef.current !== null) {
      return;
    }

    setIsPlaying(true);

    // Attempt real audio via PlatformBridge.
    if (Platform.OS === 'web') {
      try {
        const bridge = await loadWebBridge();
        if (bridge !== null) {
          const synth = createTapeAudioSynthesizer({ bridge, band });
          await synth.play(durationSec);
          if (synth.getState() === 'playing') {
            synthRef.current = synth;
            usingRealAudioRef.current = true;
            return;
          }
          // Audio init failed — fall through to timer.
          synth.dispose();
        }
      } catch {
        // Bridge load or init failed — fall through to timer.
      }
    }

    // Fallback: timer-based simulation (SSR, native, no bridge).
    usingRealAudioRef.current = false;
    elapsedRef.current = 0;
    startFallbackTimer();
  }, [isPlaying, band, durationSec, startFallbackTimer]);

  // Progress polling for real-audio path.
  useEffect(() => {
    if (!usingRealAudioRef.current || synthRef.current === null) return;

    const poll = setInterval(() => {
      const synth = synthRef.current;
      if (synth === null || synth.getState() !== 'playing') {
        clearInterval(poll);
        return;
      }
      const p = synth.getProgress(durationSec);
      setProgress(p);
      if (p >= 1) {
        clearInterval(poll);
        synth.dispose();
        synthRef.current = null;
        usingRealAudioRef.current = false;
        setIsPlaying(false);
        setProgress(0);
        onCompleteRef.current?.();
      }
    }, TICK_MS);

    return () => clearInterval(poll);
  }, [isPlaying, durationSec]);

  return { isPlaying, progress, play, stop };
}
