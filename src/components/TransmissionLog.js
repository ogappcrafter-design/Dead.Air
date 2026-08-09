import React, { useRef } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';

import { colors, mono } from '../theme/theme';

/** A line that opens with a quote is the caller talking; anything else narrates. */
const isSpeech = (line) => /^["“]/.test(line);
const isBeat = (line) => line.trim() === '...';

/**
 * The shared transcript view. Every call type renders its lines through this,
 * so speech/narration/beat styling stays consistent across all five.
 */
export default function TransmissionLog({ lines, upTo, dim = false }) {
  const ref = useRef(null);
  const visible = lines.slice(0, upTo + 1);

  return (
    <ScrollView
      ref={ref}
      style={{ flex: 1 }}
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
    >
      {visible.map((line, i) => (
        <Text
          key={i}
          style={[
            s.line,
            isBeat(line) ? s.beat : isSpeech(line) ? s.speech : s.narration,
            dim && s.dim,
            // Everything but the newest line settles back slightly.
            { opacity: i < upTo ? 0.85 : 1 },
          ]}
        >
          {line}
        </Text>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  line: { fontFamily: mono, fontSize: 15, lineHeight: 23, marginBottom: 10 },
  speech: { color: colors.text },
  narration: { color: colors.textDim, fontStyle: 'italic' },
  beat: { color: colors.textVoid, letterSpacing: 8 },
  dim: { color: colors.textFaint },
});
