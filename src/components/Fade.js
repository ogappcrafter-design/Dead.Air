import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

import { DURATION, EASE, RISE, useReducedMotion } from '../motion';

/**
 * Fades and lifts its children in once, on mount.
 *
 * Used for anything that arrives rather than being there already: each line of
 * a transmission, the choices under it, a screen. Keying a list by index means
 * only genuinely new children animate — the ones already on screen hold still.
 */
export default function Fade({
  children,
  delay = 0,
  duration = DURATION.quick,
  rise = RISE,
  style,
}) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: EASE.out,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, duration, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [rise, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
