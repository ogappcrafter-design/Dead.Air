import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Modal, Alert,
  KeyboardAvoidingView, Platform, Animated, Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generatePredictions, analyzeDigitStats, overallRec, rootSum, toVtrac } from './pick3Engine';

const STORAGE_KEY = 'ohio_pick3_draws_v2';

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  navy:      '#09194F',
  navyMid:   '#0E2070',
  royal:     '#1B4DB4',
  royalBt:   '#2255CC',
  red:       '#C41212',
  redDeep:   '#960E0E',
  gold:      '#F5C518',
  goldDark:  '#C89800',
  white:     '#FFFFFF',
  offWhite:  '#EEF2FF',
  darkText:  '#07102B',
  dimText:   '#8A9CC4',
  green:     '#00C853',
  orange:    '#E88000',
  danger:    '#E83030',
};

const REC_COLOR = {
  good:    C.green,
  ok:      C.orange,
  caution: '#DD8800',
  bad:     C.danger,
};

// ── Seed data (Ohio Pick 3 May–Jun 2026 reported draws) ──────────────────────
const SEED_DRAWS = [
  { date: '2026-05-28', type: 'midday',  digits: [2,7,0] },
  { date: '2026-05-28', type: 'evening', digits: [3,2,2] },
  { date: '2026-05-29', type: 'midday',  digits: [7,3,2] },
  { date: '2026-05-29', type: 'evening', digits: [1,1,5] },
  { date: '2026-05-30', type: 'midday',  digits: [1,0,6] },
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

function today() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) { const [,m,d] = iso.split('-'); return `${m}/${d}`; }

// ── Floating star ─────────────────────────────────────────────────────────────
const STAR_CONFIGS = [
  { x: 18,  y: 95,  sz: 14, drift: 14, ms: 3200, delay: 0    },
  { x: 85,  y: 48,  sz: 10, drift:  8, ms: 2800, delay: 500  },
  { x: 175, y: 72,  sz: 12, drift: 11, ms: 3600, delay: 200  },
  { x: 285, y: 55,  sz: 15, drift: 16, ms: 3000, delay: 100  },
  { x: 335, y: 110, sz: 10, drift:  9, ms: 2600, delay: 700  },
  { x: 42,  y: 145, sz: 11, drift: 10, ms: 3400, delay: 350  },
  { x: 300, y: 160, sz: 13, drift: 12, ms: 2900, delay: 600  },
  { x: 240, y: 130, sz:  9, drift:  7, ms: 3100, delay: 900  },
];

const INTRO_STAR_CONFIGS = [
  ...STAR_CONFIGS,
  { x: 55,  y: 560, sz: 13, drift: 12, ms: 3100, delay: 250  },
  { x: 310, y: 540, sz: 15, drift: 14, ms: 2700, delay: 450  },
  { x: 190, y: 620, sz: 10, drift:  8, ms: 3300, delay: 800  },
  { x: 90,  y: 670, sz: 12, drift: 10, ms: 3500, delay: 150  },
];

function FloatingStar({ x, y, sz, drift, ms, delay, opacity = 0.85 }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1,  duration: ms,      easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: -1, duration: ms,      easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0,  duration: ms / 2,  easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateX = anim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-drift, 0, drift] });

  return (
    <Animated.Text style={{ position: 'absolute', left: x, top: y, fontSize: sz, color: C.gold, opacity, transform: [{ translateX }] }}>
      ★
    </Animated.Text>
  );
}

// ── Intro splash screen ───────────────────────────────────────────────────────
function IntroScreen({ onEnter }) {
  const logoScale   = useRef(new Animated.Value(0.78)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const btnOpacity  = useRef(new Animated.Value(0)).current;
  const shimmer     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale,   { toValue: 1, friction: 5, tension: 38, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.timing(btnOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, 1100);

    // Gold shimmer loop on the PICK 3 text
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();

    const timer = setTimeout(onEnter, 4000);
    return () => clearTimeout(timer);
  }, []);

  const pick3Scale = shimmer.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <TouchableOpacity style={s.introScreen} activeOpacity={1} onPress={onEnter}>
      {/* Background stars */}
      {INTRO_STAR_CONFIGS.map((cfg, i) => <FloatingStar key={i} {...cfg} />)}

      <Animated.View style={[s.introBadge, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        {/* Red header band */}
        <View style={s.introRedBand}>
          <Text style={s.introRedBandText}>  ★  OHIO  LOTTERY  ★  </Text>
        </View>

        {/* Gold divider */}
        <View style={s.introGoldBar} />

        {/* Main logo body */}
        <View style={s.introBadgeBody}>
          <Animated.Text style={[s.introPick3, { transform: [{ scale: pick3Scale }] }]}>
            PICK 3
          </Animated.Text>
          <Text style={s.introPredictor}>P · R · E · D · I · C · T · O · R</Text>

          <View style={s.introGoldBar2} />

          <Text style={s.introTagline}>SIGNAL-BASED NUMBER ANALYSIS</Text>
        </View>

        {/* Bottom accent */}
        <View style={s.introRedBand}>
          <Text style={s.introRedBandText}>  6 METHODS · 1000 COMBINATIONS  </Text>
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: btnOpacity, width: '80%' }}>
        <TouchableOpacity style={s.introBtn} onPress={onEnter}>
          <Text style={s.introBtnText}>★  ANALYZE NUMBERS  ★</Text>
        </TouchableOpacity>
        <Text style={s.introSkip}>TAP ANYWHERE TO ENTER</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Slot machine digit box ────────────────────────────────────────────────────
function SlotDigit({ finalDigit, rolling, stopDelayMs }) {
  const [cur, setCur]       = useState(0);
  const [locked, setLocked] = useState(true);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (rolling) {
      setLocked(false);
      let frame = 0;
      const iv = setInterval(() => {
        setCur(d => (d + 1) % 10);
        frame++;
      }, 65);
      return () => clearInterval(iv);
    }
    // rolling stopped → wait stopDelayMs then lock
    const t = setTimeout(() => {
      setCur(finalDigit);
      setLocked(true);
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.22, duration: 80,  useNativeDriver: true }),
        Animated.spring(scale,  { toValue: 1,    friction: 4,   useNativeDriver: true }),
      ]).start();
    }, stopDelayMs);
    return () => clearTimeout(t);
  }, [rolling, finalDigit, stopDelayMs]);

  return (
    <Animated.View style={[s.slotBox, locked && s.slotBoxLocked, { transform: [{ scale }] }]}>
      <Text style={[s.slotDigit, locked && s.slotDigitLocked]}>{cur}</Text>
    </Animated.View>
  );
}

// ── Animated confidence bar ───────────────────────────────────────────────────
function ConfBar({ pct, color }) {
  const widthPct = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthPct, {
      toValue: pct,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const w = widthPct.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={s.confOuter}>
      <View style={s.confTrack}>
        <Animated.View style={[s.confFill, { width: w, backgroundColor: color }]} />
      </View>
      <Text style={[s.confPct, { color }]}>{pct}%</Text>
    </View>
  );
}

// ── Per-digit stat panel ──────────────────────────────────────────────────────
function StatPanel({ stat, isAlt }) {
  if (!stat) return null;
  const barColor = REC_COLOR[stat.level] || C.orange;
  return (
    <View style={s.statPanel}>
      <View style={s.statTopRow}>
        <Text style={[s.statLabel, { color: barColor }]}>{stat.label}</Text>
        <Text style={s.statPct}>{stat.sig}% SIGNAL</Text>
      </View>
      <View style={s.statBarTrack}>
        <View style={[s.statBarFill, { width: `${stat.sig}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={s.statReason} numberOfLines={2}>{stat.reason}</Text>
      <View style={[s.recBadge, { borderColor: barColor }]}>
        <Text style={[s.recBadgeText, { color: barColor }]}>{stat.rec}</Text>
      </View>
    </View>
  );
}

// ── Prediction card ───────────────────────────────────────────────────────────
function PredCard({ label, drawTime, result, rolling, altMode, onToggleAlt }) {
  const displayed    = altMode ? result?.alt : result?.primary;
  const displayStats = altMode ? result?.altDigitStats : result?.digitStats;
  const play         = displayed ? overallRec(analyzeDigitStats(
    [], // empty — use cached stats
    displayed.digits, 30
  )) : null;
  const cachedPlay   = altMode ? overallRec(result?.altDigitStats || []) : result?.overallPlay;
  const rs           = displayed ? rootSum(displayed.digits) : null;
  const vtStr        = displayed ? displayed.digits.map(d => `V${toVtrac(d)}`).join('-') : null;
  const playColor    = cachedPlay ? (REC_COLOR[cachedPlay.level] || C.orange) : C.orange;
  const confColor    = result ? (result.confidence >= 70 ? C.green : result.confidence >= 50 ? C.orange : C.danger) : C.gold;

  return (
    <View style={s.card}>
      {/* Red header banner */}
      <View style={s.cardBanner}>
        <Text style={s.cardBannerLabel}>{label}</Text>
        <Text style={s.cardBannerTime}>{drawTime}</Text>
      </View>

      {!result ? (
        <View style={s.cardEmpty}>
          <Text style={s.cardEmptyText}>ADD MORE DRAWS TO UNLOCK</Text>
          <Text style={s.cardEmptySub}>Need at least 5 draws of each type</Text>
        </View>
      ) : (
        <View style={s.cardBody}>
          {/* Digit row */}
          <View style={s.digitRow}>
            {(displayed?.digits || [0,0,0]).map((d, i) => (
              <View key={i} style={s.digitCol}>
                <Text style={s.posLabel}>POS {i+1}</Text>
                <SlotDigit finalDigit={d} rolling={rolling} stopDelayMs={i * 220} />
                {displayStats && <Text style={s.sigPct}>{displayStats[i]?.sig ?? '--'}%</Text>}
              </View>
            ))}
          </View>

          {/* Confidence bar */}
          <View style={s.confSection}>
            <Text style={s.confLabel}>AI CONFIDENCE</Text>
            <ConfBar pct={result.confidence} color={confColor} />
          </View>

          {/* Meta row */}
          {rs !== null && (
            <View style={s.metaRow}>
              <View style={s.metaChip}><Text style={s.metaChipText}>ROOT SUM {rs}</Text></View>
              <View style={s.metaChip}><Text style={s.metaChipText}>{vtStr}</Text></View>
              <View style={s.metaChip}><Text style={s.metaChipText}>SUM {displayed.digits.reduce((a,b)=>a+b,0)}</Text></View>
            </View>
          )}

          {/* Per-digit analysis */}
          {displayStats && (
            <View style={s.statsRow}>
              {displayStats.map((stat, i) => <StatPanel key={i} stat={stat} />)}
            </View>
          )}

          {/* Overall recommendation */}
          {cachedPlay && (
            <View style={[s.overallRec, { borderColor: playColor, backgroundColor: playColor + '18' }]}>
              <Text style={[s.overallRecText, { color: playColor }]}>
                {cachedPlay.level === 'good' ? '★' : cachedPlay.level === 'bad' ? '⚠' : '◇'}  {cachedPlay.text}
              </Text>
            </View>
          )}

          {/* Alt toggle */}
          {result.alt && (
            <TouchableOpacity style={s.altBtn} onPress={onToggleAlt}>
              <Text style={s.altBtnText}>
                {altMode
                  ? '← BACK TO PRIMARY'
                  : `ALT PICK → ${result.alt.digits.join('-')}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ── Method breakdown ──────────────────────────────────────────────────────────
function MethodBreakdown({ methods }) {
  if (!methods) return null;
  const rows = [
    { label: 'HOT DIGITS',   pct: Math.round(methods.hotDigits / 3 * 100),                             note: `${methods.hotDigits}/3 positions matched`              },
    { label: 'ROOT SUM',     pct: methods.rootSum.rank < 9 ? Math.round((9-methods.rootSum.rank)/9*100) : 5, note: `Root ${methods.rootSum.value} — rank #${methods.rootSum.rank+1} overdue` },
    { label: 'V-TRACS',      pct: methods.vtrac ? 100 : 0,                                             note: methods.vtrac ? `${methods.vtracPat} top pattern` : 'no pattern match' },
    { label: 'PAIRS',        pct: Math.round(methods.pairs / 3 * 100),                                  note: `${methods.pairs}/3 pairs hot`                          },
    { label: 'RUNDOWN +1',   pct: methods.rundown >= 0 ? Math.max(10, 100 - methods.rundown*10) : 0,   note: methods.rundown >= 0 ? `step ${methods.rundown+1}` : 'not in rundown' },
    { label: 'OVERDUE POS',  pct: Math.round(methods.overdue / 3 * 100),                               note: `${methods.overdue}/3 positions overdue`                },
  ];
  return (
    <View style={s.breakdown}>
      <View style={s.sectionHeader}>
        <View style={s.sectionLine} />
        <Text style={s.sectionTitle}>METHOD BREAKDOWN</Text>
        <View style={s.sectionLine} />
      </View>
      {rows.map(({ label, pct, note }) => (
        <View key={label} style={s.bRow}>
          <Text style={s.bLabel}>{label}</Text>
          <View style={s.bTrack}>
            <View style={[s.bFill, { width: `${pct}%` }]} />
          </View>
          <Text style={s.bNote}>{note}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Add draw modal ────────────────────────────────────────────────────────────
function AddDrawModal({ visible, onClose, onSave }) {
  const [drawDate, setDrawDate] = useState(today());
  const [drawType, setDrawType] = useState('midday');
  const [d0, setD0] = useState('');
  const [d1, setD1] = useState('');
  const [d2, setD2] = useState('');

  const reset = () => { setDrawDate(today()); setDrawType('midday'); setD0(''); setD1(''); setD2(''); };

  const save = () => {
    const digits = [d0, d1, d2].map(Number);
    if ([d0,d1,d2].some(v => v === '') || digits.some(d => isNaN(d) || d < 0 || d > 9)) {
      Alert.alert('Invalid Entry', 'Enter 3 single digits (0–9).');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(drawDate)) {
      Alert.alert('Invalid Date', 'Format must be YYYY-MM-DD.');
      return;
    }
    onSave({ date: drawDate, type: drawType, digits });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.modalBox}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>ADD DRAW RESULT</Text>
          </View>
          <View style={s.modalBody}>
            <Text style={s.modalLabel}>DATE (YYYY-MM-DD)</Text>
            <TextInput style={s.modalInput} value={drawDate} onChangeText={setDrawDate}
              placeholder="2026-06-26" placeholderTextColor={C.dimText} keyboardType="numeric" />

            <Text style={s.modalLabel}>DRAW TIME</Text>
            <View style={s.typeRow}>
              {['midday','evening'].map(t => (
                <TouchableOpacity key={t} style={[s.typeBtn, drawType===t && s.typeBtnOn]} onPress={() => setDrawType(t)}>
                  <Text style={[s.typeTxt, drawType===t && s.typeTxtOn]}>
                    {t === 'midday' ? '☀  MIDDAY  12:29 PM' : '🌙  EVENING  7:29 PM'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.modalLabel}>WINNING NUMBER</Text>
            <View style={s.digitInputRow}>
              {[[d0,setD0],[d1,setD1],[d2,setD2]].map(([v,set],i) => (
                <TextInput key={i} style={s.digitInput} value={v}
                  onChangeText={t => set(t.replace(/\D/g,'').slice(0,1))}
                  keyboardType="numeric" maxLength={1} placeholder="·"
                  placeholderTextColor={C.dimText} textAlign="center" />
              ))}
            </View>

            <TouchableOpacity style={s.saveBtn} onPress={save}>
              <Text style={s.saveBtnText}>★  SAVE RESULT  ★</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { reset(); onClose(); }}>
              <Text style={s.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function Pick3Screen({ onClose }) {
  const [draws,       setDraws]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showIntro,   setShowIntro]   = useState(true);
  const [tab,         setTab]         = useState('predict');
  const [seed,        setSeed]        = useState(1);
  const [rolling,     setRolling]     = useState(false);
  const [midResult,   setMidResult]   = useState(null);
  const [eveResult,   setEveResult]   = useState(null);
  const [altMid,      setAltMid]      = useState(false);
  const [altEve,      setAltEve]      = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);
  const [hasGenerated,setHasGenerated]= useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        setDraws(raw ? JSON.parse(raw) : SEED_DRAWS);
        if (!raw) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DRAWS));
      } catch (_) { setDraws(SEED_DRAWS); }
      setLoading(false);
    })();
  }, []);

  const persistDraws = useCallback(async (updated) => {
    const sorted = [...updated].sort((a,b) => {
      const c = a.date.localeCompare(b.date);
      return c !== 0 ? c : (a.type === 'midday' ? -1 : 1);
    });
    setDraws(sorted);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sorted)); } catch (_) {}
    return sorted;
  }, []);

  const runPredictions = useCallback((allDraws, s) => {
    const midDraws = allDraws.filter(d => d.type === 'midday');
    const eveDraws = allDraws.filter(d => d.type === 'evening');
    setRolling(true);
    setAltMid(false);
    setAltEve(false);

    setTimeout(() => {
      setMidResult(generatePredictions(midDraws, s));
      setEveResult(generatePredictions(eveDraws, s + 9999));
      setHasGenerated(true);
      // Give slot machine a moment to spin, then release
      setTimeout(() => setRolling(false), 200);
    }, 450);
  }, []);

  const handleGenerate = useCallback(() => {
    const s = seed;
    setSeed(x => x + 1);
    runPredictions(draws, s);
  }, [draws, seed, runPredictions]);

  const handleAddSave = useCallback(async (draw) => {
    const updated = await persistDraws([...draws, draw]);
    if (hasGenerated) runPredictions(updated, seed);
  }, [draws, persistDraws, hasGenerated, runPredictions, seed]);

  const handleReset = () => {
    Alert.alert('Reset Draw History', 'Reload the built-in seed dataset? Your added results will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => {
        await persistDraws(SEED_DRAWS);
        setMidResult(null); setEveResult(null);
        setHasGenerated(false); setSeed(1);
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={[s.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={C.gold} size="large" />
      </View>
    );
  }

  if (showIntro) {
    return <IntroScreen onEnter={() => setShowIntro(false)} />;
  }

  const midDraws    = draws.filter(d => d.type === 'midday');
  const eveDraws    = draws.filter(d => d.type === 'evening');
  const recentDraws = [...draws].reverse().slice(0, 40);

  return (
    <View style={s.screen}>
      {/* Floating stars in header area */}
      <View style={s.starLayer} pointerEvents="none">
        {STAR_CONFIGS.map((cfg, i) => <FloatingStar key={i} {...cfg} opacity={0.55} />)}
      </View>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>OHIO LOTTERY</Text>
          <Text style={s.headerSub}>PICK 3 PREDICTOR</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={s.closeBtn}>
          <Text style={s.closeBtnText}>✕  CLOSE</Text>
        </TouchableOpacity>
      </View>

      {/* Gold divider */}
      <View style={s.goldDivider} />

      {/* Tabs */}
      <View style={s.tabs}>
        {[['predict','PREDICT'],['data',`DATA (${draws.length})`]].map(([key, lbl]) => (
          <TouchableOpacity key={key} style={[s.tab, tab===key && s.tabActive]} onPress={() => setTab(key)}>
            <Text style={[s.tabText, tab===key && s.tabTextActive]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'predict' ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scrollContent}>

          {/* Status */}
          <View style={s.statusRow}>
            <Text style={s.statusTxt}>
              {`${midDraws.length} MIDDAY · ${eveDraws.length} EVENING DRAWS LOADED`}
            </Text>
            <TouchableOpacity onPress={() => setShowAdd(true)}>
              <Text style={s.statusAdd}>+ ADD</Text>
            </TouchableOpacity>
          </View>

          {/* Notice */}
          <View style={s.notice}>
            <Text style={s.noticeTxt}>
              {'★ Seed data loaded — verify at ohiolottery.com\n  Use + ADD to enter confirmed results for best accuracy.'}
            </Text>
          </View>

          {/* Prediction cards */}
          {hasGenerated ? (
            <>
              <PredCard label="MIDDAY SIGNAL" drawTime="12:29 PM ET"
                result={midResult} rolling={rolling}
                altMode={altMid} onToggleAlt={() => setAltMid(x => !x)} />

              <PredCard label="EVENING SIGNAL" drawTime="7:29 PM ET"
                result={eveResult} rolling={rolling}
                altMode={altEve} onToggleAlt={() => setAltEve(x => !x)} />

              <MethodBreakdown methods={altMid ? null : midResult?.methods} />
            </>
          ) : (
            <View style={s.emptyBox}>
              <Text style={s.emptyTitle}>★  PICK 3 SIGNAL DECODER  ★</Text>
              <Text style={s.emptyBody}>
                {'Press GENERATE to run all 6 prediction methods across\nthe last 30 draws and receive your best bets for the\nnext Midday and Evening drawings.\n\n• Hot/Cold digit frequency per position\n• Root sum overdue analysis\n• V-Trac group pattern matching\n• Top pairs frequency tracking\n• +1 Rundown from last draw\n• Positional overdue digit scoring'}
              </Text>
            </View>
          )}

          {/* Generate button */}
          <TouchableOpacity style={[s.genBtn, rolling && s.genBtnActive]} onPress={handleGenerate} disabled={rolling}>
            {rolling
              ? <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <ActivityIndicator color={C.white} size="small" />
                  <Text style={s.genBtnText}>ANALYZING SIGNALS...</Text>
                </View>
              : <Text style={s.genBtnText}>
                  {hasGenerated ? '★  REGENERATE SIGNAL  ★' : '★  GENERATE PREDICTION  ★'}
                </Text>
            }
          </TouchableOpacity>
        </ScrollView>

      ) : (
        /* DATA TAB */
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scrollContent}>
          <View style={s.dataToolbar}>
            <Text style={s.sectionTitle}>DRAW HISTORY</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={s.toolBtn} onPress={() => setShowAdd(true)}>
                <Text style={s.toolBtnTxt}>+ ADD</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.toolBtn, s.toolBtnRed]} onPress={handleReset}>
                <Text style={[s.toolBtnTxt, { color: C.red }]}>RESET</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={s.dataNote}>
            Verify at ohiolottery.com · Saturday has no evening draw in Ohio
          </Text>

          {/* Table header */}
          <View style={s.tblHeader}>
            <Text style={[s.tblCell, s.tblDateH]}>DATE</Text>
            <Text style={[s.tblCell, s.tblTypeH]}>DRAW</Text>
            <Text style={[s.tblCell, s.tblNumH]}>RESULT</Text>
            <Text style={[s.tblCell, s.tblMetaH]}>RS · V-TRAC</Text>
          </View>

          {recentDraws.map((d, i) => {
            const rs  = rootSum(d.digits);
            const vt  = d.digits.map(x => `V${toVtrac(x)}`).join('');
            const mid = d.type === 'midday';
            return (
              <View key={i} style={[s.tblRow, i%2===0 && s.tblRowAlt]}>
                <Text style={[s.tblCell, s.tblDate]}>{fmtDate(d.date)}</Text>
                <View style={[s.typeTag, { backgroundColor: mid ? C.red : C.royal }]}>
                  <Text style={s.typeTagTxt}>{mid ? 'MID' : 'EVE'}</Text>
                </View>
                <View style={[s.tblCell, { flexDirection: 'row', gap: 4, alignItems: 'center' }]}>
                  {d.digits.map((n, j) => (
                    <View key={j} style={[s.miniBox, { borderColor: mid ? C.gold : C.royalBt }]}>
                      <Text style={[s.miniDigit, { color: mid ? C.darkText : C.darkText }]}>{n}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[s.tblCell, s.tblMeta]}>{`${rs} · ${vt}`}</Text>
              </View>
            );
          })}

          {draws.length > 40 && (
            <Text style={[s.dataNote, { textAlign: 'center', marginTop: 8 }]}>
              {`+ ${draws.length - 40} older draws stored`}
            </Text>
          )}
        </ScrollView>
      )}

      <AddDrawModal visible={showAdd} onClose={() => setShowAdd(false)} onSave={handleAddSave} />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.navy },

  // Star layer
  starLayer: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, zIndex: 0 },

  // ── Intro ──
  introScreen:    { flex: 1, backgroundColor: C.navyMid, alignItems: 'center', justifyContent: 'center', gap: 32 },
  introBadge:     { width: '88%', borderWidth: 4, borderColor: C.gold, borderRadius: 4, overflow: 'hidden', shadowColor: C.gold, shadowOpacity: 0.5, shadowRadius: 20 },
  introRedBand:   { backgroundColor: C.red, paddingVertical: 10, alignItems: 'center' },
  introRedBandText:{ fontFamily: 'monospace', fontSize: 13, color: C.white, letterSpacing: 3, fontWeight: 'bold' },
  introGoldBar:   { height: 4, backgroundColor: C.gold },
  introGoldBar2:  { height: 2, backgroundColor: C.gold, marginVertical: 12, marginHorizontal: 20 },
  introBadgeBody: { backgroundColor: C.navy, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 8 },
  introPick3:     { fontFamily: 'monospace', fontSize: 62, color: C.gold, fontWeight: 'bold', letterSpacing: 8 },
  introPredictor: { fontFamily: 'monospace', fontSize: 13, color: C.white, letterSpacing: 6 },
  introTagline:   { fontFamily: 'monospace', fontSize: 10, color: C.dimText, letterSpacing: 3 },
  introBtn:       { backgroundColor: C.red, borderWidth: 3, borderColor: C.gold, paddingVertical: 16, borderRadius: 4, alignItems: 'center' },
  introBtnText:   { fontFamily: 'monospace', fontSize: 15, color: C.white, fontWeight: 'bold', letterSpacing: 3 },
  introSkip:      { fontFamily: 'monospace', fontSize: 10, color: C.dimText, textAlign: 'center', marginTop: 10, letterSpacing: 2 },

  // ── Main header ──
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: C.navyMid, zIndex: 1 },
  headerTitle:   { fontFamily: 'monospace', fontSize: 18, color: C.white, fontWeight: 'bold', letterSpacing: 4 },
  headerSub:     { fontFamily: 'monospace', fontSize: 10, color: C.gold, letterSpacing: 4, marginTop: 2 },
  closeBtn:      { borderWidth: 1, borderColor: C.gold, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 2 },
  closeBtnText:  { fontFamily: 'monospace', fontSize: 11, color: C.gold, letterSpacing: 2 },
  goldDivider:   { height: 3, backgroundColor: C.gold },

  // ── Tabs ──
  tabs:          { flexDirection: 'row', backgroundColor: C.navyMid },
  tab:           { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive:     { borderBottomColor: C.gold },
  tabText:       { fontFamily: 'monospace', fontSize: 11, color: C.dimText, letterSpacing: 2 },
  tabTextActive: { color: C.gold },

  scrollContent: { padding: 14, gap: 14, paddingBottom: 40 },

  // ── Status / notice ──
  statusRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusTxt:  { fontFamily: 'monospace', fontSize: 10, color: C.dimText, letterSpacing: 1 },
  statusAdd:  { fontFamily: 'monospace', fontSize: 10, color: C.gold, letterSpacing: 2, fontWeight: 'bold' },
  notice:     { borderLeftWidth: 3, borderLeftColor: C.gold, paddingLeft: 10, paddingVertical: 6 },
  noticeTxt:  { fontFamily: 'monospace', fontSize: 10, color: C.dimText, lineHeight: 17 },

  // ── Prediction card ──
  card:            { borderWidth: 3, borderColor: C.gold, borderRadius: 4, overflow: 'hidden', shadowColor: C.gold, shadowOpacity: 0.3, shadowRadius: 12 },
  cardBanner:      { backgroundColor: C.red, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  cardBannerLabel: { fontFamily: 'monospace', fontSize: 13, color: C.white, fontWeight: 'bold', letterSpacing: 3 },
  cardBannerTime:  { fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: 2 },
  cardBody:        { backgroundColor: C.white, padding: 14, gap: 12 },
  cardEmpty:       { backgroundColor: C.white, padding: 30, alignItems: 'center', gap: 6 },
  cardEmptyText:   { fontFamily: 'monospace', fontSize: 13, color: C.dimText, letterSpacing: 2 },
  cardEmptySub:    { fontFamily: 'monospace', fontSize: 10, color: '#aaa', letterSpacing: 1 },

  // ── Slot machine digit ──
  digitRow:      { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  digitCol:      { alignItems: 'center', gap: 4 },
  posLabel:      { fontFamily: 'monospace', fontSize: 9, color: C.dimText, letterSpacing: 2 },
  slotBox:       { width: 72, height: 72, borderWidth: 3, borderColor: '#ccc', borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: C.offWhite },
  slotBoxLocked: { borderColor: C.gold, backgroundColor: C.white, shadowColor: C.gold, shadowOpacity: 0.4, shadowRadius: 8 },
  slotDigit:     { fontFamily: 'monospace', fontSize: 38, fontWeight: 'bold', color: '#aaa' },
  slotDigitLocked: { color: C.darkText },
  sigPct:        { fontFamily: 'monospace', fontSize: 11, color: C.royal, fontWeight: 'bold', letterSpacing: 1 },

  // ── Confidence bar ──
  confSection:   { gap: 5 },
  confLabel:     { fontFamily: 'monospace', fontSize: 9, color: C.dimText, letterSpacing: 3 },
  confOuter:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confTrack:     { flex: 1, height: 8, backgroundColor: '#E0E4EE', borderRadius: 4, overflow: 'hidden' },
  confFill:      { height: 8, borderRadius: 4 },
  confPct:       { fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', minWidth: 42, textAlign: 'right' },

  // ── Meta chips ──
  metaRow:       { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  metaChip:      { borderWidth: 1, borderColor: C.royal, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2 },
  metaChipText:  { fontFamily: 'monospace', fontSize: 10, color: C.royal, letterSpacing: 1 },

  // ── Per-digit stat panels ──
  statsRow:      { flexDirection: 'row', gap: 6 },
  statPanel:     { flex: 1, backgroundColor: C.offWhite, borderRadius: 3, padding: 7, gap: 4 },
  statTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel:     { fontFamily: 'monospace', fontSize: 9, fontWeight: 'bold', letterSpacing: 1 },
  statPct:       { fontFamily: 'monospace', fontSize: 9, color: C.darkText, fontWeight: 'bold' },
  statBarTrack:  { height: 4, backgroundColor: '#D0D8F0', borderRadius: 2, overflow: 'hidden' },
  statBarFill:   { height: 4, borderRadius: 2 },
  statReason:    { fontFamily: 'monospace', fontSize: 8, color: '#666', lineHeight: 12 },
  recBadge:      { borderWidth: 1, borderRadius: 2, paddingHorizontal: 4, paddingVertical: 2, alignItems: 'center' },
  recBadgeText:  { fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold', letterSpacing: 0.5 },

  // ── Overall recommendation ──
  overallRec:    { borderWidth: 2, borderRadius: 3, paddingVertical: 8, alignItems: 'center' },
  overallRecText:{ fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', letterSpacing: 2 },

  // ── Alt button ──
  altBtn:        { borderWidth: 1, borderColor: C.royal, paddingVertical: 8, borderRadius: 2, alignItems: 'center' },
  altBtnText:    { fontFamily: 'monospace', fontSize: 10, color: C.royal, letterSpacing: 2 },

  // ── Method breakdown ──
  breakdown:     { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLine:   { flex: 1, height: 1, backgroundColor: C.gold },
  sectionTitle:  { fontFamily: 'monospace', fontSize: 11, color: C.gold, letterSpacing: 3, fontWeight: 'bold' },
  bRow:          { gap: 3 },
  bLabel:        { fontFamily: 'monospace', fontSize: 10, color: C.dimText, letterSpacing: 1 },
  bTrack:        { height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  bFill:         { height: 5, backgroundColor: C.gold, borderRadius: 2 },
  bNote:         { fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 },

  // ── Generate button ──
  genBtn:        { backgroundColor: C.red, borderWidth: 3, borderColor: C.gold, paddingVertical: 16, borderRadius: 4, alignItems: 'center', shadowColor: C.gold, shadowOpacity: 0.4, shadowRadius: 10 },
  genBtnActive:  { backgroundColor: C.redDeep, borderColor: C.goldDark },
  genBtnText:    { fontFamily: 'monospace', fontSize: 15, color: C.white, fontWeight: 'bold', letterSpacing: 2 },

  // ── Empty state ──
  emptyBox:      { borderWidth: 2, borderColor: C.gold, borderRadius: 4, padding: 22, gap: 12, backgroundColor: 'rgba(255,255,255,0.04)' },
  emptyTitle:    { fontFamily: 'monospace', fontSize: 14, color: C.gold, fontWeight: 'bold', letterSpacing: 3, textAlign: 'center' },
  emptyBody:     { fontFamily: 'monospace', fontSize: 11, color: C.dimText, lineHeight: 19, letterSpacing: 0.5 },

  // ── Data tab ──
  dataToolbar:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dataNote:      { fontFamily: 'monospace', fontSize: 9, color: C.dimText, letterSpacing: 1, marginBottom: 8 },
  toolBtn:       { borderWidth: 1, borderColor: C.gold, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 2 },
  toolBtnRed:    { borderColor: C.red },
  toolBtnTxt:    { fontFamily: 'monospace', fontSize: 10, color: C.gold, letterSpacing: 2 },

  tblHeader:  { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: C.gold },
  tblRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  tblRowAlt:  { backgroundColor: 'rgba(255,255,255,0.03)' },
  tblCell:    { fontFamily: 'monospace', fontSize: 11 },
  tblDateH:   { color: C.gold, width: 46, letterSpacing: 1 },
  tblTypeH:   { color: C.gold, width: 48, letterSpacing: 1 },
  tblNumH:    { color: C.gold, flex: 1, letterSpacing: 1 },
  tblMetaH:   { color: C.gold, width: 82, textAlign: 'right', letterSpacing: 1 },
  tblDate:    { color: C.dimText, width: 46 },
  tblMeta:    { color: C.dimText, width: 82, textAlign: 'right', fontSize: 10 },
  typeTag:    { width: 36, paddingVertical: 2, borderRadius: 2, alignItems: 'center', marginRight: 8 },
  typeTagTxt: { fontFamily: 'monospace', fontSize: 9, color: C.white, fontWeight: 'bold', letterSpacing: 1 },
  miniBox:    { width: 26, height: 26, borderWidth: 2, borderRadius: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white },
  miniDigit:  { fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', color: C.darkText },

  // ── Modal ──
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: C.navy, borderTopWidth: 4, borderTopColor: C.gold, overflow: 'hidden' },
  modalHeader:   { backgroundColor: C.red, paddingVertical: 14, alignItems: 'center' },
  modalTitle:    { fontFamily: 'monospace', fontSize: 15, color: C.white, fontWeight: 'bold', letterSpacing: 4 },
  modalBody:     { padding: 18, gap: 10 },
  modalLabel:    { fontFamily: 'monospace', fontSize: 10, color: C.gold, letterSpacing: 3, marginTop: 4 },
  modalInput:    { borderWidth: 2, borderColor: C.gold, borderRadius: 2, padding: 10, fontFamily: 'monospace', fontSize: 14, color: C.white, backgroundColor: 'rgba(255,255,255,0.07)' },
  typeRow:       { flexDirection: 'row', gap: 8 },
  typeBtn:       { flex: 1, borderWidth: 2, borderColor: '#333', paddingVertical: 10, borderRadius: 2, alignItems: 'center' },
  typeBtnOn:     { borderColor: C.gold, backgroundColor: 'rgba(245,197,24,0.12)' },
  typeTxt:       { fontFamily: 'monospace', fontSize: 10, color: C.dimText, letterSpacing: 1 },
  typeTxtOn:     { color: C.gold },
  digitInputRow: { flexDirection: 'row', gap: 14, justifyContent: 'center' },
  digitInput:    { borderWidth: 3, borderColor: C.gold, width: 64, height: 64, borderRadius: 4, fontFamily: 'monospace', fontSize: 30, color: C.gold, fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.06)' },
  saveBtn:       { backgroundColor: C.red, borderWidth: 2, borderColor: C.gold, paddingVertical: 14, borderRadius: 4, alignItems: 'center', marginTop: 4 },
  saveBtnText:   { fontFamily: 'monospace', fontSize: 13, color: C.white, fontWeight: 'bold', letterSpacing: 2 },
  cancelBtn:     { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontFamily: 'monospace', fontSize: 11, color: C.dimText, letterSpacing: 2 },
});
