import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

import CRT from '../components/CRT';
import { MARK } from '../content/symbols';
import { colors, mono } from '../theme/theme';

/** Shown while the save file loads, before the first real frame. */
export default function BootScreen() {
  return (
    <View style={s.screen}>
      <Text style={s.logo}>{MARK} DEAD AIR RADIO</Text>
      <Text style={s.sub}>TUNING...</Text>
      <ActivityIndicator color={colors.amber} style={{ marginTop: 20 }} />
      <CRT />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  logo: { fontFamily: mono, fontSize: 22, letterSpacing: 6, color: colors.amber },
  sub: { fontFamily: mono, fontSize: 11, letterSpacing: 4, color: colors.textGhost, marginTop: 12 },
});
