import React from 'react';
import { View } from 'react-native';

import Button from '../components/Button';
import TransmissionLog from '../components/TransmissionLog';
import useLineReveal from '../hooks/useLineReveal';

/** The call plays itself out. All the player does is stay on the line. */
export default function JustListen({ call, onComplete }) {
  const { index, done } = useLineReveal(call.lines.length, { interval: 2400, settle: 1800 });

  return (
    <View style={{ flex: 1 }}>
      <TransmissionLog lines={call.lines} upTo={index} />
      {done && (
        <Button
          label="END CALL"
          style={{ marginTop: 12 }}
          onPress={() =>
            onComplete({
              sanityDelta: call.sanityDelta || 0,
              staticMult: 1,
              tape: call.tape || null,
              outcome: null,
            })
          }
        />
      )}
    </View>
  );
}
