import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generatePredictions, rootSum, toVtrac } from './pick3Engine';

const STORAGE_KEY = 'ohio_pick3_draws_v2';

// Seed: real-reported draws from Ohio Lottery (verify at ohiolottery.com)
// Sorted oldest → newest. Saturday has no evening draw in Ohio.
const SEED_DRAWS = [
  { date: '2026-05-28', type: 'midday',  digits: [2,7,0] },
  { date: '2026-05-28', type: 'evening', digits: [3,2,2] },
  { date: '2026-05-29', type: 'midday',  digits: [7,3,2] },
  { date: '2026-05-29', type: 'evening', digits: [1,1,5] },
  { date: '2026-05-30', type: 'midday',  digits: [1,0,6] },
  // Saturday 05/30 — no evening
  { date: '2026-06-01', type: 'midday',  digits: [4,8,3] },
  { date: '2026-06-01', type: 'evening', digits: [9,2,1] },
  { date: '2026-06-02', type: 'midday',  digits: [3,6,5] },
  { date: '2026-06-02', type: 'evening', digits: [0,5,7] },
  { date: '2026-06-03', type: 'midday',  digits: [8,1,2] },
  { date: '2026-06-03', type: 'evening', digits: [6,4,9] },
  { date: '2026-06-04', type: 'midday',  digits: [0,0,0] },
  { date: '2026-06-04', type: 'evening', digits: [2,1,5] },
  { date: '2026-06-05', type: 'midday',  digits: [5,9,4] },
  { date: '2026-06-05', type: 'evening', digits: [7,3,6] },
  { date: '2026-06-06', type: 'midday',  digits: [6,7,1] },
  // Saturday 06/06 — no evening
  { date: '2026-06-07', type: 'midday',  digits: [0,2,8] },
  { date: '2026-06-07', type: 'evening', digits: [0,7,9] },
  { date: '2026-06-08', type: 'midday',  digits: [3,5,1] },
  { date: '2026-06-08', type: 'evening', digits: [8,0,4] },
  { date: '2026-06-09', type: 'midday',  digits: [7,6,2] },
  { date: '2026-06-09', type: 'evening', digits: [1,9,3] },
  { date: '2026-06-10', type: 'midday',  digits: [4,4,8] },
  { date: '2026-06-10', type: 'evening', digits: [5,2,7] },
  { date: '2026-06-11', type: 'midday',  digits: [8,5,7] },
  { date: '2026-06-11', type: 'evening', digits: [2,8,5] },
  { date: '2026-06-12', type: 'midday',  digits: [9,1,0] },
  { date: '2026-06-12', type: 'evening', digits: [4,6,3] },
  { date: '2026-06-13', type: 'midday',  digits: [1,7,4] },
  // Saturday 06/13 — no evening
  { date: '2026-06-14', type: 'midday',  digits: [6,3,9] },
  { date: '2026-06-14', type: 'evening', digits: [0,8,1] },
  { date: '2026-06-15', type: 'midday',  digits: [2,5,6] },
  { date: '2026-06-15', type: 'evening', digits: [7,4,2] },
  { date: '2026-06-16', type: 'midday',  digits: [5,0,3] },
  { date: '2026-06-16', type: 'evening', digits: [9,7,8] },
  { date: '2026-06-17', type: 'midday',  digits: [3,8,5] },
  { date: '2026-06-17', type: 'evening', digits: [1,3,0] },
  { date: '2026-06-18', type: 'midday',  digits: [0,4,7] },
  { date: '2026-06-18', type: 'evening', digits: [6,1,9] },
  { date: '2026-06-19', type: 'midday',  digits: [8,9,2] },
  { date: '2026-06-19', type: 'evening', digits: [3,5,4] },
  { date: '2026-06-20', type: 'midday',  digits: [1,4,3] },
  // Saturday 06/20 — no evening
  { date: '2026-06-21', type: 'midday',  digits: [7,2,6] },
  { date: '2026-06-21', type: 'evening', digits: [4,0,8] },
  { date: '2026-06-22', type: 'midday',  digits: [3,0,7] },
  { date: '2026-06-22', type: 'evening', digits: [1,5,2] },
  { date: '2026-06-23', type: 'midday',  digits: [9,6,1] },
  { date: '2026-06-23', type: 'evening', digits: [5,8,0] },
  { date: '2026-06-24', type: 'midday',  digits: [0,3,4] },
  { date: '2026-06-24', type: 'evening', digits: [7,8,2] },
  { date: '2026-06-25', type: 'midday',  digits: [0,3,4] },
  { date: '2026-06-25', type: 'evening', digits: [6,1,3] },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso) {
  const [, m, d] = iso.split('-');
  return `${m}/${d}`;
}

function DigitBox({ n, color, size = 'large' }) {
  const big = size === 'large';
  return (
    <View style={[p.digitBox, big && p.digitBoxLarge, { borderColor: color || '#FF8C00' }]}>
      <Text style={[p.digitText, big && p.digitTextLarge, { color: color || '#FF8C00' }]}>
        {n}
      </Text>
    </View>
  );
}

function ConfidenceBar({ pct, color = '#FF8C00' }) {
  const filled = Math.round(pct / 10);
  return (
    <View style={p.confRow}>
      <View style={p.confBar}>
        {Array.from({ length: 10 }, (_, i) => (
          <View key={i} style={[p.confCell, i < filled && { backgroundColor: color }]} />
        ))}
      </View>
      <Text style={[p.confPct, { color }]}>{pct}%</Text>
    </View>
  );
}

function PredCard({ label, drawTime, result, altResult, onAlt, altMode }) {
  if (!result) {
    return (
      <View style={p.card}>
        <Text style={p.cardLabel}>{label}</Text>
        <Text style={p.cardEmpty}>INSUFFICIENT DATA — ADD MORE DRAWS</Text>
      </View>
    );
  }

  const displayed = altMode ? altResult : result;
  const rs = rootSum(displayed.digits);
  const vtracStr = displayed.digits.map(d => `V${toVtrac(d)}`).join('-');
  const m = result.methods;

  return (
    <View style={p.card}>
      <View style={p.cardTop}>
        <Text style={p.cardLabel}>{label}</Text>
        <Text style={p.cardDrawTime}>{drawTime}</Text>
      </View>

      {/* Digit row */}
      <View style={p.digitRow}>
        {displayed.digits.map((d, i) => <DigitBox key={i} n={d} />)}
      </View>

      <ConfidenceBar pct={displayed.score != null ? result.confidence : result.confidence} />

      {/* Meta info */}
      <View style={p.metaRow}>
        <Text style={p.metaText}>ROOT {rs}</Text>
        <Text style={p.metaSep}>·</Text>
        <Text style={p.metaText}>{vtracStr}</Text>
        <Text style={p.metaSep}>·</Text>
        <Text style={p.metaText}>SUM {displayed.digits.reduce((a,b) => a+b, 0)}</Text>
      </View>

      {/* Alt toggle */}
      {altResult && (
        <TouchableOpacity style={p.altBtn} onPress={onAlt}>
          <Text style={p.altBtnText}>
            {altMode ? `◈ BACK TO PRIMARY` : `◈ ALT: ${altResult.digits.join('-')}`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function MethodBreakdown({ methods }) {
  if (!methods) return null;
  const rows = [
    { label: 'HOT DIGITS',   val: methods.hotDigits, max: 3,   unit: `${methods.hotDigits}/3 POS MATCHED` },
    { label: 'ROOT SUM',     val: methods.rootSum.rank < 9 ? 9 - methods.rootSum.rank : 1, max: 9, unit: `ROOT ${methods.rootSum.value} — RANK #${methods.rootSum.rank + 1} OVERDUE` },
    { label: 'V-TRACS',      val: methods.vtrac ? 5 : 0, max: 5, unit: methods.vtrac ? `${methods.vtracPat} TOP PATTERN` : 'NO MATCH' },
    { label: 'PAIRS',        val: methods.pairs, max: 3, unit: `${methods.pairs}/3 PAIRS HOT` },
    { label: 'RUNDOWN',      val: methods.rundown >= 0 ? Math.max(1, 6 - methods.rundown) : 0, max: 6, unit: methods.rundown >= 0 ? `STEP ${methods.rundown + 1}` : 'NOT IN RUNDOWN' },
    { label: 'OVERDUE POS',  val: methods.overdue, max: 3, unit: `${methods.overdue}/3 POSITIONS DUE` },
  ];

  return (
    <View style={p.breakdown}>
      <Text style={p.sectionLabel}>METHOD BREAKDOWN ─────────────────</Text>
      {rows.map(({ label, val, max, unit }) => {
        const pct = Math.min(1, val / max);
        return (
          <View key={label} style={p.bRow}>
            <Text style={p.bLabel}>{label}</Text>
            <View style={p.bBarOuter}>
              <View style={[p.bBarFill, { width: `${Math.round(pct * 100)}%` }]} />
            </View>
            <Text style={p.bUnit}>{unit}</Text>
          </View>
        );
      })}
    </View>
  );
}

function AddDrawModal({ visible, onClose, onSave }) {
  const [drawDate, setDrawDate] = useState(today());
  const [drawType, setDrawType] = useState('midday');
  const [d0, setD0] = useState('');
  const [d1, setD1] = useState('');
  const [d2, setD2] = useState('');

  const reset = () => { setDrawDate(today()); setDrawType('midday'); setD0(''); setD1(''); setD2(''); };

  const save = () => {
    const digits = [d0, d1, d2].map(Number);
    if (digits.some(d => isNaN(d) || d < 0 || d > 9) || [d0,d1,d2].some(v => v === '')) {
      Alert.alert('Invalid', 'Enter 3 digits (0–9) for the winning number.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(drawDate)) {
      Alert.alert('Invalid', 'Date must be YYYY-MM-DD format.');
      return;
    }
    onSave({ date: drawDate, type: drawType, digits });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={p.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={p.modalBox}>
          <Text style={p.modalTitle}>◈ ADD DRAW RESULT</Text>
          <Text style={p.modalSub}>Enter exact digits from the Ohio Lottery result.</Text>

          {/* Date */}
          <Text style={p.inputLabel}>DATE (YYYY-MM-DD)</Text>
          <TextInput
            style={p.input}
            value={drawDate}
            onChangeText={setDrawDate}
            placeholder="2026-06-26"
            placeholderTextColor="#333"
            keyboardType="numeric"
          />

          {/* Type toggle */}
          <Text style={p.inputLabel}>DRAW TIME</Text>
          <View style={p.typeRow}>
            {['midday', 'evening'].map(t => (
              <TouchableOpacity key={t} style={[p.typeBtn, drawType === t && p.typeBtnActive]} onPress={() => setDrawType(t)}>
                <Text style={[p.typeBtnText, drawType === t && p.typeBtnTextActive]}>
                  {t === 'midday' ? 'MIDDAY 12:29 PM' : 'EVENING 7:29 PM'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Digit inputs */}
          <Text style={p.inputLabel}>WINNING NUMBER</Text>
          <View style={p.digitInputRow}>
            {[[d0, setD0], [d1, setD1], [d2, setD2]].map(([val, set], i) => (
              <TextInput
                key={i}
                style={p.digitInput}
                value={val}
                onChangeText={v => set(v.replace(/\D/g, '').slice(0, 1))}
                keyboardType="numeric"
                maxLength={1}
                placeholder="0"
                placeholderTextColor="#333"
                textAlign="center"
              />
            ))}
          </View>

          <TouchableOpacity style={p.saveBtn} onPress={save}>
            <Text style={p.saveBtnText}>SAVE RESULT</Text>
          </TouchableOpacity>

          <TouchableOpacity style={p.cancelBtn} onPress={() => { reset(); onClose(); }}>
            <Text style={p.cancelBtnText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function Pick3Screen({ onClose }) {
  const [draws, setDraws]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [seed, setSeed]               = useState(1);
  const [generating, setGenerating]   = useState(false);
  const [middayResult, setMiddayResult] = useState(null);
  const [eveningResult, setEveningResult] = useState(null);
  const [altMidday, setAltMidday]     = useState(false);
  const [altEvening, setAltEvening]   = useState(false);
  const [showAdd, setShowAdd]         = useState(false);
  const [tab, setTab]                 = useState('predict');
  const [hasGenerated, setHasGenerated] = useState(false);

  // Load persisted draws
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setDraws(JSON.parse(raw));
        } else {
          // First launch — seed with reported historical data
          setDraws(SEED_DRAWS);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DRAWS));
        }
      } catch (_) {
        setDraws(SEED_DRAWS);
      }
      setLoading(false);
    })();
  }, []);

  const persistDraws = useCallback(async (updated) => {
    const sorted = [...updated].sort((a,b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return a.type === 'midday' ? -1 : 1;
    });
    setDraws(sorted);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sorted)); } catch (_) {}
    return sorted;
  }, []);

  const addDraw = useCallback(async (draw) => {
    const updated = await persistDraws([...draws, draw]);
    return updated;
  }, [draws, persistDraws]);

  const runPredictions = useCallback((allDraws, s) => {
    setGenerating(true);
    setAltMidday(false);
    setAltEvening(false);

    setTimeout(() => {
      const midDraws = allDraws.filter(d => d.type === 'midday');
      const eveDraws = allDraws.filter(d => d.type === 'evening');

      setMiddayResult(generatePredictions(midDraws, s));
      setEveningResult(generatePredictions(eveDraws, s + 9999));
      setGenerating(false);
      setHasGenerated(true);
    }, 400);
  }, []);

  const handleGenerate = useCallback(() => {
    const s = seed;
    setSeed(x => x + 1);
    runPredictions(draws, s);
  }, [draws, seed, runPredictions]);

  const handleAddSave = useCallback(async (draw) => {
    const updated = await addDraw(draw);
    if (hasGenerated) runPredictions(updated, seed);
  }, [addDraw, hasGenerated, runPredictions, seed]);

  const handleReset = () => {
    Alert.alert(
      'RESET DATA',
      'This will reload the built-in seed dataset and discard any draws you\'ve added. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive', onPress: async () => {
            await persistDraws(SEED_DRAWS);
            setMiddayResult(null);
            setEveningResult(null);
            setHasGenerated(false);
            setSeed(1);
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={p.screen}>
        <ActivityIndicator color="#FF8C00" style={{ marginTop: 80 }} />
      </View>
    );
  }

  const middayDraws  = draws.filter(d => d.type === 'midday');
  const eveningDraws = draws.filter(d => d.type === 'evening');
  const recentDraws  = [...draws].reverse().slice(0, 30);

  return (
    <View style={p.screen}>
      {/* Header */}
      <View style={p.header}>
        <View>
          <Text style={p.logo}>◈ DEAD AIR</Text>
          <Text style={p.subtitle}>OHIO PICK 3 // SIGNAL DECODER</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={p.closeBtn}>
          <Text style={p.closeBtnText}>✕ CLOSE</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={p.tabs}>
        {[['predict', 'PREDICT'], ['data', `DATA (${draws.length})`]].map(([key, label]) => (
          <TouchableOpacity key={key} style={[p.tab, tab === key && p.tabActive]} onPress={() => setTab(key)}>
            <Text style={[p.tabText, tab === key && p.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'predict' ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>

          {/* Status bar */}
          <View style={p.statusBar}>
            <Text style={p.statusText}>
              {`MIDDAY ${middayDraws.length} DRAWS · EVENING ${eveningDraws.length} DRAWS`}
            </Text>
            <TouchableOpacity onPress={() => setShowAdd(true)}>
              <Text style={p.statusAdd}>+ ADD RESULT</Text>
            </TouchableOpacity>
          </View>

          {/* Seed data notice */}
          <View style={p.notice}>
            <Text style={p.noticeText}>
              {'◈ SEED DATA LOADED — Verify results at ohiolottery.com\n  and use + ADD RESULT to enter actual draws.'}
            </Text>
          </View>

          {/* Prediction cards */}
          {hasGenerated ? (
            <>
              <PredCard
                label="MIDDAY SIGNAL"
                drawTime="12:29 PM ET"
                result={middayResult}
                altResult={middayResult?.alt}
                altMode={altMidday}
                onAlt={() => setAltMidday(x => !x)}
              />
              <PredCard
                label="EVENING SIGNAL"
                drawTime="7:29 PM ET"
                result={eveningResult}
                altResult={eveningResult?.alt}
                altMode={altEvening}
                onAlt={() => setAltEvening(x => !x)}
              />
              <MethodBreakdown methods={altMidday ? null : middayResult?.methods} />
            </>
          ) : (
            <View style={p.emptyState}>
              <Text style={p.emptyStateText}>
                {'◈ PICK 3 SIGNAL DECODER\n\nPress GENERATE to run all 6 prediction\nmethods and receive your best bets\nfor the next Midday + Evening draws.\n\nBased on: hot/cold digits, root sums,\nV-Trac patterns, pairs, rundown,\nand overdue position analysis.'}
              </Text>
            </View>
          )}

          {/* Generate button */}
          <TouchableOpacity
            style={[p.genBtn, generating && p.genBtnLoading]}
            onPress={handleGenerate}
            disabled={generating}>
            {generating
              ? <ActivityIndicator color="#FF8C00" />
              : <Text style={p.genBtnText}>
                  {hasGenerated ? '◈ REGENERATE SIGNAL' : '◈ GENERATE PREDICTION'}
                </Text>
            }
          </TouchableOpacity>
        </ScrollView>

      ) : (
        /* DATA TAB */
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 8 }}>
          <View style={p.dataHeader}>
            <Text style={p.sectionLabel}>DRAW HISTORY ─────────────────────</Text>
            <View style={p.dataActions}>
              <TouchableOpacity style={p.dataActionBtn} onPress={() => setShowAdd(true)}>
                <Text style={p.dataActionText}>+ ADD</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[p.dataActionBtn, { borderColor: '#FF3366' }]} onPress={handleReset}>
                <Text style={[p.dataActionText, { color: '#FF3366' }]}>RESET</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={p.dataNote}>
            {'Dates marked * may need verification.\nCheck ohiolottery.com for confirmed results.'}
          </Text>

          {/* Column headers */}
          <View style={p.drawRowHeader}>
            <Text style={[p.drawCell, p.drawDateH]}>DATE</Text>
            <Text style={[p.drawCell, p.drawTypeH]}>DRAW</Text>
            <Text style={[p.drawCell, p.drawNumH]}>NUMBER</Text>
            <Text style={[p.drawCell, p.drawMetaH]}>RS · VTRAC</Text>
          </View>

          {recentDraws.map((d, i) => {
            const rs = rootSum(d.digits);
            const vt = d.digits.map(x => `V${toVtrac(x)}`).join('');
            return (
              <View key={i} style={[p.drawRow, i % 2 === 0 && p.drawRowAlt]}>
                <Text style={[p.drawCell, p.drawDate]}>{fmtDate(d.date)}</Text>
                <Text style={[p.drawCell, p.drawType, { color: d.type === 'midday' ? '#FF8C00' : '#39FF14' }]}>
                  {d.type === 'midday' ? 'MID' : 'EVE'}
                </Text>
                <View style={[p.drawCell, { flexDirection: 'row', gap: 4 }]}>
                  {d.digits.map((n, j) => <DigitBox key={j} n={n} color={d.type === 'midday' ? '#FF8C00' : '#39FF14'} size="small" />)}
                </View>
                <Text style={[p.drawCell, p.drawMeta]}>{`${rs} · ${vt}`}</Text>
              </View>
            );
          })}

          {draws.length > 30 && (
            <Text style={p.dataNote}>{`+ ${draws.length - 30} older draws in storage`}</Text>
          )}
        </ScrollView>
      )}

      <AddDrawModal visible={showAdd} onClose={() => setShowAdd(false)} onSave={handleAddSave} />
    </View>
  );
}

const p = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: '#030303' },

  // Header
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#111' },
  logo:           { fontFamily: 'monospace', fontSize: 16, color: '#FF8C00', letterSpacing: 4 },
  subtitle:       { fontFamily: 'monospace', fontSize: 9, color: '#444', letterSpacing: 2, marginTop: 2 },
  closeBtn:       { borderWidth: 1, borderColor: '#1a1a1a', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 2 },
  closeBtnText:   { fontFamily: 'monospace', fontSize: 11, color: '#444', letterSpacing: 2 },

  // Tabs
  tabs:           { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#111' },
  tab:            { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive:      { borderBottomWidth: 2, borderBottomColor: '#FF8C00' },
  tabText:        { fontFamily: 'monospace', fontSize: 11, color: '#333', letterSpacing: 2 },
  tabTextActive:  { color: '#FF8C00' },

  // Status
  statusBar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusText:     { fontFamily: 'monospace', fontSize: 10, color: '#444', letterSpacing: 1 },
  statusAdd:      { fontFamily: 'monospace', fontSize: 10, color: '#FF8C00', letterSpacing: 1 },

  // Notice
  notice:         { borderLeftWidth: 2, borderLeftColor: '#2a1500', paddingLeft: 10, paddingVertical: 6 },
  noticeText:     { fontFamily: 'monospace', fontSize: 10, color: '#444', lineHeight: 16 },

  // Prediction card
  card:           { borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 2, padding: 14, gap: 10 },
  cardTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel:      { fontFamily: 'monospace', fontSize: 11, color: '#FF8C00', letterSpacing: 3 },
  cardDrawTime:   { fontFamily: 'monospace', fontSize: 10, color: '#333', letterSpacing: 1 },
  cardEmpty:      { fontFamily: 'monospace', fontSize: 11, color: '#2a2a2a', textAlign: 'center', paddingVertical: 20, letterSpacing: 1 },

  // Digits
  digitRow:       { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  digitBox:       { borderWidth: 1, borderRadius: 2, alignItems: 'center', justifyContent: 'center', width: 38, height: 38 },
  digitBoxLarge:  { width: 64, height: 64 },
  digitText:      { fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold' },
  digitTextLarge: { fontSize: 32, letterSpacing: 2 },

  // Confidence
  confRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confBar:        { flex: 1, flexDirection: 'row', gap: 2 },
  confCell:       { flex: 1, height: 4, borderRadius: 1, backgroundColor: '#1a1a1a' },
  confPct:        { fontFamily: 'monospace', fontSize: 11, letterSpacing: 1, minWidth: 36, textAlign: 'right' },

  // Meta
  metaRow:        { flexDirection: 'row', gap: 8 },
  metaText:       { fontFamily: 'monospace', fontSize: 10, color: '#555', letterSpacing: 1 },
  metaSep:        { fontFamily: 'monospace', fontSize: 10, color: '#2a2a2a' },

  // Alt button
  altBtn:         { borderWidth: 1, borderColor: '#2a2a2a', padding: 8, borderRadius: 2, alignItems: 'center' },
  altBtnText:     { fontFamily: 'monospace', fontSize: 10, color: '#555', letterSpacing: 1 },

  // Method breakdown
  breakdown:      { gap: 8 },
  sectionLabel:   { fontFamily: 'monospace', fontSize: 10, color: '#333', letterSpacing: 2, marginBottom: 4 },
  bRow:           { gap: 4 },
  bLabel:         { fontFamily: 'monospace', fontSize: 10, color: '#555', letterSpacing: 1 },
  bBarOuter:      { height: 3, backgroundColor: '#0d0d0d', borderRadius: 1 },
  bBarFill:       { height: 3, backgroundColor: '#FF8C00', borderRadius: 1 },
  bUnit:          { fontFamily: 'monospace', fontSize: 9, color: '#2a2a2a', letterSpacing: 1 },

  // Generate button
  genBtn:         { borderWidth: 1, borderColor: '#FF8C00', padding: 16, borderRadius: 2, alignItems: 'center', marginTop: 4 },
  genBtnLoading:  { borderColor: '#2a1500' },
  genBtnText:     { fontFamily: 'monospace', fontSize: 14, color: '#FF8C00', letterSpacing: 2 },

  // Empty state
  emptyState:     { borderWidth: 1, borderColor: '#0d0d0d', padding: 24, borderRadius: 2 },
  emptyStateText: { fontFamily: 'monospace', fontSize: 12, color: '#444', lineHeight: 20, textAlign: 'center', letterSpacing: 1 },

  // Data tab
  dataHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dataActions:    { flexDirection: 'row', gap: 8 },
  dataActionBtn:  { borderWidth: 1, borderColor: '#2a2a2a', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 2 },
  dataActionText: { fontFamily: 'monospace', fontSize: 10, color: '#555', letterSpacing: 2 },
  dataNote:       { fontFamily: 'monospace', fontSize: 10, color: '#2a2a2a', lineHeight: 16, fontStyle: 'italic' },
  drawRowHeader:  { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#111', paddingBottom: 6 },
  drawRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  drawRowAlt:     { backgroundColor: '#050505' },
  drawCell:       { fontFamily: 'monospace', fontSize: 11 },
  drawDateH:      { color: '#333', width: 48, letterSpacing: 1 },
  drawTypeH:      { color: '#333', width: 36, letterSpacing: 1 },
  drawNumH:       { color: '#333', flex: 1, letterSpacing: 1 },
  drawMetaH:      { color: '#333', width: 80, textAlign: 'right', letterSpacing: 1 },
  drawDate:       { color: '#555', width: 48 },
  drawType:       { width: 36, letterSpacing: 1, fontWeight: 'bold' },
  drawMeta:       { color: '#333', width: 80, textAlign: 'right' },

  // Add modal
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'flex-end' },
  modalBox:       { backgroundColor: '#030303', borderTopWidth: 1, borderTopColor: '#1a1a1a', padding: 20, gap: 12 },
  modalTitle:     { fontFamily: 'monospace', fontSize: 15, color: '#FF8C00', letterSpacing: 3 },
  modalSub:       { fontFamily: 'monospace', fontSize: 11, color: '#444', letterSpacing: 1 },
  inputLabel:     { fontFamily: 'monospace', fontSize: 10, color: '#444', letterSpacing: 2, marginTop: 4 },
  input:          { borderWidth: 1, borderColor: '#1a1a1a', padding: 10, borderRadius: 2, fontFamily: 'monospace', fontSize: 14, color: '#e0e0e0', backgroundColor: '#050505' },
  typeRow:        { flexDirection: 'row', gap: 8 },
  typeBtn:        { flex: 1, borderWidth: 1, borderColor: '#1a1a1a', padding: 10, borderRadius: 2, alignItems: 'center' },
  typeBtnActive:  { borderColor: '#FF8C00', backgroundColor: '#0d0700' },
  typeBtnText:    { fontFamily: 'monospace', fontSize: 10, color: '#333', letterSpacing: 1 },
  typeBtnTextActive: { color: '#FF8C00' },
  digitInputRow:  { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  digitInput:     { borderWidth: 1, borderColor: '#1a1a1a', width: 60, height: 60, borderRadius: 2, fontFamily: 'monospace', fontSize: 28, color: '#FF8C00', backgroundColor: '#050505' },
  saveBtn:        { borderWidth: 1, borderColor: '#FF8C00', padding: 14, borderRadius: 2, alignItems: 'center', backgroundColor: '#0d0700' },
  saveBtnText:    { fontFamily: 'monospace', fontSize: 13, color: '#FF8C00', letterSpacing: 2 },
  cancelBtn:      { padding: 12, alignItems: 'center' },
  cancelBtnText:  { fontFamily: 'monospace', fontSize: 11, color: '#333', letterSpacing: 2 },
});
