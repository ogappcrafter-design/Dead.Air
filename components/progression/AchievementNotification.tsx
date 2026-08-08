// components/progression/AchievementNotification.tsx
// Presentational toast: announces a freshly-unlocked achievement.
// Mirrors BandUnlockNotification's Reanimated slide/fade pattern.
//
// Props:
//   achievement: Achievement | null — null hides the toast.
//   onDismiss: () => void           — fired when the auto-fade timer elapses.
//
// Behavior:
//   - Slides in from top with a fade when `achievement` becomes non-null.
//   - After DISPLAY_MS (3s by default), calls onDismiss() so the parent can
//     clear recentUnlock. A pending timer is cancelled if `achievement` flips
//     back to null before the timeout fires (rapid double-unlock safe).
//   - pointerEvents="none" so the toast never blocks active gameplay touches.

import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import type { Achievement } from '../../engine/progression/Achievements';
import { colors, fonts, spacing } from '../../lib/theme';
import { useSettingsStore } from '../../store/useSettingsStore';
import { usePlayerStore } from '../../store/usePlayerStore';

interface AchievementNotificationProps {
  /** Achievement to announce, or null to hide. */
  achievement: Achievement | null;
  /** Fired after DISPLAY_MS so the parent can clear recentUnlock. */
  onDismiss: () => void;
  /** On-screen display time in ms (default 3000). */
  displayMs?: number;
  /** Slide distance in px (default -40 = slides down from above viewport). */
  slideDistance?: number;
}

export const ACHIEVEMENT_DISPLAY_MS = 3000;

export const AchievementNotification = memo(function AchievementNotification({
  achievement,
  onDismiss,
  displayMs = ACHIEVEMENT_DISPLAY_MS,
  slideDistance = -40,
}: AchievementNotificationProps) {
  const offsetY = useSharedValue(slideDistance);
  const opacity = useSharedValue(0);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const djCallSign = usePlayerStore((s) => s.djCallSign);

  useEffect(() => {
    if (achievement === null) {
      // Hidden: snap to rest.
      offsetY.value = slideDistance;
      opacity.value = 0;
      return undefined;
    }

    if (reducedMotion) {
      offsetY.value = 0;
      opacity.value = 1;
      const dismissTimer = setTimeout(onDismiss, displayMs);
      return () => clearTimeout(dismissTimer);
    }

    offsetY.value = withTiming(0, {
      duration: 300,
      easing: Easing.out(Easing.ease),
    });

    opacity.value = withSequence(
      withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: displayMs, easing: Easing.linear }),
      withTiming(0, { duration: 400, easing: Easing.in(Easing.ease) }),
    );
    const dismissTimer = setTimeout(onDismiss, 300 + displayMs + 400);
    return () => clearTimeout(dismissTimer);
  }, [achievement, displayMs, slideDistance, offsetY, opacity, onDismiss, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offsetY.value }],
    opacity: opacity.value,
  }));

  if (achievement === null) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.container, animatedStyle]}
      pointerEvents="none"
      accessible
      accessibilityLabel={`Achievement unlocked: ${achievement.name}`}
      accessibilityLiveRegion="assertive"
    >
      <View style={styles.row}>
        <Text style={styles.icon}>{achievement.icon}</Text>
        <View style={styles.textCol}>
          <Text style={styles.label}>
            {djCallSign ? `${djCallSign} — ` : ''}ACHIEVEMENT UNLOCKED
          </Text>
          <Text style={styles.name}>{achievement.name}</Text>
          <Text style={styles.description}>{achievement.description}</Text>
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: spacing.xl,
    alignSelf: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.amber,
    minWidth: 280,
    maxWidth: 360,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    fontSize: 32,
    color: colors.amber,
    lineHeight: 40,
  },
  textCol: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.amber,
    letterSpacing: 3,
  },
  name: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.text,
    letterSpacing: 1,
    fontWeight: '700',
  },
  description: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
});
