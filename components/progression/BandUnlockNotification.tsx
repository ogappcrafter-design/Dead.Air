// components/progression/BandUnlockNotification.tsx
// Presentational component: metroidvania-style band unlock toast.
// Fades in when a band unlocks, fades out when it clears. Purely visual —
// props: band: Band | null (null = hidden).

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BANDS } from '../../data/calls';
import type { Band } from '../../lib/constants';
import { colors, fonts, spacing } from '../../lib/theme';

interface BandUnlockNotificationProps {
  /** Band to announce, or null to hide. */
  band: Band | null;
  /** Fade duration in ms (default 500). */
  durationMs?: number;
}

const bandMetaByName = new Map<Band, { freq: string; color: string }>(
  BANDS.map((row) => [row.name as Band, { freq: row.freq, color: row.color }] as const),
);

export function BandUnlockNotification({ band, durationMs = 500 }: BandUnlockNotificationProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (band !== null) {
      opacity.value = withTiming(1, { duration: durationMs, easing: Easing.out(Easing.ease) });
    } else {
      opacity.value = withTiming(0, { duration: durationMs, easing: Easing.in(Easing.ease) });
    }
  }, [band, durationMs, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (band === null) {
    return null;
  }

  const meta = bandMetaByName.get(band);

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="none">
      <View style={[styles.glyph, meta ? { backgroundColor: meta.color } : undefined]} />
      <Text style={styles.label}>NEW FREQUENCY UNLOCKED</Text>
      <Text style={styles.bandName}>{band}</Text>
      <Text style={styles.freq}>{meta?.freq ?? ''}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: spacing.xl,
    alignSelf: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  glyph: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.amber,
    letterSpacing: 3,
  },
  bandName: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.text,
    letterSpacing: 2,
    fontWeight: '700',
  },
  freq: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
  },
});
