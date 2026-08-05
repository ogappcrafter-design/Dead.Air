// components/calls/DeadAirCall.tsx
// DEAD_AIR call renderer — the caller goes silent, the player waits through dead air.
// Lines play one at a time (2.5s auto-advance, tap to skip), then a countdown timer
// for `call.waitSeconds`, then the call auto-completes. No player interaction.

import { useCallback, useEffect, useRef, useState, type JSX, memo } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import type { CallData, CallOutcome } from '../../engine/calls/types';
import { computeDeadAirOutcome } from '../../engine/calls/renderers/DeadAirHandler';

interface DeadAirCallProps {
  call: CallData;
  onComplete: (outcome: CallOutcome) => void;
}

const LINE_ADVANCE_MS = 2500;

type Phase = 'lines' | 'dead-air';

export const DeadAirCall = memo(function DeadAirCall({
  call,
  onComplete,
}: DeadAirCallProps): JSX.Element {
  const lines = call.lines ?? [];
  const [phase, setPhase] = useState<Phase>('lines');
  const [lineIndex, setLineIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(call.waitSeconds ?? 0);

  // Guard against double-completion: onComplete must fire exactly once.
  const completedRef = useRef(false);
  const fireComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete(computeDeadAirOutcome(call));
  }, [call, onComplete]);

  // --- Lines phase: auto-advance every LINE_ADVANCE_MS, tap to skip current line ---
  useEffect(() => {
    if (phase !== 'lines') return;
    if (lineIndex >= lines.length) {
      // No more lines → transition to dead-air countdown.
      setPhase('dead-air');
      return;
    }
    const timer = setTimeout(() => {
      setLineIndex((i) => i + 1);
    }, LINE_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [phase, lineIndex, lines.length]);

  const advanceLine = useCallback(() => {
    if (phase !== 'lines') return;
    setLineIndex((i) => i + 1);
  }, [phase]);

  // --- Dead-air phase: 1s countdown ticks, auto-complete at 0 ---
  useEffect(() => {
    if (phase !== 'dead-air') return;
    if (remainingSeconds <= 0) {
      fireComplete();
      return;
    }
    const timer = setTimeout(() => {
      setRemainingSeconds((s) => s - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [phase, remainingSeconds, fireComplete]);

  // Defensive: if there are no lines at all, jump straight to dead-air on mount.
  useEffect(() => {
    if (phase === 'lines' && lines.length === 0) {
      setPhase('dead-air');
    }
  }, [phase, lines.length]);

  const currentLine = lines[lineIndex];

  return (
    <Pressable style={styles.screen} onPress={advanceLine} disabled={phase !== 'lines'}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.callerName}>{call.callerName}</Text>
        <Text style={styles.callerId}>{call.callerId}</Text>
      </View>

      {/* Body */}
      {phase === 'lines' && currentLine !== undefined ? (
        <View style={styles.lineBody}>
          <Text style={styles.line}>{currentLine}</Text>
          <Text style={styles.hint}>tap to skip</Text>
        </View>
      ) : null}

      {phase === 'dead-air' ? (
        <View style={styles.deadAirBody}>
          <Text style={staticNoiseStyle()}>...</Text>
          {remainingSeconds > 0 ? (
            <Text style={styles.countdown}>{remainingSeconds}</Text>
          ) : (
            <Text style={styles.countdown}>...</Text>
          )}
        </View>
      ) : null}
    </Pressable>
  );
});

// Static noise — deterministic opacity cycle so it looks like an undulating void
// without re-rendering. Rendered as a style on a single label.
function staticNoiseStyle(): { color: string; fontSize: number; opacity: number } {
  return {
    color: colors.dimGreen,
    fontSize: 48,
    opacity: 0.35,
  };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  header: {
    position: 'absolute',
    top: spacing.xl,
    alignItems: 'center',
  },
  callerName: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 3,
    marginBottom: spacing.xs,
  },
  callerId: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  lineBody: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 1,
  },
  hint: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: spacing.lg,
    opacity: 0.4,
  },
  deadAirBody: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  countdown: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textMuted,
    letterSpacing: 2,
  },
});
