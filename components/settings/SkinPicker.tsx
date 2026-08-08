// components/settings/SkinPicker.tsx
// Settings UI for selecting and purchasing cosmetic radio skins.
// Uses useSkinStore for ownership/active state and lib/iap for purchases.

import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import { SKIN_IDS, getSkin } from '../../lib/skins';
import { useSkinStore } from '../../store/useSkinStore';
import { useStoreStore } from '../../store/useStoreStore';
import { purchaseProduct, PRODUCT_IDS } from '../../lib/iap';

/**
 * Maps a skin id to its IAP product ID.
 * Returns null for the default (free) skin.
 */
function skinProductId(skinId: string): string | null {
  switch (skinId) {
    case 'vintage_wood':
      return PRODUCT_IDS.SKIN_VINTAGE_WOOD;
    case 'military_green':
      return PRODUCT_IDS.SKIN_MILITARY_GREEN;
    case 'space_age_blue':
      return PRODUCT_IDS.SKIN_SPACE_AGE_BLUE;
    case 'digital_pixel':
      return PRODUCT_IDS.SKIN_DIGITAL_PIXEL;
    default:
      return null;
  }
}

export function SkinPicker() {
  const activeSkin = useSkinStore((s) => s.activeSkin);
  const ownedSkins = useSkinStore((s) => s.ownedSkins);
  const setActiveSkin = useSkinStore((s) => s.setActiveSkin);

  const purchasingProductId = useStoreStore((s) => s.purchasingProductId);

  const handlePurchase = (skinId: string) => {
    const productId = skinProductId(skinId);
    if (!productId) return;
    void purchaseProduct(productId);
  };

  const handleActivate = (skinId: string) => {
    setActiveSkin(skinId);
  };

  return (
    <View style={styles.container} testID="skin-picker">
      {SKIN_IDS.map((skinId) => {
        const skin = getSkin(skinId);
        const owned = ownedSkins.includes(skinId);
        const active = activeSkin === skinId;
        const productId = skinProductId(skinId);
        const isPurchasingThis = purchasingProductId === productId;

        return (
          <View
            key={skinId}
            style={[styles.skinRow, active && styles.skinRowActive]}
            testID={`skin-row-${skinId}`}
          >
            <View style={styles.skinInfo}>
              <View style={styles.skinHeader}>
                <Text style={[styles.skinName, active && styles.skinNameActive]} numberOfLines={1}>
                  {skin.name}
                </Text>
                {active && (
                  <Text style={styles.activeBadge} testID={`skin-active-badge-${skinId}`}>
                    ACTIVE
                  </Text>
                )}
              </View>
              <Text style={styles.skinDesc} numberOfLines={2}>
                {skin.description}
              </Text>
              <View style={styles.swatches}>
                <View
                  style={[styles.swatch, { backgroundColor: skin.colors.background }]}
                  testID={`skin-swatch-bg-${skinId}`}
                />
                <View
                  style={[styles.swatch, { backgroundColor: skin.colors.surface }]}
                  testID={`skin-swatch-surface-${skinId}`}
                />
                <View
                  style={[styles.swatch, { backgroundColor: skin.colors.text }]}
                  testID={`skin-swatch-text-${skinId}`}
                />
                <View
                  style={[styles.swatchAccent, { backgroundColor: skin.colors.accent }]}
                  testID={`skin-swatch-accent-${skinId}`}
                />
                <View
                  style={[styles.swatch, { backgroundColor: skin.colors.border }]}
                  testID={`skin-swatch-border-${skinId}`}
                />
              </View>
            </View>

            <View style={styles.skinAction}>
              {owned ? (
                active ? (
                  <Text style={styles.ownedText} testID={`skin-status-${skinId}`}>
                    OWNED
                  </Text>
                ) : (
                  <Pressable
                    testID={`skin-activate-${skinId}`}
                    style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
                    onPress={() => handleActivate(skinId)}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={`Activate ${skin.name} skin`}
                  >
                    <Text style={styles.actionBtnText} numberOfLines={1}>
                      ACTIVATE
                    </Text>
                  </Pressable>
                )
              ) : isPurchasingThis ? (
                <ActivityIndicator
                  size="small"
                  color={colors.amber}
                  testID={`skin-purchasing-${skinId}`}
                />
              ) : (
                <Pressable
                  testID={`skin-purchase-${skinId}`}
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
                  onPress={() => handlePurchase(skinId)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`Purchase ${skin.name} skin for $${skin.price.toFixed(2)}`}
                >
                  <Text style={styles.actionBtnText} numberOfLines={1}>
                    {`$${skin.price.toFixed(2)}`}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  skinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    gap: spacing.sm,
  },
  skinRowActive: {
    borderColor: colors.amber,
  },
  skinInfo: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  skinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  skinName: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text,
    letterSpacing: 1,
  },
  skinNameActive: {
    color: colors.amber,
  },
  activeBadge: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.amber,
    letterSpacing: 1,
  },
  skinDesc: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  swatches: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  swatchAccent: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  skinAction: {
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownedText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.green,
    letterSpacing: 2,
  },
  actionBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  actionBtnPressed: {
    opacity: 0.6,
  },
  actionBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.amber,
    letterSpacing: 1,
  },
});
