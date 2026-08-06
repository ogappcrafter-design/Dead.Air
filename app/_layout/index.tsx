import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useStoreStore } from '../../store/useStoreStore';

export default function RootLayout() {
  const { initialize, dispose } = useStoreStore();

  useEffect(() => {
    // Initialize IAP service when app starts
    initialize();

    return () => {
      // Clean up when app is closed
      dispose();
    };
  }, []);

  return (
    <Stack>
      <Stack.Screen name="radio/index" options={{ headerShown: false }} />
      <Stack.Screen name="store/index" options={{ headerShown: false }} />
      <Stack.Screen name="tapes/index" options={{ headerShown: false }} />
      <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
    </Stack>
  );
}
