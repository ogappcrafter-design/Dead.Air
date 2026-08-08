import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { CRTView } from '../components/shared/CRTView';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';
import { colors } from '../lib/theme';
import { initErrorTracking } from '../lib/errorTracking';
import { useSettingsStore } from '../store/useSettingsStore';
import { AnalyticsEngine } from '../lib/analytics/AnalyticsEngine';
import { initIAP } from '../lib/iap';

initErrorTracking();

export default function RootLayout() {
  const crtEnabled = useSettingsStore((s) => s.crtEnabled);

  useEffect(() => {
    initErrorTracking();
    AnalyticsEngine.init();
    initIAP().catch(() => {});
    return () => {
      AnalyticsEngine.endSession();
    };
  }, []);

  return (
    <ErrorBoundary>
      <CRTView intensity={crtEnabled ? 0.1 : 0}>
        <View style={styles.container}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="radio" />
            <Stack.Screen name="tapes" />
            <Stack.Screen name="store" />
            <Stack.Screen name="settings" />
          </Stack>
          <StatusBar style="light" />
        </View>
      </CRTView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
