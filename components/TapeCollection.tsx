import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { colors, fonts, spacing } from '../lib/theme';

interface TapeCollectionProps {
  tapes: string[];
  totalCount: number;
}

export function TapeCollection({ tapes, totalCount }: TapeCollectionProps) {
  const collected = tapes.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>TAPES</Text>
        <Text style={styles.count}>
          {collected}/{totalCount}
        </Text>
      </View>
      <FlatList
        data={tapes}
        keyExtractor={(item, index) => `tape-${index}-${item}`}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.bullet}>▸</Text>
            <Text style={styles.label} numberOfLines={1}>
              {item}
            </Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={() => <Text style={styles.empty}>NO TAPES RECOVERED</Text>}
      />
    </View>
  );
}

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
