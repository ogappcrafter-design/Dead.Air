import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlickeringText } from '../components/shared/FlickeringText';
import { BreathingText } from '../components/shared/BreathingText';
import { colors, fonts, spacing } from '../lib/theme';
import { usePlayerStore } from '../store/usePlayerStore';

const TUNING_MESSAGES = [
  'Tuning frequencies...',
  'Scanning the dial...',
  'Something is listening...',
  'Finding your signal...',
  'The line is open...',
  "They know you're here...",
  'Stay on the line...',
  "Don't look behind you...",
];

export default function IndexScreen() {
  const router = useRouter();
  const [messageIdx, setMessageIdx] = useState(0);

  // Cycle through unsettling "tuning" messages on the splash.
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIdx((i) => (i + 1) % TUNING_MESSAGES.length);
    }, 900);
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
    // Hold the splash long enough for the atmosphere to register.
    // Was 2000ms — too fast for the flicker and message cycle to land.
    const timer = setTimeout(() => {
      minSplashElapsed = true;
      navigate();
    }, 4500);

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
      <BreathingText style={styles.subtitle}>Late Night Radio</BreathingText>
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
    textShadowColor: 'rgba(255, 140, 0, 0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  subtitle: {
    fontFamily: fonts.mono,
    fontSize: 22,
    color: colors.green,
    marginBottom: spacing.xxl,
    textShadowColor: 'rgba(57, 255, 20, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  loading: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.textMuted,
    textShadowColor: 'rgba(102, 102, 102, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});
