import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { colors, fonts, spacing } from '../lib/theme';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>NO SIGNAL</Text>
      <Text style={styles.subtitle}>Frequency not found</Text>
      <Link href="/" style={styles.link}>
        <Text style={styles.linkText}>Return to station</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.red,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  link: {
    padding: spacing.md,
  },
  linkText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.amber,
  },
});
