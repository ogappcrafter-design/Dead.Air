// components/store/TapePackSection.tsx
// Section for the store screen — renders StoreCards for DLC tape packs.
// Reuses StoreCard (presentational). State is read from useStoreStore
// (ownedTapePacks) and purchasing flag. Purchases go through lib/iap.ts
// purchaseProduct — the same path as BASE / INFINITE_SIGNAL.

import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import { useStoreStore } from '../../store/useStoreStore';
import { useAnalyticsStore } from '../../store/useAnalyticsStore';
import { StoreCard, StoreCardState } from './StoreCard';
import { purchaseProduct } from '../../lib/iap';
import { TAPE_PACKS } from '../../data/tapePacks';
import type { TapePackDefinition } from '../../data/tapePacks';

function packState(
  productId: string,
  ownedTapePacks: string[],
  purchasing: boolean,
): StoreCardState {
  if (ownedTapePacks.includes(productId)) return 'owned';
  if (purchasing) return 'purchasing';
  return 'available';
}

function TapePackCard({ pack }: { pack: TapePackDefinition }) {
  const ownedTapePacks = useStoreStore((s) => s.ownedTapePacks);
  const purchasing = useStoreStore((s) => s.purchasing);
  const track = useAnalyticsStore((s) => s.track);

  const state = packState(pack.productId, ownedTapePacks, purchasing);

  const handlePurchase = useCallback(async () => {
    track('iap_started', { productId: pack.productId });
    const result = await purchaseProduct(pack.productId);
    if (
      result?.responseCode === 0 &&
      useStoreStore.getState().ownedTapePacks.includes(pack.productId)
    ) {
      track('iap_completed', { productId: pack.productId });
    }
  }, [pack.productId, track]);

  const tapeList = pack.tapes.map((t) => t.title).join(', ');

  return (
    <StoreCard
      title={pack.title}
      description={`${pack.description}\n\nTapes: ${tapeList}`}
      price={pack.price}
      state={state}
      onPurchase={handlePurchase}
      purchaseButtonTestID={`tape-pack-${pack.packId}`}
    />
  );
}

export const TapePackSection = memo(function TapePackSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader} accessibilityRole="header">
        TAPE PACKS
      </Text>
      <Text style={styles.sectionSubheader}>
        DLC expansions — new tapes, new calls, new frequencies.
      </Text>
      {TAPE_PACKS.map((pack) => (
        <TapePackCard key={pack.productId} pack={pack} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.amber,
    letterSpacing: 3,
    marginBottom: spacing.xs,
  },
  sectionSubheader: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
});
