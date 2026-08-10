// components/shared/CRTView.tsx
// CRTView — root CRT visual effects container. Layered overlays render
// scanlines, edge vignette, phosphor glow, and gentle flicker over children.
// Pass-through View when intensity is 0 or when settings disable CRT effects.
//
// Overlays are pointerEvents='none' so touch events pass through to children.
// All animation uses react-native-reanimated (no raw Animated API). The flick
// loop is driven by a shared-value timing so it stays off the JS thread after
// mount. Performance budget: a handful of empty Views + one Animated.View.

import React, { type JSX, type ReactNode } from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../../lib/theme';
import { useSettingsStore } from '../../store/useSettingsStore';
import { ScanlineOverlay, VignetteOverlay, PhosphorGlow } from './CRTEffects';
import type { ScanlineMode } from './CRTEffects';

export interface CRTViewProps extends ViewProps {
  /** 0..1 — 0 disables effects entirely (pass-through View). */
  intensity?: number;
  children?: ReactNode;
  style?: ViewProps['style'];
}

const FLICKER_PERIOD_MS = 2800;
const FLICKER_MAX = 0.12;

/**
 * CRTView wraps children with layered CRT effects:
 *   - ScanlineOverlay: alternating dark horizontal lines
 *   - VignetteOverlay: edge darkening for screen curvature feel
 *   - PhosphorGlow: subtle amber bloom over content
 *   - Flicker: gentle opacity oscillation on the whole stack
 *
 * Pass-through when intensity===0 or useSettingsStore.crtEnabled===false.
 */
function CRTView({ intensity = 0, children, style, ...rest }: CRTViewProps): JSX.Element {
  const crtEnabled = useSettingsStore((s) => s.crtEnabled);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const scanlineDensity = useSettingsStore((s) => s.scanlineDensity);
  const particleEffects = useSettingsStore((s) => s.particleEffects);
  const active = intensity > 0 && crtEnabled && scanlineDensity !== 'off';

  const flicker = useSharedValue(0);
  const flickerStyle = useAnimatedStyle(() => ({ opacity: flicker.value }));

  React.useEffect(() => {
    if (!active || reducedMotion) {
      cancelAnimation(flicker);
      flicker.value = 1;
      return;
    }
    flicker.value = withRepeat(
      withTiming(FLICKER_MAX, {
        duration: FLICKER_PERIOD_MS / 2,
        easing: Easing.inOut(Easing.sin),
      }),
      -1, // infinite
      true, // reverse each cycle → min..max..min
    );
    return () => {
      cancelAnimation(flicker);
    };
  }, [active, reducedMotion, flicker]);

  if (!active) {
    return (
      <View style={style} {...rest}>
        {children}
      </View>
    );
  }

  // Determine overlay quality mode from scanlineDensity setting.
  // When particleEffects is false, downgrade overlays to 'reduced'.
  const overlayMode: ScanlineMode = particleEffects ? scanlineDensity : 'reduced';

  return (
    <View style={[styles.container, style]} {...rest}>
      <View style={styles.layer}>{children}</View>

      {/* Effect overlays — pointerEvents none so touches reach children. */}
      {particleEffects && <PhosphorGlow intensity={intensity} mode={overlayMode} />}
      <ScanlineOverlay intensity={intensity} mode={scanlineDensity} />
      <VignetteOverlay intensity={intensity} mode={overlayMode} />

      {/* Flicker wraps the visual stack only; not touch targets underneath. */}
      <Animated.View style={[styles.flicker, flickerStyle]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  layer: {
    flex: 1,
  },
  flicker: {
    position: 'absolute',
    inset: 0,
    backgroundColor: colors.background,
    opacity: 1,
  },
});

export default CRTView;
export { CRTView };
