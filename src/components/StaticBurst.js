import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';

import { useReducedMotion } from '../motion';

/**
 * A burst of TV snow over the whole screen.
 *
 * Fires whenever `trigger` changes — a screen change, a band change — so
 * moving around the app feels like retuning rather than swapping views.
 *
 * Three noise frames are cycled while the burst is up: one tile held still
 * reads as a texture, but swapping between them reads as live static. The
 * cycling only runs during the ~300ms the burst is visible, so there is no
 * steady-state cost.
 */
const FRAMES = [
  require('../../assets/static-1.png'),
  require('../../assets/static-2.png'),
  require('../../assets/static-3.png'),
];

const FRAME_MS = 55;
const IN_MS = 90;
const HOLD_MS = 70;
const OUT_MS = 200;
const PEAK = 0.5;

export default function StaticBurst({ trigger, intensity = 1 }) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const [frame, setFrame] = useState(0);
  const [active, setActive] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    // Don't burst on the very first render — nothing was there to transition
    // away from.
    if (first.current) {
      first.current = false;
      return undefined;
    }
    if (reduced) return undefined;

    setActive(true);
    const cycle = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), FRAME_MS);

    const animation = Animated.sequence([
      Animated.timing(opacity, {
        toValue: PEAK * intensity,
        duration: IN_MS,
        useNativeDriver: true,
      }),
      Animated.delay(HOLD_MS),
      Animated.timing(opacity, { toValue: 0, duration: OUT_MS, useNativeDriver: true }),
    ]);

    animation.start(({ finished }) => {
      if (finished) setActive(false);
    });

    return () => {
      clearInterval(cycle);
      animation.stop();
      opacity.setValue(0);
      setActive(false);
    };
  }, [trigger, reduced, intensity, opacity]);

  if (!active) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <Image
        source={FRAMES[frame]}
        style={StyleSheet.absoluteFill}
        resizeMode="repeat"
        fadeDuration={0}
      />
      {/* A touch of black under the snow so the outgoing screen dips rather
          than just gaining speckle. */}
      <View style={[StyleSheet.absoluteFill, s.scrim]} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  scrim: { backgroundColor: '#000', opacity: 0.35 },
});
