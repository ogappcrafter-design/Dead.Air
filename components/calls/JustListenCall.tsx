// components/calls/JustListenCall.tsx
// Pure presentational component for JUST_LISTEN calls.
// Receives `call` and `onComplete` as props — no store access, no side
// effects beyond timers. After the last line shows a brief "..." pause,
// then reports the deterministic outcome via onComplete.

import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import type { CallData, CallOutcome } from '../../engine/calls/types';
import { computeJustListenOutcome } from '../../engine/calls/renderers/JustListenHandler';

interface JustListenCallProps {
  call: CallData;
  onComplete: (outcome: CallOutcome) => void;
}

/** Per-line auto-advance delay. */
const LINE_ADVANCE_MS = 2500;
/** Brief "..." pause after the last line before reporting the outcome. */
const FINAL_PAUSE_MS = 1000;

type Phase = 'lines' | 'finalPause';

export const JustListenCall = memo(function JustListenCall({
  call,
  onComplete,
}: JustListenCallProps) {
  const lines = call.lines ?? [];
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('lines');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const advance = useCallback(() => {
    setIndex((prev) => {
      if (prev < lines.length - 1) {
        return prev + 1;
      }
      // Reached last line — drop into the brief final pause.
      setPhase('finalPause');
      return prev;
    });
  }, [lines.length]);

  // Auto-advance on a timer; cleared on phase change and unmount.
  useEffect(() => {
    if (phase !== 'lines' || lines.length === 0) {
      return;
    }
    const t = setTimeout(advance, LINE_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [phase, index, advance, lines.length]);

  // After the final pause, fire onComplete exactly once.
  useEffect(() => {
    if (phase !== 'finalPause') {
      return;
    }
    const t = setTimeout(() => {
      onCompleteRef.current(computeJustListenOutcome(call));
    }, FINAL_PAUSE_MS);
    return () => clearTimeout(t);
  }, [phase, call]);

  // Empty lines edge case: skip straight to the final pause.
  useEffect(() => {
    if (lines.length === 0 && phase === 'lines') {
      setPhase('finalPause');
    }
  }, [lines.length, phase]);

  const currentLine = lines[index];

  return (
    <Pressable
      style={styles.backdrop}
      onPress={advance}
      disabled={phase === 'finalPause'}
      accessible
      accessibilityRole="button"
      accessibilityLabel={phase === 'lines' ? 'Skip caller line' : 'Call completing'}
      accessibilityHint="Tap to advance to next line"
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.callerName} numberOfLines={1} accessibilityRole="header">
            {call.callerName}
          </Text>
          <Text style={styles.callerId} numberOfLines={1}>
            {call.callerId}
          </Text>
        </View>

        <View style={styles.body}>
          {phase === 'lines' && currentLine !== undefined ? (
            <Text style={styles.line} key={index} accessibilityLiveRegion="polite">
              {currentLine}
            </Text>
          ) : (
            <Text style={styles.pause}>...</Text>
          )}
        </View>

        <Text style={styles.hint} numberOfLines={1}>
          {phase === 'lines' ? 'TAP TO SKIP' : '...'}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  callerName: {
    fontFamily: fonts.mono,
    fontSize: 22,
    fontWeight: '700',
    color: colors.amber,
    letterSpacing: 3,
    textAlign: 'center',
  },
  callerId: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  body: {
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  line: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    textAlign: 'center',
  },
  pause: {
    fontFamily: fonts.mono,
    fontSize: 24,
    color: colors.textMuted,
    letterSpacing: 6,
  },
  hint: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});

export default JustListenCall;
