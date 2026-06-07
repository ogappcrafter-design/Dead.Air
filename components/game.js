import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CALLS, BANDS, ALL_TAPES, BAND_VIBES, SYM } from './calls';

async function generateAICall(band, recentNames) {
  const prompt = `You are writing a paranormal radio call for DEAD AIR RADIO, an atmospheric horror mobile game.
BAND: ${band.name}
VIBE: ${BAND_VIBES[band.id]}
RECENT CALLS TO AVOID: ${recentNames.join(", ")}
Generate ONE original call. Type: JUST_LISTEN, DEAD_AIR, RIGHT_ANSWER, SIGNAL_DECODE, or STAY_CALM.
Return ONLY raw JSON. No markdown. No backticks.
Base fields: { "callerName":"NAME", "callerId":"string", "signal":0-5, "type":"type", "lines":["..."], "staticReward":30-250, "sanityDelta":number }
DEAD_AIR: add "waitSeconds":8-18
STAY_CALM: add "duration":10-16, "sanityPenalty":15-25
RIGHT_ANSWER: add "choices":[3 objects with "text","outcome","sanityDelta","staticMult","tape":false]
SIGNAL_DECODE: add "intro":"string","sequence":[5 ints 0-4],"decodedMessage":"SHORT TEXT"`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const raw = data.content.filter(b => b.type === "text").map(b => b.text).join("");
  const clean = raw.replace(/```(?:json)?\n?|\n?```/g, "").trim();
  const p = JSON.parse(clean);
  const VALID = ["JUST_LISTEN", "DEAD_AIR", "RIGHT_ANSWER", "SIGNAL_DECODE", "STAY_CALM"];
  const call = {
    id: `gen_${Date.now()}`,
    band: band.id,
    generated: true,
    callerName: p.callerName || "UNKNOWN",
    callerId: p.callerId || "???-????",
    signal: Math.max(0, Math.min(5, parseInt(p.signal) || 2)),
    type: VALID.includes(p.type) ? p.type : "JUST_LISTEN",
    lines: Array.isArray(p.lines) ? p.lines : ["..."],
    staticReward: parseInt(p.staticReward) || 60,
    sanityDelta: parseInt(p.sanityDelta) || 0,
  };
  if (call.type === "DEAD_AIR") call.waitSeconds = parseInt(p.waitSeconds) || 10;
  if (call.type === "STAY_CALM") {
    call.duration = parseInt(p.duration) || 12;
    call.sanityPenalty = parseInt(p.sanityPenalty) || 18;
  }
  if (call.type === "RIGHT_ANSWER") {
    call.choices = Array.isArray(p.choices) && p.choices.length >= 3
      ? p.choices.slice(0, 3).map(c => ({
          text: c.text || "...",
          outcome: c.outcome || "The line goes dead.",
          sanityDelta: parseInt(c.sanityDelta) || 0,
          staticMult: parseFloat(c.staticMult) || 1,
          tape: false
        }))
      : [
          { text: "Understood.", outcome: "The line goes dead.", sanityDelta: -5, staticMult: 1, tape: false },
          { text: "No.", outcome: "Silence.", sanityDelta: 0, staticMult: 1, tape: false },
          { text: "Who is this?", outcome: "Click.", sanityDelta: -5, staticMult: 1.5, tape: false }
        ];
  }
  if (call.type === "SIGNAL_DECODE") {
    call.intro = p.intro || "Decode the incoming sequence.";
    call.sequence = Array.isArray(p.sequence) && p.sequence.length === 5
      ? p.sequence.map(n => Math.max(0, Math.min(4, parseInt(n) || 0)))
      : [0, 1, 2, 3, 4];
    call.decodedMessage = p.decodedMessage || "SIGNAL RECEIVED";
  }
  return call;
}

function Bars({ n, color }) {
  const c = color || "#39FF14";
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 20, gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={{
          width: 5, height: 4 + i * 3, borderRadius: 1,
          backgroundColor: i <= n ? c : '#1a1a1a'
        }} />
      ))}
    </View>
  );
}

function JustListen({ call, onComplete }) {
  const [idx, setIdx] = useState(0);
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (idx < call.lines.length - 1) {
      const t = setTimeout(() => setIdx(i => i + 1), 2400);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setGo(true), 1800);
      return () => clearTimeout(t);
    }
  }, [idx, call.lines.length]);
  const isSp = l => l.startsWith('"') || l.startsWith('\u201c');
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        {call.lines.slice(0, idx + 1).map((l, i) => (
          <Text key={i} style={[
            mg.line,
            l === '...' ? mg.dots : isSp(l) ? mg.speech : mg.narrate,
            { opacity: i < idx ? 0.85 : 1 }
          ]}>{l}</Text>
        ))}
      </ScrollView>
      {go && (
        <TouchableOpacity style={[g.btn, g.btnAmber, { marginTop: 12 }]}
          onPress={() => onComplete({ sanityDelta: call.sanityDelta || 0, staticMult: 1, tape: !!call.tape, tapeName: call.tapeName, outcome: null })}>
          <Text style={g.btnAmberText}>END CALL</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function DeadAir({ call, onComplete }) {
  const [li, setLi] = useState(0);
  const [cd, setCd] = useState(call.waitSeconds);
  const [rdy, setRdy] = useState(false);
  useEffect(() => {
    if (li < call.lines.length - 1) {
      const t = setTimeout(() => setLi(i => i + 1), 1500);
      return () => clearTimeout(t);
    }
  }, [li, call.lines.length]);
  useEffect(() => {
    if (cd <= 0) { setRdy(true); return; }
    const t = setTimeout(() => setCd(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cd]);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
        <Text style={mg.timer}>{cd > 0 ? `00:${String(cd).padStart(2, '0')}` : '─ ─ ─'}</Text>
        <Text style={mg.timerSub}>{cd > 0 ? 'HOLD THE LINE...' : 'SIGNAL RECEIVED'}</Text>
      </View>
      <ScrollView style={{ flex: 1 }}>
        {call.lines.slice(0, li + 1).map((l, i) => (
          <Text key={i} style={[mg.line, mg.narrate, { color: l === '...' ? '#2a2a2a' : '#555' }]}>{l}</Text>
        ))}
      </ScrollView>
      {rdy && (
        <TouchableOpacity style={[g.btn, g.btnAmber, { marginTop: 12 }]}
          onPress={() => onComplete({ sanityDelta: call.sanityDelta || 0, staticMult: 1, tape: !!call.tape, tapeName: call.tapeName, outcome: null })}>
          <Text style={g.btnAmberText}>CONTINUE</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function RightAnswer({ call, onComplete }) {
  const [ph, setPh] = useState('r');
  const [li, setLi] = useState(0);
  const [ch, setCh] = useState(null);
  useEffect(() => {
    if (ph !== 'r') return;
    if (li < call.lines.length - 1) {
      const t = setTimeout(() => setLi(i => i + 1), 1700);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setPh('c'), 1400);
      return () => clearTimeout(t);
    }
  }, [li, ph, call.lines.length]);
  const isSp = l => l.startsWith('"') || l.startsWith('\u201c');
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        {call.lines.slice(0, li + 1).map((l, i) => (
          <Text key={i} style={[mg.line, isSp(l) ? mg.speech : mg.narrate, { opacity: i < li ? 0.85 : 1 }]}>{l}</Text>
        ))}
      </ScrollView>
      {ph === 'c' && (
        <View style={{ marginTop: 12, gap: 8 }}>
          <Text style={mg.choiceLabel}>RESPOND ──────────────────</Text>
          {call.choices.map((c, i) => (
            <TouchableOpacity key={i} style={mg.choiceBtn} onPress={() => { setCh(c); setPh('o'); }}>
              <Text style={mg.choiceText}>{c.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {ph === 'o' && ch && (
        <View style={{ marginTop: 12, gap: 10 }}>
          <View style={mg.outcome}>
            <Text style={mg.outcomeText}>{ch.outcome}</Text>
          </View>
          <TouchableOpacity style={[g.btn, g.btnAmber]}
            onPress={() => onComplete({ sanityDelta: ch.sanityDelta || 0, staticMult: ch.staticMult || 1, tape: !!ch.tape, tapeName: ch.tapeName, outcome: ch.outcome })}>
            <Text style={g.btnAmberText}>END CALL</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function SignalDecode({ call, onComplete }) {
  const [prog, setProg] = useState(0);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(false);
  const t = call.sequence;
  const hit = si => {
    if (done) return;
    if (si === t[prog]) {
      const np = prog + 1;
      setProg(np);
      if (np === t.length) setDone(true);
    } else {
      setErr(si);
      setTimeout(() => setErr(null), 400);
    }
  };
  return (
    <View style={{ flex: 1 }}>
      {call.intro && <Text style={[mg.line, mg.narrate, { marginBottom: 12 }]}>{call.intro}</Text>}
      <View style={mg.seqRow}>
        {t.map((s, i) => (
          <View key={i} style={[mg.seqBox, i < prog && mg.seqDone, i === prog && mg.seqActive]}>
            <Text style={[mg.seqSym, { color: i < prog ? '#FF8C00' : i === prog ? '#fff' : '#2a2a2a' }]}>{SYM[s]}</Text>
          </View>
        ))}
      </View>
      <Text style={mg.seqLabel}>TAP THE SEQUENCE — {prog}/{t.length}</Text>
      <View style={mg.symGrid}>
        {SYM.map((s, i) => (
          <TouchableOpacity key={i} style={[mg.symBtn, err === i && mg.symErr]} onPress={() => hit(i)}>
            <Text style={mg.symText}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {done && (
        <View style={{ gap: 10, marginTop: 12 }}>
          <View style={mg.decoded}>
            <Text style={mg.decodedText}>{call.decodedMessage}</Text>
          </View>
          <TouchableOpacity style={[g.btn, g.btnAmber]}
            onPress={() => onComplete({ sanityDelta: call.sanityDelta || 0, staticMult: 1, tape: !!call.tape, tapeName: call.tapeName, outcome: `DECODED: "${call.decodedMessage}"` })}>
            <Text style={g.btnAmberText}>END CALL</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function StayCalm({ call, onComplete }) {
  const [pr, setPr] = useState(0);
  const [tl, setTl] = useState(call.duration);
  const [st, setSt] = useState('live');
  const pRef = useRef(0);
  const stRef = useRef('live');
  useEffect(() => {
    const iv = setInterval(() => {
      if (stRef.current !== 'live') return;
      const np = Math.min(100, pRef.current + (100 / (call.duration * 10)));
      pRef.current = np;
      setPr(np);
      if (np >= 100) { stRef.current = 'lost'; setSt('lost'); }
    }, 100);
    return () => clearInterval(iv);
  }, [call.duration]);
  useEffect(() => {
    if (st !== 'live') return;
    if (tl <= 0) { stRef.current = 'won'; setSt('won'); return; }
    const t = setTimeout(() => setTl(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [tl, st]);
  const breathe = () => {
    if (st !== 'live') return;
    const np = Math.max(0, pRef.current - 22);
    pRef.current = np;
    setPr(np);
  };
  const pc = pr < 40 ? '#39FF14' : pr < 70 ? '#FF8C00' : '#FF3366';
  return (
    <View style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
        <Text style={mg.timer}>{tl > 0 ? `00:${String(tl).padStart(2, '0')}` : '─ ─ ─'}</Text>
        <Text style={mg.timerSub}>{st === 'live' ? 'STAY CALM' : st === 'won' ? 'SIGNAL HELD' : 'SIGNAL LOST'}</Text>
      </View>
      <View style={mg.calmBar}>
        <View style={[mg.calmFill, { width: `${pr}%`, backgroundColor: pc }]} />
      </View>
      <Text style={[mg.timerSub, { marginBottom: 16 }]}>ANXIETY LEVEL</Text>
      {st === 'live' && (
        <TouchableOpacity style={[g.btn, { borderColor: '#39FF14', borderWidth: 1, marginBottom: 10 }]} onPress={breathe}>
          <Text style={[g.btnAmberText, { color: '#39FF14' }]}>◈ BREATHE</Text>
        </TouchableOpacity>
      )}
      {st === 'won' && (
        <TouchableOpacity style={[g.btn, g.btnAmber]} onPress={() => onComplete({ sanityDelta: call.sanityDelta || 0, staticMult: 1, tape: !!call.tape, tapeName: call.tapeName, outcome: 'You held your nerve.' })}>
          <Text style={g.btnAmberText}>END CALL</Text>
        </TouchableOpacity>
      )}
      {st === 'lost' && (
        <TouchableOpacity style={[g.btn, { borderColor: '#FF3366', borderWidth: 1 }]} onPress={() => onComplete({ sanityDelta: -(call.sanityPenalty || 18), staticMult: 0.5, tape: false, outcome: 'You lost control.' })}>
          <Text style={[g.btnAmberText, { color: '#FF3366' }]}>END CALL</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function Game({ saveData, purchases, onSave, onOpenStore, onPurchaseInfinite }) {
  const { sanity, bal, done, tapes, genCount } = saveData;
  const [activeBand, setActiveBand] = useState(0);
  const [activeCall, setActiveCall] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genErr, setGenErr] = useState(null);
  const [tab, setTab] = useState('calls');

  const unlockedBands = BANDS.filter(b => {
    if (b.unlockAt === 0) return true;
    if (b.id === 1 && purchases.baseUnlocked) return true;
    if (b.id === 2 && purchases.baseUnlocked) return true;
    if (b.id === 3 && purchases.baseUnlocked) return true;
    if (b.id === 4 && purchases.baseUnlocked) return true;
    return done.length >= b.unlockAt;
  });

  const bandCalls = CALLS.filter(c => c.band === activeBand && !done.includes(c.id));
  const canGenerate = purchases.infiniteUnlocked || genCount < 3;

  const startCall = (call) => setActiveCall(call);

  const handleComplete = async ({ sanityDelta, staticMult, tape, tapeName, outcome }) => {
    const reward = Math.round((activeCall.staticReward || 60) * staticMult);
    const newSanity = Math.max(0, Math.min(100, sanity + sanityDelta));
    const newBal = bal + reward;
    const newDone = [...done, activeCall.id];
    const newTapes = tape && tapeName && !tapes.includes(tapeName) ? [...tapes, tapeName] : tapes;
    const newGenCount = activeCall.generated ? genCount + 1 : genCount;
    setActiveCall(null);
    await onSave({ sanity: newSanity, bal: newBal, done: newDone, tapes: newTapes, genCount: newGenCount });
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setGenErr(null);
    try {
      const band = BANDS[activeBand];
      const recentNames = CALLS.filter(c => c.band === activeBand).map(c => c.callerName).slice(-5);
      const call = await generateAICall(band, recentNames);
      setActiveCall(call);
    } catch (e) {
      setGenErr('SIGNAL LOST. Try again.');
    }
    setGenerating(false);
  };

  const band = BANDS[activeBand];

  if (activeCall) {
    return (
      <View style={g.screen}>
        <View style={g.callHeader}>
          <View>
            <Text style={[g.callerId, { color: band.color }]}>{activeCall.callerId}</Text>
            <Text style={g.callerName}>{activeCall.callerName}</Text>
          </View>
          <Bars n={activeCall.signal} color={band.color} />
        </View>
        <View style={g.callBody}>
          {activeCall.type === 'JUST_LISTEN' && <JustListen call={activeCall} onComplete={handleComplete} />}
          {activeCall.type === 'DEAD_AIR' && <DeadAir call={activeCall} onComplete={handleComplete} />}
          {activeCall.type === 'RIGHT_ANSWER' && <RightAnswer call={activeCall} onComplete={handleComplete} />}
          {activeCall.type === 'SIGNAL_DECODE' && <SignalDecode call={activeCall} onComplete={handleComplete} />}
          {activeCall.type === 'STAY_CALM' && <StayCalm call={activeCall} onComplete={handleComplete} />}
        </View>
      </View>
    );
  }

  return (
    <View style={g.screen}>
      {/* Header */}
      <View style={g.header}>
        <Text style={g.logo}>◈ DEAD AIR</Text>
        <View style={g.headerRight}>
          <Text style={g.stat}><Text style={g.statVal}>{sanity}</Text> SAN</Text>
          <Text style={g.stat}><Text style={g.statVal}>{bal}</Text> ◈</Text>
          <TouchableOpacity onPress={onOpenStore} style={g.storeBtn}>
            <Text style={g.storeBtnText}>STORE</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Band selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={g.bandRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {BANDS.map(b => {
          const unlocked = unlockedBands.some(u => u.id === b.id);
          const active = b.id === activeBand;
          return (
            <TouchableOpacity key={b.id} style={[g.bandBtn, active && { borderColor: b.color }]}
              onPress={() => { if (unlocked) setActiveBand(b.id); }}>
              <Text style={[g.bandName, { color: unlocked ? b.color : '#333' }]}>{b.name}</Text>
              <Text style={[g.bandFreq, { color: unlocked ? '#555' : '#222' }]}>{b.freq}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Tabs */}
      <View style={g.tabs}>
        <TouchableOpacity style={[g.tab, tab === 'calls' && g.tabActive]} onPress={() => setTab('calls')}>
          <Text style={[g.tabText, tab === 'calls' && g.tabTextActive]}>CALLS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[g.tab, tab === 'tapes' && g.tabActive]} onPress={() => setTab('tapes')}>
          <Text style={[g.tabText, tab === 'tapes' && g.tabTextActive]}>TAPES ({tapes.length})</Text>
        </TouchableOpacity>
      </View>

      {tab === 'calls' ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
          {bandCalls.length === 0 && (
            <Text style={g.empty}>— ALL CALLS LOGGED FOR THIS BAND —</Text>
          )}
          {bandCalls.map(call => (
            <TouchableOpacity key={call.id} style={g.callCard} onPress={() => startCall(call)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[g.callCardId, { color: band.color }]}>{call.callerId}</Text>
                <Bars n={call.signal} color={band.color} />
              </View>
              <Text style={g.callCardName}>{call.callerName}</Text>
              <Text style={g.callCardType}>{call.type.replace('_', ' ')}</Text>
            </TouchableOpacity>
          ))}

          {/* AI Generate button */}
          <TouchableOpacity
            style={[g.genBtn, !canGenerate && g.genBtnDisabled, generating && g.genBtnLoading]}
            onPress={handleGenerate}
            disabled={generating || !canGenerate}>
            {generating
              ? <ActivityIndicator color="#FF8C00" />
              : <Text style={g.genBtnText}>{canGenerate ? `◈ GENERATE AI CALL${!purchases.infiniteUnlocked ? ` (${3 - genCount} left)` : ''}` : '◈ UNLOCK INFINITE IN STORE'}</Text>
            }
          </TouchableOpacity>
          {genErr && <Text style={g.genErr}>{genErr}</Text>}
        </ScrollView>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 8 }}>
          {tapes.length === 0 && <Text style={g.empty}>— NO TAPES COLLECTED YET —</Text>}
          {ALL_TAPES.map((t, i) => {
            const owned = tapes.includes(t);
            return (
              <View key={i} style={[g.tapeRow, !owned && g.tapeLocked]}>
                <Text style={[g.tapeName, { color: owned ? '#FF8C00' : '#2a2a2a' }]}>
                  {owned ? t : `Tape #${i + 1} — ████████████`}
                </Text>
                {owned && <Text style={g.tapeCheck}>◈</Text>}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/* ── Shared call-screen styles ── */
const mg = StyleSheet.create({
  line: { fontFamily: 'monospace', fontSize: 15, marginBottom: 10, lineHeight: 22 },
  narrate: { color: '#888', fontStyle: 'italic' },
  speech: { color: '#e0e0e0' },
  dots: { color: '#2a2a2a', letterSpacing: 8 },
  timer: { fontFamily: 'monospace', fontSize: 42, color: '#FF8C00', letterSpacing: 4 },
  timerSub: { fontFamily: 'monospace', fontSize: 11, color: '#444', letterSpacing: 3, marginTop: 4 },
  choiceLabel: { fontFamily: 'monospace', fontSize: 11, color: '#444', letterSpacing: 3, marginBottom: 4 },
  choiceBtn: { borderWidth: 1, borderColor: '#2a2a2a', padding: 12, borderRadius: 2 },
  choiceText: { fontFamily: 'monospace', fontSize: 14, color: '#ccc' },
  outcome: { borderLeftWidth: 2, borderLeftColor: '#FF8C00', paddingLeft: 12, paddingVertical: 6 },
  outcomeText: { fontFamily: 'monospace', fontSize: 13, color: '#aaa', fontStyle: 'italic', lineHeight: 20 },
  seqRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 10 },
  seqBox: { width: 44, height: 44, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  seqDone: { borderColor: '#FF8C00', backgroundColor: '#1a0e00' },
  seqActive: { borderColor: '#fff', backgroundColor: '#111' },
  seqSym: { fontSize: 22 },
  seqLabel: { fontFamily: 'monospace', fontSize: 11, color: '#444', textAlign: 'center', letterSpacing: 2, marginBottom: 16 },
  symGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  symBtn: { width: 60, height: 60, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  symErr: { borderColor: '#FF3366', backgroundColor: '#1a0005' },
  symText: { fontSize: 26, color: '#ccc' },
  decoded: { borderWidth: 1, borderColor: '#39FF14', padding: 12, borderRadius: 2, alignItems: 'center' },
  decodedText: { fontFamily: 'monospace', fontSize: 16, color: '#39FF14', letterSpacing: 4 },
  calmBar: { height: 6, backgroundColor: '#111', borderRadius: 3, marginHorizontal: 0, marginBottom: 6, overflow: 'hidden' },
  calmFill: { height: 6, borderRadius: 3 },
});

/* ── Global screen/navigation styles ── */
const g = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030303' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#111' },
  logo: { fontFamily: 'monospace', fontSize: 18, color: '#FF8C00', letterSpacing: 5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stat: { fontFamily: 'monospace', fontSize: 12, color: '#444' },
  statVal: { color: '#FF8C00' },
  storeBtn: { borderWidth: 1, borderColor: '#2a2a2a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 2 },
  storeBtnText: { fontFamily: 'monospace', fontSize: 11, color: '#555', letterSpacing: 2 },
  bandRow: { borderBottomWidth: 1, borderBottomColor: '#111', flexGrow: 0 },
  bandBtn: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  bandName: { fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 },
  bandFreq: { fontFamily: 'monospace', fontSize: 10 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#111' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#FF8C00' },
  tabText: { fontFamily: 'monospace', fontSize: 11, color: '#333', letterSpacing: 2 },
  tabTextActive: { color: '#FF8C00' },
  callCard: { borderWidth: 1, borderColor: '#1a1a1a', padding: 14, borderRadius: 2, gap: 4 },
  callCardId: { fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 },
  callCardName: { fontFamily: 'monospace', fontSize: 16, color: '#ccc' },
  callCardType: { fontFamily: 'monospace', fontSize: 10, color: '#333', letterSpacing: 2 },
  callHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: '#111' },
  callerId: { fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 },
  callerName: { fontFamily: 'monospace', fontSize: 18, color: '#e0e0e0' },
  callBody: { flex: 1, padding: 16 },
  genBtn: { borderWidth: 1, borderColor: '#FF8C00', padding: 14, borderRadius: 2, alignItems: 'center', marginTop: 8 },
  genBtnDisabled: { borderColor: '#1a1a1a' },
  genBtnLoading: { borderColor: '#2a1500' },
  genBtnText: { fontFamily: 'monospace', fontSize: 13, color: '#FF8C00', letterSpacing: 1 },
  genErr: { fontFamily: 'monospace', fontSize: 12, color: '#FF3366', textAlign: 'center', marginTop: 6 },
  empty: { fontFamily: 'monospace', fontSize: 12, color: '#2a2a2a', textAlign: 'center', marginTop: 40, letterSpacing: 2 },
  tapeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#0d0d0d' },
  tapeLocked: {},
  tapeName: { fontFamily: 'monospace', fontSize: 13 },
  tapeCheck: { color: '#FF8C00', fontSize: 16 },
  btn: { padding: 14, borderRadius: 2, alignItems: 'center' },
  btnAmber: { backgroundColor: '#1a0e00', borderWidth: 1, borderColor: '#FF8C00' },
  btnAmberText: { fontFamily: 'monospace', fontSize: 13, color: '#FF8C00', letterSpacing: 2 },
});
