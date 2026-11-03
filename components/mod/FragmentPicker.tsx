// components/mod/FragmentPicker.tsx
// DEA-89 — one-at-a-time picker over an existing band fragment pool.
//
// The builder never accepts free-form call text; it only cycles through the
// authored fragment strings the procedural engine already uses.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';

export interface FragmentPickerProps {
  label: string;
  fragments: readonly string[];
  index: number;
  onChange: (index: number) => void;
  testID?: string;
}

export function FragmentPicker({ label, fragments, index, onChange, testID }: FragmentPickerProps) {
  const count = fragments.length;
  const safeIndex = count === 0 ? 0 : Math.min(Math.max(index, 0), count - 1);
  const text = fragments[safeIndex] ?? '—';
  const go = (delta: number): void => {
    if (count === 0) return;
    onChange((safeIndex + delta + count) % count);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.counter} testID={testID ? `${testID}-counter` : undefined}>
          {count === 0 ? '0/0' : `${safeIndex + 1}/${count}`}
        </Text>
      </View>
      <View style={styles.body}>
        <Pressable
          testID={testID ? `${testID}-prev` : undefined}
          style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed]}
          onPress={() => go(-1)}
          disabled={count < 2}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Previous ${label}`}
        >
          <Text style={styles.arrowText}>◀</Text>
        </Pressable>
        <Text style={styles.fragment} numberOfLines={4}>
          {text}
        </Text>
        <Pressable
          testID={testID ? `${testID}-next` : undefined}
          style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed]}
          onPress={() => go(1)}
          disabled={count < 2}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Next ${label}`}
        >
          <Text style={styles.arrowText}>▶</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  counter: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.green,
    letterSpacing: 1,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  arrow: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowPressed: {
    opacity: 0.6,
  },
  arrowText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.amber,
  },
  fragment: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 17,
    color: colors.text,
  },
});
