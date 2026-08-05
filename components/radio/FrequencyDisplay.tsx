import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';

interface FrequencyDisplayProps {
  frequency: number;
  bandName: string;
}

export const FrequencyDisplay = memo(function FrequencyDisplay({
  frequency,
  bandName,
}: FrequencyDisplayProps) {
  const formatted = frequency.toFixed(1);

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`Frequency display: ${bandName}, ${formatted} MHz`}
    >
      <Text style={styles.bandLabel} accessibilityRole="header">
        {bandName}
      </Text>
      <View style={styles.display}>
        <Text style={styles.freq} maxFontSizeMultiplier={1.2}>
          {formatted}
        </Text>
        <Text style={styles.unit}>MHz</Text>
      </View>
      <View style={styles.tickMarks}>
        {Array.from({ length: 21 }, (_, i) => {
          const freq = 87.5 + i * 1.025;
          const isActive = Math.abs(freq - frequency) < 0.5;
          return (
            <View
              key={`tick-${freq.toFixed(1)}`}
              style={[styles.tick, isActive && styles.tickActive]}
            />
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  bandLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 4,
    marginBottom: spacing.xs,
  },
  display: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 4,
  },
  freq: {
    fontFamily: fonts.display,
    fontSize: 48,
    color: colors.amber,
    letterSpacing: 2,
  },
  unit: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  tickMarks: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: 2,
  },
  tick: {
    width: 2,
    height: 8,
    backgroundColor: colors.border,
  },
  tickActive: {
    backgroundColor: colors.amber,
    height: 12,
  },
});
