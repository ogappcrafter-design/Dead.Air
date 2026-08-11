import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CRTView } from '../components/shared/CRTView';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';
import { colors } from '../lib/theme';
import { initErrorTracking } from '../lib/errorTracking';
import { useSettingsStore } from '../store/useSettingsStore';
import { AnalyticsEngine } from '../lib/analytics/AnalyticsEngine';
import { initIAP } from '../lib/iap';

initErrorTracking();

// Google Fonts: Eater (text consumed by static) + VT323 (phosphor terminal)
const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Eater&family=VT323&display=swap';

function injectFonts() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dar-fonts')) return;
  const link = document.createElement('link');
  link.id = 'dar-fonts';
  link.rel = 'stylesheet';
  link.href = FONT_URL;
  document.head.appendChild(link);
}

export default function RootLayout() {
  const crtEnabled = useSettingsStore((s) => s.crtEnabled);

  useEffect(() => {
    injectFonts();
    initErrorTracking();
    AnalyticsEngine.init();
    initIAP().catch(() => {});
    return () => {
      AnalyticsEngine.endSession();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
