import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, StyleSheet } from 'react-native';

import feedback from '../feedback';
import Button from '../components/Button';
import Fade from '../components/Fade';
import useShake from '../hooks/useShake';
import { useReducedMotion } from '../motion';
import { colors, mono, type } from '../theme/theme';

const TICK_MS = 100;
const BREATH_RELIEF = 22;

/**
 * Keep your nerve. Anxiety climbs on its own; BREATHE pushes it back down.
 * Reach the end of the countdown to hold the signal; hit 100 and you lose it.
 *
 * Anxiety rises at exactly 100/duration per second, so an untouched call
 * reaches 100 at the same instant the countdown expires — you have to breathe
 * at least once. That tie is resolved deterministically here in favour of
 * losing; v1 ran the bar and the clock on two independent timer chains and
 * whichever fired first won the race.
 */
export default function StayCalm({ call, accent, onComplete }) {
  const [anxiety, setAnxiety] = useState(0);
  const [remaining, setRemaining] = useState(call.duration);
  const [status, setStatus] = useState('live');

  const anxietyRef = useRef(0);
  const statusRef = useRef('live');
  const startedAt = useRef(null);
  const lastTick = useRef(null);

  // The bar is driven separately from the logic: the tick is the source of
  // truth at 10 Hz, and each tick hands the native driver a short linear leg to
  // the next value, so the fill glides instead of stepping.
  const [trackWidth, setTrackWidth] = useState(0);
  const fill = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const { shake, style: shakeStyle } = useShake({ distance: 9, cycles: 4 });

  const drive = useCallback(
    (value) => {
      const to = value / 100;
      if (reduced) {
        fill.setValue(to);
        return;
      }
      Animated.timing(fill, {
        toValue: to,
        duration: TICK_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    },
    [fill, reduced],
  );

  useEffect(() => {
    const ratePerSecond = 100 / call.duration;
    // Anchor the clock once. If this effect ever re-runs mid-call (the
    // reduce-motion setting changing, say) restarting the countdown would hand
    // the player free seconds.
    if (startedAt.current === null) startedAt.current = Date.now();
    lastTick.current = Date.now();

    const id = setInterval(() => {
      if (statusRef.current !== 'live') return;

      const now = Date.now();
      const delta = (now - lastTick.current) / 1000;
      lastTick.current = now;

      const next = Math.min(100, anxietyRef.current + delta * ratePerSecond);
      anxietyRef.current = next;
      setAnxiety(next);
      drive(next);

      const elapsed = (now - startedAt.current) / 1000;
      setRemaining(Math.max(0, Math.ceil(call.duration - elapsed)));

      // Order matters: losing is checked first, so an untouched call loses.
      if (next >= 100) {
        statusRef.current = 'lost';
        setStatus('lost');
        shake();
      } else if (elapsed >= call.duration) {
        statusRef.current = 'won';
        setStatus('won');
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [call.duration, drive, shake]);

  const breathe = useCallback(() => {
    if (statusRef.current !== 'live') return;
    feedback.fire('breath');
    const next = Math.max(0, anxietyRef.current - BREATH_RELIEF);
    anxietyRef.current = next;
    setAnxiety(next);
    drive(next);
  }, [drive]);

  const barColor = anxiety < 40 ? colors.green : anxiety < 70 ? colors.amber : colors.red;
  const caption = status === 'live' ? 'STAY CALM' : status === 'won' ? 'SIGNAL HELD' : 'SIGNAL LOST';

  return (
    <Animated.View style={[{ flex: 1 }, shakeStyle]}>
      <View style={s.head}>
        <Text style={[type.timer, { color: status === 'lost' ? colors.red : accent || colors.amber }]}>
          {remaining > 0 ? `00:${String(remaining).padStart(2, '0')}` : '─ ─ ─'}
        </Text>
        <Text style={s.sub}>{caption}</Text>
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(anxiety) }}
        style={s.track}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        {/* Full-width fill slid in from the left, so the motion is a transform
            the native driver can own rather than a re-laid-out width. */}
        <Animated.View
          style={[
            s.fill,
            {
              width: trackWidth,
              backgroundColor: barColor,
              transform: [
                {
                  translateX: fill.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-trackWidth, 0],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
      <Text style={[s.sub, { marginBottom: 16 }]}>ANXIETY LEVEL</Text>

      {status === 'live' && <Button label="◈ BREATHE" tone="green" onPress={breathe} />}

      {status === 'won' && (
        <Fade>
          <Button
            label="END CALL"
            onPress={() =>
              onComplete({
                sanityDelta: call.sanityDelta || 0,
                staticMult: 1,
                tape: call.tape || null,
                outcome: 'You held your nerve.',
              })
            }
          />
        </Fade>
      )}

      {status === 'lost' && (
        <Fade>
          <Button
            label="END CALL"
            tone="red"
            onPress={() =>
              onComplete({
                sanityDelta: -(call.sanityPenalty || 18),
                staticMult: 0.5,
                tape: null,
                outcome: 'You lost control.',
              })
            }
          />
        </Fade>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  head: { alignItems: 'center', paddingVertical: 16 },
  sub: {
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: 3,
    color: colors.textFaint,
    marginTop: 4,
    textAlign: 'center',
  },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.hairline, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
