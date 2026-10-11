// components/endless/EndlessNightOverlay.tsx
// DEA-86: Endless Night surface for the radio screen.
//
// Two states:
//   - ACTIVE: a slim HUD strip at the top of the radio showing score
//     (shifts survived), escalation level, weather, and the personal
//     best. Discreet so it never hides the call UI below it.
//   - GAME OVER: a centered banner with the final score, the personal
//     best, and two actions — RESTART (starts a fresh run) and EXIT
//     (ends the run and returns to normal play). The leaderboard entry
//     is already submitted by useEndlessNight when the flag flips.
//
// Purely presentational — all run state comes from the game store.

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import { useGameStore } from '../../store/useGameStore';

export function EndlessNightOverlay() {
  const active = useGameStore((s) => s.endlessModeActive);
  const gameOver = useGameStore((s) => s.endlessGameOver);
  const score = useGameStore((s) => s.endlessScore);
  const highScore = useGameStore((s) => s.endlessHighScore);
  const level = useGameStore((s) => s.escalationLevel);
  const weather = useGameStore((s) => s.endlessWeather);
  const restartRun = useGameStore((s) => s.restartEndlessRun);
  const endRun = useGameStore((s) => s.endEndlessNightMode);

  // Nothing to show: no run active and no pending game-over banner.
  if (!active && !gameOver) {
    return null;
  }

  if (gameOver) {
    return (
      <View style={styles.gameOverWrap} testID="endless-gameover-banner">
        <View style={styles.gameOverCard}>
          <Text style={styles.gameOverTitle}>SIGNAL LOST</Text>
          <Text style={styles.gameOverSub}>THE NIGHT TOOK YOU</Text>
          <View style={styles.scoreRow}>
            <View style={styles.scoreCol}>
              <Text style={styles.scoreLabel}>SHIFTS SURVIVED</Text>
              <Text style={styles.scoreValue}>{score}</Text>
            </View>
            <View style={styles.scoreCol}>
              <Text style={styles.scoreLabel}>BEST</Text>
              <Text style={styles.scoreValue}>{highScore}</Text>
            </View>
          </View>
          <View style={styles.gameOverActions}>
            <Pressable
              testID="endless-restart"
              style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
              onPress={restartRun}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Start a new Endless Night run"
            >
              <Text style={styles.actionBtnText}>RESTART</Text>
            </Pressable>
            <Pressable
              testID="endless-exit"
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionBtnGhost,
                pressed && styles.actionBtnPressed,
              ]}
              onPress={endRun}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Exit Endless Night"
            >
              <Text style={styles.actionBtnText}>EXIT</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.hudWrap} testID="endless-hud">
      <View style={styles.hud}>
        <View style={styles.hudLeft}>
          <Text style={styles.hudTitle}>ENDLESS</Text>
          <Text style={styles.hudValue}>{score}</Text>
        </View>
        <View style={styles.hudMid}>
          <Text style={styles.hudLabel}>LVL {level}</Text>
          <Text style={styles.hudWeather}>{weather}</Text>
        </View>
        <View style={styles.hudRight}>
          <Text style={styles.hudLabel}>BEST</Text>
          <Text style={styles.hudValueSmall}>{highScore}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hudWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    padding: spacing.sm,
  },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  hudLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  hudTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.amber,
    letterSpacing: 2,
  },
  hudValue: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.text,
  },
  hudMid: {
    alignItems: 'center',
    gap: 0,
  },
  hudLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  hudWeather: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.amber,
    letterSpacing: 1,
  },
  hudRight: {
    alignItems: 'flex-end',
    gap: 0,
  },
  hudValueSmall: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text,
  },
  gameOverWrap: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    backgroundColor: 'rgba(3,3,3,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  gameOverCard: {
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    maxWidth: 320,
  },
  gameOverTitle: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.red,
    letterSpacing: 6,
  },
  gameOverSub: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 3,
    marginTop: -spacing.sm,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xs,
  },
  scoreCol: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  scoreLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  scoreValue: {
    fontFamily: fonts.mono,
    fontSize: 34,
    color: colors.amber,
  },
  gameOverActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: 4,
    minWidth: 96,
    alignItems: 'center',
  },
  actionBtnGhost: {
    borderColor: colors.border,
  },
  actionBtnPressed: {
    opacity: 0.6,
  },
  actionBtnText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.amber,
    letterSpacing: 2,
  },
});
