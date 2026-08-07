// app/tapes/index.tsx
// Tape Collection screen — lists all 15 unlockable tapes, shows collected
// status, and invokes TapePlayer overlay for collected tapes.
//
// State wiring:
//   - useGameStore.tapes: collected tape names (post-dedup, persisted)
//   - useSettingsStore.masterVolume: persisted user volume preference
//   - local useState: selectedTape (drives overlay) + playback (TapePlayback
//     instance, stable across renders via useRef) + playbackState snapshot
//   - TapeDroneSynth (DEA-77): ambient drone audio per tape, lifecycle
//     owned by this screen — starts on PLAY, stops on PAUSE/STOP/CLOSE,
//     and is disposed on unmount (audio stops on navigation away).
//
// Routing: back button uses expo-router's useRouter().back() to return to
// the radio screen. Tapes screen is declared in app/_layout.tsx Stack.

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ALL_TAPES, CALLS } from '../../data/calls';
import { TAPES } from '../../data/tapes';
import { colors, fonts, spacing } from '../../lib/theme';
import { BANDS } from '../../lib/constants';
import type { Band } from '../../lib/constants';
import type { CallData } from '../../engine/calls/types';
import { useGameStore } from '../../store/useGameStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { findCallByTape } from '../../engine/progression/TapeLookup';
import { TapePlayback } from '../../engine/progression/TapePlayback';
import {
  TapeDroneSynth,
  buildTapeProfile,
  type TapeAudioProfile,
} from '../../engine/audio/TapeDroneSynth';
import { getAudioEngine, getOrCreateAudioEngine } from '../../engine/audio/AudioEngine';
import { VoiceProcessor } from '../../engine/audio/VoiceProcessor';
import { createWebAudioBridge } from '../../engine/audio/WebAudioBridge';
import TapePlayer from '../../components/tapes/TapePlayer';

const BAND_BY_INDEX: readonly Band[] = BANDS;

const buildTranscript = (call: CallData): string[] => {
  const lines: string[] = [];
  if (call.intro !== undefined) {
    lines.push(call.intro);
  }
  if (call.lines !== undefined && call.lines.length > 0) {
    lines.push(...call.lines);
  }
  if (call.decodedMessage !== undefined) {
    lines.push('The transmitted sequence decoded to:');
    lines.push(call.decodedMessage);
  }
  return lines;
};

const parseDuration = (duration: string): number => {
  const [m, s] = duration.split(':').map(Number);
  return (m || 0) * 60 + (s || 0);
};

const formatTime = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const TapeListRow = memo(function TapeListRow({
  tapeName,
  isCollected,
  onPress,
}: {
  tapeName: string;
  isCollected: boolean;
  onPress: (tapeName: string) => void;
}) {
  if (isCollected) {
    return (
      <Pressable
        style={styles.rowCollected}
        onPress={() => onPress(tapeName)}
        accessibilityRole="button"
        accessibilityLabel={`Play ${tapeName}`}
      >
        <Text style={styles.tapeNameCollected} numberOfLines={1}>
          {tapeName}
        </Text>
        <Text style={styles.rowStatus}>▸</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.rowUncollected}>
      <Text style={styles.tapeNameUncollected} numberOfLines={1}>
        ???
      </Text>
    </View>
  );
});

function TapeListSeparator() {
  return <View style={styles.separator} />;
}

export default function TapesScreen() {
  const router = useRouter();
  const collectedTapes = useGameStore((s) => s.tapes);
  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const setMasterVolume = useSettingsStore((s) => s.setMasterVolume);

  const playbackRef = useRef<TapePlayback>(new TapePlayback());
  const [playbackState, setPlaybackState] = useState(playbackRef.current.getState());
  const [selectedTape, setSelectedTape] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [position, setPosition] = useState(0);

  const droneRef = useRef<TapeDroneSynth | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const collectedSet = useMemo(() => new Set(collectedTapes), [collectedTapes]);

  const ensureAudioEngine = useCallback(() => {
    let engine = getAudioEngine();
    if (engine === null) {
      try {
        engine = getOrCreateAudioEngine({ bridge: createWebAudioBridge() });
      } catch {
        return null;
      }
    }
    if (!engine.isReady()) {
      void engine.init();
    }
    return engine;
  }, []);

  const selectedTapeIndex = useMemo(() => {
    if (selectedTape === null) return -1;
    return ALL_TAPES.indexOf(selectedTape);
  }, [selectedTape]);

  const selectedDurationSec = useMemo(() => {
    if (selectedTapeIndex < 0 || selectedTapeIndex >= TAPES.length) return 0;
    const tape = TAPES[selectedTapeIndex]!;
    return parseDuration(tape.duration);
  }, [selectedTapeIndex]);

  const selectedTranscript = useMemo(() => {
    if (selectedTape === null) return [] as string[];
    const call = findCallByTape(selectedTape, CALLS as unknown as CallData[]);
    return call !== null ? buildTranscript(call) : [];
  }, [selectedTape]);

  const selectedBand = useMemo<Band>(() => {
    if (selectedTape === null) return 'LIVING';
    const call = findCallByTape(selectedTape, CALLS as unknown as CallData[]);
    if (call === null) return 'LIVING';
    const idx = call.band;
    return idx >= 0 && idx < BAND_BY_INDEX.length ? BAND_BY_INDEX[idx]! : 'LIVING';
  }, [selectedTape]);

  const stopDrone = useCallback(() => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (droneRef.current !== null) {
      droneRef.current.stop();
      droneRef.current.dispose();
      droneRef.current = null;
    }
  }, []);

  const startDrone = useCallback(
    (tapeName: string, band: Band) => {
      stopDrone();
      const idx = ALL_TAPES.indexOf(tapeName);
      const tapeId = idx >= 0 && idx < TAPES.length ? TAPES[idx]!.id : `tape-${idx + 1}`;
      const profile = buildTapeProfile(band, tapeId);

      const engine = ensureAudioEngine();
      if (engine === null) return;

      const ctx = engine.getContext();
      const destination = engine.getMasterGain();
      if (ctx === null || destination === null) return;

      const bridge = createWebAudioBridge();
      const voice = new VoiceProcessor(bridge, ctx, destination);
      const synth = voice.createTapeDroneSynth();
      synth.setVolume(masterVolume);
      synth.start(profile);
      droneRef.current = synth;
    },
    [masterVolume, stopDrone, ensureAudioEngine],
  );

  const startTick = useCallback(() => {
    if (tickRef.current !== null) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setPosition((p) => {
        const next = p + 0.5;
        if (selectedDurationSec > 0 && next >= selectedDurationSec) {
          setProgress(1);
          // Auto-stop at end.
          stopDrone();
          playbackRef.current.stop();
          setPlaybackState(playbackRef.current.getState());
          if (tickRef.current !== null) {
            clearInterval(tickRef.current);
            tickRef.current = null;
          }
          return 0;
        }
        setProgress(selectedDurationSec > 0 ? next / selectedDurationSec : 0);
        return next;
      });
    }, 500);
  }, [selectedDurationSec, stopDrone]);

  const closePlayer = useCallback(() => {
    stopDrone();
    playbackRef.current.stop();
    setPlaybackState(playbackRef.current.getState());
    setSelectedTape(null);
    setProgress(0);
    setPosition(0);
  }, [stopDrone]);

  const handlePlayPress = useCallback(() => {
    if (selectedTape === null) return;
    if (playbackState.isPlaying) {
      // PAUSE: stop drone + tick, keep tape selected.
      stopDrone();
      if (tickRef.current !== null) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      playbackRef.current.stop();
      setPlaybackState(playbackRef.current.getState());
    } else {
      // PLAY: start drone + tick.
      const call = findCallByTape(selectedTape, CALLS as unknown as CallData[]);
      const band: Band =
        call !== null && call.band >= 0 && call.band < BAND_BY_INDEX.length
          ? BAND_BY_INDEX[call.band]!
          : 'LIVING';
      playbackRef.current.play(selectedTape, band);
      setPlaybackState(playbackRef.current.getState());
      startDrone(selectedTape, band);
      startTick();
    }
  }, [selectedTape, playbackState.isPlaying, startDrone, startTick, stopDrone]);

  const handleStopPress = useCallback(() => {
    stopDrone();
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    playbackRef.current.stop();
    setPlaybackState(playbackRef.current.getState());
    setProgress(0);
    setPosition(0);
  }, [stopDrone]);

  const handleVolumeChange = useCallback(
    (vol: number) => {
      setMasterVolume(vol);
      if (droneRef.current !== null) {
        droneRef.current.setVolume(vol);
      }
    },
    [setMasterVolume],
  );

  const handleTapePress = useCallback(
    (tapeName: string) => {
      setSelectedTape(tapeName);
      stopDrone();
      playbackRef.current.stop();
      setPlaybackState(playbackRef.current.getState());
      setProgress(0);
      setPosition(0);
    },
    [stopDrone],
  );

  // Stop audio when navigating away / unmounting.
  useEffect(() => {
    const onUnmount = () => {
      stopDrone();
      if (tickRef.current !== null) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
    return onUnmount;
  }, [stopDrone]);

  const renderItem = useCallback(
    ({ item: tapeName }: { item: string }) => (
      <TapeListRow
        tapeName={tapeName}
        isCollected={collectedSet.has(tapeName)}
        onPress={handleTapePress}
      />
    ),
    [collectedSet, handleTapePress],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to radio"
        >
          <Text style={styles.backLabel}>‹ BACK</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          TAPES COLLECTED
        </Text>
        <Text style={styles.count}>
          {collectedTapes.length} / {ALL_TAPES.length}
        </Text>
      </View>

      <FlatList
        data={ALL_TAPES}
        keyExtractor={(item, _i) => item}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={TapeListSeparator}
      />

      {selectedTape !== null && (
        <TapePlayer
          tapeName={selectedTape}
          transcript={selectedTranscript}
          band={selectedBand}
          isPlaying={playbackState.isPlaying}
          onPlayPress={handlePlayPress}
          onStopPress={handleStopPress}
          onClose={closePlayer}
          progress={progress}
          positionLabel={formatTime(position)}
          durationLabel={formatTime(selectedDurationSec)}
          volume={masterVolume}
          onVolumeChange={handleVolumeChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  backLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.amber,
    letterSpacing: 3,
  },
  count: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowCollected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  rowUncollected: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    opacity: 0.4,
  },
  tapeNameCollected: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.amber,
    letterSpacing: 1,
  },
  tapeNameUncollected: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textMuted,
    letterSpacing: 3,
  },
  rowStatus: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.amber,
    marginLeft: spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
});
