// components/store/StoreCard.tsx
// Presentational card for the store screen. Owns no state — the parent passes
// entitlement + purchase state and an onPurchase callback. Pure styling, no
// direct store access, no testIDs beyond the documented ones.

import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';

export type StoreCardState = 'available' | 'owned' | 'purchasing';

interface StoreCardProps {
  /** Card title (e.g. "BASE GAME", "INFINITE SIGNAL"). */
  title: string;
  /** Short description shown below the title. */
  description: string;
  /** Price label (e.g. "FREE", "$4.99"). */
  price: string;
  /** Drives button rendering / disabled state. */
  state: StoreCardState;
  /** Invoked when the user taps PURCHASE. Ignored for `owned`. */
  onPurchase: () => void;
  /** Optional testID for the purchase button. */
  purchaseButtonTestID?: string;
}

export const StoreCard = memo(function StoreCard({
  title,
  description,
  price,
  state,
  onPurchase,
  purchaseButtonTestID,
}: StoreCardProps) {
  const isOwned = state === 'owned';
  const isPurchasing = state === 'purchasing';

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`${title}, ${isOwned ? 'owned' : price}`}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        <Text style={[styles.price, isOwned && styles.priceOwned]} numberOfLines={1}>
          {isOwned ? 'OWNED' : price}
        </Text>
      </View>

      <Text style={styles.description} numberOfLines={3}>
        {description}
      </Text>

      <View style={styles.footer}>
        {isOwned ? (
          <View
            style={styles.ownedBadge}
            accessible
            accessibilityLabel="Owned"
            accessibilityRole="text"
          >
            <Text style={styles.ownedBadgeText} numberOfLines={1}>
              OWNED
            </Text>
          </View>
        ) : (
          <Pressable
            testID={purchaseButtonTestID}
            style={({ pressed }) => [
              styles.purchaseButton,
              pressed && styles.purchaseButtonPressed,
              isPurchasing && styles.purchaseButtonDisabled,
            ]}
            onPress={onPurchase}
            disabled={isPurchasing}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Purchase ${title}`}
            accessibilityHint={isPurchasing ? 'Processing purchase' : undefined}
            accessibilityState={{ disabled: isPurchasing }}
          >
            {isPurchasing ? (
              <ActivityIndicator
                size="small"
                color={colors.background}
                testID="store-card-activity"
              />
            ) : (
              <Text style={styles.purchaseButtonText} numberOfLines={1}>
                PURCHASE
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.amber,
    letterSpacing: 2,
    flex: 1,
    minWidth: 0,
  },
  price: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.green,
    letterSpacing: 1,
    minWidth: 64,
    textAlign: 'right',
  },
  priceOwned: {
    color: colors.textMuted,
  },
  description: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text,
    letterSpacing: 0.5,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  purchaseButton: {
    backgroundColor: colors.green,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 2,
    minWidth: 120,
    alignItems: 'center',
  },
  purchaseButtonPressed: {
    backgroundColor: colors.dimGreen,
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.background,
    letterSpacing: 2,
    fontWeight: '700',
  },
  ownedBadge: {
    borderWidth: 1,
    borderColor: colors.green,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 2,
  },
  ownedBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.green,
    letterSpacing: 2,
  },
});
