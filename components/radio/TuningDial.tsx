import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { colors, fonts, spacing } from '../../lib/theme';
import { useSettingsStore } from '../../store/useSettingsStore';

interface TuningDialProps {
  frequency: number;
  minFreq: number;
  maxFreq: number;
  isTuning: boolean;
  onFrequencyChange: (freq: number) => void;
  onTuningStart: () => void;
  onTuningEnd: () => void;
}

export const TuningDial = memo(function TuningDial({
  frequency,
  minFreq,
  maxFreq,
  isTuning: _isTuning,
  onFrequencyChange,
  onTuningStart,
  onTuningEnd,
}: TuningDialProps) {
  const rotation = useSharedValue(0);
  const lastY = useSharedValue(0);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  const springConfig = { damping: 12, stiffness: 120 };

  const gesture = Gesture.Pan()
    .onStart(() => {
      lastY.value = 0;
      onTuningStart();
    })
    .onUpdate((e) => {
      const delta = (lastY.value - e.translationY) * 0.05;
      const newFreq = Math.max(minFreq, Math.min(maxFreq, frequency + delta));
      onFrequencyChange(newFreq);
      lastY.value = e.translationY;

      // Rotate dial based on frequency position
      const range = maxFreq - minFreq;
      const position = (newFreq - minFreq) / range;
      rotation.value = reducedMotion
        ? position * 270 - 135
        : withSpring(position * 270 - 135, springConfig);
    })
    .onEnd(() => {
      onTuningEnd();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Calculate needle position for visual feedback
  const range = maxFreq - minFreq;
  const position = (frequency - minFreq) / range;

  return (
    <View style={styles.container}>
      <Text style={styles.label} accessibilityRole="header">
        TUNE
      </Text>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.dialOuter}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Tune frequency, current ${frequency.toFixed(1)}`}
          accessibilityHint="Drag vertically to change frequency"
        >
          <Animated.View style={[styles.dialInner, animatedStyle]}>
            <View style={styles.needle} />
            <View style={styles.dotTop} />
            <View style={styles.dotRight} />
            <View style={styles.dotBottom} />
            <View style={styles.dotLeft} />
          </Animated.View>
          <View
            style={[styles.indicator, { transform: [{ rotate: `${position * 270 - 135}deg` }] }]}
          >
            <View style={styles.indicatorDot} />
          </View>
        </View>
      </GestureDetector>
      <Text style={styles.hint} accessibilityRole="text">
        DRAG TO TUNE
      </Text>
    </View>
  );
});

const DIAL_SIZE = 140;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  dialOuter: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialInner: {
    width: DIAL_SIZE - 24,
    height: DIAL_SIZE - 24,
    borderRadius: (DIAL_SIZE - 24) / 2,
    borderWidth: 1,
    borderColor: `${colors.amber}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  needle: {
    width: 2,
    height: 24,
    backgroundColor: colors.amber,
    position: 'absolute',
    top: 4,
  },
  dotTop: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    position: 'absolute',
    top: 8,
  },
  dotRight: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    position: 'absolute',
    right: 8,
  },
  dotBottom: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    position: 'absolute',
    bottom: 8,
  },
  dotLeft: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    position: 'absolute',
    left: 8,
  },
  indicator: {
    position: 'absolute',
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    alignItems: 'center',
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.amber,
    position: 'absolute',
    top: -4,
  },
  hint: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: spacing.sm,
    opacity: 0.5,
  },
});
