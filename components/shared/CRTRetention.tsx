// components/shared/CRTRetention.tsx
// Phosphor decay wrapper. When the wrapped content changes (by ref to the
// children signature), a brief amber afterglow pulses over the previous
// frame and fades to transparent over ~200ms. Pure visual layer; uses
// react-native-reanimated shared values so the animation runs off the JS
// thread after kick-off. pointerEvents='none' so touches pass through.

import React, { useEffect, useRef, type JSX, type ReactNode } from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { colors } from '../../lib/theme';

export interface CRTRetentionProps extends ViewProps {
  children?: ReactNode;
  style?: ViewProps['style'];
}

const TRAIL_MS = 200;

/**
 * CRTRetention — wraps children and flashes an amber afterglow when the
 * children signature changes. Detects change via React's children reference
 * identity (React re-creates children on parent re-render); the afterglow
 * overlay fades over TRAIL_MS and stays invisible until the next change.
 */
function CRTRetention({ children, style, ...rest }: CRTRetentionProps): JSX.Element {
  const glow = useSharedValue(0);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    glow.value = 0.5;
    glow.value = withTiming(0, {
      duration: TRAIL_MS,
      easing: Easing.out(Easing.ease),
    });
    return () => {
      cancelAnimation(glow);
    };
  }, [children, glow]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <View style={[styles.container, style]} {...rest}>
      <Animated.View style={[styles.afterglow, glowStyle]} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  afterglow: {
    position: 'absolute',
    inset: 0,
    backgroundColor: colors.amber,
  },
});

export default CRTRetention;
export { CRTRetention };
