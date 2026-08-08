// components/calls/TimingCall.tsx
// Presentational component for TIMING calls.
// Player must tap (or hold) in sync with a beat map.
// Mirrors StayCalmCall's timing-based pattern.

import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import { computeTimingOutcome } from '../../engine/calls/renderers/TimingHandler';
import type { CallData, CallOutcome } from '../../engine/calls/types';

interface TimingCallProps {
  call: CallData;
  onComplete: (outcome: CallOutcome) => void;
}

type Phase = 'countdown' | 'playing' | 'result';

interface TapRecord {
  timestampMs: number;
  isHold: boolean;
}

const COUNTDOWN_SECONDS = 3;
const RESULT_DWELL_MS = 2000;

export const TimingCall = memo(function TimingCall({ call, onComplete }: TimingCallProps) {
  const beatMap = call.beatMap ?? [];
  const duration = call.duration ?? 10;

  const [phase, setPhase] = useState<Phase>('countdown');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [taps, setTaps] = useState<TapRecord[]>([]);
  const [currentBeatIdx, setCurrentBeatIdx] = useState(0);
  const [startTime, setStartTime] = useState(0);

  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Countdown before beats start.
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      setStartTime(Date.now());
      setPhase('playing');
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown]);

  // Track current beat during playback.
  useEffect(() => {
    if (phase !== 'playing' || beatMap.length === 0) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const nextIdx = beatMap.findIndex((beat) => beat.timestampMs > elapsed);
      setCurrentBeatIdx(nextIdx === -1 ? beatMap.length : nextIdx);

      // Check if all beats have passed.
      if (elapsed > (beatMap[beatMap.length - 1]?.timestampMs ?? 0) + 1000) {
        clearInterval(interval);
        setPhase('result');
      }
    }, 50);
    return () => clearInterval(interval);
  }, [phase, startTime, beatMap]);

  // No beatMap → immediate zero outcome.
  useEffect(() => {
    if (beatMap.length === 0 && phase === 'countdown') {
      setPhase('result');
    }
  }, [beatMap.length, phase]);

  // Result phase → compute and fire.
  useEffect(() => {
    if (phase !== 'result' || completedRef.current) return;
    completedRef.current = true;
    const outcome = computeTimingOutcome(call, taps);
    const timer = setTimeout(() => onCompleteRef.current(outcome), RESULT_DWELL_MS);
    return () => clearTimeout(timer);
  }, [phase, call, taps]);

  const handleTap = useCallback(() => {
    if (phase !== 'playing') return;
    const timestampMs = Date.now() - startTime;
    setTaps((prev) => [...prev, { timestampMs, isHold: false }]);
  }, [phase, startTime]);

  const handleHoldStart = useCallback(() => {
    if (phase !== 'playing') return;
    const timestampMs = Date.now() - startTime;
    setTaps((prev) => [...prev, { timestampMs, isHold: true }]);
  }, [phase, startTime]);

  // Visible beats: upcoming 3 beats.
  const upcomingBeats = beatMap.slice(currentBeatIdx, currentBeatIdx + 3);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.callerName} accessibilityRole="header">
          {call.callerName}
        </Text>
        <Text style={styles.callerId}>{call.callerId}</Text>
      </View>

      {phase === 'countdown' && (
        <View style={styles.countdownBlock}>
          <Text style={styles.countdownLabel}>SYNC TO BEAT</Text>
          <Text style={styles.countdownNumber} accessibilityLiveRegion="polite">
            {countdown > 0 ? countdown : 'GO'}
          </Text>
        </View>
      )}

      {phase === 'playing' && (
        <View style={styles.playingBlock}>
          <Text style={styles.beatLabel}>
            BEAT {currentBeatIdx + 1} / {beatMap.length}
          </Text>

          <View style={styles.beatTrack}>
            {upcomingBeats.map((beat, idx) => (
              <View
                key={`beat-${currentBeatIdx + idx}`}
                style={[
                  styles.beatMarker,
                  idx === 0 && styles.beatMarkerCurrent,
                  beat.type === 'HOLD' && styles.beatMarkerHold,
                ]}
              >
                <Text style={styles.beatType}>{beat.type === 'HOLD' ? 'HOLD' : 'TAP'}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.tapButton, pressed && styles.tapButtonPressed]}
            onPress={handleTap}
            onPressIn={handleHoldStart}
            accessibilityRole="button"
            accessibilityLabel="Tap to the beat"
            accessibilityHint="Tap for TAP beats, press and hold for HOLD beats"
          >
            <Text style={styles.tapButtonText}>TAP</Text>
          </Pressable>

          <Text style={styles.tapCount}>{taps.length} taps</Text>
        </View>
      )}

      {phase === 'result' && (
        <View style={styles.resultBlock}>
          <Text style={styles.resultText} accessibilityLiveRegion="polite">
            {taps.length > 0 ? 'TIMING ANALYZED' : 'NO INPUT'}
          </Text>
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
    marginBottom: spacing.lg,
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
  countdownBlock: {
    alignItems: 'center',
    gap: spacing.md,
  },
  countdownLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.amber,
    letterSpacing: 4,
  },
  countdownNumber: {
    fontFamily: fonts.display,
    fontSize: 64,
    color: colors.amber,
    fontWeight: '700',
  },
  playingBlock: {
    alignItems: 'center',
    gap: spacing.lg,
    width: '100%',
  },
  beatLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  beatTrack: {
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 60,
    alignItems: 'center',
  },
  beatMarker: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beatMarkerCurrent: {
    borderColor: colors.amber,
    backgroundColor: `${colors.amber}20`,
  },
  beatMarkerHold: {
    borderColor: colors.dimGreen,
  },
  beatType: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text,
    letterSpacing: 1,
  },
  tapButton: {
    width: 120,
    height: 120,
    borderWidth: 2,
    borderColor: colors.amber,
    backgroundColor: colors.surface,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapButtonPressed: {
    backgroundColor: `${colors.amber}30`,
    borderColor: colors.green,
  },
  tapButtonText: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.amber,
    letterSpacing: 3,
  },
  tapCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  resultBlock: {
    alignItems: 'center',
  },
  resultText: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.dimGreen,
    letterSpacing: 4,
  },
});

export default TimingCall;
