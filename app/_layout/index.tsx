import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { initIAP, disconnectIAP, revalidateEntitlements } from '../../lib/iap';

export default function RootLayout() {
  useEffect(() => {
    // Initialize IAP service and re-validate entitlements on launch
    initIAP().then(() => revalidateEntitlements());

    return () => {
      // Clean up when app is closed
      disconnectIAP();
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
