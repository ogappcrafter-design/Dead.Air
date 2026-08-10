import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, View } from 'react-native';

import { useReducedMotion } from '../motion';
import { colors } from '../theme/theme';

/**
 * DEAD AIR as a dot-matrix display that resolves out of nothing.
 *
 * The same 5x7 bitmap font the icon generator uses, rendered as blocks. Cells
 * light in a left-to-right sweep with enough randomness that the word appears
 * to form out of noise rather than wipe in — the tagline is "the signal is
 * forming", and this is that, literally.
 *
 * Every cell's opacity is an interpolation of one shared Animated.Value, so
 * the whole ~300-cell display costs two animated nodes and runs entirely on
 * the native driver.
 */
const GLYPHS = {
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

const COLS = 5;
const ROWS = 7;
/** How long a single cell takes to come up, as a fraction of the whole reveal. */
const CELL_FADE = 0.14;

export default function Wordmark({
  text = 'DEAD AIR',
  unit = 6,
  gap = 2,
  color = colors.amber,
  duration = 1900,
  onSettled,
}) {
  const reduced = useReducedMotion();
  const reveal = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const flicker = useRef(new Animated.Value(1)).current;

  const letters = useMemo(() => text.toUpperCase().split(''), [text]);

  /**
   * A stable arrival time per cell. Weighted mostly by column so the word
   * builds left to right, with enough noise that the edge is ragged.
   */
  const thresholds = useMemo(() => {
    const totalCols = letters.length * COLS;
    return letters.map((char, letterIndex) =>
      Array.from({ length: ROWS }, () =>
        Array.from({ length: COLS }, (_unused, col) => {
          const across = (letterIndex * COLS + col) / totalCols;
          return Math.min(0.85, across * 0.55 + Math.random() * 0.45);
        }),
      ),
    );
  }, [letters]);

  useEffect(() => {
    if (reduced) {
      reveal.setValue(1);
      onSettled?.();
      return undefined;
    }
    const animation = Animated.timing(reveal, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => finished && onSettled?.());
    return () => animation.stop();
    // onSettled is intentionally not a dependency: it should fire once per
    // reveal, not every time the parent hands down a new closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal, reduced, duration]);

  // A tired tube, once the word is up.
  useEffect(() => {
    if (reduced) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 0.88, duration: 1700, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 1, duration: 2300, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flicker, reduced]);

  return (
    <Animated.View
      accessibilityRole="header"
      accessibilityLabel={text}
      style={{ flexDirection: 'row', opacity: flicker }}
    >
      {letters.map((char, letterIndex) => {
        const glyph = GLYPHS[char] || GLYPHS[' '];
        return (
          <View key={`${char}-${letterIndex}`} style={{ marginRight: unit }}>
            {glyph.map((row, rowIndex) => (
              <View key={rowIndex} style={{ flexDirection: 'row' }}>
                {row.split('').map((bit, colIndex) => {
                  const lit = bit === '1';
                  const t = thresholds[letterIndex][rowIndex][colIndex];
                  return (
                    <Animated.View
                      key={colIndex}
                      style={{
                        width: unit,
                        height: unit,
                        marginRight: gap,
                        marginBottom: gap,
                        backgroundColor: color,
                        // Unlit cells stay faintly visible so the whole thing
                        // reads as a panel with cells rather than floating dots.
                        opacity: lit
                          ? reveal.interpolate({
                              inputRange: [t, Math.min(1, t + CELL_FADE)],
                              outputRange: [0, 1],
                              extrapolate: 'clamp',
                            })
                          : 0.045,
                      }}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        );
      })}
    </Animated.View>
  );
}
