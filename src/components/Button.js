import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';

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
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      activeOpacity={0.7}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.btn,
        { borderColor: disabled ? colors.line : t.border, backgroundColor: disabled ? 'transparent' : t.fill },
        style,
      ]}
    >
      <Text style={[s.text, { color: disabled ? colors.textGhost : t.ink }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: { borderWidth: 1, borderRadius: 2, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  text: { fontFamily: mono, fontSize: 13, letterSpacing: 2 },
});
