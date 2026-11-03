// components/mod/Stepper.tsx
// DEA-89 — compact +/- control used by the frequency forge for numeric tuning.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';

export interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  testID?: string;
}

export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  testID,
}: StepperProps) {
  const lower = Math.max(min, Math.round((value - step) * 100) / 100);
  const higher = Math.min(max, Math.round((value + step) * 100) / 100);
  const text = formatValue ? formatValue(value) : String(value);

  return (
    <View style={styles.row}>
      <View style={styles.labelColumn}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.range}>
          {min}–{max}
        </Text>
      </View>
      <View style={styles.controls}>
        <Pressable
          testID={testID ? `${testID}-down` : undefined}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => onChange(lower)}
          disabled={value <= min}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
        >
          <Text style={styles.buttonText}>−</Text>
        </Pressable>
        <Text style={styles.value} testID={testID ? `${testID}-value` : undefined}>
          {text}
        </Text>
        <Pressable
          testID={testID ? `${testID}-up` : undefined}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => onChange(higher)}
          disabled={value >= max}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
        >
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  labelColumn: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text,
    letterSpacing: 1,
  },
  range: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  button: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.surfaceLight,
  },
  buttonText: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.amber,
    lineHeight: 20,
  },
  value: {
    minWidth: 44,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.green,
  },
});
