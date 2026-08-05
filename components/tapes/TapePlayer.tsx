// components/tapes/TapePlayer.tsx
// Pure presentational component for the tape playback overlay.
//
// Renders a full-screen modal with the cued tape's transcript and transport
// controls. Props-only — no store access, no audio wiring, no side-effects
// beyond invocation of `onClose` / `onPlayPress` callbacks. The parent screen
// owns the TapePlayback state machine and resolves which transcript to pass.
//
// Layout matches the JustListenCall idiom: backdrop Pressable -> card ->
// header / body / hint, plus a transport row with PLAY/STOP and CLOSE.

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
  /** Tap handler for the PLAY / STOP transport toggle. */
  onPlayPress: () => void;
  /** Tap handler for the CLOSE button — also fires on backdrop tap. */
  onClose: () => void;
}

/** Band display labels (short uppercase strings for the ambient indicator). */
const BAND_LABEL: ReadonlyRecord<Band, string> = {
  LIVING: 'LIVING',
  LIMINAL: 'LIMINAL',
  LOST: 'LOST',
  CLASSIFIED: 'CLASSIFIED',
  '████████': '████████',
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
export function TapePlayer({
  tapeName,
  transcript,
  band,
  isPlaying,
  onPlayPress,
  onClose,
}: TapePlayerProps) {
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

        <View style={styles.transportRow}>
          <Pressable
            style={styles.transportButton}
            onPress={onPlayPress}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Stop tape' : 'Play tape'}
          >
            <Text style={styles.transportLabel}>{isPlaying ? 'STOP' : 'PLAY'}</Text>
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
}

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
