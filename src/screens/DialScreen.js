import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

import ArchiveScreen from './ArchiveScreen';
import feedback from '../feedback';
import CRT from '../components/CRT';
import Fade from '../components/Fade';
import StaticBurst from '../components/StaticBurst';
import SignalBars from '../components/SignalBars';
import Button from '../components/Button';
import { BANDS, bandById } from '../content/bands';
import { callTypeLabel } from '../content/callTypes';
import { MARK } from '../content/symbols';
import { isOffAir, sanityState, stabiliseQuote } from '../engine/save';
import { CALM_ABOVE, interference } from '../engine/interference';
import {
  availableCalls,
  bandLockReason,
  generationStatus,
  isBandUnlocked,
  progressSummary,
  teasedCalls,
} from '../engine/progression';
import { useReducedMotion } from '../motion';
import { colors, mono, safeTop } from '../theme/theme';

/** The sanity readout pulses once the station is in trouble. */
function SanityReadout({ sanity }) {
  const reduced = useReducedMotion();
  const state = sanityState(sanity);
  const alarmed = interference(sanity) > 0.45;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!alarmed || reduced) {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 620, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 620, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [alarmed, reduced, pulse]);

  return (
    <Animated.Text style={[s.stat, { opacity: pulse }]}>
      <Text style={{ color: state.color }}>{sanity}</Text>
      <Text style={s.statKey}> SAN</Text>
    </Animated.Text>
  );
}

/** The station. Pick a band, pick a call, or ask the frequency for a new one. */
export default function DialScreen({
  save,
  purchases,
  activeBandId,
  onSelectBand,
  onStartCall,
  onGenerate,
  onStabilise,
  onOpenStore,
  onOpenSettings,
  generating,
  generationError,
}) {
  const [tab, setTab] = useState('calls');

  const band = bandById(activeBandId);
  const calls = availableCalls(activeBandId, save);
  const teased = teasedCalls(activeBandId, save);
  const gen = generationStatus(save, purchases);
  const progress = progressSummary(save, purchases);
  const offAir = isOffAir(save);
  const quote = stabiliseQuote(save);

  const generateLabel = () => {
    if (!gen.allowed) return `${MARK} UNLOCK INFINITE IN STORE`;
    if (gen.unlimited) return `${MARK} GENERATE AI CALL`;
    return `${MARK} GENERATE AI CALL (${gen.remaining} LEFT)`;
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Text style={[s.logo, { color: band.color }]}>{MARK} DEAD AIR</Text>
        <View style={s.headerRight}>
          <SanityReadout sanity={save.sanity} />
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
              onPress={() => {
                // Only when the dial actually moves — re-tapping the current
                // band should not re-trigger the sweep.
                if (b.id !== activeBandId) feedback.fire('tune');
                onSelectBand(b.id);
              }}
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
            style={[s.tab, tab === key && { borderBottomColor: band.color, borderBottomWidth: 2 }]}
            onPress={() => setTab(key)}
          >
            <Text style={[s.tabText, tab === key && { color: band.color }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'tapes' ? (
        <ArchiveScreen tapes={save.tapes} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.list}>
          {offAir ? (
            <Fade>
              <View style={s.deadAir}>
                <Text style={s.deadAirTitle}>DEAD AIR</Text>
                <Text style={s.deadAirBody}>
                  You have nothing left to give the callers. The desk is dark and the frequency has
                  gone quiet.
                </Text>
                <Text style={s.deadAirBody}>
                  Sit with it until you can hold a line again.
                </Text>
                <Button
                  label={
                    quote.emergency
                      ? `STABILISE — EVERYTHING YOU HAVE  →  +${quote.restore} SAN`
                      : `STABILISE — ${quote.cost} ${MARK}  →  +${quote.restore} SAN`
                  }
                  tone="red"
                  style={{ marginTop: 18 }}
                  onPress={onStabilise}
                />
              </View>
            </Fade>
          ) : (
            <>
              {/* Only once it matters. Offering a top-up after every scratch
                  would turn a tension release into a chore. */}
              {quote.available && save.sanity < CALM_ABOVE && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Stabilise for ${quote.cost} static, restoring ${quote.restore} sanity`}
                  onPress={onStabilise}
                  style={({ pressed }) => [s.stabilise, pressed && { borderColor: colors.green }]}
                >
                  <Text style={s.stabiliseLabel}>◈ STABILISE</Text>
                  <Text style={s.stabiliseCost}>
                    {quote.cost} {MARK} → +{quote.restore} SAN
                  </Text>
                </Pressable>
              )}

              {calls.length === 0 && teased.length === 0 && (
                <Text style={s.empty}>— ALL CALLS LOGGED FOR THIS BAND —</Text>
              )}

              {calls.map((call, i) => (
                // Keyed by band so the list re-forms when the dial moves, arriving
                // in sequence rather than all at once.
                <Fade key={`${activeBandId}-${call.id}`} delay={Math.min(i, 6) * 55}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onStartCall(call)}
                    style={({ pressed }) => [
                      s.card,
                      call.secret && { borderColor: band.color },
                      pressed && { borderColor: band.color, backgroundColor: '#080808' },
                    ]}
                  >
                    <View style={s.cardTop}>
                      <Text style={[s.cardId, { color: band.color }]} numberOfLines={1}>
                        {call.callerId}
                      </Text>
                      <SignalBars n={call.signal} color={band.color} />
                    </View>
                    <Text style={s.cardName}>{call.callerName}</Text>
                    <Text style={s.cardType}>
                      {call.secret ? 'UNLISTED TRANSMISSION' : callTypeLabel(call.type)}
                    </Text>
                  </Pressable>
                </Fade>
              ))}

              {/* Earned, but not right now. Shown so a near miss reads as a
                  near miss rather than as nothing being there. */}
              {teased.map((call) => (
                <Fade key={`teased-${call.id}`}>
                  <View style={[s.card, s.cardLocked]}>
                    <Text style={s.cardIdLocked}>{call.callerId}</Text>
                    <Text style={s.cardNameLocked}>████████████</Text>
                    <Text style={s.cardType}>
                      {call.window
                        ? `RECEIVABLE ${String(call.window.from).padStart(2, '0')}:00 – ${String(
                            call.window.to,
                          ).padStart(2, '0')}:00 ONLY`
                        : 'NOT RECEIVABLE'}
                    </Text>
                  </View>
                </Fade>
              ))}

              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.7}
                disabled={generating || !gen.allowed}
                onPress={gen.allowed ? onGenerate : onOpenStore}
                style={[
                  s.generate,
                  { borderColor: gen.allowed ? band.color : colors.line },
                ]}
              >
                {generating ? (
                  <ActivityIndicator color={band.color} />
                ) : (
                  <Text
                    style={[
                      s.generateText,
                      { color: gen.allowed ? band.color : colors.textGhost },
                    ]}
                  >
                    {generateLabel()}
                  </Text>
                )}
              </TouchableOpacity>

              {!!generationError && <Text style={s.error}>{generationError}</Text>}
            </>
          )}
        </ScrollView>
      )}

      {/* Lighter than a screen change — retuning within the same station. */}
      <StaticBurst trigger={activeBandId} intensity={0.55} />
      <CRT sanity={save.sanity} />
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
  logo: { fontFamily: mono, fontSize: 18, letterSpacing: 5 },
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
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomColor: 'transparent' },
  tabText: { fontFamily: mono, fontSize: 11, letterSpacing: 2, color: colors.textGhost },

  list: { padding: 16, gap: 10, paddingBottom: 96 },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 2, padding: 14, gap: 4 },
  cardLocked: { borderColor: '#141414', borderStyle: 'dashed' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  cardId: { fontFamily: mono, fontSize: 11, letterSpacing: 2, flex: 1 },
  cardIdLocked: { fontFamily: mono, fontSize: 11, letterSpacing: 2, color: colors.textGhost },
  cardName: { fontFamily: mono, fontSize: 16, color: '#ccc' },
  cardNameLocked: { fontFamily: mono, fontSize: 16, color: colors.lineBright, letterSpacing: 1 },
  cardType: { fontFamily: mono, fontSize: 10, letterSpacing: 2, color: colors.textGhost },

  stabilise: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.lineBright,
    borderRadius: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stabiliseLabel: { fontFamily: mono, fontSize: 12, letterSpacing: 2, color: colors.green },
  stabiliseCost: { fontFamily: mono, fontSize: 11, color: colors.textFaint },

  deadAir: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 2,
    padding: 20,
    gap: 10,
    marginTop: 24,
  },
  deadAirTitle: { fontFamily: mono, fontSize: 22, letterSpacing: 6, color: colors.red },
  deadAirBody: { fontFamily: mono, fontSize: 13, lineHeight: 21, color: colors.textDim },

  generate: {
    borderWidth: 1,
    borderRadius: 2,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  generateText: { fontFamily: mono, fontSize: 13, letterSpacing: 1 },
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
