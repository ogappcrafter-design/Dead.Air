import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';

import { useReducedMotion } from '../motion';

/**
 * Scanline + vignette overlay.
 *
 * The scanlines are a 1x3px PNG tiled with resizeMode="repeat" rather than a
 * stack of a few hundred Views — one node instead of one per line, and the GPU
 * does the tiling.
 *
 * The layer breathes very slowly and drops out for a frame now and then. Both
 * run on the native driver off a single animated opacity, so the tube keeps
 * moving even while a call is ticking on the JS thread.
 */
const SCANLINE_TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAADCAYAAABS3WWCAAAAD0lEQVR42mNgYGDQY4ADAAIJAC/RxCXXAAAAAElFTkSuQmCC';

const BASE_OPACITY = 0.9;

function CRT() {
  const reduced = useReducedMotion();
  const glow = useRef(new Animated.Value(BASE_OPACITY)).current;

  // Slow breathing.
  useEffect(() => {
    if (reduced) {
      glow.setValue(BASE_OPACITY);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.82, duration: 2200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow, reduced]);

  // An occasional dropped frame. Rare enough to register as the room, not a bug.
  useEffect(() => {
    if (reduced) return undefined;
    let timer;
    const schedule = () => {
      timer = setTimeout(() => {
        Animated.sequence([
          Animated.timing(glow, { toValue: 0.45, duration: 45, useNativeDriver: true }),
          Animated.timing(glow, { toValue: BASE_OPACITY, duration: 110, useNativeDriver: true }),
        ]).start();
        schedule();
      }, 6000 + Math.random() * 9000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [glow, reduced]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: glow }]}>
        <Image
          source={{ uri: SCANLINE_TILE }}
          style={StyleSheet.absoluteFill}
          resizeMode="repeat"
          fadeDuration={0}
        />
      </Animated.View>
      {/* Vignette, approximated with four edge gradients-by-opacity. */}
      <View style={[s.edge, s.top]} />
      <View style={[s.edge, s.bottom]} />
      <View style={[s.edge, s.left]} />
      <View style={[s.edge, s.right]} />
    </View>
  );
}

const s = StyleSheet.create({
  edge: { position: 'absolute', backgroundColor: '#000', opacity: 0.35 },
  top: { top: 0, left: 0, right: 0, height: 56 },
  bottom: { bottom: 0, left: 0, right: 0, height: 72 },
  left: { top: 0, bottom: 0, left: 0, width: 20, opacity: 0.22 },
  right: { top: 0, bottom: 0, right: 0, width: 20, opacity: 0.22 },
});

export default React.memo(CRT);
