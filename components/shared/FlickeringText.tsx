// components/shared/FlickeringText.tsx
// Per-letter flicker effect — like a dying neon sign. Each letter independently
// dims and recovers at random intervals. Subtle, unsettling, not garish.

import { useEffect, useMemo } from 'react';
import { Text, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface FlickeringTextProps {
  text: string;
  style?: TextStyle;
  letterSpacing?: number;
}

const FLICKER_CHANCE = 0.06;
const FLICKER_MIN_OPACITY = 0.25;
const FLICKER_DURATION_MAX = 220;
const RECOVER_DURATION = 120;

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function Letter({ char, flickerChance }: { char: string; flickerChance: number }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (Math.random() < flickerChance) {
        opacity.value = withTiming(FLICKER_MIN_OPACITY, {
          duration: randomBetween(FLICKER_MIN_OPACITY, FLICKER_DURATION_MAX),
          easing: Easing.out(Easing.quad),
        });
        timeout = setTimeout(() => {
          opacity.value = withTiming(1, {
            duration: RECOVER_DURATION,
            easing: Easing.inOut(Easing.quad),
          });
          timeout = setTimeout(tick, randomBetween(800, 4000));
        }, FLICKER_DURATION_MAX);
      } else {
        timeout = setTimeout(tick, randomBetween(800, 4000));
      }
    };

    timeout = setTimeout(tick, randomBetween(200, 2000));
    return () => clearTimeout(timeout);
  }, [flickerChance, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (char === ' ') {
    return <Text style={{ opacity: 1 }}> </Text>;
  }

  return <Animated.Text style={[{ opacity: 1 }, animatedStyle]}>{char}</Animated.Text>;
}

export function FlickeringText({ text, style, letterSpacing = 8 }: FlickeringTextProps) {
  const letters = useMemo(() => text.split(''), [text]);

  return (
    <Text style={[style, { letterSpacing }]}>
      {letters.map((char, i) => (
        <Letter key={i} char={char} flickerChance={FLICKER_CHANCE} />
      ))}
    </Text>
  );
}
