import React, { useCallback, useRef } from 'react';
import { Animated, Pressable, Text, StyleSheet } from 'react-native';

import { DURATION, useReducedMotion } from '../motion';
import { colors, mono } from '../theme/theme';

const TONES = {
  amber: { border: colors.amber, fill: colors.amberInk, ink: colors.amber },
  green: { border: colors.green, fill: 'transparent', ink: colors.green },
  red: { border: colors.red, fill: 'transparent', ink: colors.red },
  quiet: { border: colors.lineBright, fill: 'transparent', ink: colors.textFaint },
};

/**
 * `color` overrides both the border and the label for cases that key off
 * something dynamic — the store tints each product's button with that
 * product's accent rather than the shared amber.
 */
export default function Button({ label, onPress, tone = 'amber', color, disabled, style }) {
  const base = TONES[tone] || TONES.amber;
  const t = color ? { ...base, border: color, ink: color } : base;

  const reduced = useReducedMotion();
  const press = useRef(new Animated.Value(0)).current;

  // A press should feel like it took the weight, not just changed opacity.
  const to = useCallback(
    (value) => {
      if (reduced) return;
      Animated.timing(press, {
        toValue: value,
        duration: DURATION.instant,
        useNativeDriver: true,
      }).start();
    },
    [press, reduced],
  );

  return (
    <Animated.View
      style={{
        transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.975] }) }],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => to(1)}
        onPressOut={() => to(0)}
        style={({ pressed }) => [
          s.btn,
          {
            borderColor: disabled ? colors.line : t.border,
            backgroundColor: disabled ? 'transparent' : t.fill,
            opacity: pressed && !disabled ? 0.85 : 1,
          },
          style,
        ]}
      >
        <Text style={[s.text, { color: disabled ? colors.textGhost : t.ink }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  btn: { borderWidth: 1, borderRadius: 2, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  text: { fontFamily: mono, fontSize: 13, letterSpacing: 2 },
});
