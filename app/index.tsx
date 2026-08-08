import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { colors, fonts, spacing } from '../lib/theme';
import { useGameStore } from '../store/useGameStore';
import { usePlayerStore } from '../store/usePlayerStore';

export default function IndexScreen() {
  const router = useRouter();
  const isPlaying = useGameStore((s) => s.isPlaying);

  useEffect(() => {
    let active = true;
    let hydrated = usePlayerStore.persist.hasHydrated();
    let minSplashElapsed = false;

    const navigate = () => {
      if (!active || !hydrated || !minSplashElapsed) {
        return;
      }
      const { hasOnboarded: onboarded } = usePlayerStore.getState();
      if (onboarded) {
        router.replace('/radio');
      } else {
        router.replace('/onboarding');
      }
    };

    // Auto-navigate after the splash, but only once the player store has
    // finished rehydrating from AsyncStorage. Routing on the default
    // `hasOnboarded: false` sends returning players back to /onboarding
    // when persistence hydration is slower than this timer.
    const timer = setTimeout(() => {
      minSplashElapsed = true;
      navigate();
    }, 2000);

    const unsubscribe = usePlayerStore.persist.onFinishHydration(() => {
      hydrated = true;
      navigate();
    });

    return () => {
      active = false;
      clearTimeout(timer);
      unsubscribe();
    };
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
