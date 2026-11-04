// hooks/useCallVoice.ts
// DEA-94 — voices the active call's lines through the existing voice chain.
//
// Design decision (on-device, no cloud TTS):
//   - Speech is synthesized locally by a formant synthesizer (engine/audio/tts)
//     from the call text that is already on the device. Nothing is uploaded,
//     no player-identifying data leaves the app, and there is no provider
//     account, key, or per-request cost.
//   - Rendered PCM is played into `VoiceProcessor.getInput()`, so every line
//     gets the same EQ → compressor → bitcrush treatment as recorded audio.
//   - Graceful degradation: native (no PCM bridge yet), SSR, a closed audio
//     context, an unsupported bridge, or voice volume 0 all leave the call
//     completely text-only. Playback failures are swallowed — a call must
//     never break because a voice could not render.
//
// The hook only *accompanies* the call UI: it fits each line into the existing
// 2500 ms line window but never changes renderers' timers, outcomes, or sanity
// effects.

import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { BANDS, type Band } from '../lib/constants';
import type { CallData } from '../engine/calls/types';
import { interpolateCallLines } from '../lib/callInterpolation';
import { usePlayerStore } from '../store/usePlayerStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useGameStore } from '../store/useGameStore';
import { getOrCreateAudioEngine } from '../engine/audio/AudioEngine';
import { configForHint } from '../engine/audio/AudioPerformanceConfig';
import { VoiceProcessor } from '../engine/audio/VoiceProcessor';
import { CallVoiceEngine, DEFAULT_LINE_WINDOW_MS } from '../engine/audio/CallVoiceEngine';
import { loadCallVoiceBridge } from '../engine/audio/CallVoiceBridgeLoader';
import { supportsPcmPlayback } from '../engine/audio/PlatformBridge';
import { voiceProfileFor, type VoiceProfile } from '../engine/audio/tts/VoiceProfile';

const bandForCall = (bandIndex: number): Band => BANDS[bandIndex] ?? 'LIVING';

export interface CallVoiceOptions {
  /** Only speak while the owning screen is focused. Defaults to true. */
  enabled?: boolean;
  /** Override the per-line window. Defaults to the call UI's 2500 ms. */
  lineDurationMs?: number;
}

/**
 * Speak the active call's lines. Call with the active `CallData` (or null).
 * Safe to call on every render: all work is memoized per call identity.
 */
export function useCallVoice(call: CallData | null, options: CallVoiceOptions = {}): void {
  const enabled = options.enabled ?? true;
  const lineDurationMs = options.lineDurationMs ?? DEFAULT_LINE_WINDOW_MS;

  const playerName = usePlayerStore((s) => s.playerName);
  const djCallSign = usePlayerStore((s) => s.djCallSign);
  const stationName = usePlayerStore((s) => s.stationName);
  const voiceVolume = useSettingsStore((s) => s.voiceVolume);
  const audioQuality = useSettingsStore((s) => s.audioQuality);
  const sanity = useGameStore((s) => s.sanity);

  const callId = call?.id ?? null;
  const band = call === null ? 'LIVING' : bandForCall(call.band);
  const variant = call?.sourceCustomFrequencyId ?? 'base';

  const lines = useMemo(
    () =>
      call === null
        ? []
        : interpolateCallLines(call.id, call.lines ?? [], { playerName, djCallSign, stationName }),
    [call, playerName, djCallSign, stationName],
  );

  /**
   * One profile per speaker index. Non-multi-caller calls only use speaker 0;
   * MULTI_CALLER alternates voices per `lineSpeakers`.
   */
  const profilesBySpeaker = useMemo(() => {
    const map = new Map<number, VoiceProfile>();
    if (call === null) return map;

    const speakerIndexes = new Set<number>([0]);
    for (const speaker of call.lineSpeakers ?? []) speakerIndexes.add(speaker);

    const source = {
      id: call.id,
      callerId: call.callerId,
      callerName: call.callerName,
      band: call.band,
      signal: call.signal,
    };

    for (const speakerIndex of speakerIndexes) {
      const profile = voiceProfileFor(source, { sanity, speakerIndex, variant });
      map.set(speakerIndex, { ...profile, gain: profile.gain * voiceVolume });
    }
    return map;
  }, [call, sanity, variant, voiceVolume]);

  const baseProfile = profilesBySpeaker.get(0) ?? null;

  const lineSpeakers = call?.lineSpeakers;

  useEffect(() => {
    if (!enabled || call === null || baseProfile === null) return;
    if (lines.length === 0) return;
    if (voiceVolume <= 0) return;
    if (Platform.OS !== 'web') return;

    let cancelled = false;
    let engine: CallVoiceEngine | null = null;
    let processor: VoiceProcessor | null = null;

    void (async () => {
      try {
        const bridge = await loadCallVoiceBridge();
        if (bridge === null || cancelled) return;

        const audioEngine = getOrCreateAudioEngine({
          bridge,
          perfConfig: configForHint(audioQuality === 'low' ? 'interactive' : 'balanced'),
        });
        await audioEngine.init();
        if (cancelled || !audioEngine.isReady()) return;

        const ctx = audioEngine.getContext();
        const masterGain = audioEngine.getMasterGain();
        if (ctx === null || masterGain === null) return;

        // Reuse whichever bridge the shared engine was created with — mixing
        // bridges with a foreign context is not supported.
        const activeBridge = audioEngine.getBridge();
        if (!supportsPcmPlayback(activeBridge)) return;

        processor = new VoiceProcessor(activeBridge, ctx, masterGain);
        processor.applyPresetForBand(band);

        engine = new CallVoiceEngine({
          bridge: activeBridge,
          ctx,
          destination: processor.getInput(),
        });
        if (!engine.isSupported()) return;

        const profileForLine =
          lineSpeakers !== undefined && lineSpeakers.length > 0
            ? (index: number): VoiceProfile =>
                profilesBySpeaker.get(lineSpeakers[index] ?? 0) ?? baseProfile
            : undefined;

        await engine.speak(lines, baseProfile, { lineDurationMs, profileForLine });
      } catch {
        // Any audio failure degrades to text-only — never break the call.
      }
    })();

    return () => {
      cancelled = true;
      engine?.dispose();
      processor?.dispose();
    };
    // `lines`, `baseProfile` and `profilesBySpeaker` are memoized per call.
  }, [
    enabled,
    callId,
    band,
    lines,
    baseProfile,
    profilesBySpeaker,
    lineSpeakers,
    lineDurationMs,
    voiceVolume,
    audioQuality,
  ]);
}
