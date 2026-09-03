import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';

import { useReducedMotion } from '../motion';

/**
 * A short horizontal jolt, for the moments the station takes a hit.
 *
 * Returns a style to spread onto an Animated.View and a `shake()` to fire.
 * Runs on the native driver, and does nothing at all under reduce-motion —
 * a jolt is exactly the kind of thing that setting exists to stop.
 */
export default function useShake({ distance = 7, cycles = 3, duration = 46 } = {}) {
  const reduced = useReducedMotion();
  const offset = useRef(new Animated.Value(0)).current;

  const shake = useCallback(() => {
    if (reduced) return;
    const legs = [];
    for (let i = 0; i < cycles; i += 1) {
      // Each pass is weaker than the last, so it settles instead of stopping dead.
      const amount = distance * (1 - i / cycles);
      legs.push(
        Animated.timing(offset, { toValue: -amount, duration, useNativeDriver: true }),
        Animated.timing(offset, { toValue: amount, duration, useNativeDriver: true }),
      );
    }
    legs.push(Animated.timing(offset, { toValue: 0, duration, useNativeDriver: true }));
    Animated.sequence(legs).start();
  }, [offset, reduced, distance, cycles, duration]);

  return { shake, style: { transform: [{ translateX: offset }] } };
}
