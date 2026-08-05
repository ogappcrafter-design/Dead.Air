// engine/audio/StaticSynth.ts
// White / pink / brown noise generator w/ intensity + character controls.
// Intensity (0..1) → band-pass + drive feel: off-station = harsher.

import {
  PlatformBridge,
  BridgeBufferSourceNode,
  BridgeBiquadNode,
  BridgeWaveShaperNode,
  BridgeAudioContext,
  StaticCharacter,
} from './PlatformBridge';
import type { StaticSynthPerfParams } from './AudioPerformanceConfig';

/** Character → filter band-pass center frequency (Hz). Off-station ≈ harsher. */
export const characterCenterFreq: Record<StaticCharacter, number> = {
  white: 6000,
  pink: 3000,
  brown: 800,
};

/** Intensity → filter Q (resonance). Higher = more aggressive edge. */
export const intensityToQ = (intensity: number): number => {
  const clamped = Math.max(0, Math.min(1, intensity));
  return 0.7 + clamped * 4.3; // [0.7 .. 5.0]
};

/** Intensity → band-pass bandwidth (Hz, relative to center). Higher intensity narrows band. */
export const intensityToBandwidth = (intensity: number, center: number): number => {
  const clamped = Math.max(0, Math.min(1, intensity));
  const fullBW = center * 0.7; // wide-open at intensity 0
  const narrowBW = center * 0.05; // tight at intensity 1
  return fullBW - (fullBW - narrowBW) * clamped;
};

/** Intensity → waveshaper drive (0..1). Off-station pushes harder. */
export const intensityToDrive = (intensity: number): number => {
  const clamped = Math.max(0, Math.min(1, intensity));
  return clamped; // linear is fine — chain adds color
};

/** Waveshaper curve for noise coloration. Uses tanh-style soft clip. */
export const makeDriveCurve = (drive: number, samples = 1024): Float32Array => {
  const curve = new Float32Array(samples);
  const k = 1 + drive * 30; // drive factor
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1; // [-1, 1]
    curve[i] = Math.tanh(k * x); // soft clip
  }
  return curve;
};

/**
 * StaticSynth — persistent noise source through a band-pass + waveshaper.
 *
 * Lifecycle:
 * - Created once per AudioEngine. Owner: AudioEngine or a top-level
 *   audio graph manager (Phase 4). Not tied to a single call.
 * - `setCharacter` swaps underlying buffer (requires source stop/start).
 * - `setIntensity` updates filter + drive in real-time (no buffer swap).
 * - Always connects output to a provided destination node.
 */
export class StaticSynth {
  private readonly bridge: PlatformBridge;
  private readonly ctx: BridgeAudioContext;
  private source: BridgeBufferSourceNode | null = null;
  private bandPass: BridgeBiquadNode;
  private shaper: BridgeWaveShaperNode;
  private character: StaticCharacter = 'white';
  private intensity = 0.5;
  private started = false;
  private readonly shaperOversample: 'none' | '2x' | '4x';

  constructor(
    bridge: PlatformBridge,
    ctx: BridgeAudioContext,
    destination: import('./PlatformBridge').BridgeAudioNode,
    perf?: StaticSynthPerfParams,
  ) {
    this.bridge = bridge;
    this.ctx = ctx;
    this.shaperOversample = perf?.shaperOversample ?? '2x';

    this.bandPass = bridge.createBiquad(ctx, 'bandpass');
    this.bandPass.setQ(intensityToQ(this.intensity));
    const center = characterCenterFreq[this.character];
    this.bandPass.setFrequency(center);

    this.shaper = bridge.createWaveShaper(ctx);
    this.shaper.setCurve(makeDriveCurve(intensityToDrive(this.intensity)));
    this.shaper.setOversample(this.shaperOversample);

    this.bandPass.connect(this.shaper);
    this.shaper.connect(destination);
  }

  /** Start noise. Idempotent. */
  start(): void {
    if (this.started) {
      return;
    }
    this.source = this.bridge.createStaticSource(this.ctx, this.character);
    this.source.setLoop(true);
    this.source.connect(this.bandPass);
    this.source.start(this.ctx.currentTime);
    this.started = true;
  }

  /** Stop noise. Idempotent. */
  stop(): void {
    if (!this.started || this.source === null) {
      return;
    }
    this.source.stop();
    this.source.disconnect();
    this.source = null;
    this.started = false;
  }

  /** Swap character (white / pink / brown). Restarts the buffer. */
  setCharacter(character: StaticCharacter): void {
    if (this.character === character) {
      return;
    }
    this.character = character;
    this.bandPass.setFrequency(characterCenterFreq[character]);
    if (this.started) {
      // Restart source w/ new buffer.
      this.stop();
      this.start();
    }
  }

  /** Set intensity 0..1 — updates filter Q, bandwidth, and drive. */
  setIntensity(value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.intensity = clamped;
    this.bandPass.setQ(intensityToQ(clamped));
    const center = characterCenterFreq[this.character];
    this.bandPass.setFrequency(center);
    this.shaper.setCurve(makeDriveCurve(intensityToDrive(clamped)));
  }

  /** Current character. */
  getCharacter(): StaticCharacter {
    return this.character;
  }

  /** Current intensity. */
  getIntensity(): number {
    return this.intensity;
  }

  /** True if source currently generating. */
  isStarted(): boolean {
    return this.started;
  }

  /** Tear down nodes. After dispose, instance is unusable. */
  dispose(): void {
    this.stop();
    this.bandPass.disconnect();
    this.shaper.disconnect();
  }
}
