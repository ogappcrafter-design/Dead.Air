import { View, StyleSheet } from 'react-native';
import { colors } from '../../lib/theme';
import { RadioBody } from '../../components/radio/RadioBody';
import { ActiveCallDispatcher } from '@/components/calls/ActiveCallDispatcher';
import { AchievementNotification } from '@/components/progression/AchievementNotification';
import { useAchievementStore } from '@/store/useAchievementStore';
import CRTView from '../../components/shared/CRTView';

export default function RadioScreen() {
  const recentUnlock = useAchievementStore((s) => s.recentUnlock);
  const clearRecentUnlock = useAchievementStore((s) => s.clearRecentUnlock);

  return (
    <CRTView intensity={0.3}>
      <View style={styles.container}>
        <RadioBody />
        <ActiveCallDispatcher />
        <AchievementNotification achievement={recentUnlock} onDismiss={clearRecentUnlock} />
      </View>
    </CRTView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
