import { Text, View, StyleSheet } from 'react-native';
import { useDailyCallStore } from '@/store/useDailyCallStore';
import { theme } from '@/lib/theme';

/**
 * StreakIndicator — subtle CRT-style daily streak counter.
 * Displays consecutive daily call completions as a dim green readout.
 * Designed to be atmospheric, not gamified — blends into the radio aesthetic.
 */
export function StreakIndicator() {
  const streak = useDailyCallStore((s) => s.streak);
  const completedToday = useDailyCallStore((s) => s.completedToday);

  // Don't show anything if no streak established yet
  if (streak < 2) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.label}>STREAK</Text>
      <Text style={[styles.count, completedToday ? styles.active : styles.pending]}>
        {streak.toString().padStart(3, '0')}
      </Text>
      <Text style={styles.unit}>DAYS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.xs,
    opacity: 0.6,
  },
  label: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    color: theme.colors.textMuted,
    letterSpacing: 1,
  },
  count: {
    fontFamily: theme.fonts.mono,
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  active: {
    color: theme.colors.dimGreen,
    textShadowColor: theme.colors.green,
    textShadowRadius: 3,
  },
  pending: {
    color: theme.colors.textMuted,
  },
  unit: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    color: theme.colors.textMuted,
    letterSpacing: 1,
  },
});
