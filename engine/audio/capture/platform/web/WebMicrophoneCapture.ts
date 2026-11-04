// engine/audio/capture/platform/web/WebMicrophoneCapture.ts
// DEA-90 — browser microphone capture via getUserMedia + Web Audio.
//
// The browser has no PCM stream API in this app's dependency set, so capture
// runs through a MediaStreamSource → AnalyserNode pair and the analyser is
// polled for time-domain samples. Levels are RMS values handed to the caller;
// no audio is buffered, stored, or uploaded.
//
// Echo cancellation, noise suppression, and automatic gain control are
// requested so the game's own synthesized call voice does not leak back into
// the detector on browsers that honour them.

import type {
  MicrophoneCapture,
  MicrophoneLevelListener,
  MicrophonePermission,
} from '../../MicrophoneCapture';
import { computeRms } from '../../VoiceActivityDetector';

/** Analyser poll cadence; matches the detector's ~50 ms frame assumption. */
const POLL_INTERVAL_MS = 50;
const FFT_SIZE = 1024;

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;

const getAudioContextCtor = (): AudioContextCtor | null => {
  const scope = globalThis as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
};

const getMediaDevices = (): MediaDevices | null => {
  if (typeof navigator === 'undefined') return null;
  const devices = navigator.mediaDevices;
  return typeof devices?.getUserMedia === 'function' ? devices : null;
};

/** Constraints tuned for voice-activity detection, not recording. */
const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

const isPermissionDenial = (error: unknown): boolean => {
  const name = (error as { name?: unknown } | null)?.name;
  return name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError';
};

export class WebMicrophoneCapture implements MicrophoneCapture {
  readonly platform = 'web' as const;

  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private frame: Float32Array<ArrayBuffer> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  isAvailable(): boolean {
    return getMediaDevices() !== null && getAudioContextCtor() !== null;
  }

  async requestPermission(): Promise<MicrophonePermission> {
    const devices = getMediaDevices();
    if (devices === null || !this.isAvailable()) return 'unavailable';

    // Browsers have no portable "query only" API for capture, so the prompt
    // is triggered by getUserMedia. The track is kept for the imminent
    // `start()` call and released by `stop()`.
    if (this.stream === null) {
      try {
        this.stream = await devices.getUserMedia(MIC_CONSTRAINTS);
      } catch (error) {
        return isPermissionDenial(error) ? 'denied' : 'unavailable';
      }
    }
    return 'granted';
  }

  async start(onLevel: MicrophoneLevelListener): Promise<boolean> {
    const devices = getMediaDevices();
    const AudioCtor = getAudioContextCtor();
    if (devices === null || AudioCtor === null || typeof onLevel !== 'function') return false;
    if (this.timer !== null) return true;

    // Drop any half-built graph from an earlier failed start, but keep a
    // stream acquired by `requestPermission` so the browser is not asked twice.
    const existingStream = this.stream;
    this.releaseGraph();

    try {
      const stream = existingStream ?? (await devices.getUserMedia(MIC_CONSTRAINTS));
      this.stream = stream;

      const context = new AudioCtor({ latencyHint: 'interactive' });
      this.context = context;
      if (context.state === 'suspended') {
        try {
          await context.resume();
        } catch {
          // Autoplay policy may keep the context suspended; the analyser
          // still yields silence, which reads as "no speech".
        }
      }

      const analyser = context.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0;
      context.createMediaStreamSource(stream).connect(analyser);

      this.analyser = analyser;
      this.frame = new Float32Array(analyser.fftSize);
      this.timer = setInterval(() => this.sample(onLevel), POLL_INTERVAL_MS);
      return true;
    } catch {
      this.stop();
      return false;
    }
  }

  stop(): void {
    this.releaseGraph();

    if (this.stream !== null) {
      for (const track of this.stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Track already ended — best effort.
        }
      }
      this.stream = null;
    }
  }

  /** Tear down the analyser graph while leaving the stream in place. */
  private releaseGraph(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.analyser?.disconnect();
    this.analyser = null;
    this.frame = null;

    const context = this.context;
    this.context = null;
    if (context !== null && context.state !== 'closed') {
      void context.close().catch(() => {
        // Already closed — best effort.
      });
    }
  }

  private sample(onLevel: MicrophoneLevelListener): void {
    const analyser = this.analyser;
    const frame = this.frame;
    if (analyser === null || frame === null) return;

    try {
      analyser.getFloatTimeDomainData(frame);
      onLevel(computeRms(frame));
    } catch {
      // A torn-down analyser must not break the call: stop quietly.
      this.stop();
    }
  }
}

export const createWebMicrophoneCapture = (): MicrophoneCapture => new WebMicrophoneCapture();
