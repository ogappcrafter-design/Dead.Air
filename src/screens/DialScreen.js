import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

import ArchiveScreen from './ArchiveScreen';
import CRT from '../components/CRT';
import SignalBars from '../components/SignalBars';
import { BANDS, bandById } from '../content/bands';
import { callTypeLabel } from '../content/callTypes';
import { MARK } from '../content/symbols';
import { sanityState } from '../engine/save';
import {
  availableCalls,
  bandLockReason,
  generationStatus,
  isBandUnlocked,
  progressSummary,
} from '../engine/progression';
import { colors, mono, safeTop } from '../theme/theme';

/** The station. Pick a band, pick a call, or ask the frequency for a new one. */
export default function DialScreen({
  save,
  purchases,
  activeBandId,
  onSelectBand,
  onStartCall,
  onGenerate,
  onOpenStore,
  onOpenSettings,
  generating,
  generationError,
}) {
  const [tab, setTab] = useState('calls');

  const band = bandById(activeBandId);
  const calls = availableCalls(activeBandId, save);
  const gen = generationStatus(save, purchases);
  const sanity = sanityState(save.sanity);
  const progress = progressSummary(save, purchases);

  const generateLabel = () => {
    if (!gen.allowed) return `${MARK} UNLOCK INFINITE IN STORE`;
    if (gen.unlimited) return `${MARK} GENERATE AI CALL`;
    return `${MARK} GENERATE AI CALL (${gen.remaining} LEFT)`;
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Text style={s.logo}>{MARK} DEAD AIR</Text>
        <View style={s.headerRight}>
          <Text style={s.stat}>
            <Text style={{ color: sanity.color }}>{save.sanity}</Text>
            <Text style={s.statKey}> SAN</Text>
          </Text>
          <Text style={s.stat}>
            <Text style={{ color: colors.amber }}>{save.bal}</Text>
            <Text style={s.statKey}> {MARK}</Text>
          </Text>
          <TouchableOpacity accessibilityRole="button" onPress={onOpenStore} style={s.chip}>
            <Text style={s.chipText}>STORE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={onOpenSettings}
            style={s.chip}
          >
            <Text style={s.chipText}>≡</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.bandRow}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      >
        {BANDS.map((b) => {
          const unlocked = isBandUnlocked(b, save, purchases);
          const active = b.id === activeBandId;
          const lock = bandLockReason(b, save, purchases);
          return (
            <TouchableOpacity
              key={b.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active, disabled: !unlocked }}
              disabled={!unlocked}
              onPress={() => onSelectBand(b.id)}
              style={[s.band, active && { borderBottomColor: b.color }]}
            >
              <Text style={[s.bandName, { color: unlocked ? b.color : colors.textGhost }]}>
                {b.name}
              </Text>
              <Text style={[s.bandFreq, { color: unlocked ? colors.textFaint : colors.lineBright }]}>
                {lock || b.freq}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={s.tabs}>
        {[
          ['calls', 'CALLS'],
          ['tapes', `TAPES (${progress.tapesFound})`],
        ].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            style={[s.tab, tab === key && s.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[s.tabText, tab === key && { color: colors.amber }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'tapes' ? (
        <ArchiveScreen tapes={save.tapes} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.list}>
          {calls.length === 0 && (
            <Text style={s.empty}>— ALL CALLS LOGGED FOR THIS BAND —</Text>
          )}

          {calls.map((call) => (
            <TouchableOpacity
              key={call.id}
              accessibilityRole="button"
              activeOpacity={0.7}
              style={s.card}
              onPress={() => onStartCall(call)}
            >
              <View style={s.cardTop}>
                <Text style={[s.cardId, { color: band.color }]} numberOfLines={1}>
                  {call.callerId}
                </Text>
                <SignalBars n={call.signal} color={band.color} />
              </View>
              <Text style={s.cardName}>{call.callerName}</Text>
              <Text style={s.cardType}>{callTypeLabel(call.type)}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.7}
            disabled={generating || !gen.allowed}
            onPress={gen.allowed ? onGenerate : onOpenStore}
            style={[s.generate, !gen.allowed && { borderColor: colors.line }]}
          >
            {generating ? (
              <ActivityIndicator color={colors.amber} />
            ) : (
              <Text style={[s.generateText, !gen.allowed && { color: colors.textGhost }]}>
                {generateLabel()}
              </Text>
            )}
          </TouchableOpacity>

          {!!generationError && <Text style={s.error}>{generationError}</Text>}
        </ScrollView>
      )}

      <CRT />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: safeTop,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  logo: { fontFamily: mono, fontSize: 18, letterSpacing: 5, color: colors.amber },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stat: { fontFamily: mono, fontSize: 12 },
  statKey: { color: colors.textFaint },
  chip: {
    borderWidth: 1,
    borderColor: colors.lineBright,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontFamily: mono, fontSize: 11, letterSpacing: 2, color: colors.textFaint },

  bandRow: { borderBottomWidth: 1, borderBottomColor: colors.hairline, flexGrow: 0 },
  band: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  bandName: { fontFamily: mono, fontSize: 11, letterSpacing: 2 },
  bandFreq: { fontFamily: mono, fontSize: 10 },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.hairline },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.amber },
  tabText: { fontFamily: mono, fontSize: 11, letterSpacing: 2, color: colors.textGhost },

  list: { padding: 16, gap: 10, paddingBottom: 96 },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 2, padding: 14, gap: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  cardId: { fontFamily: mono, fontSize: 11, letterSpacing: 2, flex: 1 },
  cardName: { fontFamily: mono, fontSize: 16, color: '#ccc' },
  cardType: { fontFamily: mono, fontSize: 10, letterSpacing: 2, color: colors.textGhost },

  generate: {
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: 2,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  generateText: { fontFamily: mono, fontSize: 13, letterSpacing: 1, color: colors.amber },
  error: { fontFamily: mono, fontSize: 12, color: colors.red, textAlign: 'center', marginTop: 6 },
  empty: {
    fontFamily: mono,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.textVoid,
    textAlign: 'center',
    marginTop: 40,
  },
});
