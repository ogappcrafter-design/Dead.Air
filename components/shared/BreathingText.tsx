// components/shared/BreathingText.tsx
// Slow, subtle opacity oscillation — like something breathing. Very low
// amplitude so it registers as "something feels off" rather than "this pulses".

import { useEffect } from 'react';
import { TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const BREATHE_PERIOD = 4200;
const OPACITY_MIN = 0.55;

export function BreathingText({
  children,
  style,
  ...rest
}: {
  children: React.ReactNode;
  style?: TextStyle;
  [key: string]: unknown;
}) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(OPACITY_MIN, {
        duration: BREATHE_PERIOD / 2,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[style, animatedStyle]} {...rest}>
      {children}
    </Animated.Text>
  );
}
