import React, { memo } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { colors, fonts, spacing } from '../lib/theme';

interface TapeCollectionProps {
  tapes: string[];
  totalCount: number;
}

/** Memoized row component — avoids re-rendering existing rows when tapes array grows. */
const TapeRow = memo(function TapeRow({ item }: { item: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.bullet}>▸</Text>
      <Text style={styles.label} numberOfLines={1}>
        {item}
      </Text>
    </View>
  );
});

/** Module-level separator — stable reference across renders. */
function TapeSeparator() {
  return <View style={styles.separator} />;
}

/** Module-level empty state — stable reference across renders. */
function TapeEmptyState() {
  return <Text style={styles.empty}>NO TAPES RECOVERED</Text>;
}

export const TapeCollection = memo(function TapeCollection({
  tapes,
  totalCount,
}: TapeCollectionProps) {
  const collected = tapes.length;

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`Tapes collected: ${collected} of ${totalCount}`}
    >
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          TAPES
        </Text>
        <Text style={styles.count} accessibilityLiveRegion="polite">
          {collected}/{totalCount}
        </Text>
      </View>
      <FlatList
        data={tapes}
        keyExtractor={(item, index) => `tape-${index}-${item}`}
        renderItem={({ item }) => <TapeRow item={item} />}
        ItemSeparatorComponent={TapeSeparator}
        ListEmptyComponent={TapeEmptyState}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.amber,
    letterSpacing: 2,
  },
  count: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  bullet: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.green,
  },
  label: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text,
    letterSpacing: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  empty: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
