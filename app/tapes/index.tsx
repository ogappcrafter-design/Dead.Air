// app/tapes/index.tsx
// Tape Collection screen — lists all 15 unlockable tapes, shows collected
// status, and invokes TapePlayer overlay for collected tapes.
//
// State wiring:
//   - useGameStore.tapes: collected tape names (post-dedup, persisted)
//   - local useState: selectedTape (drives overlay) + playback (TapePlayback
//     instance, stable across renders via useRef) + playbackState snapshot
//
// Routing: back button uses expo-router's useRouter().back() to return to
// the radio screen. Tapes screen is declared in app/_layout.tsx Stack.

import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ALL_TAPES, CALLS } from '../../data/calls';
import { colors, fonts, spacing } from '../../lib/theme';
import { BANDS } from '../../lib/constants';
import type { Band } from '../../lib/constants';
import type { CallData } from '../../engine/calls/types';
import { useGameStore } from '../../store/useGameStore';
import { findCallByTape } from '../../engine/progression/TapeLookup';
import { TapePlayback } from '../../engine/progression/TapePlayback';
import TapePlayer from '../../components/tapes/TapePlayer';

/** Band lookup from numeric index (CALLS[].band) to Band string literal. */
const BAND_BY_INDEX: readonly Band[] = BANDS;

/** Build transcript lines for a tape's originating call. Handles all call
 *  shapes: plain lines, SIGNAL_DECODE intro+decodedMessage, and empty. */
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

/** Memoized row component for the tape FlatList. */
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

/** Module-level separator — stable reference across renders. */
function TapeListSeparator() {
  return <View style={styles.separator} />;
}

export default function TapesScreen() {
  const router = useRouter();
  const collectedTapes = useGameStore((s) => s.tapes);

  // Stable TapePlayback instance. useRef avoids re-instantiating on every
  // render; the snapshot below triggers re-renders when state changes.
  const playbackRef = useRef<TapePlayback>(new TapePlayback());
  const [playbackState, setPlaybackState] = useState(playbackRef.current.getState());
  const [selectedTape, setSelectedTape] = useState<string | null>(null);

  const collectedSet = useMemo(() => new Set(collectedTapes), [collectedTapes]);

  // Memoize transcript and band for the selected tape — avoids recomputing
  // the call lookup + buildTranscript + band resolution on every render.
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

  const closePlayer = useCallback(() => {
    playbackRef.current.stop();
    setPlaybackState(playbackRef.current.getState());
    setSelectedTape(null);
  }, []);

  const handlePlayPress = useCallback(() => {
    if (selectedTape === null) return;
    if (playbackState.isPlaying) {
      playbackRef.current.stop();
    } else {
      const call = findCallByTape(selectedTape, CALLS as unknown as CallData[]);
      const band: Band =
        call !== null && call.band >= 0 && call.band < BAND_BY_INDEX.length
          ? BAND_BY_INDEX[call.band]!
          : 'LIVING';
      playbackRef.current.play(selectedTape, band);
    }
    setPlaybackState(playbackRef.current.getState());
  }, [selectedTape, playbackState.isPlaying]);

  const handleTapePress = useCallback((tapeName: string) => {
    // Tapping a collected tape opens the player and cues it; transport starts
    // idle (PLAY) — user engages via the transport toggle.
    setSelectedTape(tapeName);
    playbackRef.current.stop();
    setPlaybackState(playbackRef.current.getState());
  }, []);

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
          onClose={closePlayer}
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
