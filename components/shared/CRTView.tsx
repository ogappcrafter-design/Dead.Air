// components/shared/CRTView.tsx
// Decorative wrapper applying a CRT-style overlay (scanlines + vignette) at a
// configurable intensity. Used across screens to evoke the dead-air radio
// aesthetic. Pure presentational — no behavior.

import { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../lib/theme';

interface CRTViewProps {
  /** 0 disables the overlay; 0.0–1.0 scales scanline opacity. */
  intensity?: number;
  children: ReactNode;
}

/**
 * CRTView renders a dim scanline + vignette overlay over its children when
 * `intensity` > 0. When intensity is 0, it renders children bare with no
 * overlay. The overlay layers use theme colors so they harmonize with the
 * rest of the UI.
 */
export function CRTView({ intensity = 0, children }: CRTViewProps) {
  if (intensity <= 0) {
    return <>{children}</>;
  }

  return (
    <View style={styles.wrapper}>
      {children}
      <View style={[styles.scanlines, { opacity: intensity }]} pointerEvents="none" />
      <View style={[styles.vignette, { opacity: intensity * 0.6 }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: 'relative',
  },
  scanlines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Translucent dark tint approximates scanline overlay without native
    // repeating-gradient support.
    backgroundColor: `${colors.background}40`,
  },
  vignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: `${colors.background}80`,
  },
});

export default CRTView;
