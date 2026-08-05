import { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import { Band, BANDS } from '../../lib/constants';
import { BANDS as BAND_DATA } from '../../data/bands';

interface BandSelectorProps {
  currentBand: Band;
  unlockedBands: Band[];
  onBandSelect: (band: Band) => void;
}

export const BandSelector = memo(function BandSelector({
  currentBand,
  unlockedBands,
  onBandSelect,
}: BandSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label} accessibilityRole="header">
        BAND
      </Text>
      <View style={styles.bands}>
        {BANDS.map((band) => {
          const isUnlocked = unlockedBands.includes(band);
          const isActive = currentBand === band;
          const bandInfo = BAND_DATA[band];

          return (
            <Pressable
              key={band}
              style={[
                styles.bandButton,
                isActive && styles.bandActive,
                !isUnlocked && styles.bandLocked,
              ]}
              onPress={() => isUnlocked && onBandSelect(band)}
              disabled={!isUnlocked}
              accessible
              accessibilityRole="button"
              accessibilityLabel={bandInfo.name}
              accessibilityHint={
                isActive ? 'Active band' : isUnlocked ? 'Switch frequency band' : 'Locked'
              }
              accessibilityState={{ selected: isActive, disabled: !isUnlocked }}
            >
              <Text
                style={[
                  styles.bandName,
                  isActive && styles.bandNameActive,
                  !isUnlocked && styles.bandNameLocked,
                ]}
                numberOfLines={1}
              >
                {bandInfo.name}
              </Text>
              {!isUnlocked && (
                <Text style={styles.lockIcon} accessibilityLabel="Locked">
                  🔒
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  bands: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  bandButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 2,
    alignItems: 'center',
    minWidth: 52,
  },
  bandActive: {
    borderColor: colors.amber,
    backgroundColor: `${colors.amber}15`,
  },
  bandLocked: {
    opacity: 0.3,
  },
  bandName: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  bandNameActive: {
    color: colors.amber,
  },
  bandNameLocked: {
    color: colors.textMuted,
  },
  lockIcon: {
    fontSize: 8,
    marginTop: 2,
  },
});
