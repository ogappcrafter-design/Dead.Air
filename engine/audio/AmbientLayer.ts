// engine/audio/AmbientLayer.ts
// Looping background soundscape. Fades in/out, swappable by band, never fully stops.

import {
  PlatformBridge,
  BridgeAudioContext,
  BridgeAudioNode,
  BridgeBufferSourceNode,
  BridgeGainNode,
  BridgeBiquadNode,
  StaticCharacter,
} from './PlatformBridge';
import { Band } from '../../lib/constants';
import type { AmbientProfile } from './profiles/types';

/** Map band → ambient character params (filter + base gain). */
export interface AmbientBandParams {
  /** Center frequency of the band-pass coloration (Hz). */
  centerFreq: number;
  /** Base gain (0..1) — how present this band is. */
  baseGain: number;
  /** Detune of the source buffer playback (cents). 0 = original pitch. */
  detuneCents: number;
}

/** Per-band ambient tone palette. Off-bands become more otherworldly. */
export const bandAmbientParams: Record<Band, AmbientBandParams> = {
  LIVING: { centerFreq: 500, baseGain: 0.25, detuneCents: 0 },
  LIMINAL: { centerFreq: 220, baseGain: 0.3, detuneCents: -200 },
  LOST: { centerFreq: 110, baseGain: 0.35, detuneCents: -700 },
  CLASSIFIED: { centerFreq: 800, baseGain: 0.4, detuneCents: 400 },
  '████████': { centerFreq: 1000, baseGain: 0.5, detuneCents: -1200 },
  WEATHER: { centerFreq: 200, baseGain: 0.38, detuneCents: -300 },
  PIRATE: { centerFreq: 450, baseGain: 0.35, detuneCents: 200 },
  HISTORICAL: { centerFreq: 350, baseGain: 0.3, detuneCents: -100 },
};

/** Default fade time (seconds). */
export const DEFAULT_FADE_SECONDS = 2;

/**
 * AmbientLayer — always-present looping soundscape that recolors by band.
 *
 * Contract:
 * - Never fully stops. Fade-out → swap buffer → fade-in.
 * - Swapping is crossfade: previous source fades while next fades in.
 * - Owns its gain node: fade = gain ramp.
 */
export class AmbientLayer {
  private readonly bridge: PlatformBridge;
  private readonly ctx: BridgeAudioContext;
  private readonly destination: BridgeAudioNode;

  private gain: BridgeGainNode;
  private tone: BridgeBiquadNode;
  private source: BridgeBufferSourceNode | null = null;
  private currentBand: Band | null = null;
  private currentProfile: AmbientProfile | null = null;
  private currentGain = 0;
  private targetGain = 0;
  private playing = false;
  private fadeSeconds = DEFAULT_FADE_SECONDS;
  private rafHandle: ReturnType<typeof setInterval> | null = null;

  constructor(bridge: PlatformBridge, ctx: BridgeAudioContext, destination: BridgeAudioNode) {
    this.bridge = bridge;
    this.ctx = ctx;
    this.destination = destination;

    this.gain = bridge.createMasterGain(ctx);
    this.gain.setGain(0);

    this.tone = bridge.createBiquad(ctx, 'bandpass');
    this.tone.setFrequency(500);
    this.tone.setQ(0.7);

    bridge.connect(this.tone, this.gain);
    bridge.connect(this.gain, destination);
  }

  /**
   * Start the ambient layer with the given band.
   * Idempotent — calling twice changes band.
   */
  start(band: Band, fadeSeconds = this.fadeSeconds): void {
    this.fadeSeconds = fadeSeconds;
    this.currentBand = band;
    this.playing = true;

    const params = this.getParamsForBand(band);
    this.tone.setFrequency(params.centerFreq);
    this.targetGain = params.baseGain;

    if (this.source === null) {
      const character = this.currentProfile?.staticCharacter ?? 'pink';
      this.source = this.bridge.createStaticSource(this.ctx, character);
      this.source.setLoop(true);
      this.source.connect(this.tone);
      this.source.start(this.ctx.currentTime);
    }
    this.scheduleFadeIn(fadeSeconds);
  }

  /** Cross-fade to a new band. Source stays alive (same buffer) — tone recolors. */
  swapBand(band: Band, fadeSeconds = this.fadeSeconds): void {
    if (!this.playing) {
      this.start(band, fadeSeconds);
      return;
    }
    this.currentBand = band;
    const params = this.getParamsForBand(band);
    this.tone.setFrequency(params.centerFreq);
    this.targetGain = params.baseGain;
    this.fadeTo(params.baseGain, fadeSeconds);
  }

  /** Fade out — but source keeps running (never fully stop). */
  fadeOut(fadeSeconds = this.fadeSeconds): void {
    this.targetGain = 0;
    this.fadeTo(0, fadeSeconds);
  }

  /** Fade in to target gain (uses last band params). */
  fadeIn(fadeSeconds = this.fadeSeconds): void {
    if (this.currentBand === null) {
      return;
    }
    const params = this.getParamsForBand(this.currentBand);
    this.targetGain = params.baseGain;
    this.fadeTo(params.baseGain, fadeSeconds);
  }

  /** Set fade time for subsequent ops. */
  setFadeSeconds(seconds: number): void {
    this.fadeSeconds = Math.max(0.05, seconds);
  }

  /** Current band (or null if never started). */
  getBand(): Band | null {
    return this.currentBand;
  }

  /** Current gain (0..1). */
  getGain(): number {
    return this.currentGain;
  }

  /** True if layer is currently playing. */
  isPlaying(): boolean {
    return this.playing;
  }

  /** Current ambient profile, or null if using default. */
  getProfile(): AmbientProfile | null {
    return this.currentProfile;
  }

  /** Set an atmospheric ambient profile. Recreates source if noise character changes. */
  setProfile(profile: AmbientProfile | null): void {
    const prevChar: StaticCharacter = this.currentProfile?.staticCharacter ?? 'pink';
    const nextChar: StaticCharacter = profile?.staticCharacter ?? 'pink';
    this.currentProfile = profile;

    if (this.source !== null && prevChar !== nextChar) {
      this.source.stop();
      this.source.disconnect();
      this.source = this.bridge.createStaticSource(this.ctx, nextChar);
      this.source.setLoop(true);
      this.source.connect(this.tone);
      this.source.start(this.ctx.currentTime);
    }

    if (this.currentBand !== null && this.playing) {
      const params = this.getParamsForBand(this.currentBand);
      this.tone.setFrequency(params.centerFreq);
      this.targetGain = params.baseGain;
      this.fadeTo(params.baseGain, this.fadeSeconds);
    }
  }

  private getParamsForBand(band: Band): AmbientBandParams {
    if (this.currentProfile !== null) {
      return this.currentProfile.bandParams[band];
    }
    return bandAmbientParams[band];
  }

  /** Internal: simple linear fade using setInterval ticks. */
  private scheduleFadeIn(seconds: number): void {
    this.fadeTo(this.targetGain, seconds);
  }

  private fadeTo(target: number, seconds: number): void {
    if (this.rafHandle !== null) {
      clearInterval(this.rafHandle);
      this.rafHandle = null;
    }
    const startGain = this.currentGain;
    const delta = target - startGain;
    const ticks = Math.max(1, Math.round(seconds * 20)); // 20 Hz update
    const step = delta / ticks;
    let n = 0;
    this.rafHandle = setInterval(() => {
      n += 1;
      this.currentGain = startGain + step * n;
      if (n >= ticks) {
        this.currentGain = target;
        if (this.rafHandle !== null) {
          clearInterval(this.rafHandle);
          this.rafHandle = null;
        }
      }
      this.gain.setGain(this.currentGain);
    }, 50);
  }

  /** Tear down — stops source + clears gain. After dispose, instance is unusable. */
  dispose(): void {
    if (this.rafHandle !== null) {
      clearInterval(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.source !== null) {
      this.source.stop();
      this.source.disconnect();
      this.source = null;
    }
    this.tone.disconnect();
    this.gain.disconnect();
    this.playing = false;
  }
}
