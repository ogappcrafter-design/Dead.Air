// __tests__/engine/audio/capture/VoiceActivityDetector.test.ts
// DEA-90 — pure VAD behaviour over synthetic RMS sequences.
// No microphone, no timers: the detector is stepped by hand.

import {
  computeRms,
  DEFAULT_VAD_CONFIG,
  VoiceActivityDetector,
  type VoiceActivityFrame,
  type VoiceActivityConfig,
} from '@/engine/audio/capture/VoiceActivityDetector';

/** Short frames keep each scenario readable. */
const TEST_CONFIG: Partial<VoiceActivityConfig> = {
  calibrationFrames: 3,
  speechThreshold: 0.02,
  silenceThreshold: 0.01,
  noiseFloorStartMultiplier: 3,
  noiseFloorStopMultiplier: 1.8,
  minSpeechFrames: 3,
  minSilenceFrames: 4,
  floorFallRate: 0.5,
  floorRiseRate: 0.001,
  initialNoiseFloor: 0.0005,
};

const SILENCE = 0.001;
const SPEECH = 0.25;

const makeDetector = (overrides: Partial<VoiceActivityConfig> = {}): VoiceActivityDetector =>
  new VoiceActivityDetector({ ...TEST_CONFIG, ...overrides });

/** Feed `frames` identical levels; returns the last frame result. */
function feed(detector: VoiceActivityDetector, level: number, frames: number): VoiceActivityFrame {
  let last = detector.pushRms(level);
  for (let i = 1; i < frames; i += 1) last = detector.pushRms(level);
  return last;
}

/** Run calibration so the floor matches a quiet room. */
function calibrate(detector: VoiceActivityDetector): void {
  feed(detector, SILENCE, TEST_CONFIG.calibrationFrames ?? 3);
}

describe('computeRms', () => {
  it('returns 0 for an empty frame', () => {
    expect(computeRms([])).toBe(0);
  });

  it('returns the absolute amplitude of a constant signal', () => {
    expect(computeRms([0.5, -0.5, 0.5, -0.5])).toBeCloseTo(0.5, 6);
  });

  it('returns 0 for digital silence', () => {
    expect(computeRms(new Float32Array(16))).toBe(0);
  });

  it('matches the analytic RMS of a sine wave', () => {
    const samples = new Float32Array(256);
    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = Math.sin((2 * Math.PI * i) / 32);
    }
    expect(computeRms(samples)).toBeCloseTo(Math.SQRT1_2, 2);
  });
});

describe('VoiceActivityDetector — calibration', () => {
  it('never reports speech during the calibration window', () => {
    const detector = makeDetector();
    const frame = feed(detector, SPEECH, TEST_CONFIG.calibrationFrames ?? 3);
    expect(frame.speaking).toBe(false);
    expect(detector.speaking).toBe(false);
  });

  it('learns a loud room during calibration instead of flinching', () => {
    const detector = makeDetector();
    feed(detector, 0.05, 3); // noisy room, constant
    const steadyNoise = feed(detector, 0.05, 10);
    expect(steadyNoise.speaking).toBe(false);
    expect(steadyNoise.startGate).toBeGreaterThanOrEqual(0.05);
  });
});

describe('VoiceActivityDetector — speech latch', () => {
  it('latches after minSpeechFrames consecutive loud frames', () => {
    const detector = makeDetector();
    calibrate(detector);

    const before = feed(detector, SPEECH, (TEST_CONFIG.minSpeechFrames ?? 3) - 1);
    expect(before.speaking).toBe(false);

    const latched = feed(detector, SPEECH, 1);
    expect(latched.speaking).toBe(true);
    expect(detector.speaking).toBe(true);
  });

  it('ignores a burst shorter than minSpeechFrames', () => {
    const detector = makeDetector();
    calibrate(detector);

    feed(detector, SPEECH, 2);
    const afterBurst = feed(detector, SILENCE, 2);
    expect(afterBurst.speaking).toBe(false);
  });

  it('requires the run to be consecutive', () => {
    const detector = makeDetector();
    calibrate(detector);

    feed(detector, SPEECH, 2);
    feed(detector, SILENCE, 1);
    feed(detector, SPEECH, 2);
    expect(detector.speaking).toBe(false);
  });

  it('does not latch while speech stays under the start gate', () => {
    const detector = makeDetector();
    calibrate(detector);
    expect(feed(detector, 0.015, 20).speaking).toBe(false);
  });
});

describe('VoiceActivityDetector — hysteresis', () => {
  it('keeps the latch open for levels between the stop and start gates', () => {
    const detector = makeDetector();
    calibrate(detector);
    feed(detector, SPEECH, 3);
    expect(detector.speaking).toBe(true);

    // 0.015 is above the stop gate (0.01) but below the start gate (0.02).
    const hover = feed(detector, 0.015, 20);
    expect(hover.startGate).toBeGreaterThan(hover.level);
    expect(hover.speaking).toBe(true);
  });

  it('releases only after minSilenceFrames of quiet', () => {
    const detector = makeDetector();
    calibrate(detector);
    feed(detector, SPEECH, 3);

    const nearlyReleased = feed(detector, SILENCE, (TEST_CONFIG.minSilenceFrames ?? 4) - 1);
    expect(nearlyReleased.speaking).toBe(true);

    const released = feed(detector, SILENCE, 1);
    expect(released.speaking).toBe(false);
  });

  it('restarts the silence run when sound returns', () => {
    const detector = makeDetector();
    calibrate(detector);
    feed(detector, SPEECH, 3);

    feed(detector, SILENCE, 3);
    feed(detector, SPEECH, 1);
    expect(detector.speaking).toBe(true);

    const afterShortSilence = feed(detector, SILENCE, 3);
    expect(afterShortSilence.speaking).toBe(true);
  });

  it('latches again after a release', () => {
    const detector = makeDetector();
    calibrate(detector);
    feed(detector, SPEECH, 3);
    feed(detector, SILENCE, 4);
    expect(detector.speaking).toBe(false);

    const relatched = feed(detector, SPEECH, 3);
    expect(relatched.speaking).toBe(true);
  });
});

describe('VoiceActivityDetector — defensive input', () => {
  it('treats NaN as silence', () => {
    const detector = makeDetector();
    calibrate(detector);
    const frame = detector.pushRms(Number.NaN);
    expect(frame.level).toBe(0);
    expect(frame.speaking).toBe(false);
  });

  it('clamps negative levels to zero', () => {
    const detector = makeDetector();
    calibrate(detector);
    expect(detector.pushRms(-0.5).level).toBe(0);
  });

  it('reset() forgets the room and the latch', () => {
    const detector = makeDetector();
    calibrate(detector);
    feed(detector, SPEECH, 3);
    expect(detector.speaking).toBe(true);

    detector.reset();
    expect(detector.speaking).toBe(false);
    expect(detector.noiseFloorLevel).toBe(DEFAULT_VAD_CONFIG.initialNoiseFloor);
  });

  it('pushSamples() derives RMS before stepping', () => {
    const detector = makeDetector();
    calibrate(detector);
    let frame = detector.pushSamples([0.4, -0.4, 0.4, -0.4]);
    expect(frame.level).toBeCloseTo(0.4, 6);
    for (let i = 0; i < 4; i += 1) {
      frame = detector.pushSamples([0.4, -0.4, 0.4, -0.4]);
    }
    expect(frame.speaking).toBe(true);
  });
});
