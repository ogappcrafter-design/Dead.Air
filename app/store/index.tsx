// app/store/index.tsx
// Store screen — base game + Infinite Signal IAP. Mock purchase flow only
// in Phase 5-4; real billing wired in a later phase. Persists hasInfiniteSignal
// via useStoreStore (zustand + AsyncStorage).

import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing } from '../../lib/theme';
import { useStoreStore } from '../../store/useStoreStore';
import { useAnalyticsStore } from '../../store/useAnalyticsStore';
import { StoreCard } from '../../components/store/StoreCard';

/** Stable noop — avoids creating a new function reference on every render. */
const NOOP = () => {};

export default function StoreScreen() {
  const router = useRouter();
  const hasInfiniteSignal = useStoreStore((s) => s.hasInfiniteSignal);
  const isLoading = useStoreStore((s) => s.isLoading);
  const purchaseInfiniteSignal = useStoreStore((s) => s.purchaseInfiniteSignal);
  const restorePurchases = useStoreStore((s) => s.restorePurchases);
  const track = useAnalyticsStore((s) => s.track);

  useEffect(() => {
    track('store_viewed');
  }, [track]);

  const handlePurchaseInfiniteSignal = async () => {
    await purchaseInfiniteSignal();
    if (useStoreStore.getState().hasInfiniteSignal) {
      track('iap_completed', { productId: 'infinite_signal' });
    }
  };

  const infiniteSignalState = hasInfiniteSignal
    ? ('owned' as const)
    : isLoading
      ? ('purchasing' as const)
      : ('available' as const);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable
            testID="store-back-button"
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            onPress={() => router.back()}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Back to radio"
            accessibilityHint="Return to the radio screen"
          >
            <Text style={styles.backButtonText} numberOfLines={1}>
              ‹ RADIO
            </Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            DEAD AIR RADIO
          </Text>
          <View style={styles.backButtonSpacer} />
        </View>

        <StoreCard
          title="BASE GAME"
          description="18 sacred calls. 5 bands. Full horror. The complete base-game experience, free."
          price="FREE"
          state="owned"
          onPurchase={NOOP}
        />

        <StoreCard
          title="INFINITE SIGNAL"
          description="Endless procedural calls beyond the 18 sacred handshakes. New frequencies, new voices, forever."
          price="$4.99"
          state={infiniteSignalState}
          onPurchase={handlePurchaseInfiniteSignal}
          purchaseButtonTestID="infinite-signal-purchase"
        />

        <Pressable
          testID="restore-purchases"
          style={({ pressed }) => [styles.restoreLink, pressed && styles.restoreLinkPressed]}
          onPress={restorePurchases}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
          accessibilityHint="Re-sync previously purchased entitlements"
        >
          <Text style={styles.restoreText} numberOfLines={1}>
            Restore Purchases
          </Text>
        </Pressable>

        <Text style={styles.disclaimer} numberOfLines={3}>
          Mock store. Real billing arrives in a later phase. Entitlement persists locally across
          reinstalls.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  backButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 80,
  },
  backButtonPressed: {
    backgroundColor: colors.surface,
  },
  backButtonSpacer: {
    minWidth: 80,
  },
  backButtonText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.amber,
    letterSpacing: 2,
  },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.amber,
    letterSpacing: 4,
    textAlign: 'center',
    minWidth: 0,
  },
  restoreLink: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  restoreLinkPressed: {
    opacity: 0.6,
  },
  restoreText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 2,
    textDecorationLine: 'underline',
  },
  disclaimer: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
});
