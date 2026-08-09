import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import Button from '../components/Button';
import TransmissionLog from '../components/TransmissionLog';
import useLineReveal from '../hooks/useLineReveal';
import { colors, mono } from '../theme/theme';

/** What the DJ says changes how the call ends. */
export default function RightAnswer({ call, onComplete }) {
  const [chosen, setChosen] = useState(null);
  const { index, done } = useLineReveal(call.lines.length, { interval: 1700, settle: 1400 });

  return (
    <View style={{ flex: 1 }}>
      <TransmissionLog lines={call.lines} upTo={index} />

      {done && !chosen && (
        <View style={{ marginTop: 12, gap: 8 }}>
          <Text style={s.prompt}>RESPOND ──────────────────</Text>
          {call.choices.map((choice, i) => (
            <TouchableOpacity
              key={i}
              accessibilityRole="button"
              activeOpacity={0.7}
              style={s.choice}
              onPress={() => setChosen(choice)}
            >
              <Text style={s.choiceText}>{choice.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {chosen && (
        <View style={{ marginTop: 12, gap: 10 }}>
          <View style={s.outcome}>
            <Text style={s.outcomeText}>{chosen.outcome}</Text>
          </View>
          <Button
            label="END CALL"
            onPress={() =>
              onComplete({
                sanityDelta: chosen.sanityDelta || 0,
                staticMult: chosen.staticMult || 1,
                tape: chosen.tape || null,
                outcome: chosen.outcome,
              })
            }
          />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  prompt: { fontFamily: mono, fontSize: 11, letterSpacing: 3, color: colors.textFaint, marginBottom: 4 },
  choice: { borderWidth: 1, borderColor: colors.lineBright, borderRadius: 2, padding: 12 },
  choiceText: { fontFamily: mono, fontSize: 14, color: '#ccc' },
  outcome: { borderLeftWidth: 2, borderLeftColor: colors.amber, paddingLeft: 12, paddingVertical: 6 },
  outcomeText: { fontFamily: mono, fontSize: 13, lineHeight: 20, color: colors.textSoft, fontStyle: 'italic' },
});
