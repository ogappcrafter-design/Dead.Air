import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import Button from '../components/Button';
import TransmissionLog from '../components/TransmissionLog';
import useCountdown from '../hooks/useCountdown';
import useLineReveal from '../hooks/useLineReveal';
import { colors, mono, type } from '../theme/theme';

/** Hold the line while nothing happens. The waiting is the mechanic. */
export default function DeadAir({ call, onComplete }) {
  const { index } = useLineReveal(call.lines.length, { interval: 1500, settle: 0 });
  const { remaining, expired } = useCountdown(call.waitSeconds);

  return (
    <View style={{ flex: 1 }}>
      <View style={s.head}>
        <Text style={type.timer}>
          {expired ? '─ ─ ─' : `00:${String(remaining).padStart(2, '0')}`}
        </Text>
        <Text style={s.sub}>{expired ? 'SIGNAL RECEIVED' : 'HOLD THE LINE...'}</Text>
      </View>

      <TransmissionLog lines={call.lines} upTo={index} dim />

      {expired && (
        <Button
          label="CONTINUE"
          style={{ marginTop: 12 }}
          onPress={() =>
            onComplete({
              sanityDelta: call.sanityDelta || 0,
              staticMult: 1,
              tape: call.tape || null,
              outcome: null,
            })
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  head: { alignItems: 'center', paddingVertical: 16 },
  sub: { fontFamily: mono, fontSize: 11, letterSpacing: 3, color: colors.textFaint, marginTop: 4 },
});
