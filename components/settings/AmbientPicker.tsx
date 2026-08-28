// components/settings/AmbientPicker.tsx
// Settings UI for selecting owned atmospheric DLC packs as the active ambience.

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import { useStoreStore } from '../../store/useStoreStore';
import { useAmbientStore } from '../../store/useAmbientStore';
import { getOwnedPacks, DEFAULT_PACK_ID } from '../../data/atmosphericPacks';

export function AmbientPicker() {
  const ownedIds = useStoreStore((s) => s.ownedAtmosphericPacks);
  const activeAmbient = useAmbientStore((s) => s.activeAmbient);
  const setActiveAmbient = useAmbientStore((s) => s.setActiveAmbient);

  const ownedPacks = getOwnedPacks(ownedIds);

  return (
    <View style={styles.container}>
      <Pressable
        testID="ambient-option-default"
        style={[styles.option, activeAmbient === DEFAULT_PACK_ID && styles.optionSelected]}
        onPress={() => setActiveAmbient(DEFAULT_PACK_ID)}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Default ambience"
      >
        <View style={styles.optionHeader}>
          <Text
            style={[
              styles.optionLabel,
              activeAmbient === DEFAULT_PACK_ID
                ? styles.optionLabelActive
                : styles.optionLabelMuted,
            ]}
          >
            DEFAULT
          </Text>
          {activeAmbient === DEFAULT_PACK_ID && <Text style={styles.optionIndicator}>●</Text>}
        </View>
        <Text style={styles.optionDesc}>Standard radio ambience</Text>
      </Pressable>

      {ownedPacks.length === 0 ? (
        <Text style={styles.emptyText}>No atmospheric packs owned. Purchase from the store.</Text>
      ) : (
        ownedPacks.map((pack) => {
          const selected = activeAmbient === pack.id;
          return (
            <Pressable
              key={pack.id}
              testID={`ambient-option-${pack.id}`}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => setActiveAmbient(pack.id)}
              accessible
              accessibilityRole="button"
              accessibilityLabel={pack.name}
              accessibilityHint={pack.description}
            >
              <View style={styles.optionHeader}>
                <Text
                  style={[
                    styles.optionLabel,
                    selected ? styles.optionLabelActive : styles.optionLabelMuted,
                  ]}
                >
                  {pack.name.toUpperCase()}
                </Text>
                {selected && <Text style={styles.optionIndicator}>●</Text>}
              </View>
              <Text style={styles.optionDesc}>{pack.description}</Text>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  optionSelected: {
    borderColor: colors.amber,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabel: {
    fontFamily: fonts.mono,
    fontSize: 14,
    letterSpacing: 2,
  },
  optionLabelActive: {
    color: colors.amber,
  },
  optionLabelMuted: {
    color: colors.textMuted,
  },
  optionIndicator: {
    color: colors.amber,
    fontSize: 10,
  },
  optionDesc: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  emptyText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.5,
    paddingVertical: spacing.xs,
  },
});
