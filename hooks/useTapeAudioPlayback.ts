// hooks/useTapeAudioPlayback.ts
// Simulated audio playback for tapes.
// TODO(phase-4): Replace timer with real PlatformBridge audio synthesis.
// The audio engine (engine/audio/*) is fully abstract — no platform
// implementations exist yet. This hook simulates playback progress so the
// UI can be wired and tested. When PlatformBridge implementations land,
// replace the timer with StaticSynth + VoiceProcessor synthesis.

import { useCallback, useEffect, useRef, useState } from 'react';

export interface TapeAudioPlayback {
  isPlaying: boolean;
  progress: number; // 0..1
  play: () => void;
  stop: () => void;
}

const TICK_MS = 100; // update progress every 100ms

export function useTapeAudioPlayback(
  durationSec: number,
  onComplete?: () => void,
): TapeAudioPlayback {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const elapsedRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);

  // Keep callback ref fresh without restarting the effect
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
    };
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
    setProgress(0);
    elapsedRef.current = 0;
  }, []);

  const play = useCallback(() => {
    // Already running — no-op (idempotent).
    if (intervalRef.current !== null) return;

    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      elapsedRef.current += TICK_MS / 1000;
      const p = Math.min(1, elapsedRef.current / durationSec);
      setProgress(p);

      if (p >= 1) {
        // Playback complete.
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

  return { isPlaying, progress, play, stop };
}
