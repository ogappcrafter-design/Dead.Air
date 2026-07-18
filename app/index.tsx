import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { colors, fonts, spacing } from '../lib/theme';
import { useGameStore } from '../store/useGameStore';

export default function IndexScreen() {
  const router = useRouter();
  const isPlaying = useGameStore((s) => s.isPlaying);

  useEffect(() => {
    // Auto-navigate after splash
    const timer = setTimeout(() => {
      router.replace('/radio');
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DEAD AIR</Text>
      <Text style={styles.subtitle}>Late Night Radio</Text>
      <Text style={styles.loading}>Tuning frequencies...</Text>
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
    fontSize: 48,
    color: colors.amber,
    letterSpacing: 8,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.green,
    marginBottom: spacing.xxl,
  },
  loading: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
  },
});
