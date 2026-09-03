import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import feedback from '../feedback';
import CRT from '../components/CRT';
import Fade from '../components/Fade';
import Wordmark from '../components/Wordmark';
import { MARK } from '../content/symbols';
import { progressSummary } from '../engine/progression';
import { isOffAir } from '../engine/save';
import { useReducedMotion } from '../motion';
import { colors, mono } from '../theme/theme';

/**
 * The front door.
 *
 * The wordmark resolves out of an unlit panel, the tagline arrives behind it,
 * and only then does the screen invite a touch. Nothing here is skippable-by-
 * accident: the whole surface is the control, so the first tap always works.
 */
export default function TitleScreen({ save, purchases, onEnter }) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const [settled, setSettled] = useState(reduced);
  const prompt = useRef(new Animated.Value(0)).current;

  const progress = progressSummary(save, purchases);
  const returning = progress.callsDone > 0;
  const dark = isOffAir(save);

  // "DEAD AIR" is 8 cells-groups wide; size the matrix to the screen so it
  // fills small phones without overflowing large ones.
  const unit = Math.max(4, Math.min(9, Math.floor(width / 62)));

  useEffect(() => {
    if (!settled) return undefined;
    if (reduced) {
      prompt.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(prompt, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(prompt, { toValue: 0.25, duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [settled, reduced, prompt]);

  const enter = useCallback(() => {
    if (!settled) return;
    feedback.fire('tune');
    onEnter();
  }, [settled, onEnter]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={returning ? 'Resume the broadcast' : 'Tune in'}
      accessibilityHint="Opens the dial"
      onPress={enter}
      style={s.screen}
    >
      <View style={s.center}>
        <Wordmark unit={unit} onSettled={() => setSettled(true)} />

        {settled && (
          <Fade delay={140}>
            <Text style={s.tagline}>Something is trying to reach you.</Text>
          </Fade>
        )}
      </View>

      <View style={s.foot}>
        {settled && (
          <Fade delay={420}>
            <Animated.Text
              style={[s.prompt, dark && { color: colors.red }, { opacity: prompt }]}
            >
              {dark ? `${MARK} THE STATION IS DARK` : returning ? `${MARK} RESUME BROADCAST` : `${MARK} TUNE IN`}
            </Animated.Text>
            {returning && (
              <Text style={s.progress}>
                {progress.callsDone} OF {progress.callsTotal} CALLS LOGGED ·{' '}
                {progress.tapesFound} OF {progress.tapesTotal} TAPES
              </Text>
            )}
          </Fade>
        )}
      </View>

      <CRT sanity={save.sanity} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  tagline: {
    fontFamily: mono,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.textFaint,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 28,
  },
  foot: { paddingBottom: 64, alignItems: 'center', minHeight: 92 },
  prompt: {
    fontFamily: mono,
    fontSize: 13,
    letterSpacing: 4,
    color: colors.amber,
    textAlign: 'center',
  },
  progress: {
    fontFamily: mono,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.textGhost,
    textAlign: 'center',
    marginTop: 12,
  },
});
