import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, Text, StyleSheet } from 'react-native';

import Fade from './Fade';
import { useReducedMotion } from '../motion';
import { colors, mono } from '../theme/theme';

/** A line that opens with a quote is the caller talking; anything else narrates. */
const isSpeech = (line) => /^["“]/.test(line);
const isBeat = (line) => String(line ?? '').trim() === '...';

const styleFor = (line) => (isBeat(line) ? s.beat : isSpeech(line) ? s.speech : s.narration);

/**
 * A line that has already played. Memoised because the line currently typing
 * repaints ~30 times a second, and there is no reason to repaint the ones
 * above it every time a character lands.
 */
const SettledLine = React.memo(function SettledLine({ line, dim }) {
  return <Text style={[s.line, styleFor(line), dim && s.dim, s.settled]}>{line}</Text>;
});

/** The cursor sitting at the end of the line being typed. */
function Cursor({ color }) {
  const reduced = useReducedMotion();
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.15, duration: 380, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blink, reduced]);

  return <Animated.Text style={[s.cursor, { color, opacity: blink }]}>▌</Animated.Text>;
}

/**
 * The shared transcript view. Every call type renders its lines through this,
 * so speech/narration/beat styling stays consistent across all five.
 *
 * Lines type out rather than appearing whole — see useTranscript for why. The
 * whole surface is a skip control, so an impatient player can outrun the
 * pacing without leaving the call.
 */
export default function TransmissionLog({ lines, index, chars, typing, onSkip, dim = false, accent }) {
  const ref = useRef(null);
  const settled = lines.slice(0, index);
  const current = String(lines[index] ?? '');
  const shown = current.slice(0, chars);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Skip ahead"
      onPress={onSkip}
      style={{ flex: 1 }}
    >
      <ScrollView
        ref={ref}
        style={{ flex: 1 }}
        onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
      >
        {settled.map((line, i) => (
          <SettledLine key={i} line={line} dim={dim} />
        ))}

        {index < lines.length && (
          // Keyed by index so each new line gets its own entrance.
          <Fade key={index} duration={180} rise={3}>
            <Text style={[s.line, styleFor(current), dim && s.dim]}>
              {isBeat(current) ? current : shown}
              {typing && !isBeat(current) ? <Cursor color={accent || colors.amber} /> : null}
            </Text>
          </Fade>
        )}
      </ScrollView>
    </Pressable>
  );
}

const s = StyleSheet.create({
  line: { fontFamily: mono, fontSize: 15, lineHeight: 23, marginBottom: 10 },
  settled: { opacity: 0.82 },
  speech: { color: colors.text },
  narration: { color: colors.textDim, fontStyle: 'italic' },
  beat: { color: colors.textVoid, letterSpacing: 8 },
  dim: { color: colors.textFaint },
  cursor: { fontFamily: mono, fontSize: 15 },
});
