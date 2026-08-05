// components/shared/CRTEffects.tsx
// Presentational sub-components used by CRTView. All overlays are
// pointerEvents='none' so touch events reach the content underneath.
// No store access, no game logic — pure view layer driven by `intensity`.

import React, { type JSX } from 'react';
import { View, StyleSheet } from 'react-native';

export interface OverlayProps {
  /** 0..1 — drives overlay opacity. Caller (CRTView) already gates 0. */
  intensity: number;
}

const SCANLINE_COUNT = 80; // lines per overlay height — kept light for perf

/**
 * ScanlineOverlay — alternating dark/light horizontal lines approximating
 * a CRT raster. Rendered as a stack of 2px rows with alternating colors,
 * evenly distributed by top %. Opacity scales with intensity so the effect
 * is subtle on low settings. pointerEvents='none'.
 */
export function ScanlineOverlay({ intensity }: OverlayProps): JSX.Element {
  const opacity = Math.min(1, Math.max(0, intensity));
  return (
    <View style={[styles.root, { opacity }]} pointerEvents="none">
      {Array.from({ length: SCANLINE_COUNT }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.line,
            {
              top: `${(i * 100) / SCANLINE_COUNT}%`,
              backgroundColor: i % 2 === 0 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.02)',
            },
          ]}
        />
      ))}
    </View>
  );
}

/**
 * VignetteOverlay — edge darkening for screen-curvature feel. Approximated
 * with a wide inset shadow (no Linear/RadialGradient dep). Opacity scales
 * with intensity.
 */
export function VignetteOverlay({ intensity }: OverlayProps): JSX.Element {
  const opacity = Math.min(1, Math.max(0, intensity * 0.85));
  return <View style={[styles.root, styles.vignette, { opacity }]} pointerEvents="none" />;
}

/**
 * PhosphorGlow — subtle amber bloom over content. Implemented as a
 * translucent amber wash with a soft blur via shadow; intensity scales
 * opacity. Does not touch input — wraps nothing, sits on top as overlay.
 */
export function PhosphorGlow({ intensity }: OverlayProps): JSX.Element {
  const opacity = Math.min(1, Math.max(0, intensity * 0.35));
  return <View style={[styles.root, styles.glow, { opacity }]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    inset: 0,
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
  },
  vignette: {
    backgroundColor: 'transparent',
    // Inset-like dark frame: wide dark border + soft inner shadow.
    borderWidth: 48,
    borderColor: 'rgba(0,0,0,0.55)',
    shadowColor: '#000000',
    shadowOpacity: 0.9,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: 0 },
  },
  glow: {
    backgroundColor: 'rgba(255, 140, 0, 0.04)', // amber wash
    shadowColor: '#FF8C00',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
});
