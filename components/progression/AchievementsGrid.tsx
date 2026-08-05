// components/progression/AchievementsGrid.tsx
// Presentational grid of all achievements.
// Unlocked: full color, icon visible. Locked: dimmed, icon replaced with "?".
// Pure presentational — props in, callbacks out, no store access.
//
// Props:
//   items: Array<Achievement & { unlocked: boolean }> — from getAchievementStatus.
//   columns?: number (default 2).

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import type { Achievement } from '../../engine/progression/Achievements';

export type AchievementStatusItem = Achievement & { unlocked: boolean };

interface AchievementsGridProps {
  items: AchievementStatusItem[];
  columns?: number;
}

export const AchievementsGrid = memo(function AchievementsGrid({
  items,
  columns = 2,
}: AchievementsGridProps) {
  const unlockedCount = items.reduce((n, i) => (i.unlocked ? n + 1 : n), 0);
  const progressLabel = `${unlockedCount} / ${items.length} unlocked`;
  const gapPct = 4;
  const cellWidthPct = Math.max(0, 100 / columns - gapPct);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ACHIEVEMENTS</Text>
      <Text style={styles.progress}>{progressLabel}</Text>
      <View style={styles.grid}>
        {items.map((item, idx) => (
          <View
            key={item.id}
            style={[
              styles.cell,
              { width: `${cellWidthPct}%` },
              idx % columns !== 0 ? { marginLeft: `${gapPct}%` } : null,
            ]}
            accessible
            accessibilityLabel={`${item.name}: ${item.unlocked ? 'unlocked' : 'locked'}. ${item.description}`}
          >
            <Text style={[styles.icon, item.unlocked ? null : styles.iconLocked]}>
              {item.unlocked ? item.icon : '?'}
            </Text>
            <Text style={[styles.name, item.unlocked ? null : styles.textLocked]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text
              style={[styles.description, item.unlocked ? null : styles.textLocked]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontFamily: fonts.mono,
    fontSize: 20,
    color: colors.amber,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  progress: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    padding: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    minWidth: 0,
  },
  icon: {
    fontSize: 24,
    color: colors.amber,
    marginBottom: spacing.xs,
  },
  iconLocked: {
    color: colors.textMuted,
  },
  name: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  description: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  textLocked: {
    color: colors.dimGreen,
    opacity: 0.6,
  },
});
