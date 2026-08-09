import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';

import { ALL_TAPES, maskedTape } from '../content/tapes';
import { MARK } from '../content/symbols';
import { colors, mono } from '../theme/theme';

/** The tape archive. Uncollected tapes stay redacted. */
export default function ArchiveScreen({ tapes }) {
  const owned = new Set(tapes);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>
      <Text style={s.count}>
        {owned.size} / {ALL_TAPES.length} RECOVERED
      </Text>

      {ALL_TAPES.map((tape, i) => {
        const found = owned.has(tape);
        return (
          <View key={tape} style={s.row}>
            <Text style={[s.name, { color: found ? colors.amber : colors.lineBright }]}>
              {found ? tape : maskedTape(i)}
            </Text>
            {found && <Text style={s.check}>{MARK}</Text>}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  count: {
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: 3,
    color: colors.textFaint,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0d0d0d',
  },
  name: { fontFamily: mono, fontSize: 13, flex: 1 },
  check: { color: colors.amber, fontSize: 16 },
});
