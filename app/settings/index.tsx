import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, spacing } from '../../lib/theme';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SETTINGS</Text>
      <Text style={styles.placeholder}>Coming in Phase 6</Text>
      <Pressable style={styles.link} onPress={() => router.push('/settings/achievements')}>
        <Text style={styles.linkText}>ACHIEVEMENTS →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.amber,
    marginBottom: spacing.md,
  },
  placeholder: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textMuted,
  },
  link: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  linkText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.amber,
    letterSpacing: 2,
  },
});
