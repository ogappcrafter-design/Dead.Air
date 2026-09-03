import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import feedback from '../feedback';
import Button from '../components/Button';
import CRT from '../components/CRT';
import Fade from '../components/Fade';
import { bandById } from '../content/bands';
import { MARK } from '../content/symbols';
import { colors, mono, safeTop } from '../theme/theme';

/**
 * What that call cost and what it paid.
 *
 * v1 computed payout, sanity drift and tape awards and then returned straight
 * to the dial, so the whole economy was invisible while you played it.
 */
export default function SignOffScreen({ call, gained, sanity = 100, offAir = false, onDismiss }) {
  const accent = bandById(call.band).color;

  // Let the line finish closing before the bell — the hangup click is still
  // ringing out when this screen mounts, and the two on top of each other
  // sound like a glitch rather than a reward.
  useEffect(() => {
    if (!gained.tape) return undefined;
    const t = setTimeout(() => feedback.fire('tape'), 420);
    return () => clearTimeout(t);
  }, [gained.tape]);

  const sanitySign = gained.sanityDelta > 0 ? '+' : '';
  const sanityColor =
    gained.sanityDelta > 0 ? colors.green : gained.sanityDelta < 0 ? colors.red : colors.textFaint;

  return (
    <View style={s.screen}>
      <View style={s.body}>
        <Fade>
          <Text style={s.label}>CALL ENDED</Text>
          <Text style={[s.caller, { color: accent }]}>{call.callerName}</Text>
        </Fade>

        {!!gained.outcome && (
          <Fade delay={160}>
            <Text style={s.outcome}>{gained.outcome}</Text>
          </Fade>
        )}

        <View style={s.rule} />

        <Fade delay={260}>
          <View style={s.row}>
            <Text style={s.rowLabel}>STATIC EARNED</Text>
            <Text style={[s.rowValue, { color: colors.amber }]}>
              +{gained.payout} {MARK}
            </Text>
          </View>

          <View style={s.row}>
            <Text style={s.rowLabel}>SANITY</Text>
            <Text style={[s.rowValue, { color: sanityColor }]}>
              {gained.sanityDelta === 0 ? 'UNCHANGED' : `${sanitySign}${gained.sanityDelta}`}
              <Text style={s.rowTrail}>{`   ${sanity}/100`}</Text>
            </Text>
          </View>
        </Fade>

        {!!gained.tape && (
          <Fade delay={420}>
            <View style={s.tape}>
              <Text style={s.tapeLabel}>TAPE RECOVERED</Text>
              <Text style={s.tapeName}>{gained.tape}</Text>
            </View>
          </Fade>
        )}

        {/* The call that took the last of them should say so here, not leave
            the player to discover a dark station on the dial. */}
        {offAir && (
          <Fade delay={520}>
            <View style={s.warning}>
              <Text style={s.warningTitle}>THE STATION HAS GONE DARK</Text>
              <Text style={s.warningBody}>
                That was the last of you. Nothing else will come through until you stabilise.
              </Text>
            </View>
          </Fade>
        )}

        <Fade delay={620}>
          <Button
            label={offAir ? 'SIT IN THE DARK' : 'BACK TO THE DIAL'}
            tone={offAir ? 'red' : 'amber'}
            color={offAir ? undefined : accent}
            style={{ marginTop: 28 }}
            onPress={onDismiss}
          />
        </Fade>
      </View>

      <CRT sanity={sanity} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: 24, paddingTop: safeTop + 40, justifyContent: 'center' },
  label: { fontFamily: mono, fontSize: 11, letterSpacing: 4, color: colors.textFaint },
  caller: { fontFamily: mono, fontSize: 22, marginTop: 6 },
  outcome: {
    fontFamily: mono,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textDim,
    fontStyle: 'italic',
    marginTop: 16,
  },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 2, color: colors.textFaint },
  rowValue: { fontFamily: mono, fontSize: 14 },
  rowTrail: { color: colors.textGhost, fontSize: 11 },
  tape: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: 2,
    padding: 14,
    gap: 6,
  },
  tapeLabel: { fontFamily: mono, fontSize: 10, letterSpacing: 3, color: colors.textFaint },
  tapeName: { fontFamily: mono, fontSize: 13, color: colors.amber },
  warning: {
    marginTop: 20,
    borderLeftWidth: 2,
    borderLeftColor: colors.red,
    paddingLeft: 14,
    paddingVertical: 8,
    gap: 6,
  },
  warningTitle: { fontFamily: mono, fontSize: 12, letterSpacing: 3, color: colors.red },
  warningBody: { fontFamily: mono, fontSize: 12, lineHeight: 20, color: colors.textDim },
});
