import React from 'react';
import { View } from 'react-native';

import Button from '../components/Button';
import Fade from '../components/Fade';
import TransmissionLog from '../components/TransmissionLog';
import useTranscript from '../hooks/useTranscript';

/** The call plays itself out. All the player does is stay on the line. */
export default function JustListen({ call, accent, onComplete }) {
  const { index, chars, typing, done, skip } = useTranscript(call.lines);

  return (
    <View style={{ flex: 1 }}>
      <TransmissionLog
        lines={call.lines}
        index={index}
        chars={chars}
        typing={typing}
        onSkip={skip}
        accent={accent}
      />
      {done && (
        <Fade style={{ marginTop: 12 }}>
          <Button
            label="END CALL"
            onPress={() =>
              onComplete({
                sanityDelta: call.sanityDelta || 0,
                staticMult: 1,
                tape: call.tape || null,
                outcome: null,
              })
            }
          />
        </Fade>
      )}
    </View>
  );
}
