// components/mod/FrequencyLibrary.tsx
// DEA-89 — saved local frequencies and read-only installed community ones.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import {
  customCallTypeLabel,
  getCustomFrequencyBandName,
  type CustomFrequency,
} from '../../engine/calls/CustomFrequency';

export interface FrequencyLibraryProps {
  frequencies: readonly CustomFrequency[];
  hasInfiniteSignal: boolean;
  unlockedBands: readonly string[];
  communityEnabled: boolean;
  publishing?: boolean;
  onPlay: (frequency: CustomFrequency) => void;
  onEdit: (frequency: CustomFrequency) => void;
  onDelete: (frequency: CustomFrequency) => void;
  onShare: (frequency: CustomFrequency) => void;
  onPublish: (frequency: CustomFrequency) => void;
}

export function FrequencyLibrary({
  frequencies,
  hasInfiniteSignal,
  unlockedBands,
  communityEnabled,
  publishing = false,
  onPlay,
  onEdit,
  onDelete,
  onShare,
  onPublish,
}: FrequencyLibraryProps) {
  if (frequencies.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>NO SAVED FREQUENCIES</Text>
        <Text style={styles.emptyText}>
          Compose a call in the builder, or install a shared frequency from the community.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {frequencies.map((frequency) => {
        const bandName = getCustomFrequencyBandName(frequency.composition.band);
        const bandUnlocked = bandName !== null && unlockedBands.includes(bandName);
        const canPlay = hasInfiniteSignal && bandUnlocked;
        const playReason = !hasInfiniteSignal
          ? 'INFINITE SIGNAL REQUIRED'
          : !bandUnlocked
            ? 'BAND LOCKED'
            : null;
        const isLocal = frequency.origin === 'local';
        const readOnly = !isLocal || !hasInfiniteSignal;

        return (
          <View key={frequency.id} testID={`frequency-item-${frequency.id}`} style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.name} numberOfLines={1}>
                {frequency.name}
              </Text>
              <Text style={[styles.badge, isLocal ? styles.badgeLocal : styles.badgeInstalled]}>
                {isLocal ? 'LOCAL' : 'INSTALLED'}
              </Text>
            </View>

            <Text style={styles.meta}>
              {customCallTypeLabel(frequency.composition.callType)} · {bandName ?? 'UNKNOWN'} ·{' '}
              {frequency.frequency.toFixed(1)}
            </Text>

            {frequency.description !== undefined && frequency.description.length > 0 && (
              <Text style={styles.description} numberOfLines={2}>
                {frequency.description}
              </Text>
            )}

            <View style={styles.credits}>
              {frequency.authorName !== undefined && (
                <Text style={styles.credit}>BY {frequency.authorName.toUpperCase()}</Text>
              )}
              {frequency.friendCode !== undefined && (
                <Text style={styles.credit}>FRIEND {frequency.friendCode}</Text>
              )}
              {readOnly && (
                <Text style={styles.readOnly}>
                  {isLocal ? 'READ-ONLY · INFINITE SIGNAL REQUIRED' : 'READ-ONLY INSTALL'}
                </Text>
              )}
            </View>

            <View style={styles.actions}>
              <Pressable
                testID={`frequency-play-${frequency.id}`}
                style={({ pressed }) => [
                  styles.action,
                  styles.actionPrimary,
                  !canPlay && styles.actionDisabled,
                  pressed && styles.actionPressed,
                ]}
                onPress={() => onPlay(frequency)}
                disabled={!canPlay}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Play ${frequency.name}`}
                accessibilityHint={playReason ?? 'Plays the assembled call'}
              >
                <Text style={styles.actionPrimaryText}>PLAY</Text>
              </Pressable>

              {isLocal && hasInfiniteSignal && (
                <Pressable
                  testID={`frequency-edit-${frequency.id}`}
                  style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                  onPress={() => onEdit(frequency)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${frequency.name}`}
                >
                  <Text style={styles.actionText}>EDIT</Text>
                </Pressable>
              )}

              <Pressable
                testID={`frequency-share-${frequency.id}`}
                style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                onPress={() => onShare(frequency)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Copy share text for ${frequency.name}`}
              >
                <Text style={styles.actionText}>SHARE</Text>
              </Pressable>

              {isLocal && hasInfiniteSignal && (
                <Pressable
                  testID={`frequency-publish-${frequency.id}`}
                  style={({ pressed }) => [
                    styles.action,
                    (!communityEnabled || !hasInfiniteSignal || publishing) &&
                      styles.actionDisabled,
                    pressed && styles.actionPressed,
                  ]}
                  onPress={() => onPublish(frequency)}
                  disabled={!communityEnabled || !hasInfiniteSignal || publishing}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`Publish ${frequency.name} to the community`}
                >
                  <Text style={styles.actionText}>PUBLISH</Text>
                </Pressable>
              )}

              <Pressable
                testID={`frequency-delete-${frequency.id}`}
                style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                onPress={() => onDelete(frequency)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Delete ${frequency.name}`}
              >
                <Text style={[styles.actionText, styles.actionDanger]}>DELETE</Text>
              </Pressable>
            </View>

            {playReason !== null && <Text style={styles.playReason}>{playReason}</Text>}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.amber,
  },
  badge: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  badgeLocal: {
    color: colors.green,
    borderColor: colors.dimGreen,
  },
  badgeInstalled: {
    color: colors.textMuted,
    borderColor: colors.border,
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  description: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
  },
  credits: {
    gap: 2,
  },
  credit: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.green,
    letterSpacing: 1,
  },
  readOnly: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  action: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  actionPrimary: {
    borderColor: colors.amber,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionDisabled: {
    opacity: 0.35,
  },
  actionText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text,
    letterSpacing: 1,
  },
  actionPrimaryText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.amber,
    letterSpacing: 1,
  },
  actionDanger: {
    color: colors.red,
  },
  playReason: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: spacing.md,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  emptyText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
});
