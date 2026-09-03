import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import feedback from '../feedback';
import CRT from '../components/CRT';
import SignalBars from '../components/SignalBars';
import StaticBurst from '../components/StaticBurst';
import VuMeter from '../components/VuMeter';
import { playerFor } from '../calls';
import { bandById } from '../content/bands';
import { interference, interferenceBurstMs, signalPenalty } from '../engine/interference';
import { colors, mono, safeTop } from '../theme/theme';

/** Frame around whichever call player the transmission's type calls for. */
export default function CallScreen({ call, sanity = 100, onComplete }) {
  const band = bandById(call.band);
  const Player = playerFor(call.type);
  const accent = band.color;

  // A one-way latch. Two taps on END CALL land in the same frame otherwise,
  // and the second one runs against a save the first has not written yet.
  const finished = useRef(false);

  // The line opens, and the station bed comes up under it. Doing this here
  // rather than in each player means all five call types get it for free, and
  // the bed is guaranteed to stop however the screen goes away.
  useEffect(() => {
    feedback.fire('answer');
    feedback.startCarrier();
    return () => feedback.stopCarrier();
  }, [call.id]);

  // When the DJ is coming apart, the line does too — bursts of static arrive
  // uninvited, and more often the worse it gets.
  const [interruption, setInterruption] = useState(0);
  useEffect(() => {
    const gap = interferenceBurstMs(sanity);
    if (!gap) return undefined;
    const id = setInterval(() => setInterruption((n) => n + 1), gap);
    return () => clearInterval(id);
  }, [sanity]);

  const complete = useCallback(
    (result) => {
      if (finished.current) return;
      finished.current = true;
      feedback.fire('hangup');
      onComplete(result);
    },
    [onComplete],
  );

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={[s.callerId, { color: accent }]} numberOfLines={1}>
            {call.callerId}
          </Text>
          <Text style={s.callerName} numberOfLines={1}>
            {call.callerName}
          </Text>
        </View>
        <VuMeter pulse={interruption} color={accent} />
        <SignalBars n={Math.max(0, call.signal - signalPenalty(sanity))} color={accent} live />
      </View>

      <View style={s.body}>
        <Player call={call} accent={accent} onComplete={complete} />
      </View>

      <StaticBurst trigger={interruption} intensity={0.4 + interference(sanity) * 0.5} />
      <CRT sanity={sanity} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    paddingTop: safeTop,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  callerId: { fontFamily: mono, fontSize: 11, letterSpacing: 2 },
  callerName: { fontFamily: mono, fontSize: 18, color: colors.text },
  body: { flex: 1, padding: 16 },
});
