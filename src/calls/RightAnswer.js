import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import Button from '../components/Button';
import Fade from '../components/Fade';
import TransmissionLog from '../components/TransmissionLog';
import feedback from '../feedback';
import useTranscript from '../hooks/useTranscript';
import { colors, mono } from '../theme/theme';

/** What the DJ says changes how the call ends. */
export default function RightAnswer({ call, accent, onComplete }) {
  const [chosen, setChosen] = useState(null);
  const { index, chars, typing, done, skip } = useTranscript(call.lines);

  const choose = (choice) => {
    feedback.fire('key');
    setChosen(choice);
  };

  return (
    <View style={{ flex: 1 }}>
      <TransmissionLog
        lines={call.lines}
        index={index}
        chars={chars}
        typing={typing}
        onSkip={skip}
        accent={accent}
      />

      {done && !chosen && (
        <View style={{ marginTop: 12, gap: 8 }}>
          <Text style={s.prompt}>RESPOND ──────────────────</Text>
          {call.choices.map((choice, i) => (
            // Staggered so the options arrive like a decision forming, and the
            // player cannot slam the first one before reading the rest.
            <Fade key={i} delay={i * 90}>
              <Pressable
                accessibilityRole="button"
                onPress={() => choose(choice)}
                style={({ pressed }) => [
                  s.choice,
                  pressed && { borderColor: accent || colors.amber, backgroundColor: '#0b0b0b' },
                ]}
              >
                <Text style={s.choiceText}>{choice.text}</Text>
              </Pressable>
            </Fade>
          ))}
        </View>
      )}

      {chosen && (
        <Fade style={{ marginTop: 12 }}>
          <View style={{ gap: 10 }}>
            <View style={[s.outcome, { borderLeftColor: accent || colors.amber }]}>
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
        </Fade>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  prompt: { fontFamily: mono, fontSize: 11, letterSpacing: 3, color: colors.textFaint, marginBottom: 4 },
  choice: { borderWidth: 1, borderColor: colors.lineBright, borderRadius: 2, padding: 12 },
  choiceText: { fontFamily: mono, fontSize: 14, color: '#ccc' },
  outcome: { borderLeftWidth: 2, paddingLeft: 12, paddingVertical: 6 },
  outcomeText: { fontFamily: mono, fontSize: 13, lineHeight: 20, color: colors.textSoft, fontStyle: 'italic' },
});
