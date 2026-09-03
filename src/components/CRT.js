import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';

import { flickerIntervalMs, scanlineOpacity, vignetteBoost } from '../engine/interference';
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
 *
 * Pass `sanity` and the tube degrades with the DJ: heavier scanlines, and
 * dropped frames going from about one every nine seconds to one every two.
 * It is the same number the header shows, made visible.
 */
const SCANLINE_TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAADCAYAAABS3WWCAAAAD0lEQVR42mNgYGDQY4ADAAIJAC/RxCXXAAAAAElFTkSuQmCC';

function CRT({ sanity = 100 }) {
  const reduced = useReducedMotion();
  const base = scanlineOpacity(sanity);
  const closing = vignetteBoost(sanity);
  const glow = useRef(new Animated.Value(base)).current;

  // Slow breathing.
  useEffect(() => {
    if (reduced) {
      glow.setValue(base);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: Math.min(1, base * 1.08), duration: 2600, useNativeDriver: true }),
        Animated.timing(glow, { toValue: base * 0.92, duration: 2200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow, reduced, base]);

  // An occasional dropped frame. Rare enough to register as the room, not a bug.
  useEffect(() => {
    if (reduced) return undefined;
    let timer;
    const gap = flickerIntervalMs(sanity);
    const schedule = () => {
      timer = setTimeout(() => {
        Animated.sequence([
          Animated.timing(glow, { toValue: 0.45, duration: 45, useNativeDriver: true }),
          Animated.timing(glow, { toValue: base, duration: 110, useNativeDriver: true }),
        ]).start();
        schedule();
      }, gap * 0.6 + Math.random() * gap * 0.8);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [glow, reduced, sanity, base]);

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
      {/* Vignette, approximated with four edge gradients-by-opacity. It
          closes in as sanity falls, so the picture literally narrows. */}
      <View style={[s.edge, s.top, { opacity: 0.35 + closing }]} />
      <View style={[s.edge, s.bottom, { opacity: 0.35 + closing }]} />
      <View style={[s.edge, s.left, { opacity: 0.22 + closing }]} />
      <View style={[s.edge, s.right, { opacity: 0.22 + closing }]} />
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
