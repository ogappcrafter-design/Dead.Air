// engine/audio/TapeAudioSynthesizer.ts
// Combines AudioEngine + AmbientLayer + StaticSynth + VoiceProcessor for tape playback.
// Owns the audio graph lifecycle for a single tape playback session.

import {
  AudioEngine,
  AudioEngineOptions,
  getOrCreateAudioEngine,
  resetAudioEngine,
} from './AudioEngine';
import { AmbientLayer } from './AmbientLayer';
import { StaticSynth } from './StaticSynth';
import { VoiceProcessor } from './VoiceProcessor';
import { PlatformBridge } from './PlatformBridge';
import { Band } from '../../lib/constants';
import { bandStaticCharacter } from './PlatformBridge';
import { BALANCED_CONFIG } from './AudioPerformanceConfig';

export interface TapeAudioSynthesizerOptions {
  bridge: PlatformBridge;
  band: Band;
  /** Master volume (0..1). Defaults to 0.7. */
  masterVolume?: number;
}

export type TapeSynthState = 'idle' | 'playing' | 'stopped' | 'error';

/**
 * TapeAudioSynthesizer — per-tape audio graph combining drone + voice + static.
 *
 * Architecture:
 * - AudioEngine: singleton owning AudioContext + master gain
 * - AmbientLayer: always-present looping soundscape colored by band
 * - StaticSynth: noise texture through band-pass + waveshaper
 * - VoiceProcessor: lo-fi treatment for voice fragments
 *
 * The synthesizer connects: StaticSynth → VoiceProcessor → master gain
 * and AmbientLayer → master gain independently.
 */
export class TapeAudioSynthesizer {
  private readonly bridge: PlatformBridge;
  private readonly band: Band;
  private readonly masterVolume: number;

  private engine: AudioEngine | null = null;
  private ambient: AmbientLayer | null = null;
  private staticSynth: StaticSynth | null = null;
  private voiceProcessor: VoiceProcessor | null = null;

  private state: TapeSynthState = 'idle';
  private startTime = 0;
  private pauseTime = 0;
  private durationSec = 0;

  constructor(opts: TapeAudioSynthesizerOptions) {
    this.bridge = opts.bridge;
    this.band = opts.band;
    this.masterVolume = opts.masterVolume ?? 0.7;
  }

  /** Current lifecycle state. */
  getState(): TapeSynthState {
    return this.state;
  }

  /** Elapsed playback time in seconds. */
  getElapsed(): number {
    if (this.engine === null || this.state !== 'playing') {
      return this.pauseTime;
    }
    const ctx = this.engine.getContext();
    if (ctx === null) return this.pauseTime;
    return ctx.currentTime - this.startTime + this.pauseTime;
  }

  /** Progress 0..1 for a given duration. */
  getProgress(durationSec: number): number {
    if (durationSec <= 0) return 0;
    return Math.min(1, this.getElapsed() / durationSec);
  }

  /**
   * Initialize the audio graph + start playback.
   * Idempotent — calling twice resumes if stopped.
   */
  async play(durationSec: number): Promise<void> {
    this.durationSec = durationSec;

    if (this.state === 'playing') {
      return; // already playing — no-op
    }

    try {
      if (this.engine === null) {
        await this.initialize();
      }

      if (this.engine === null || !this.engine.isReady()) {
        this.state = 'error';
        return;
      }

      const ctx = this.engine.getContext();
      if (ctx === null) {
        this.state = 'error';
        return;
      }

      // Resume from pause or start fresh
      if (this.state === 'stopped' && this.pauseTime > 0) {
        // Adjust start time to account for elapsed
        this.startTime = ctx.currentTime - this.pauseTime;
      } else {
        this.startTime = ctx.currentTime;
        this.pauseTime = 0;
      }

      this.state = 'playing';
    } catch {
      this.state = 'error';
    }
  }

  /** Stop playback — pauses graph, records elapsed. */
  stop(): void {
    if (this.state !== 'playing') {
      return;
    }
    this.pauseTime = this.getElapsed();
    this.state = 'stopped';

    // Fade out ambient to avoid click
    if (this.ambient !== null) {
      this.ambient.fadeOut(0.3);
    }
  }

  /** Tear down the entire audio graph. */
  dispose(): void {
    if (this.staticSynth !== null) {
      this.staticSynth.stop();
      this.staticSynth = null;
    }
    if (this.voiceProcessor !== null) {
      this.voiceProcessor.dispose();
      this.voiceProcessor = null;
    }
    if (this.ambient !== null) {
      this.ambient.dispose();
      this.ambient = null;
    }
    if (this.engine !== null) {
      void this.engine.close();
      resetAudioEngine();
      this.engine = null;
    }
    this.state = 'idle';
    this.startTime = 0;
    this.pauseTime = 0;
  }

  /** Initialize audio engine + create layers. */
  private async initialize(): Promise<void> {
    const opts: AudioEngineOptions = {
      bridge: this.bridge,
      initialMasterVolume: this.masterVolume,
      perfConfig: BALANCED_CONFIG,
    };

    this.engine = getOrCreateAudioEngine(opts);
    await this.engine.init();

    if (!this.engine.isReady()) {
      this.state = 'error';
      return;
    }

    const ctx = this.engine.getContext();
    const masterGain = this.engine.getMasterGain();
    if (ctx === null || masterGain === null) {
      this.state = 'error';
      return;
    }

    // Ambient layer — always-present soundscape
    this.ambient = new AmbientLayer(this.bridge, ctx, masterGain);
    this.ambient.start(this.band, 2);

    // Static synth — noise texture
    this.staticSynth = new StaticSynth(this.bridge, ctx, masterGain);
    this.staticSynth.setCharacter(bandStaticCharacter(this.band));
    this.staticSynth.setIntensity(0.5);
    this.staticSynth.start();

    // Voice processor — lo-fi treatment for voice fragments
    this.voiceProcessor = new VoiceProcessor(this.bridge, ctx, masterGain);
    this.voiceProcessor.applyPresetForBand(this.band);
  }
}

/**
 * Factory: create a synthesizer for the given band.
 * Requires a PlatformBridge implementation.
 */
export const createTapeAudioSynthesizer = (
  opts: TapeAudioSynthesizerOptions,
): TapeAudioSynthesizer => new TapeAudioSynthesizer(opts);
