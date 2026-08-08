import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import { useLeaderboardStore } from '../../store/useLeaderboardStore';

const DISPLAY_LIMIT = 10;

export function Leaderboard() {
  const entries = useLeaderboardStore((s) => s.entries);
  const topEntries = entries.slice(0, DISPLAY_LIMIT);

  return (
    <View style={styles.container}>
      {topEntries.map((entry, idx) => (
        <View key={entry.id} style={styles.row}>
          <Text style={styles.rank}>{idx + 1}</Text>
          <View style={styles.info}>
            <Text style={styles.callSign}>{entry.callSign}</Text>
            <Text style={styles.achievement}>{entry.achievement}</Text>
          </View>
          <Text style={styles.score}>{entry.score}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rank: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.amber,
    minWidth: 24,
    letterSpacing: 1,
  },
  info: {
    flex: 1,
  },
  callSign: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text,
    letterSpacing: 2,
  },
  achievement: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  score: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.green,
    letterSpacing: 1,
  },
});
