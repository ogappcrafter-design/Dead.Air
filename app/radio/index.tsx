import { View, StyleSheet, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing } from '../../lib/theme';
import { RadioBody } from '../../components/radio/RadioBody';
import { ActiveCallDispatcher } from '@/components/calls/ActiveCallDispatcher';
import { AchievementNotification } from '@/components/progression/AchievementNotification';
import { useAchievementStore } from '@/store/useAchievementStore';
import { useTutorialController } from '@/hooks/useTutorialController';
import { TutorialIndicator } from '@/components/tutorial/TutorialIndicator';
import { TutorialTransition } from '@/components/tutorial/TutorialTransition';
import CRTView from '../../components/shared/CRTView';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

export default function RadioScreen() {
  const router = useRouter();
  const recentUnlock = useAchievementStore((s) => s.recentUnlock);
  const clearRecentUnlock = useAchievementStore((s) => s.clearRecentUnlock);
  const tutorial = useTutorialController();

  return (
    <CRTView intensity={0.3}>
      <View style={styles.container}>
        {tutorial.isActive && <TutorialIndicator />}
        <RadioBody />
        <ErrorBoundary>
          <ActiveCallDispatcher />
        </ErrorBoundary>
        <AchievementNotification achievement={recentUnlock} onDismiss={clearRecentUnlock} />
        <View style={styles.navRow} accessibilityRole="toolbar">
          <Pressable
            testID="radio-nav-tapes"
            style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
            onPress={() => router.push('/tapes')}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Open tape collection"
          >
            <Text style={styles.navLabel} numberOfLines={1}>
              ▣ TAPES
            </Text>
          </Pressable>
          <Pressable
            testID="radio-nav-store"
            style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
            onPress={() => router.push('/store')}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Open store"
          >
            <Text style={styles.navLabel} numberOfLines={1}>
              ⛁ STORE
            </Text>
          </Pressable>
          <Pressable
            testID="radio-nav-settings"
            style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
            onPress={() => router.push('/settings')}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <Text style={styles.navLabel} numberOfLines={1}>
              ⚙ SETTINGS
            </Text>
          </Pressable>
        </View>
      </View>
      {tutorial.isInTransition && <TutorialTransition />}
    </CRTView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    paddingBottom: spacing.md,
  },
  navBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 2,
    minWidth: 64,
  },
  navBtnPressed: {
    backgroundColor: colors.surface,
    opacity: 0.85,
  },
  navLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.amber,
    letterSpacing: 2,
    textAlign: 'center',
  },
});
