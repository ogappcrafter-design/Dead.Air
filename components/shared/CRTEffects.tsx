// components/shared/CRTEffects.tsx
// Presentational sub-components used by CRTView. All overlays are
// pointerEvents='none' so touch events reach the content underneath.
// No store access, no game logic — pure view layer driven by `intensity`.
//
// Optimized: ScanlineOverlay now uses far fewer Views (20 for full, 10 for
// reduced, 0 for off) instead of 80. ScanlineMode controls density/visibility
// for performance scaling.

import React, { type JSX } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

/** Scanline rendering mode for performance scaling. */
export type ScanlineMode = 'full' | 'reduced' | 'off';

export interface OverlayProps {
  /** 0..1 — drives overlay opacity. Caller (CRTView) already gates 0. */
  intensity: number;
}

export interface ScanlineOverlayProps extends OverlayProps {
  /** Scanline density mode. 'off' renders nothing. */
  mode?: ScanlineMode;
}

const FULL_SCANLINE_COUNT = 20;
const REDUCED_SCANLINE_COUNT = 10;

/**
 * ScanlineOverlay — CRT raster effect using evenly-spaced thin dark bars.
 * Optimized from 80 Views to 20 (full) / 10 (reduced) / 0 (off).
 *
 * Modes:
 * - 'full': 20 scanlines (5% spacing) — original look at 1/4 the render cost
 * - 'reduced': 10 scanlines (10% spacing) — lighter for mid-tier devices
 * - 'off': renders nothing
 *
 * The whole set drifts slowly downward then wraps — like a loose broadcast
 * signal. The drift is barely perceptible but registers as "something's off".
 */
export function ScanlineOverlay({
  intensity,
  mode = 'full',
}: ScanlineOverlayProps): JSX.Element | null {
  const opacity = Math.min(1, Math.max(0, intensity));
  if (mode === 'off' || opacity === 0) {
    return null;
  }

  const count = mode === 'reduced' ? REDUCED_SCANLINE_COUNT : FULL_SCANLINE_COUNT;

  const drift = useSharedValue(0);
  React.useEffect(() => {
    drift.value = withRepeat(
      withTiming(2, {
        duration: 9000,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [drift]);

  const driftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drift.value }],
  }));

  return (
    <View style={[styles.root, { opacity }]} pointerEvents="none">
      <Animated.View style={[styles.layer, driftStyle]}>
        {Array.from({ length: count }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.line,
              {
                top: `${(i * 100) / count}%`,
                height: mode === 'reduced' ? 3 : 2,
                backgroundColor: 'rgba(0,0,0,0.25)',
              },
            ]}
          />
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * VignetteOverlay — edge darkening for screen-curvature feel. Approximated
 * with a wide inset shadow (no Linear/RadialGradient dep). Opacity scales
 * with intensity. Reduced mode uses thinner border for less GPU cost.
 */
export interface VignetteOverlayProps extends OverlayProps {
  /** Scale vignette by quality mode. 'reduced' = thinner border, less shadow. */
  mode?: ScanlineMode;
}

export function VignetteOverlay({
  intensity,
  mode = 'full',
}: VignetteOverlayProps): JSX.Element | null {
  const opacity = Math.min(1, Math.max(0, intensity * 0.85));
  if (mode === 'off' || opacity === 0) {
    return null;
  }
  const vignetteStyle = mode === 'reduced' ? styles.vignetteReduced : styles.vignette;
  return <View style={[styles.root, vignetteStyle, { opacity }]} pointerEvents="none" />;
}

/**
 * PhosphorGlow — subtle amber bloom over content. Implemented as a
 * translucent amber wash with a soft blur via shadow; intensity scales
 * opacity. Reduced mode lowers shadow radius for less GPU cost.
 */
export interface PhosphorGlowProps extends OverlayProps {
  /** Scale glow by quality mode. 'reduced' = smaller shadow, 'off' = nothing. */
  mode?: ScanlineMode;
}

export function PhosphorGlow({ intensity, mode = 'full' }: PhosphorGlowProps): JSX.Element | null {
  const opacity = Math.min(1, Math.max(0, intensity * 0.35));
  if (mode === 'off' || opacity === 0) {
    return null;
  }
  const glowStyle = mode === 'reduced' ? styles.glowReduced : styles.glow;
  return <View style={[styles.root, glowStyle, { opacity }]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  layer: {
    flex: 1,
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  vignette: {
    backgroundColor: 'transparent',
    borderWidth: 56,
    borderColor: 'rgba(0,0,0,0.65)',
    shadowColor: '#000000',
    shadowOpacity: 0.95,
    shadowRadius: 100,
    shadowOffset: { width: 0, height: 0 },
  },
  vignetteReduced: {
    backgroundColor: 'transparent',
    borderWidth: 28,
    borderColor: 'rgba(0,0,0,0.55)',
    shadowColor: '#000000',
    shadowOpacity: 0.8,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: 0 },
  },
  glow: {
    backgroundColor: 'rgba(255, 140, 0, 0.04)',
    shadowColor: '#FF8C00',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  glowReduced: {
    backgroundColor: 'rgba(255, 140, 0, 0.03)',
    shadowColor: '#FF8C00',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
});
