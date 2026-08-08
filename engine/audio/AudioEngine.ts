// engine/audio/AudioEngine.ts
// Singleton owning the underlying AudioContext + master gain + one PlatformBridge.
// Lazily created; SSR-safe (no AudioContext access during SSR).

import { PlatformBridge, BridgeAudioContext, BridgeGainNode } from './PlatformBridge';
import { LatencyProfiler, type LatencyStats } from './LatencyProfiler';
import {
  BALANCED_CONFIG,
  type AudioPerformanceConfig,
  type LatencyHint,
} from './AudioPerformanceConfig';
import type { AmbientLayer } from './AmbientLayer';
import type { AmbientProfile } from './profiles/types';

export interface AudioEngineOptions {
  bridge: PlatformBridge;
  /** Initial master volume (0..1). Defaults to 0.7. */
  initialMasterVolume?: number;
  /** Performance config — controls latency hints + processing params. */
  perfConfig?: AudioPerformanceConfig;
}

export type AudioEngineState = 'uninitialized' | 'running' | 'suspended' | 'closed';

const DEFAULT_MASTER_VOLUME = 0.7;

/**
 * AudioEngine — the single owner of the audio graph lifecycle.
 *
 * Contract:
 * - Lazily created on first `init()` via `getOrCreateAudioEngine(opts)`.
 * - `init()` is idempotent — calling twice returns same context.
 * - SSR-safe: if `bridge.createContext()` rejects (no AudioContext /
 *   expo-av unavailable), engine enters `closed` state and subsequent
 *   calls become no-ops rather than throwing.
 * - Master gain always exists once initialized; `setMasterVolume(0)`
 *   is the equivalent of mute but keeps the graph running.
 */
export class AudioEngine {
  private readonly bridge: PlatformBridge;
  private ctx: BridgeAudioContext | null = null;
  private masterGain: BridgeGainNode | null = null;
  private state: AudioEngineState = 'uninitialized';
  private masterVolume: number;
  private mutedVolume: number | null = null;
  private readonly perfConfig: AudioPerformanceConfig;
  private readonly latencyProfiler: LatencyProfiler;
  private ambientLayer: AmbientLayer | null = null;
  private pendingProfile: AmbientProfile | null = null;

  constructor(opts: AudioEngineOptions) {
    this.bridge = opts.bridge;
    this.masterVolume = opts.initialMasterVolume ?? DEFAULT_MASTER_VOLUME;
    this.perfConfig = opts.perfConfig ?? BALANCED_CONFIG;
    this.latencyProfiler = new LatencyProfiler();
  }

  /** Latency profiler — callers use this to measure call-to-output timing. */
  getLatencyProfiler(): LatencyProfiler {
    return this.latencyProfiler;
  }

  /** Active performance config. */
  getPerfConfig(): AudioPerformanceConfig {
    return this.perfConfig;
  }

  /** Current latency stats snapshot. */
  getLatencyStats(): LatencyStats {
    return this.latencyProfiler.getStats();
  }

  /** Current lifecycle state. */
  getState(): AudioEngineState {
    return this.state;
  }

  /** Current master volume (0..1). */
  getMasterVolume(): number {
    return this.masterVolume;
  }

  /** The platform bridge used by this engine. */
  getBridge(): PlatformBridge {
    return this.bridge;
  }

  /**
   * Lazily create AudioContext + master gain. Idempotent.
   * Resolves once context is `running` (web) or initialized (native).
   */
  async init(): Promise<void> {
    if (this.state === 'running' || this.state === 'suspended') {
      return;
    }
    if (this.state === 'closed') {
      // Closed engine cannot be re-initialized — caller must reset.
      return;
    }
    try {
      this.ctx = await this.bridge.createContext(this.perfConfig.latencyHint);
      this.masterGain = this.bridge.createMasterGain(this.ctx);
      this.bridge.connectToDestination(this.masterGain, this.ctx);
      this.masterGain.setGain(this.masterVolume);
      await this.ctx.resume();
      this.state = 'running';
    } catch {
      // SSR or no audio HW — engine becomes inert.
      this.ctx = null;
      this.masterGain = null;
      this.state = 'closed';
    }
  }

  /** Resume a suspended context. Idempotent if already running. */
  async resume(): Promise<void> {
    if (this.state !== 'suspended' || this.ctx === null) {
      return;
    }
    try {
      await this.ctx.resume();
      this.state = 'running';
    } catch {
      // Resume failed — leave state as-is; next call retries.
    }
  }

  /** Suspend context (e.g. app backgrounded). Idempotent. */
  async suspend(): Promise<void> {
    if (this.state !== 'running' || this.ctx === null) {
      return;
    }
    try {
      await this.ctx.suspend();
      this.state = 'suspended';
    } catch {
      // Suspend failed — leave running.
    }
  }

  /** Tear down — close context, drop nodes. After this, only `resetAudioEngine` can revive. */
  async close(): Promise<void> {
    if (this.state === 'closed') {
      return;
    }
    if (this.ctx !== null) {
      try {
        await this.ctx.close();
      } catch {
        // Best-effort.
      }
    }
    if (this.masterGain !== null) {
      this.masterGain.disconnect();
    }
    this.ctx = null;
    this.masterGain = null;
    this.state = 'closed';
  }

  /**
   * Set master volume (0..1). Clamped. Respects mute: passing 0
   * zeroes gain but keeps the graph alive for quick resume.
   */
  setMasterVolume(value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.masterVolume = clamped;
    if (this.masterGain !== null) {
      this.masterGain.setGain(clamped);
    }
  }

  /**
   * Convenience mute: remembers last volume for unmute.
   * Mute = setMasterVolume(0). Unmute = restore saved value.
   */
  mute(): void {
    if (this.mutedVolume === null) {
      this.mutedVolume = this.masterVolume;
    }
    this.setMasterVolume(0);
  }

  unmute(): void {
    if (this.mutedVolume !== null) {
      this.setMasterVolume(this.mutedVolume);
      this.mutedVolume = null;
    }
  }

  /** True if currently muted. */
  isMuted(): boolean {
    return this.mutedVolume !== null;
  }

  /**
   * Get the master gain node (for downstream modules to connect INTO).
   * Returns null if engine is not initialized or closed.
   */
  getMasterGain(): BridgeGainNode | null {
    return this.masterGain;
  }

  /**
   * Get the underlying context (modules need it to create nodes).
   * Returns null if not initialized.
   */
  getContext(): BridgeAudioContext | null {
    return this.ctx;
  }

  /** True when init() has succeeded and context is alive. */
  isReady(): boolean {
    return this.state === 'running' || this.state === 'suspended';
  }

  setAmbientLayer(layer: AmbientLayer | null): void {
    this.ambientLayer = layer;
    if (layer !== null && this.pendingProfile !== null) {
      layer.setProfile(this.pendingProfile);
      this.pendingProfile = null;
    }
  }

  getAmbientLayer(): AmbientLayer | null {
    return this.ambientLayer;
  }

  setAmbientProfile(profile: AmbientProfile | null): void {
    if (this.ambientLayer !== null) {
      this.ambientLayer.setProfile(profile);
    } else {
      this.pendingProfile = profile;
    }
  }
}

// --- Module-level singleton ---

let audioEngineInstance: AudioEngine | null = null;

/**
 * Get the existing audio engine singleton, or create it on first call.
 * `opts.bridge` is required on first call; ignored thereafter.
 */
export const getOrCreateAudioEngine = (opts?: AudioEngineOptions): AudioEngine => {
  if (audioEngineInstance === null) {
    if (opts === undefined) {
      throw new Error('getOrCreateAudioEngine() requires options on first call');
    }
    audioEngineInstance = new AudioEngine(opts);
  }
  return audioEngineInstance;
};

/** Test-only: clear singleton. Allows fresh per-test instantiation. */
export const resetAudioEngine = (): void => {
  if (audioEngineInstance !== null) {
    void audioEngineInstance.close();
    audioEngineInstance = null;
  }
};

/** SSR-safe accessor: returns null if no instance created yet. */
export const getAudioEngine = (): AudioEngine | null => audioEngineInstance;
