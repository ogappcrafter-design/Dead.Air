// engine/audio/capture/VoiceActivityDetector.ts
// DEA-90 — pure voice-activity detection for microphone-driven gameplay.
//
// Deliberately small and deterministic: it consumes a stream of RMS levels (or
// raw sample frames) and reports whether speech is present. There is no
// speech-to-text, no network call, and no platform dependency, so the whole
// mechanic can be unit-tested with synthetic level sequences.
//
// Detection is energy-based with hysteresis:
//   - the ambient noise floor is learned during a short calibration window and
//     then followed slowly, so a noisy room raises the gates instead of
//     triggering them;
//   - speech opens at `startGate` and only closes at the lower `stopGate`,
//     so a level hovering between the two keeps the latch open;
//   - a burst shorter than `minSpeechFrames` is ignored, and silence must
//     persist for `minSilenceFrames` before the latch releases.
//
// Frame cadence is owned by the capture layer (web polls the analyser every
// 50 ms; native delivers ~100 ms buffers). Configuration is expressed in
// frames so the detector itself never reads a clock.

/** Tuning for {@link VoiceActivityDetector}. All rates are per frame. */
export interface VoiceActivityConfig {
  /** Frames spent learning the ambient floor before speech can latch. */
  calibrationFrames: number;
  /** Absolute RMS that always counts as speech, whatever the learned floor. */
  speechThreshold: number;
  /** Absolute RMS that always counts as silence, whatever the learned floor. */
  silenceThreshold: number;
  /** Multiplier over the learned floor that opens the speech gate. */
  noiseFloorStartMultiplier: number;
  /** Multiplier over the learned floor that keeps the speech gate open. */
  noiseFloorStopMultiplier: number;
  /** Consecutive above-gate frames required before reporting speech. */
  minSpeechFrames: number;
  /** Consecutive below-gate frames required before reporting silence again. */
  minSilenceFrames: number;
  /** How fast the floor follows quieter audio (0..1 per frame). */
  floorFallRate: number;
  /** How fast the floor creeps toward louder ambience (0..1 per frame). */
  floorRiseRate: number;
  /** Starting floor before calibration has seen any audio. */
  initialNoiseFloor: number;
}

/**
 * Defaults assume ~50 ms frames: 300 ms calibration, 150 ms of speech to
 * latch, 500 ms of silence to release. Absolute gates are RMS in [0, 1].
 */
export const DEFAULT_VAD_CONFIG: VoiceActivityConfig = {
  calibrationFrames: 6,
  speechThreshold: 0.02,
  silenceThreshold: 0.012,
  noiseFloorStartMultiplier: 3,
  noiseFloorStopMultiplier: 1.8,
  minSpeechFrames: 3,
  minSilenceFrames: 10,
  floorFallRate: 0.5,
  floorRiseRate: 0.01,
  initialNoiseFloor: 0.0005,
};

/** One detector step. */
export interface VoiceActivityFrame {
  /** Frame RMS in [0, 1]. */
  level: number;
  /** Ambient noise floor learned so far. */
  noiseFloor: number;
  /** RMS needed to open the speech gate this frame. */
  startGate: number;
  /** RMS needed to keep the speech gate open this frame. */
  stopGate: number;
  /** True once speech has latched. */
  speaking: boolean;
}

/** Root-mean-square of a sample frame, in [0, 1] for normalized PCM. */
export function computeRms(samples: Float32Array | readonly number[]): number {
  const length = samples.length;
  if (length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < length; i += 1) {
    const value = samples[i] ?? 0;
    sum += value * value;
  }
  return Math.sqrt(sum / length);
}

/**
 * Stateful energy VAD. Feed one frame per capture tick and act on
 * `speaking`. `reset()` returns the detector to its calibration state so a new
 * call never inherits the previous room's floor.
 */
export class VoiceActivityDetector {
  private readonly config: VoiceActivityConfig;

  private noiseFloor: number;
  private calibrationFramesSeen = 0;
  private speechRun = 0;
  private silenceRun = 0;
  private latched = false;

  constructor(config: Partial<VoiceActivityConfig> = {}) {
    this.config = { ...DEFAULT_VAD_CONFIG, ...config };
    this.noiseFloor = this.config.initialNoiseFloor;
  }

  /** Current speech latch state. */
  get speaking(): boolean {
    return this.latched;
  }

  /** Ambient noise floor learned so far. */
  get noiseFloorLevel(): number {
    return this.noiseFloor;
  }

  /** Forget the room and start calibrating again. */
  reset(): void {
    this.noiseFloor = this.config.initialNoiseFloor;
    this.calibrationFramesSeen = 0;
    this.speechRun = 0;
    this.silenceRun = 0;
    this.latched = false;
  }

  /** Convenience: compute RMS from a sample frame, then step the detector. */
  pushSamples(samples: Float32Array | readonly number[]): VoiceActivityFrame {
    return this.pushRms(computeRms(samples));
  }

  /** Step the detector with a pre-computed RMS level. */
  pushRms(rms: number): VoiceActivityFrame {
    const level = Number.isFinite(rms) ? Math.max(0, rms) : 0;

    // Calibration: learn the room before any speech can latch. A single loud
    // frame during calibration raises the floor, which is conservative — it
    // costs sensitivity rather than inventing a flinch.
    if (this.calibrationFramesSeen < this.config.calibrationFrames) {
      this.noiseFloor = Math.max(this.noiseFloor, level);
      this.calibrationFramesSeen += 1;
      return this.frame(level);
    }

    // Only track the floor while idle. While speech is latched the floor must
    // stay put, otherwise the voice raises its own gate out of reach.
    if (!this.latched) {
      const rate = level < this.noiseFloor ? this.config.floorFallRate : this.config.floorRiseRate;
      this.noiseFloor += (level - this.noiseFloor) * rate;
    }

    const startGate = Math.max(
      this.config.speechThreshold,
      this.noiseFloor * this.config.noiseFloorStartMultiplier,
    );
    const stopGate = Math.max(
      this.config.silenceThreshold,
      this.noiseFloor * this.config.noiseFloorStopMultiplier,
    );

    if (this.latched) {
      if (level <= stopGate) {
        this.silenceRun += 1;
        if (this.silenceRun >= this.config.minSilenceFrames) {
          this.latched = false;
          this.silenceRun = 0;
          this.speechRun = 0;
        }
      } else {
        this.silenceRun = 0;
      }
    } else if (level >= startGate) {
      this.speechRun += 1;
      if (this.speechRun >= this.config.minSpeechFrames) {
        this.latched = true;
        this.speechRun = 0;
        this.silenceRun = 0;
      }
    } else {
      this.speechRun = 0;
    }

    return this.frame(level);
  }

  private frame(level: number): VoiceActivityFrame {
    return {
      level,
      noiseFloor: this.noiseFloor,
      startGate: Math.max(
        this.config.speechThreshold,
        this.noiseFloor * this.config.noiseFloorStartMultiplier,
      ),
      stopGate: Math.max(
        this.config.silenceThreshold,
        this.noiseFloor * this.config.noiseFloorStopMultiplier,
      ),
      speaking: this.latched,
    };
  }
}
