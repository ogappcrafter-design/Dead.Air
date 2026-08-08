// app/store/index.tsx
// Store screen — base game + Infinite Signal IAP.
// Real billing via expo-in-app-purchases (lib/iap.ts). Entitlements persist
// in useStoreStore (zustand + AsyncStorage).

import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing } from '../../lib/theme';
import { useStoreStore } from '../../store/useStoreStore';
import { useAnalyticsStore } from '../../store/useAnalyticsStore';
import { StoreCard } from '../../components/store/StoreCard';
import { TapePackSection } from '../../components/store/TapePackSection';
import { purchaseProduct, restorePurchases, PRODUCT_IDS } from '../../lib/iap';
import { ATMOSPHERIC_PACKS } from '../../data/atmosphericPacks';

/** Stable noop — avoids creating a new function reference on every render. */
const NOOP = () => {};

export default function StoreScreen() {
  const router = useRouter();
  const hasInfiniteSignal = useStoreStore((s) => s.hasInfiniteSignal);
  const hasBase = useStoreStore((s) => s.hasBase);
  const purchasing = useStoreStore((s) => s.purchasing);
  const ownedAtmosphericPacks = useStoreStore((s) => s.ownedAtmosphericPacks);
  const lastError = useStoreStore((s) => s.lastError);
  const lastMessage = useStoreStore((s) => s.lastMessage);
  const track = useAnalyticsStore((s) => s.track);

  useEffect(() => {
    track('store_viewed');
  }, [track]);

  const handlePurchaseBase = async () => {
    track('iap_started', { productId: 'base' });
    const result = await purchaseProduct(PRODUCT_IDS.BASE);
    if (result?.responseCode === 0 && useStoreStore.getState().hasBase) {
      track('iap_completed', { productId: 'base' });
    }
  };

  const handlePurchaseInfiniteSignal = async () => {
    track('iap_started', { productId: 'infinite_signal' });
    const result = await purchaseProduct(PRODUCT_IDS.INFINITE_SIGNAL);
    if (result?.responseCode === 0 && useStoreStore.getState().hasInfiniteSignal) {
      track('iap_completed', { productId: 'infinite_signal' });
    }
  };

  const handlePurchaseAtmos = async (productId: string, packId: string) => {
    track('iap_started', { productId: packId });
    const result = await purchaseProduct(productId);
    if (
      result?.responseCode === 0 &&
      useStoreStore.getState().ownedAtmosphericPacks.includes(packId)
    ) {
      track('iap_completed', { productId: packId });
    }
  };

  const handleRestore = async () => {
    track('iap_restore_started');
    await restorePurchases();
    track('iap_restore_completed');
  };

  const baseState = hasBase
    ? ('owned' as const)
    : purchasing
      ? ('purchasing' as const)
      : ('available' as const);

  const infiniteSignalState = hasInfiniteSignal
    ? ('owned' as const)
    : purchasing
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

        {(lastError || lastMessage) && (
          <View style={styles.statusBanner}>
            <Text
              style={[styles.statusText, lastError ? styles.textError : styles.textInfo]}
              numberOfLines={3}
            >
              {lastError?.message ?? lastMessage}
            </Text>
          </View>
        )}

        <StoreCard
          title="BASE GAME"
          description="18 sacred calls. 5 bands. Full horror. The complete base-game experience."
          price="$0.99"
          state={baseState}
          onPurchase={handlePurchaseBase}
          purchaseButtonTestID="base-purchase"
        />

        <StoreCard
          title="INFINITE SIGNAL"
          description="Endless procedural calls beyond the 18 sacred handshakes. New frequencies, new voices, forever."
          price="$3.99"
          state={infiniteSignalState}
          onPurchase={handlePurchaseInfiniteSignal}
          purchaseButtonTestID="infinite-signal-purchase"
        />

        {ATMOSPHERIC_PACKS.map((pack) => {
          const owned = ownedAtmosphericPacks.includes(pack.id);
          const state: 'owned' | 'purchasing' | 'available' = owned
            ? 'owned'
            : purchasing
              ? 'purchasing'
              : 'available';
          return (
            <StoreCard
              key={pack.id}
              title={pack.name}
              description={pack.description}
              price={pack.price}
              state={state}
              onPurchase={() => handlePurchaseAtmos(pack.productId, pack.id)}
              purchaseButtonTestID={`atmos-${pack.id}-purchase`}
            />
          );
        })}
        <TapePackSection />

        <Pressable
          testID="restore-purchases"
          style={({ pressed }) => [styles.restoreLink, pressed && styles.restoreLinkPressed]}
          onPress={handleRestore}
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
          Purchases are tied to your App Store or Google Play account and can be restored on any
          device.
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
  statusBanner: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  statusText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    textAlign: 'center',
  },
  textError: {
    color: colors.red,
  },
  textInfo: {
    color: colors.green,
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
