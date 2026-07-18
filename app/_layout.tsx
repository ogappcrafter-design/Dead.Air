import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { CRTView } from '../components/shared/CRTView';
import { colors } from '../lib/theme';
import { useSettingsStore } from '../store/useSettingsStore';

export default function RootLayout() {
  const crtEnabled = useSettingsStore((s) => s.crtEnabled);

  return (
    <CRTView intensity={crtEnabled ? 0.1 : 0}>
      <View style={styles.container}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="radio" />
          <Stack.Screen name="tapes" />
          <Stack.Screen name="store" />
          <Stack.Screen name="settings" />
        </Stack>
        <StatusBar style="light" />
      </View>
    </CRTView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
