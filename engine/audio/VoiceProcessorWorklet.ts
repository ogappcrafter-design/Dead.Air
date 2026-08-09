// engine/audio/VoiceProcessorWorklet.ts
// Wraps AudioWorkletNode for voice processing, with fallback to VoiceProcessor
// on platforms that don't support AudioWorklets (native bridge, older browsers).
// Respects AudioPerformanceConfig for quality/performance tradeoffs.

import { PlatformBridge, BridgeAudioContext, BridgeAudioNode, VoicePreset } from './PlatformBridge';
import { Band } from '../../lib/constants';
import { bandVoicePreset } from './PlatformBridge';
import { VoiceProcessor, voicePresets } from './VoiceProcessor';
import type { BitcrushPerfParams } from './AudioPerformanceConfig';

/**
 * VoiceProcessorWorklet — tries to use AudioWorklet for off-main-thread
 * voice processing, falls back to VoiceProcessor (PlatformBridge-based)
 * when AudioWorklets are not available (native bridge, older browsers).
 *
 * API mirrors VoiceProcessor so callers can swap seamlessly.
 */
export class VoiceProcessorWorklet {
  private readonly bridge: PlatformBridge;
  private readonly ctx: BridgeAudioContext;
  private readonly destination: BridgeAudioNode;
  private readonly perf?: BitcrushPerfParams;

  private workletNode: AudioWorkletNode | null = null;
  private fallback: VoiceProcessor | null = null;
  private readonly useWorklet: boolean;
  private workletLoading = false;
  private currentPreset: VoicePreset | null = null;
  private preloadedPreset: VoicePreset | null = null;

  constructor(
    bridge: PlatformBridge,
    ctx: BridgeAudioContext,
    destination: BridgeAudioNode,
    perf?: BitcrushPerfParams,
  ) {
    this.bridge = bridge;
    this.ctx = ctx;
    this.destination = destination;
    this.perf = perf;

    // Only attempt worklet on web platform with real AudioContext.
    // Native bridges don't expose audioWorklet.
    this.useWorklet = this.canUseWorklet();

    if (this.useWorklet) {
      this.initWorklet();
    } else {
      this.fallback = new VoiceProcessor(bridge, ctx, destination, perf);
    }
  }

  /** Check if AudioWorklet is available on this platform. */
  private canUseWorklet(): boolean {
    if (this.bridge.platform !== 'web') {
      return false;
    }
    try {
      // Access the underlying Web AudioContext for worklet support check.
      // The bridge wraps a real AudioContext on web.
      const webCtx = (this.ctx as unknown as { context?: AudioContext }).context;
      if (!webCtx || !webCtx.audioWorklet) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /** Initialize the AudioWorklet node. May throw if module load fails. */
  private initWorklet(): void {
    this.workletLoading = true;
    try {
      const webCtx = (this.ctx as unknown as { context: AudioContext }).context;
      const moduleUrl = './worklets/voiceProcessor.worklet.js';

      void webCtx.audioWorklet
        .addModule(moduleUrl)
        .then(() => {
          if (this.fallback) {
            this.workletLoading = false;
            return;
          }
          this.workletNode = new AudioWorkletNode(webCtx, 'voice-processor', {
            processorOptions: {
              eqCenter: 1800,
              eqQ: 0.8,
              compThreshold: -24,
              compRatio: 3,
              outputGain: 0.85,
              bitcrushDepth: 0.05,
            },
          });
          this.workletNode.connect((this.destination as unknown as { node: AudioNode }).node);
          this.workletLoading = false;
          if (this.currentPreset) {
            this.applyPreset(this.currentPreset);
          }
        })
        .catch(() => {
          if (!this.fallback) {
            this.fallback = new VoiceProcessor(this.bridge, this.ctx, this.destination, this.perf);
          }
          this.workletLoading = false;
          if (this.currentPreset) {
            this.fallback.applyPreset(this.currentPreset);
          }
        });
    } catch {
      this.fallback = new VoiceProcessor(this.bridge, this.ctx, this.destination, this.perf);
      this.workletLoading = false;
    }
  }

  /** Input node — connect call audio sources INTO this. */
  getInput(): BridgeAudioNode {
    if (this.fallback) {
      return this.fallback.getInput();
    }
    if (this.workletNode) {
      // Return the worklet node wrapped as a BridgeAudioNode.
      // The caller connects via PlatformBridge.connect, which on web
      // delegates to AudioNode.connect.
      return {
        kind: 'worklet',
        disconnect: () => {
          this.workletNode?.disconnect();
        },
        node: this.workletNode as unknown as AudioNode,
      } as BridgeAudioNode;
    }
    this.fallback = new VoiceProcessor(this.bridge, this.ctx, this.destination, this.perf);
    this.workletLoading = false;
    return this.fallback.getInput();
  }

  /** Apply a named preset (reconfigures entire chain). */
  applyPreset(preset: VoicePreset): void {
    this.currentPreset = preset;
    const params = voicePresets[preset];

    if (this.fallback) {
      this.fallback.applyPreset(preset);
      return;
    }

    if (this.workletNode) {
      this.preloadedPreset = null;
      const port = (this.workletNode as unknown as { port: MessagePort }).port;
      port.postMessage({
        eqCenter: params.eqCenter,
        eqQ: params.eqQ,
        compThreshold: params.compThreshold,
        compRatio: params.compRatio,
        outputGain: params.outputGain,
        bitcrushDepth: params.bitcrush,
      });
    }
  }

  /**
   * Preload a voice preset ahead of the actual call start.
   * For worklet path, this just stores the preset (the worklet applies
   * params via message, which is already fast). For fallback, delegates
   * to VoiceProcessor.preloadVoice.
   */
  preloadVoice(preset: VoicePreset): void {
    if (this.fallback) {
      this.fallback.preloadVoice(preset);
      return;
    }
    this.preloadedPreset = preset;
    // Apply immediately — worklet message is already low-overhead.
    this.applyPreset(preset);
    this.preloadedPreset = preset;
  }

  /** Apply preset for a given Band. */
  applyPresetForBand(band: Band): void {
    this.applyPreset(bandVoicePreset(band));
  }

  /** Preload preset for a given Band ahead of call start. */
  preloadVoiceForBand(band: Band): void {
    this.preloadVoice(bandVoicePreset(band));
  }

  /** True if a preset has been preloaded and matches the given preset. */
  hasPreloadedPreset(preset: VoicePreset): boolean {
    return this.preloadedPreset === preset;
  }

  /** Current preset (or null if none applied). */
  getPreset(): VoicePreset | null {
    return this.currentPreset;
  }

  /** True if the worklet path is active (vs fallback). */
  isUsingWorklet(): boolean {
    return this.workletNode !== null;
  }

  /** Tear down. After dispose, instance is unusable. */
  dispose(): void {
    if (this.fallback) {
      this.fallback.dispose();
      this.fallback = null;
    }
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
  }

  /**
   * Create a TapeDroneSynth wired to the same destination.
   * Delegates to fallback VoiceProcessor if using fallback path.
   */
  createTapeDroneSynth(): import('./TapeDroneSynth').TapeDroneSynth {
    if (this.fallback) {
      return this.fallback.createTapeDroneSynth();
    }
    // For worklet path, create a new synth with the bridge/ctx directly.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TapeDroneSynth = require('./TapeDroneSynth').TapeDroneSynth;
    return new TapeDroneSynth(this.bridge, this.ctx, this.destination);
  }

  /**
   * Build a tape audio profile from band + tape id.
   */
  buildTapeProfile(band: Band, tapeId: string): import('./TapeDroneSynth').TapeAudioProfile {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./TapeDroneSynth').buildTapeProfile(band, tapeId);
  }
}
