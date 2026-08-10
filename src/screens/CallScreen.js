import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import feedback from '../feedback';
import CRT from '../components/CRT';
import SignalBars from '../components/SignalBars';
import { playerFor } from '../calls';
import { bandById } from '../content/bands';
import { colors, mono, safeTop } from '../theme/theme';

/** Frame around whichever call player the transmission's type calls for. */
export default function CallScreen({ call, onComplete }) {
  const band = bandById(call.band);
  const Player = playerFor(call.type);

  // The line opens, and the station bed comes up under it. Doing this here
  // rather than in each player means all five call types get it for free, and
  // the bed is guaranteed to stop however the screen goes away.
  useEffect(() => {
    feedback.fire('answer');
    feedback.startCarrier();
    return () => feedback.stopCarrier();
  }, [call.id]);

  const complete = useCallback(
    (result) => {
      feedback.fire('hangup');
      onComplete(result);
    },
    [onComplete],
  );

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={[s.callerId, { color: band.color }]} numberOfLines={1}>
            {call.callerId}
          </Text>
          <Text style={s.callerName} numberOfLines={1}>
            {call.callerName}
          </Text>
        </View>
        <SignalBars n={call.signal} color={band.color} />
      </View>

      <View style={s.body}>
        <Player call={call} onComplete={complete} />
      </View>

      <CRT />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    paddingTop: safeTop,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  callerId: { fontFamily: mono, fontSize: 11, letterSpacing: 2 },
  callerName: { fontFamily: mono, fontSize: 18, color: colors.text },
  body: { flex: 1, padding: 16 },
});
