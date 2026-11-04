// engine/audio/capture/platform/native/NativeMicrophoneCapture.ts
// DEA-90 — native microphone capture via expo-audio's PCM stream.
//
// `AudioModule.AudioStream` delivers raw mono float32 buffers straight from the
// device microphone (~100 ms each), so the detector gets levels without
// recording a file: nothing is written to disk, nothing leaves the device.
//
// Two platform notes are baked into this module:
//   - iOS switches the audio session to `.record` while the stream runs (that
//     is expo-audio's own behaviour), so `stop()` puts the session back into
//     playback mode to let call voice / ambient audio resume.
//   - Capture is best-effort: a missing native class, a refused permission, or
//     a device that cannot open the microphone all resolve to "unavailable",
//     and the caller keeps the tap-only mechanic.

import {
  AudioModule,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import type { AudioStream, AudioStreamBuffer } from 'expo-audio';

import type {
  MicrophoneCapture,
  MicrophoneLevelListener,
  MicrophonePermission,
} from '../../MicrophoneCapture';
import { computeRms } from '../../VoiceActivityDetector';

/** 48 kHz mono float32 is supported by every device expo-audio targets. */
const SAMPLE_RATE = 48000;
const CHANNELS = 1;

/** Minimal listener handle — the shared-object typings may be unavailable. */
interface StreamSubscription {
  remove(): void;
}

/** Release a shared object without depending on its optional typings. */
const releaseStream = (stream: AudioStream): void => {
  const releasable = stream as unknown as { release?: () => void };
  releasable.release?.();
};

export class NativeMicrophoneCapture implements MicrophoneCapture {
  readonly platform = 'native' as const;

  private stream: AudioStream | null = null;
  private subscription: StreamSubscription | null = null;

  isAvailable(): boolean {
    return typeof AudioModule?.AudioStream === 'function';
  }

  async requestPermission(): Promise<MicrophonePermission> {
    if (!this.isAvailable()) return 'unavailable';

    try {
      const current = await getRecordingPermissionsAsync();
      if (current.granted) return 'granted';
      // Once the OS stops allowing prompts, asking again only adds noise.
      if (!current.canAskAgain) return 'denied';

      const next = await requestRecordingPermissionsAsync();
      return next.granted ? 'granted' : 'denied';
    } catch {
      return 'unavailable';
    }
  }

  async start(onLevel: MicrophoneLevelListener): Promise<boolean> {
    if (typeof onLevel !== 'function' || !this.isAvailable()) return false;
    if (this.stream !== null) return true;

    try {
      const stream = new AudioModule.AudioStream({
        sampleRate: SAMPLE_RATE,
        channels: CHANNELS,
        encoding: 'float32',
      });
      this.stream = stream;
      this.subscription = stream.addListener('audioStreamBuffer', (buffer: AudioStreamBuffer) => {
        try {
          onLevel(computeRms(new Float32Array(buffer.data)));
        } catch {
          // A malformed buffer is skipped; the next one is independent.
        }
      });

      await stream.start();
      return true;
    } catch {
      this.stop();
      return false;
    }
  }

  stop(): void {
    const stream = this.stream;
    this.stream = null;

    this.subscription?.remove();
    this.subscription = null;

    if (stream === null) return;

    try {
      stream.stop();
    } catch {
      // Already stopped — best effort.
    }
    try {
      releaseStream(stream);
    } catch {
      // Already released — best effort.
    }

    // iOS capture leaves the session in `.record` and deactivates it on stop.
    // Restore playback so the call voice can continue after the flinch.
    void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {
      // Session restore is best-effort.
    });
  }
}

export const createNativeMicrophoneCapture = (): MicrophoneCapture => new NativeMicrophoneCapture();
