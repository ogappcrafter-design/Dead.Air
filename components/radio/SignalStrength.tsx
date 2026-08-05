import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';

interface SignalStrengthProps {
  strength: number; // 0-1
  isTuning: boolean;
}

export const SignalStrength = memo(function SignalStrength({
  strength,
  isTuning,
}: SignalStrengthProps) {
  const bars = 5;
  const activeBars = Math.round(strength * bars);

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`Signal strength: ${activeBars} of ${bars}`}
    >
      <Text style={styles.label} accessibilityRole="header">
        SIGNAL
      </Text>
      <View style={styles.bars}>
        {Array.from({ length: bars }, (_, i) => {
          const isActive = i < activeBars;
          const height = 8 + i * 3;
          return (
            <View
              key={`bar-${i}-${height}`}
              style={[
                styles.bar,
                { height },
                isActive && styles.barActive,
                isTuning && isActive && styles.barTuning,
              ]}
            />
          );
        })}
      </View>
      <Text
        style={[styles.status, isTuning && styles.statusTuning]}
        accessibilityLiveRegion="polite"
      >
        {isTuning ? 'TUNING' : strength > 0.7 ? 'STRONG' : strength > 0.3 ? 'WEAK' : 'NONE'}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 24,
  },
  bar: {
    width: 6,
    backgroundColor: colors.border,
    borderRadius: 1,
  },
  barActive: {
    backgroundColor: colors.green,
  },
  barTuning: {
    opacity: 0.5,
  },
  status: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  statusTuning: {
    color: colors.amber,
  },
});
