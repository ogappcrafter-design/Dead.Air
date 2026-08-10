import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlickeringText } from '../components/shared/FlickeringText';
import { colors, fonts, spacing } from '../lib/theme';
import { usePlayerStore } from '../store/usePlayerStore';

const TUNING_MESSAGES = [
  'Tuning frequencies...',
  'Scanning the dial...',
  'Something is listening...',
  'Finding your signal...',
  'The line is open...',
  'They know you\'re here...',
  'Stay on the line...',
  'Don\'t look behind you...',
];

export default function IndexScreen() {
  const router = useRouter();
  const [messageIdx, setMessageIdx] = useState(0);

  // Cycle through unsettling "tuning" messages on the splash.
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIdx((i) => (i + 1) % TUNING_MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

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
      <FlickeringText text="DEAD AIR" style={styles.title} letterSpacing={8} />
      <Text style={styles.subtitle}>Late Night Radio</Text>
      <Text style={styles.loading}>{TUNING_MESSAGES[messageIdx]}</Text>
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
