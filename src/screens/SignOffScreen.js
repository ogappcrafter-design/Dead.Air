import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import Button from '../components/Button';
import CRT from '../components/CRT';
import { MARK } from '../content/symbols';
import { colors, mono, safeTop } from '../theme/theme';

/**
 * What that call cost and what it paid.
 *
 * v1 computed payout, sanity drift and tape awards and then returned straight
 * to the dial, so the whole economy was invisible while you played it.
 */
export default function SignOffScreen({ call, gained, onDismiss }) {
  const sanitySign = gained.sanityDelta > 0 ? '+' : '';
  const sanityColor =
    gained.sanityDelta > 0 ? colors.green : gained.sanityDelta < 0 ? colors.red : colors.textFaint;

  return (
    <View style={s.screen}>
      <View style={s.body}>
        <Text style={s.label}>CALL ENDED</Text>
        <Text style={s.caller}>{call.callerName}</Text>

        {!!gained.outcome && <Text style={s.outcome}>{gained.outcome}</Text>}

        <View style={s.rule} />

        <View style={s.row}>
          <Text style={s.rowLabel}>STATIC EARNED</Text>
          <Text style={[s.rowValue, { color: colors.amber }]}>
            +{gained.payout} {MARK}
          </Text>
        </View>

        <View style={s.row}>
          <Text style={s.rowLabel}>SANITY</Text>
          <Text style={[s.rowValue, { color: sanityColor }]}>
            {gained.sanityDelta === 0 ? 'UNCHANGED' : `${sanitySign}${gained.sanityDelta}`}
          </Text>
        </View>

        {!!gained.tape && (
          <View style={s.tape}>
            <Text style={s.tapeLabel}>TAPE RECOVERED</Text>
            <Text style={s.tapeName}>{gained.tape}</Text>
          </View>
        )}

        <Button label="BACK TO THE DIAL" style={{ marginTop: 28 }} onPress={onDismiss} />
      </View>

      <CRT />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: 24, paddingTop: safeTop + 40, justifyContent: 'center' },
  label: { fontFamily: mono, fontSize: 11, letterSpacing: 4, color: colors.textFaint },
  caller: { fontFamily: mono, fontSize: 22, color: colors.text, marginTop: 6 },
  outcome: {
    fontFamily: mono,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textDim,
    fontStyle: 'italic',
    marginTop: 16,
  },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 2, color: colors.textFaint },
  rowValue: { fontFamily: mono, fontSize: 14 },
  tape: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: 2,
    padding: 14,
    gap: 6,
  },
  tapeLabel: { fontFamily: mono, fontSize: 10, letterSpacing: 3, color: colors.textFaint },
  tapeName: { fontFamily: mono, fontSize: 13, color: colors.amber },
});
