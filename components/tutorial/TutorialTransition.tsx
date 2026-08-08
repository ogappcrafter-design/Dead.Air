import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';

export function TutorialTransition() {
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const fade = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.delay(2400),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]);
    fade.start();
    return () => fade.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="none">
      <View style={styles.inner}>
        <Text style={styles.signal}>THE SIGNAL IS CLEAR</Text>
        <Text style={styles.sub}>you are on your own now, operator</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  inner: {
    alignItems: 'center',
    gap: spacing.md,
  },
  signal: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.amber,
    letterSpacing: 6,
    textAlign: 'center',
  },
  sub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 3,
    textAlign: 'center',
  },
});
