import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../lib/theme';
import type { Band } from '../lib/constants';

interface BandProgressProps {
  bands: ReadonlyArray<{
    id: number;
    name: Band;
    freq: string;
    color: string;
    unlockAt: number;
  }>;
  unlockedBands: readonly Band[];
  totalReceivedCalls: number;
}

export function BandProgress({ bands, unlockedBands, totalReceivedCalls }: BandProgressProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>BANDS</Text>
      {bands.map((band) => {
        const isUnlocked = unlockedBands.includes(band.name);
        const progress = Math.min(1, totalReceivedCalls / Math.max(1, band.unlockAt));
        return (
          <View key={`band-${band.id}`} style={styles.row}>
            <View style={[styles.dot, isUnlocked && { backgroundColor: band.color }]} />
            <Text style={[styles.name, !isUnlocked && styles.locked]} numberOfLines={1}>
              {band.name}
            </Text>
            <Text style={styles.freq} numberOfLines={1}>
              {band.freq}
            </Text>
            <View style={styles.barContainer}>
              <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.threshold}>{band.unlockAt}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  title: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.amber,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  name: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text,
    letterSpacing: 1,
    minWidth: 80,
  },
  locked: {
    color: colors.textMuted,
  },
  freq: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
    minWidth: 60,
  },
  barContainer: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.green,
  },
  threshold: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    minWidth: 24,
    textAlign: 'right',
  },
});
