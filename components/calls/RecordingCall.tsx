// components/calls/RecordingCall.tsx
// Presentational component for RECORDING calls.
// Player scrubs through a recording clip to find a hidden timestamp,
// can reveal metadata facts, then submits to compute outcome.

import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import { computeRecordingOutcome } from '../../engine/calls/renderers/RecordingHandler';
import type { CallData, CallOutcome } from '../../engine/calls/types';

interface RecordingCallProps {
  call: CallData;
  onComplete: (outcome: CallOutcome) => void;
}

type Phase = 'intro' | 'scrub' | 'submitting';

const INTRO_DWELL_MS = 2000;

export const RecordingCall = memo(function RecordingCall({ call, onComplete }: RecordingCallProps) {
  const clips = call.recordingClips ?? [];
  const clip = clips[0];
  const metadata = clip?.metadata ?? [];
  const [seekPosition, setSeekPosition] = useState(0.5);
  const [revealedMetadata, setRevealedMetadata] = useState<boolean[]>(() =>
    metadata.map(() => false),
  );
  const [phase, setPhase] = useState<Phase>('intro');

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Auto-advance from intro to scrub phase.
  useEffect(() => {
    if (phase !== 'intro') return;
    const timer = setTimeout(() => setPhase('scrub'), INTRO_DWELL_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // Skip intro if no clips.
  useEffect(() => {
    if (clips.length === 0 && phase === 'intro') {
      setPhase('scrub');
    }
  }, [clips.length, phase]);

  const handleScrub = useCallback(
    (pos: number) => {
      if (phase !== 'scrub') return;
      setSeekPosition(Math.max(0, Math.min(1, pos)));
    },
    [phase],
  );

  const toggleMetadata = useCallback(
    (idx: number) => {
      if (phase !== 'scrub') return;
      setRevealedMetadata((prev) => {
        const next = [...prev];
        next[idx] = !next[idx];
        return next;
      });
    },
    [phase],
  );

  const handleSubmit = useCallback(() => {
    if (phase !== 'scrub') return;
    setPhase('submitting');
    const outcome = computeRecordingOutcome(call, { seekPosition, revealedMetadata });
    setTimeout(() => onCompleteRef.current(outcome), 1500);
  }, [phase, call, seekPosition, revealedMetadata]);

  // No clips — immediate zero outcome.
  useEffect(() => {
    if (clips.length === 0 && phase === 'scrub') {
      const outcome = computeRecordingOutcome(call, { seekPosition: 0, revealedMetadata: [] });
      onCompleteRef.current(outcome);
    }
  }, [clips.length, phase, call]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.callerName} accessibilityRole="header">
          {call.callerName}
        </Text>
        <Text style={styles.callerId}>{call.callerId}</Text>
      </View>

      {phase === 'intro' && (
        <View style={styles.introBlock}>
          <Text style={styles.clipLabel}>NOW PLAYING</Text>
          <Text style={styles.clipName}>{clip?.audioLabel ?? 'UNKNOWN'}</Text>
          <Text style={styles.hint}>preparing playback...</Text>
        </View>
      )}

      {phase === 'scrub' && (
        <View style={styles.scrubBlock}>
          <Text style={styles.clipLabel}>{clip?.audioLabel ?? 'UNKNOWN'}</Text>

          {/* Scrub bar */}
          <Pressable
            style={styles.scrubBar}
            onPress={(e) => {
              const relativeX = e.nativeEvent.locationX;
              const barWidth = 300;
              handleScrub(relativeX / barWidth);
            }}
            accessibilityRole="adjustable"
            accessibilityLabel="Scrub position"
            accessibilityHint="Tap to set seek position"
          >
            <View style={[styles.scrubIndicator, { left: `${seekPosition * 100}%` }]} />
          </Pressable>

          <Text style={styles.seekValue}>{Math.round(seekPosition * 100)}%</Text>

          {/* Metadata toggles */}
          {metadata.length > 0 && (
            <View style={styles.metadataBlock}>
              <Text style={styles.metadataLabel}>METADATA</Text>
              {metadata.map((item, idx) => (
                <Pressable
                  key={`meta-${idx}`}
                  style={[
                    styles.metadataItem,
                    revealedMetadata[idx] && styles.metadataItemRevealed,
                  ]}
                  onPress={() => toggleMetadata(idx)}
                  accessibilityRole="button"
                  accessibilityLabel={`Metadata ${idx + 1}`}
                >
                  <Text style={styles.metadataText}>
                    {revealedMetadata[idx] ? item : '??? ??? ???'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable
            style={styles.submitButton}
            onPress={handleSubmit}
            accessibilityRole="button"
            accessibilityLabel="Submit recording analysis"
          >
            <Text style={styles.submitText}>SUBMIT</Text>
          </Pressable>
        </View>
      )}

      {phase === 'submitting' && (
        <View style={styles.submittingBlock}>
          <Text style={styles.processing}>ANALYZING...</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  callerName: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.amber,
    letterSpacing: 2,
  },
  callerId: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  introBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  clipLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 3,
  },
  clipName: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.text,
    letterSpacing: 1,
  },
  hint: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
    marginTop: spacing.sm,
  },
  scrubBlock: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: spacing.md,
  },
  scrubBar: {
    width: 300,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  scrubIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.amber,
  },
  seekValue: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.amber,
    letterSpacing: 1,
  },
  metadataBlock: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metadataLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  metadataItem: {
    width: '100%',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  metadataItemRevealed: {
    borderColor: colors.dimGreen,
  },
  metadataText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 1,
  },
  submitButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.amber,
    backgroundColor: colors.surface,
    marginTop: spacing.md,
  },
  submitText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.amber,
    letterSpacing: 3,
  },
  submittingBlock: {
    alignItems: 'center',
  },
  processing: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.dimGreen,
    letterSpacing: 4,
  },
});

export default RecordingCall;
