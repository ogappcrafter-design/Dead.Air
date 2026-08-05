import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, spacing } from '../../lib/theme';
import { ErrorReportButton } from '../../components/shared/ErrorReportButton';

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>SETTINGS</Text>
      <Text style={styles.placeholder}>Coming in Phase 6</Text>
      <Pressable style={styles.link} onPress={() => router.push('/settings/achievements')}>
        <Text style={styles.linkText}>ACHIEVEMENTS →</Text>
      </Pressable>
      <View style={styles.divider} />
      <ErrorReportButton />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    justifyContent: 'center',
    alignItems: 'stretch',
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.amber,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  placeholder: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  link: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    alignSelf: 'center',
  },
  linkText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.amber,
    letterSpacing: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
});
