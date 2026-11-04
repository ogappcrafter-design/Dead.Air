// engine/audio/CallVoiceEngine.ts
// DEA-94 — on-device call voice playback.
//
// Owns the bridge-side lifecycle for synthesized speech: it renders lines with
// the formant synthesizer, caches them (bounded), and plays them into the
// existing VoiceProcessor input so every line inherits EQ → compressor →
// bitcrush. No network, no credentials, no native speech module.
//
// The engine degrades gracefully: a bridge without `createPcmSource` simply
// reports `isSupported() === false` and the call UI stays text-only. Web plays
// through a live Web Audio graph; native renders the same VoiceProcessor chain
// offline and plays the result via expo-audio.

import {
  PlatformBridge,
  BridgeAudioContext,
  BridgeAudioNode,
  BridgeBufferSourceNode,
  supportsPcmPlayback,
} from './PlatformBridge';
import type { VoiceProfile } from './tts/VoiceProfile';
import { renderSpeech, type RenderedSpeech } from './tts/FormantSynthesizer';

/**
 * Default window per call line. Mirrors the `LINE_ADVANCE_MS` used by the call
 * renderers (2500 ms); the engine only fits speech to that window — it never
 * changes the renderers' timers or mechanics.
 */
export const DEFAULT_LINE_WINDOW_MS = 2500;

/** Pause left between lines inside a window so lines don't run together. */
const LINE_GAP_MS = 140;

/** Longest line the synthesizer will render (chars). Guards against abuse. */
const MAX_LINE_CHARS = 400;

/** Voice is band-limited by the radio chain; 24 kHz keeps renders cheap. */
const DEFAULT_MAX_SAMPLE_RATE = 24000;

export interface CallVoiceEngineOptions {
  bridge: PlatformBridge;
  ctx: BridgeAudioContext;
  /** Node to connect speech into — normally `VoiceProcessor.getInput()`. */
  destination: BridgeAudioNode;
  /** Override the synthesis sample rate (clamped to the context rate). */
  sampleRate?: number;
  /** Max cached rendered lines. Default 16 (~7 MB at 24 kHz mono). */
  cacheSize?: number;
}

export interface SpeakOptions {
  /** Fit each line into this window (ms). Defaults to DEFAULT_LINE_WINDOW_MS. */
  lineDurationMs?: number;
  /** Extra silence after each line, inside the window. */
  gapMs?: number;
  /** Per-line profile override (MULTI_CALLER speaker alternation). */
  profileForLine?: (index: number) => VoiceProfile;
}

export interface CallVoiceStats {
  renderedLines: number;
  playedLines: number;
  cacheHits: number;
  cachedLines: number;
}

export class CallVoiceEngine {
  private readonly bridge: PlatformBridge;
  private readonly ctx: BridgeAudioContext;
  private readonly destination: BridgeAudioNode;
  private readonly sampleRate: number;
  private readonly cacheSize: number;

  private readonly cache = new Map<string, RenderedSpeech>();
  private activeSource: BridgeBufferSourceNode | null = null;
  private pendingResolve: (() => void) | null = null;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private disposed = false;

  private renderedLines = 0;
  private playedLines = 0;
  private cacheHits = 0;

  constructor(options: CallVoiceEngineOptions) {
    this.bridge = options.bridge;
    this.ctx = options.ctx;
    this.destination = options.destination;
    this.sampleRate = Math.min(
      DEFAULT_MAX_SAMPLE_RATE,
      Math.max(8000, Math.round(options.sampleRate ?? this.ctx.sampleRate)),
    );
    this.cacheSize = Math.max(1, options.cacheSize ?? 16);
  }

  /** True when this bridge can play raw PCM (web + native). */
  isSupported(): boolean {
    return supportsPcmPlayback(this.bridge);
  }

  /** Stats for diagnostics/tests. */
  getStats(): CallVoiceStats {
    return {
      renderedLines: this.renderedLines,
      playedLines: this.playedLines,
      cacheHits: this.cacheHits,
      cachedLines: this.cache.size,
    };
  }

  /**
   * Render (or fetch from cache) one line. Returns null when unsupported, when
   * the line is empty, or when the text exceeds the guard limit.
   */
  renderLine(
    text: string,
    profile: VoiceProfile,
    targetDurationMs: number = DEFAULT_LINE_WINDOW_MS,
  ): RenderedSpeech | null {
    if (!this.isSupported()) return null;
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_LINE_CHARS) return null;

    const key = `${profile.seed}:${profile.pitchCents}:${profile.gain}:${targetDurationMs}:${this.sampleRate}:${trimmed}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      this.cacheHits += 1;
      // Refresh LRU position.
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }

    const rendered = renderSpeech(trimmed, profile, {
      sampleRate: this.sampleRate,
      targetDurationMs,
      seed: profile.seed,
    });
    this.renderedLines += 1;

    if (this.cache.size >= this.cacheSize) {
      const oldest = this.cache.keys().next();
      if (!oldest.done) this.cache.delete(oldest.value);
    }
    this.cache.set(key, rendered);
    return rendered;
  }

  /** Pre-render a line into the cache without playing it. */
  prewarm(
    text: string,
    profile: VoiceProfile,
    targetDurationMs: number = DEFAULT_LINE_WINDOW_MS,
  ): void {
    this.renderLine(text, profile, targetDurationMs);
  }

  /**
   * Speak every line in order, one per `lineDurationMs` window.
   * Resolves when finished or when `stop()` is called.
   */
  async speak(
    lines: readonly string[],
    profile: VoiceProfile,
    options: SpeakOptions = {},
  ): Promise<void> {
    if (!this.isSupported() || this.disposed) return;
    const generation = ++this.generation;
    const windowMs = Math.max(400, options.lineDurationMs ?? DEFAULT_LINE_WINDOW_MS);
    const gapMs = Math.max(0, Math.min(windowMs / 2, options.gapMs ?? LINE_GAP_MS));

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index] ?? '';
      if (!this.isCurrent(generation)) return;

      const lineProfile = options.profileForLine?.(index) ?? profile;
      const startedAt = Date.now();
      const rendered = this.renderLine(line, lineProfile, Math.max(200, windowMs - gapMs));

      if (rendered !== null && rendered.samples.length > 0) {
        // Pre-warm the following line while this one plays.
        const next = lines[index + 1];
        if (next !== undefined) {
          const nextProfile = options.profileForLine?.(index + 1) ?? profile;
          this.prewarm(next, nextProfile, Math.max(200, windowMs - gapMs));
        }
        // Cap playback to the line window so voice and text stay aligned even
        // when an unusually long line cannot be fitted into it.
        const played = await this.playBuffer(rendered, generation, windowMs - gapMs);
        if (!played || !this.isCurrent(generation)) return;
      }

      const remaining = windowMs - (Date.now() - startedAt);
      if (remaining > 0) {
        const waited = await this.wait(remaining, generation);
        if (!waited || !this.isCurrent(generation)) return;
      }
    }
  }

  /** Speak a single line and resolve when it finishes (or on stop). */
  async speakLine(
    text: string,
    profile: VoiceProfile,
    targetDurationMs: number = DEFAULT_LINE_WINDOW_MS,
  ): Promise<boolean> {
    if (!this.isSupported() || this.disposed) return false;
    const generation = ++this.generation;
    const rendered = this.renderLine(text, profile, targetDurationMs);
    if (rendered === null || rendered.samples.length === 0) return false;
    return this.playBuffer(rendered, generation);
  }

  /** Stop playback and cancel any in-flight wait. Idempotent. */
  stop(): void {
    this.generation += 1;
    if (this.activeSource !== null) {
      try {
        this.activeSource.stop();
      } catch {
        // Already stopped/never started — best effort.
      }
      try {
        this.activeSource.disconnect();
      } catch {
        // Best effort.
      }
      this.activeSource = null;
    }
    this.resolvePending();
  }

  /** Tear down. After dispose, the instance is unusable. */
  dispose(): void {
    this.stop();
    this.disposed = true;
    this.cache.clear();
  }

  // --- internals ---

  private isCurrent(generation: number): boolean {
    return !this.disposed && generation === this.generation;
  }

  private async playBuffer(
    rendered: RenderedSpeech,
    generation: number,
    maxMs?: number,
  ): Promise<boolean> {
    const createPcmSource = this.bridge.createPcmSource;
    if (createPcmSource === undefined) return false;

    let source: BridgeBufferSourceNode;
    try {
      source = createPcmSource.call(this.bridge, this.ctx, rendered.samples, rendered.sampleRate);
      this.bridge.connect(source, this.destination);
      source.start();
    } catch {
      // Bridge refused the buffer — stay silent rather than break the call.
      return false;
    }

    this.activeSource = source;
    this.playedLines += 1;

    const durationMs = rendered.durationSec * 1000;
    const waitMs = maxMs === undefined ? durationMs : Math.min(durationMs, maxMs);
    const finished = await this.wait(waitMs, generation);

    if (this.activeSource === source) {
      if (maxMs !== undefined && durationMs > maxMs) {
        try {
          source.stop();
        } catch {
          // Already ended — best effort.
        }
      }
      try {
        source.disconnect();
      } catch {
        // Best effort.
      }
      this.activeSource = null;
    }
    return finished;
  }

  /** Await `ms`, resolving early (with false) when stopped/superseded. */
  private wait(ms: number, generation: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (!this.isCurrent(generation)) {
        resolve(false);
        return;
      }
      this.pendingResolve = () => resolve(false);
      this.pendingTimer = setTimeout(
        () => {
          this.pendingTimer = null;
          this.pendingResolve = null;
          resolve(this.isCurrent(generation));
        },
        Math.max(0, ms),
      );
    });
  }

  private resolvePending(): void {
    if (this.pendingTimer !== null) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    if (resolve !== null) resolve();
  }
}
