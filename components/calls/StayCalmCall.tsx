// components/calls/StayCalmCall.tsx
// Presentational renderer for STAY_CALM calls.
// The caller is escalating in panic. The player must do nothing (stay calm)
// for `call.duration` seconds. Tapping the screen = flinching → caller panics.

import React, { useCallback, useEffect, useRef, useState, memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { computeStayCalmOutcome } from '@/engine/calls/renderers/StayCalmHandler';
import type { CallData, CallOutcome } from '@/engine/calls/types';
import { colors, fonts, spacing } from '@/lib/theme';

interface StayCalmCallProps {
  call: CallData;
  onComplete: (outcome: CallOutcome) => void;
}

type Phase = 'countdown' | 'flinched' | 'survived';

const FLINCH_DISPLAY_MS = 2000;
const SURVIVE_DISPLAY_MS = 2000;
const TICK_MS = 100;

const StayCalmCall = memo(function StayCalmCall({
  call,
  onComplete,
}: StayCalmCallProps): React.JSX.Element {
  const duration = call.duration ?? 10;
  const lines = call.lines ?? [];
  const msPerLine = lines.length > 0 ? (duration * 1000) / lines.length : duration * 1000;

  const [elapsedMs, setElapsedMs] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('countdown');

  // Guards prevent double-firing onComplete when timers overlap.
  const completedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(
    (stayedCalm: boolean, withPhase: Phase) => {
      if (completedRef.current) return;
      completedRef.current = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setPhase(withPhase);
      const outcome = computeStayCalmOutcome(call, stayedCalm);
      const delay = withPhase === 'flinched' ? FLINCH_DISPLAY_MS : SURVIVE_DISPLAY_MS;
      setTimeout(() => onComplete(outcome), delay);
    },
    [call, onComplete],
  );

  // Countdown ticker.
  useEffect(() => {
    if (phase !== 'countdown') return;
    intervalRef.current = setInterval(() => {
      setElapsedMs((prev) => {
        const next = prev + TICK_MS;
        if (next >= duration * 1000) {
          // Elapsed past duration without flinch → survived.
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          // Defer the finish off the setState updater to avoid a stale closure
          // warning if React nests another update.
          setTimeout(() => finish(true, 'survived'), 0);
          return duration * 1000;
        }
        return next;
      });
    }, TICK_MS);
    return () => {
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [phase, duration, finish]);

  // Advance the caller dialogue lines in sync with elapsed time.
  useEffect(() => {
    if (lines.length === 0) return;
    const idx = Math.min(lines.length - 1, Math.floor(elapsedMs / msPerLine));
    setLineIndex(idx);
  }, [elapsedMs, lines.length, msPerLine]);

  // Any press while in countdown = flinch.
  const handlePress = useCallback(() => {
    if (phase !== 'countdown' || completedRef.current) return;
    finish(false, 'flinched');
  }, [phase, finish]);

  const remainingSec = Math.max(0, Math.ceil((duration * 1000 - elapsedMs) / 1000));
  const progress = Math.min(1, elapsedMs / (duration * 1000));

  return (
    <Pressable
      onPressIn={handlePress}
      disabled={phase !== 'countdown'}
      style={styles.screen}
      accessibilityLabel="Stay calm — do not tap"
      accessibilityRole="button"
      accessibilityHint="Do not press; wait for the countdown to complete"
    >
      <View style={styles.content}>
        {phase === 'countdown' && (
          <>
            <View style={styles.header}>
              <Text style={styles.callerName} accessibilityRole="header">
                {call.callerName}
              </Text>
              <Text style={styles.callerId}>{call.callerId}</Text>
            </View>

            <View style={styles.timerBlock}>
              <Text style={styles.timerLabel}>STAY CALM</Text>
              <Text style={styles.timer}>{remainingSec.toString().padStart(2, '0')}s</Text>
            </View>

            <View style={styles.lineBlock}>
              {lines.length > 0 ? (
                <Text style={styles.line} accessibilityLiveRegion="polite">
                  {lines[lineIndex] ?? ''}
                </Text>
              ) : (
                <Text style={styles.line}>...</Text>
              )}
            </View>

            <View style={styles.progressWrap}>
              <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
            </View>

            <Text style={styles.hint}>do not move. do not tap.</Text>
          </>
        )}

        {phase === 'flinched' && (
          <Text style={styles.panic} accessibilityLiveRegion="assertive">
            YOU FLINCHED
          </Text>
        )}
        {phase === 'survived' && (
          <Text style={styles.calm} accessibilityLiveRegion="assertive">
            ...
          </Text>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    gap: spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  callerName: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  callerId: {
    color: colors.textMuted,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
  },
  timerBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  timerLabel: {
    color: colors.red,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 4,
  },
  timer: {
    color: colors.red,
    fontFamily: fonts.display,
    fontSize: 56,
    fontWeight: '700',
  },
  lineBlock: {
    minHeight: 64,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  line: {
    color: colors.textMuted,
    fontFamily: fonts.mono,
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  progressWrap: {
    width: '100%',
    height: 2,
    backgroundColor: colors.border,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.dimGreen,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'lowercase',
  },
  panic: {
    color: colors.red,
    fontFamily: fonts.display,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 6,
  },
  calm: {
    color: colors.dimGreen,
    fontFamily: fonts.display,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 6,
  },
});

export default StayCalmCall;
