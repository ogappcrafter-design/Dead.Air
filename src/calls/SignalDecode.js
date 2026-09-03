import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, Pressable, StyleSheet } from 'react-native';

import Button from '../components/Button';
import Fade from '../components/Fade';
import feedback from '../feedback';
import useShake from '../hooks/useShake';
import { SYM } from '../content/symbols';
import { colors, mono } from '../theme/theme';

/** Tap the transmitted glyph sequence back. A wrong tap flashes and resets nothing. */
export default function SignalDecode({ call, accent, onComplete }) {
  const [progress, setProgress] = useState(0);
  const [wrong, setWrong] = useState(null);
  const target = call.sequence;
  const solved = progress === target.length;
  const errorTimer = useRef(null);
  const { shake, style: shakeStyle } = useShake();

  /**
   * The authority on how far in we are.
   *
   * Reading `progress` straight from render state judged a second correct tap
   * against the position from before the first one had committed — so tapping
   * quickly, which is exactly what anyone does in a sequence minigame, threw
   * false misses. The ref is updated synchronously on the tap.
   */
  const progressRef = useRef(0);

  // Unmounting mid-flash used to set state on a dead component.
  useEffect(() => () => clearTimeout(errorTimer.current), []);

  const tap = (symbolIndex) => {
    if (progressRef.current >= target.length) return;

    if (symbolIndex === target[progressRef.current]) {
      progressRef.current += 1;
      setProgress(progressRef.current);
      feedback.fire('key');
      return;
    }

    feedback.fire('reject');
    shake();
    setWrong(symbolIndex);
    clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setWrong(null), 400);
  };

  const tint = accent || colors.amber;

  return (
    <Animated.View style={[{ flex: 1 }, shakeStyle]}>
      {!!call.intro && <Text style={s.intro}>{call.intro}</Text>}

      <View style={s.seqRow}>
        {target.map((symbol, i) => (
          <View
            key={i}
            style={[
              s.slot,
              i < progress && { borderColor: tint, backgroundColor: colors.amberInk },
              i === progress && !solved && s.slotActive,
            ]}
          >
            <Text
              style={[
                s.slotSym,
                { color: i < progress ? tint : i === progress ? colors.white : colors.lineBright },
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
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`Glyph ${i + 1}`}
            onPress={() => tap(i)}
            style={({ pressed }) => [
              s.key,
              pressed && { borderColor: tint, backgroundColor: '#0b0b0b' },
              wrong === i && s.keyWrong,
            ]}
          >
            <Text style={s.keySym}>{symbol}</Text>
          </Pressable>
        ))}
      </View>

      {solved && (
        <Fade style={{ marginTop: 12 }}>
          <View style={{ gap: 10 }}>
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
        </Fade>
      )}
    </Animated.View>
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
