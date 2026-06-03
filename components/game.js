import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CALLS, BANDS, ALL_TAPES, BAND_VIBES, SYM } from './Calls';

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
  const pc = pr < 40 ? '#