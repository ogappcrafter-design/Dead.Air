import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import { useCallOfTheDayStore } from '../../store/useCallOfTheDayStore';
import { getCallOfTheDay } from '../../engine/calls/CallOfTheDayGenerator';
import { getTodayUTC } from '../../engine/calls/DailyCallGenerator';
import { CALLS } from '../../data/calls';

export function CallOfTheDay() {
  const dailyCall = useCallOfTheDayStore((s) => s.dailyCall);
  const hasVoted = useCallOfTheDayStore((s) => s.hasVoted);
  const voteCount = useCallOfTheDayStore((s) => s.voteCount);
  const vote = useCallOfTheDayStore((s) => s.vote);
  const checkNewDay = useCallOfTheDayStore((s) => s.checkNewDay);
  const setDailyCall = useCallOfTheDayStore((s) => s.setDailyCall);

  useEffect(() => {
    checkNewDay(getTodayUTC());
    if (!useCallOfTheDayStore.getState().dailyCall) {
      const result = getCallOfTheDay(CALLS, getTodayUTC());
      setDailyCall(result);
    }
  }, [checkNewDay, setDailyCall]);

  if (!dailyCall) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No featured call today.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.callerName}>{dailyCall.callerName}</Text>
      <Text style={styles.date}>{dailyCall.date}</Text>
      <View style={styles.linesContainer}>
        {dailyCall.lines.slice(0, 3).map((line, idx) => (
          <Text key={idx} style={styles.line}>
            {line}
          </Text>
        ))}
      </View>
      <Pressable
        style={[styles.voteButton, hasVoted && styles.votedButton]}
        onPress={vote}
        disabled={hasVoted}
      >
        <Text style={styles.voteButtonText}>{hasVoted ? '✓ VOTED' : 'VOTE FOR THIS CALL'}</Text>
      </Pressable>
      <Text style={styles.voteCount}>{voteCount} votes</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  callerName: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.amber,
    letterSpacing: 2,
  },
  date: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  linesContainer: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  line: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text,
  },
  voteButton: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  votedButton: {
    borderColor: colors.green,
    backgroundColor: colors.surface,
  },
  voteButtonText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.amber,
    letterSpacing: 2,
  },
  voteCount: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  emptyText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1,
    textAlign: 'center',
  },
});
