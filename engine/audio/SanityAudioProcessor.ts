/**
 * SanityAudioProcessor — real-time audio distortion based on sanity level.
 *
 * Three effects, all gradual/continuous (interpolated by sanity value):
 *   1. Whisper layer: pink-noise → bandpass → gain, fades in at low sanity
 *   2. Warble: setInterval tremolo on the whisper gain (~6.5 Hz)
 *   3. Distortion: waveshaper on a parallel chain, increases with low sanity
 *
 * Weather interaction: bad weather + low sanity = multiplicative degradation.
 * The caller passes `weatherStaticAdd` (0–20) and `weatherClarityMultiplier` (0.8–1.0)
 * alongside `sanity` (0–100). The processor compounds them.
 */

import type {
  PlatformBridge,
  BridgeAudioContext,
  BridgeAudioNode,
  BridgeBufferSourceNode,
  BridgeBiquadNode,
  BridgeGainNode,
  BridgeWaveShaperNode,
} from './PlatformBridge';

// ─── Types ─────────────────────────────────────────────────

export interface SanityAudioUpdate {
  /** Current sanity 0–100 (0 = worst, 100 = best). */
  readonly sanity: number;
  /** Weather static add from WeatherSystem (0–20 scale). */
  readonly weatherStaticAdd: number;
  /** Weather clarity multiplier from WeatherSystem (0.8–1.0). */
  readonly weatherClarityMultiplier: number;
}

// ─── Constants ──────────────────────────────────────────────

/** Sanity below this triggers audio distortion (matches SanityEffectEngine). */
const DISTORTION_THRESHOLD = 40;
/** Maximum whisper gain when sanity is 0. */
const MAX_WHISPER_GAIN = 0.07;
/** Warble frequency in Hz (unstable pulsing quality). */
const WARBLE_FREQ_HZ = 6.5;
/** Maximum warble depth (fraction of whisper gain). */
const MAX_WARBLE_DEPTH = 0.45;
/** Whisper bandpass center frequency. */
const WHISPER_CENTER_FREQ = 850;
/** Whisper bandpass Q. */
const WHISPER_Q = 1.8;
/** Maximum distortion waveshaper amount. */
const MAX_DISTORTION = 0.35;
/** Update interval for warble modulation (ms). */
const UPDATE_INTERVAL_MS = 50;

// ─── Helpers ────────────────────────────────────────────────

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Build a soft-clipping waveshaper curve.
 * `amount` 0 = no distortion, 1 = maximum.
 */
function makeDistortionCurve(amount: number): Float32Array {
  const samples = 1024;
  const curve = new Float32Array(samples);
  const k = amount * 40; // soft-clip intensity
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1; // [-1, 1]
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

// ─── SanityAudioProcessor ───────────────────────────────────

export class SanityAudioProcessor {
  private readonly bridge: PlatformBridge;
  private readonly ctx: BridgeAudioContext;
  private readonly destination: BridgeAudioNode;

  // Whisper chain: source → filter → gain → destination
  private whisperSource: BridgeBufferSourceNode | null = null;
  private whisperFilter: BridgeBiquadNode;
  private whisperGain: BridgeGainNode;

  // Distortion chain: input gain → waveshaper → output gain → destination
  private distortionInput: BridgeGainNode;
  private distortionShaper: BridgeWaveShaperNode;
  private distortionOutput: BridgeGainNode;

  // State
  private currentWhisperTarget = 0;
  private currentDistortionAmount = 0;
  private currentWhisperGain = 0;
  private currentDistortionGain = 0;
  private warblePhase = 0;
  private warbleTimer: ReturnType<typeof setInterval> | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(bridge: PlatformBridge, ctx: BridgeAudioContext, destination: BridgeAudioNode) {
    this.bridge = bridge;
    this.ctx = ctx;
    this.destination = destination;

    // ── Whisper layer ──
    this.whisperFilter = bridge.createBiquad(ctx, 'bandpass');
    this.whisperFilter.setFrequency(WHISPER_CENTER_FREQ);
    this.whisperFilter.setQ(WHISPER_Q);

    this.whisperGain = bridge.createMasterGain(ctx);
    this.whisperGain.setGain(0);

    bridge.connect(this.whisperFilter, this.whisperGain);
    bridge.connect(this.whisperGain, destination);

    // ── Distortion chain (parallel, takes from destination via input gain) ──
    // We can't tap the master signal directly, so the distortion chain
    // adds its own coloration by modulating the whisper feed.
    // Instead of re-routing master audio, we use the waveshaper on the
    // whisper signal itself to add a harsher edge at very low sanity.
    this.distortionInput = bridge.createMasterGain(ctx);
    this.distortionInput.setGain(1);

    this.distortionShaper = bridge.createWaveShaper(ctx);
    this.distortionShaper.setOversample('2x');
    this.distortionShaper.setCurve(makeDistortionCurve(0));

    this.distortionOutput = bridge.createMasterGain(ctx);
    this.distortionOutput.setGain(0);

    bridge.connect(this.whisperFilter, this.distortionInput);
    bridge.connect(this.distortionInput, this.distortionShaper);
    bridge.connect(this.distortionShaper, this.distortionOutput);
    bridge.connect(this.distortionOutput, destination);
  }

  /**
   * Start the whisper noise source. Must be called after AudioContext resume.
   */
  start(): void {
    if (this.whisperSource || this.disposed) return;

    this.whisperSource = this.bridge.createStaticSource(this.ctx, 'pink');
    this.whisperSource.setLoop(true);
    this.whisperSource.connect(this.whisperFilter);
    this.whisperSource.start(this.ctx.currentTime);

    // Start warble modulation
    this.warbleTimer = setInterval(() => this.tickWarble(), UPDATE_INTERVAL_MS);
  }

  /**
   * Update distortion levels based on current sanity + weather.
   * All values are interpolated continuously — no step changes.
   */
  update(params: SanityAudioUpdate): void {
    if (this.disposed) return;

    const { sanity, weatherStaticAdd, weatherClarityMultiplier } = params;

    // Base distortion: 0 at sanity≥40, 1 at sanity=0
    const baseDistortion = clamp01((DISTORTION_THRESHOLD - sanity) / DISTORTION_THRESHOLD);

    // Weather compounds: bad weather + low sanity = worse
    // weatherStaticAdd is 0–20, normalize to 0–0.3, multiply with base
    const weatherFactor = (weatherStaticAdd / 20) * 0.3;
    const weatherClarityDegrade = 1 - weatherClarityMultiplier; // 0–0.2

    // Combined distortion: base + weather contribution, capped at 1
    const combinedDistortion = clamp01(
      baseDistortion + baseDistortion * (weatherFactor + weatherClarityDegrade),
    );

    // ── Whisper gain ──
    this.currentWhisperTarget = combinedDistortion * MAX_WHISPER_GAIN;

    // ── Distortion amount ──
    this.currentDistortionAmount = combinedDistortion * MAX_DISTORTION;
    this.distortionShaper.setCurve(makeDistortionCurve(this.currentDistortionAmount));

    // Distortion output gain follows combined distortion
    this.currentDistortionGain = combinedDistortion * 0.5;
    this.distortionOutput.setGain(this.currentDistortionGain);
  }

  /**
   * Warble modulation — oscillates whisper gain to create CRT-unstable quality.
   */
  private tickWarble(): void {
    if (this.disposed || !this.whisperSource) return;

    const intervalSec = UPDATE_INTERVAL_MS / 1000;
    this.warblePhase += WARBLE_FREQ_HZ * intervalSec * Math.PI * 2;

    const warbleDepth = MAX_WARBLE_DEPTH * (this.currentWhisperTarget / MAX_WHISPER_GAIN);
    const oscillation = Math.sin(this.warblePhase) * warbleDepth;
    const gain = this.currentWhisperTarget * (1 + oscillation);
    const clampedGain = Math.max(0, gain);

    this.currentWhisperGain = clampedGain;
    this.whisperGain.setGain(clampedGain);
  }

  /**
   * Fade out and stop all processing.
   */
  fadeOut(seconds: number = 1.5): void {
    this.currentWhisperTarget = 0;

    if (this.warbleTimer !== null) {
      clearInterval(this.warbleTimer);
      this.warbleTimer = null;
    }

    if (this.fadeTimer !== null) {
      clearInterval(this.fadeTimer);
    }

    const steps = Math.max(1, Math.floor((seconds * 1000) / UPDATE_INTERVAL_MS));
    const startGain = this.currentWhisperGain;
    const startDist = this.currentDistortionGain;
    let step = 0;

    this.fadeTimer = setInterval(() => {
      step++;
      const progress = step / steps;
      const whisperVal = startGain * (1 - progress);
      const distVal = startDist * (1 - progress);
      this.whisperGain.setGain(Math.max(0, whisperVal));
      this.distortionOutput.setGain(Math.max(0, distVal));

      if (step >= steps) {
        if (this.fadeTimer !== null) {
          clearInterval(this.fadeTimer);
          this.fadeTimer = null;
        }
        this.whisperGain.setGain(0);
        this.distortionOutput.setGain(0);
      }
    }, UPDATE_INTERVAL_MS);
  }

  /**
   * Check if the processor is active (whisper source playing).
   */
  isActive(): boolean {
    return this.whisperSource !== null && !this.disposed;
  }

  /**
   * Dispose all nodes and stop timers.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.warbleTimer !== null) {
      clearInterval(this.warbleTimer);
      this.warbleTimer = null;
    }

    if (this.fadeTimer !== null) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    if (this.whisperSource) {
      try {
        this.whisperSource.stop(this.ctx.currentTime);
      } catch {
        // Source may already be stopped
      }
      this.whisperSource = null;
    }

    this.bridge.disconnectAll(this.whisperFilter);
    this.bridge.disconnectAll(this.whisperGain);
    this.bridge.disconnectAll(this.distortionInput);
    this.bridge.disconnectAll(this.distortionShaper);
    this.bridge.disconnectAll(this.distortionOutput);
  }
}
