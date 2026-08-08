// components/tapes/TapePlayer.tsx
// Pure presentational component for the tape playback overlay.
//
// Renders a full-screen modal with the cued tape's transcript and transport
// controls. Props-only — no store access, no audio wiring, no side-effects
// beyond invocation of `onClose` / `onPlayPress` callbacks. The parent screen
// owns the TapePlayback state machine and resolves which transcript to pass.
//
// Layout matches the JustListenCall idiom: backdrop Pressable -> card ->
// header / body / hint, plus a transport row with PLAY/PAUSE/STOP/CLOSE,
// a playback progress bar, and a master-volume slider (DEA-75).

import React, { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import type { Band } from '../../lib/constants';

export interface TapePlayerProps {
  /** Display name of the cued tape (e.g. "Tape #6 — Signal From Guardian"). */
  tapeName: string;
  /** Transcript lines to render in the body scroll view. */
  transcript: readonly string[];
  /** Ambient band of the tape's originating call — drives the band label. */
  band: Band;
  /** Whether the transport is currently engaged (PLAY). */
  isPlaying: boolean;
  /** Tap handler for the PLAY / PAUSE transport toggle. */
  onPlayPress: () => void;
  /** Tap handler for the STOP button — halts playback + resets position. */
  onStopPress: () => void;
  /** Tap handler for the CLOSE button — also fires on backdrop tap. */
  onClose: () => void;
  /** Playback progress fraction 0..1 (0 = start, 1 = end). */
  progress: number;
  /** Current playback position label (e.g. "1:23"). */
  positionLabel: string;
  /** Total tape duration label (e.g. "4:32"). */
  durationLabel: string;
  /** Master volume 0..1. */
  volume: number;
  /** Volume change handler — called when user adjusts the slider. */
  onVolumeChange: (vol: number) => void;
}

/** Band display labels (short uppercase strings for the ambient indicator). */
const BAND_LABEL: ReadonlyRecord<Band, string> = {
  LIVING: 'LIVING',
  LIMINAL: 'LIMINAL',
  LOST: 'LOST',
  CLASSIFIED: 'CLASSIFIED',
  '████████': '████████',
  WEATHER: 'WEATHER',
  PIRATE: 'PIRATE',
  HISTORICAL: 'HISTORICAL',
};

/** Minimal record utility — keeps type-safety without pulling in TS helpers. */
type ReadonlyRecord<K extends string, V> = {
  readonly [key in K]: V;
};

/**
 * TapePlayer — presentational overlay for reviewing a collected tape.
 *
 * Pure: receives state + callbacks and renders. Does not subscribe to any
 * store, does not call into the audio engine. The parent screen wires the
 * transport (play/stop) against a TapePlayback instance and the band store
 * (for already-collected status); TapePlayer simply reflects what it is told.
 */
export const TapePlayer = memo(function TapePlayer({
  tapeName,
  transcript,
  band,
  isPlaying,
  onPlayPress,
  onStopPress,
  onClose,
  progress,
  positionLabel,
  durationLabel,
  volume,
  onVolumeChange,
}: TapePlayerProps) {
  const progressPct = Math.max(0, Math.min(100, progress * 100));

  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.tapeName} numberOfLines={2}>
            {tapeName}
          </Text>
          <Text style={styles.band} numberOfLines={1}>
            {BAND_LABEL[band]} BAND
          </Text>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          nestedScrollEnabled
        >
          {transcript.length === 0 ? (
            <Text style={styles.empty}>— no transcript —</Text>
          ) : (
            transcript.map((line, i) => (
              <Text style={styles.line} key={`${i}-${line.slice(0, 16)}`}>
                {line}
              </Text>
            ))
          )}
        </ScrollView>

        <View style={styles.progressRow}>
          <Text style={styles.timeLabel}>{positionLabel}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.timeLabel}>{durationLabel}</Text>
        </View>

        <View style={styles.volumeRow}>
          <Text style={styles.volumeLabel}>VOL</Text>
          <View style={styles.volumeTrack}>
            <View style={[styles.volumeFill, { width: `${volume * 100}%` }]} />
          </View>
          <Pressable
            style={styles.volumeTouch}
            onPress={(e) => {
              const { locationX } = e.nativeEvent;
              const trackWidth = 200;
              const ratio = Math.max(0, Math.min(1, locationX / trackWidth));
              onVolumeChange(ratio);
            }}
            accessibilityRole="adjustable"
            accessibilityLabel="Master volume"
          />
        </View>

        <View style={styles.transportRow}>
          <Pressable
            style={styles.transportButton}
            onPress={onPlayPress}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause tape' : 'Play tape'}
          >
            <Text style={styles.transportLabel}>{isPlaying ? 'PAUSE' : 'PLAY'}</Text>
          </Pressable>
          <Pressable
            style={styles.stopButton}
            onPress={onStopPress}
            accessibilityRole="button"
            accessibilityLabel="Stop tape"
          >
            <Text style={styles.transportLabel}>STOP</Text>
          </Pressable>
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close tape player"
          >
            <Text style={styles.closeLabel}>CLOSE</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(3, 3, 3, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  tapeName: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '700',
    color: colors.amber,
    letterSpacing: 2,
    textAlign: 'center',
  },
  band: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 3,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  body: {
    minHeight: 200,
    maxHeight: 360,
  },
  bodyContent: {
    paddingVertical: spacing.sm,
  },
  line: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  empty: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  timeLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    marginHorizontal: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.amber,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    height: 24,
  },
  volumeLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
    width: 28,
  },
  volumeTrack: {
    flex: 1,
    height: 4,
    marginRight: 28,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  volumeFill: {
    height: '100%',
    backgroundColor: colors.dimGreen,
  },
  volumeTouch: {
    position: 'absolute',
    left: 32,
    right: 32,
    top: 0,
    bottom: 0,
  },
  transportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  transportButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.amber,
  },
  stopButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  transportLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.amber,
    letterSpacing: 3,
  },
  closeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  closeLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 3,
  },
});

export default TapePlayer;
