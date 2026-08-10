import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

import Button from '../components/Button';
import CRT from '../components/CRT';
import { MARK } from '../content/symbols';
import { progressSummary } from '../engine/progression';
import { isConfigured } from '../services/signal';
import { colors, mono, safeTop } from '../theme/theme';

/**
 * Progress readout, the content warning the store listing promises, and the
 * erase-save escape hatch v1 had no way to reach.
 */
export default function SettingsScreen({ save, purchases, settings, onToggleSound, onErase, onClose }) {
  const [armed, setArmed] = useState(false);
  const progress = progressSummary(save, purchases);

  const rows = [
    ['CALLS LOGGED', `${progress.callsDone} / ${progress.callsTotal}`],
    ['TAPES RECOVERED', `${progress.tapesFound} / ${progress.tapesTotal}`],
    ['BANDS OPEN', `${progress.bandsOpen} / ${progress.bandsTotal}`],
    ['STATIC', `${save.bal}`],
    ['SANITY', `${save.sanity}`],
    ['INFINITE SIGNAL', isConfigured() ? 'CONNECTED' : 'NOT CONFIGURED'],
  ];

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View>
          <Text style={s.logo}>{MARK} DEAD AIR</Text>
          <Text style={s.sub}>STATION LOG</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onClose} style={s.close}>
          <Text style={s.closeText}>✕ CLOSE</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 96 }}>
        {rows.map(([label, value]) => (
          <View key={label} style={s.row}>
            <Text style={s.rowLabel}>{label}</Text>
            <Text style={s.rowValue}>{value}</Text>
          </View>
        ))}

        <Text style={s.heading}>SOUND</Text>
        <TouchableOpacity
          accessibilityRole="switch"
          accessibilityState={{ checked: settings.sound }}
          accessibilityLabel="Station sound"
          activeOpacity={0.7}
          onPress={onToggleSound}
          style={s.toggle}
        >
          <Text style={s.toggleLabel}>STATION SOUND</Text>
          <Text style={[s.toggleValue, { color: settings.sound ? colors.amber : colors.textGhost }]}>
            {settings.sound ? `${MARK} ON` : '─ OFF'}
          </Text>
        </TouchableOpacity>
        <Text style={s.body}>
          Carrier hiss, relays, and the archive bell. The station follows your device&apos;s silent
          switch and mixes with whatever else you are playing.
        </Text>

        <Text style={s.heading}>CONTENT</Text>
        <Text style={s.body}>
          This game deals with grief, death, loss, the supernatural, and psychological horror. Some
          transmissions are based on emotionally real scenarios.
        </Text>

        <Text style={s.heading}>ERASE STATION</Text>
        <Text style={s.body}>
          Wipes every logged call, tape, and point of sanity. Purchases are kept — you never have to
          buy the game twice.
        </Text>

        <Button
          label={armed ? 'CONFIRM — ERASE EVERYTHING' : 'ERASE SAVE'}
          tone={armed ? 'red' : 'quiet'}
          style={{ marginTop: 12 }}
          onPress={() => {
            if (armed) {
              setArmed(false);
              onErase();
            } else {
              setArmed(true);
            }
          }}
        />
        {armed && (
          <TouchableOpacity accessibilityRole="button" onPress={() => setArmed(false)} style={s.cancel}>
            <Text style={s.cancelText}>CANCEL</Text>
          </TouchableOpacity>
        )}

        <Text style={s.footer}>{'The frequency is open.\nSomething is already waiting.'}</Text>
      </ScrollView>

      <CRT />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: safeTop,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  logo: { fontFamily: mono, fontSize: 18, letterSpacing: 5, color: colors.amber },
  sub: { fontFamily: mono, fontSize: 10, letterSpacing: 4, color: colors.textFaint, marginTop: 2 },
  close: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeText: { fontFamily: mono, fontSize: 11, letterSpacing: 2, color: colors.textFaint },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0d0d0d',
  },
  rowLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 2, color: colors.textFaint },
  rowValue: { fontFamily: mono, fontSize: 12, color: colors.amber },
  heading: {
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: 3,
    color: colors.textFaint,
    marginTop: 28,
    marginBottom: 8,
  },
  body: { fontFamily: mono, fontSize: 12, lineHeight: 20, color: '#666' },
  toggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 2,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  toggleLabel: { fontFamily: mono, fontSize: 12, letterSpacing: 2, color: colors.text },
  toggleValue: { fontFamily: mono, fontSize: 13, letterSpacing: 2 },
  cancel: { padding: 10, alignItems: 'center' },
  cancelText: { fontFamily: mono, fontSize: 11, letterSpacing: 2, color: colors.textGhost },
  footer: {
    fontFamily: mono,
    fontSize: 11,
    lineHeight: 18,
    color: colors.textVoid,
    textAlign: 'center',
    marginTop: 32,
    fontStyle: 'italic',
  },
});
