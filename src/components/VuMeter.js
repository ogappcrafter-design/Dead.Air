import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

import { useReducedMotion } from '../motion';
import { colors } from '../theme/theme';

/**
 * A little oscilloscope for an open line.
 *
 * It kicks whenever a new line arrives and sags back between them, so the
 * header reads as a live signal rather than a static label — the difference
 * between "here is some text" and "someone is talking to you right now".
 *
 * One animated value drives every bar; each bar just interpolates it against
 * its own fixed weight, so the whole meter is a single native-driver node.
 * Bars scale from their centre, which reads as a waveform and avoids the
 * translate-compensation a bottom-anchored bar would need.
 */
const WEIGHTS = [0.35, 0.7, 0.45, 1, 0.6, 0.85, 0.4, 0.75, 0.3];
const IDLE = 0.12;

export default function VuMeter({ pulse = 0, color = colors.amber, height = 18 }) {
  const reduced = useReducedMotion();
  const energy = useRef(new Animated.Value(IDLE)).current;

  useEffect(() => {
    if (reduced) {
      energy.setValue(0.5);
      return undefined;
    }
    const kick = Animated.sequence([
      Animated.timing(energy, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(energy, { toValue: IDLE, duration: 620, useNativeDriver: true }),
    ]);
    kick.start();
    return () => kick.stop();
  }, [pulse, energy, reduced]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', height, gap: 2 }}
    >
      {WEIGHTS.map((weight, i) => (
        <Animated.View
          key={i}
          style={{
            width: 2,
            height,
            backgroundColor: color,
            opacity: 0.75,
            transform: [
              {
                scaleY: energy.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.06, weight],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}
