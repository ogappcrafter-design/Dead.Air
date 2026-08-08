// app/settings/achievements.tsx
// Expo Router screen: lists every achievement with unlock status.
// Reads stats from useGameStore and unlocks from useAchievementStore,
// derives the grid items via getAchievementStatus (pure).

import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useGameStore } from '../../store/useGameStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAchievementStore } from '../../store/useAchievementStore';
import { useDailyCallStore } from '../../store/useDailyCallStore';
import { getAchievementStatus, type PlayerStats } from '../../engine/progression/Achievements';
import { AchievementsGrid } from '../../components/progression/AchievementsGrid';
import { colors, fonts, spacing } from '../../lib/theme';

/**
 * Derive the PlayerStats snapshot from persisted game state.
 * All six stats come from useGameStore: sanityLowest is the cumulative
 * minimum (updated on decreaseSanity), shiftsCompleted increments on
 * endShift, longestCallSurvivedMs records the running max call duration.
 */
function usePlayerStats(): PlayerStats {
  const tapes = useGameStore((s) => s.tapes);
  const unlockedBands = useGameStore((s) => s.unlockedBands);
  const receivedCalls = useGameStore((s) => s.receivedCalls);
  const sanityLowest = useGameStore((s) => s.sanityLowest);
  const shiftsCompleted = useGameStore((s) => s.shiftsCompleted);
  const longestCallSurvivedMs = useGameStore((s) => s.longestCallSurvivedMs);
  const difficultyMode = useSettingsStore((s) => s.difficulty);
  const dailyStreak = useDailyCallStore((s) => s.streak); (feat(calls): DEA-49 daily mystery call system — seeded RNG, streak tracking, exclusive calls)

  return {
    callsReceived: receivedCalls.length,
    bandsUnlocked: unlockedBands.length,
    tapesCollected: tapes.length,
    sanityLowest,
    shiftsCompleted,
    longestCallSurvivedMs,
    difficultyMode,
    dailyStreak, (feat(calls): DEA-49 daily mystery call system — seeded RNG, streak tracking, exclusive calls)
  };
}

export default function AchievementsScreen() {
  const stats = usePlayerStats();
  const unlocked = useAchievementStore((s) => s.unlocked);
  const items = getAchievementStatus(stats, unlocked);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          ACHIEVEMENTS
        </Text>
      </View>
      <AchievementsGrid items={items} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  header: {
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.amber,
    letterSpacing: 2,
  },
});
