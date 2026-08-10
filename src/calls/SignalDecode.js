import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import feedback from '../feedback';
import Button from '../components/Button';
import { SYM } from '../content/symbols';
import { colors, mono } from '../theme/theme';

/** Tap the transmitted glyph sequence back. A wrong tap flashes and resets nothing. */
export default function SignalDecode({ call, onComplete }) {
  const [progress, setProgress] = useState(0);
  const [wrong, setWrong] = useState(null);
  const target = call.sequence;
  const solved = progress === target.length;
  const errorTimer = useRef(null);

  // v1 left this setTimeout dangling — unmounting mid-flash set state on a
  // dead component.
  useEffect(() => () => clearTimeout(errorTimer.current), []);

  const tap = (symbolIndex) => {
    if (solved) return;
    if (symbolIndex === target[progress]) {
      feedback.fire('key');
      setProgress((p) => p + 1);
      return;
    }
    feedback.fire('reject');
    setWrong(symbolIndex);
    clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setWrong(null), 400);
  };

  return (
    <View style={{ flex: 1 }}>
      {!!call.intro && <Text style={s.intro}>{call.intro}</Text>}

      <View style={s.seqRow}>
        {target.map((symbol, i) => (
          <View
            key={i}
            style={[s.slot, i < progress && s.slotDone, i === progress && !solved && s.slotActive]}
          >
            <Text
              style={[
                s.slotSym,
                { color: i < progress ? colors.amber : i === progress ? colors.white : colors.lineBright },
              ]}
            >
              {SYM[symbol]}
            </Text>
          </View>
        ))}
      </View>

      <Text style={s.counter}>
        TAP THE SEQUENCE — {progress}/{target.length}
      </Text>

      <View style={s.grid}>
        {SYM.map((symbol, i) => (
          <TouchableOpacity
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`Glyph ${i + 1}`}
            activeOpacity={0.7}
            style={[s.key, wrong === i && s.keyWrong]}
            onPress={() => tap(i)}
          >
            <Text style={s.keySym}>{symbol}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {solved && (
        <View style={{ gap: 10, marginTop: 12 }}>
          <View style={s.decoded}>
            <Text style={s.decodedText}>{call.decodedMessage}</Text>
          </View>
          <Button
            label="END CALL"
            onPress={() =>
              onComplete({
                sanityDelta: call.sanityDelta || 0,
                staticMult: 1,
                tape: call.tape || null,
                outcome: `DECODED: "${call.decodedMessage}"`,
              })
            }
          />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  intro: {
    fontFamily: mono,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textDim,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  seqRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 10 },
  slot: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.lineBright,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotDone: { borderColor: colors.amber, backgroundColor: colors.amberInk },
  slotActive: { borderColor: colors.white, backgroundColor: colors.hairline },
  slotSym: { fontSize: 22 },
  counter: {
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textFaint,
    textAlign: 'center',
    marginBottom: 16,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  key: {
    width: 60,
    height: 60,
    borderWidth: 1,
    borderColor: colors.lineBright,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyWrong: { borderColor: colors.red, backgroundColor: '#1a0005' },
  keySym: { fontSize: 26, color: '#ccc' },
  decoded: {
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 2,
    padding: 12,
    alignItems: 'center',
  },
  decodedText: { fontFamily: mono, fontSize: 16, letterSpacing: 4, color: colors.green },
});
