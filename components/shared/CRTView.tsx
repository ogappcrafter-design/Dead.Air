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

// Signal tear: brief horizontal displacement. Rare, fast, subliminal.
const TEAR_PERIOD_MS = 7000;
const TEAR_DISPLACEMENT = 4;

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

  // Signal tear — every ~7s, a 4px horizontal jog for ~80ms. Subliminal.
  const tear = useSharedValue(0);
  React.useEffect(() => {
    if (!active || reducedMotion) return;
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      tear.value = withTiming(TEAR_DISPLACEMENT, { duration: 40 });
      timeout = setTimeout(() => {
        tear.value = withTiming(0, { duration: 40 });
        timeout = setTimeout(tick, TEAR_PERIOD_MS * (0.6 + Math.random() * 0.8));
      }, 80);
    };
    timeout = setTimeout(tick, 3000);
    return () => clearTimeout(timeout);
  }, [active, reducedMotion, tear]);

  const tearStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tear.value }],
  }));

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
      <Animated.View style={[styles.layer, tearStyle]}>{children}</Animated.View>

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
