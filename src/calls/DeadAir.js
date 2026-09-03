import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import Button from '../components/Button';
import Fade from '../components/Fade';
import TransmissionLog from '../components/TransmissionLog';
import useCountdown from '../hooks/useCountdown';
import useTranscript from '../hooks/useTranscript';
import { colors, mono, type } from '../theme/theme';

/** Hold the line while nothing happens. The waiting is the mechanic. */
export default function DeadAir({ call, accent, onComplete }) {
  // Slower than a normal call: this one is about the silence between lines.
  const { index, chars, typing, skip } = useTranscript(call.lines, { cps: 34 });
  const { remaining, expired } = useCountdown(call.waitSeconds);

  return (
    <View style={{ flex: 1 }}>
      <View style={s.head}>
        <Text style={[type.timer, expired && { color: accent || colors.amber }]}>
          {expired ? '─ ─ ─' : `00:${String(remaining).padStart(2, '0')}`}
        </Text>
        <Text style={s.sub}>{expired ? 'SIGNAL RECEIVED' : 'HOLD THE LINE...'}</Text>
      </View>

      <TransmissionLog
        lines={call.lines}
        index={index}
        chars={chars}
        typing={typing}
        onSkip={skip}
        accent={accent}
        dim
      />

      {expired && (
        <Fade style={{ marginTop: 12 }}>
          <Button
            label="CONTINUE"
            onPress={() =>
              onComplete({
                sanityDelta: call.sanityDelta || 0,
                staticMult: 1,
                tape: call.tape || null,
                outcome: null,
              })
            }
          />
        </Fade>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  head: { alignItems: 'center', paddingVertical: 16 },
  sub: { fontFamily: mono, fontSize: 11, letterSpacing: 3, color: colors.textFaint, marginTop: 4 },
});
