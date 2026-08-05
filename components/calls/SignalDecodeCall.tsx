// components/calls/SignalDecodeCall.tsx
// Presentational React component for SIGNAL_DECODE call type.
// Player taps symbol buttons to match the transmitted sequence.

import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import { SYM } from '../../data/calls';
import { computeSignalDecodeOutcome } from '../../engine/calls/renderers/SignalDecodeHandler';
import type { CallData, CallOutcome } from '../../engine/calls/types';

interface SignalDecodeCallProps {
  call: CallData;
  onComplete: (outcome: CallOutcome) => void;
}

type Phase = 'input' | 'success' | 'failure';

export function SignalDecodeCall({ call, onComplete }: SignalDecodeCallProps) {
  const sequence = call.sequence ?? [];
  const [input, setInput] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>('input');
  const completedRef = useRef(false);

  // When player has entered sequence.length symbols, auto-check.
  useEffect(() => {
    if (phase !== 'input' || input.length !== sequence.length || sequence.length === 0) {
      return;
    }
    const matches = sequence.every((sym, idx) => input[idx] === sym);
    if (matches) {
      setPhase('success');
    } else {
      setPhase('failure');
    }
  }, [input.length, sequence, phase]);

  // On success, show decodedMessage for 3s, then onComplete(true outcome).
  useEffect(() => {
    if (phase !== 'success' || completedRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      completedRef.current = true;
      onComplete(computeSignalDecodeOutcome(call, true));
    }, 3000);
    return () => clearTimeout(timer);
  }, [phase, call, onComplete]);

  // On failure, show "SIGNAL LOST" for 2s, then onComplete(false outcome).
  useEffect(() => {
    if (phase !== 'failure' || completedRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      completedRef.current = true;
      onComplete(computeSignalDecodeOutcome(call, false));
    }, 2000);
    return () => clearTimeout(timer);
  }, [phase, call, onComplete]);

  const tapSymbol = (idx: number): void => {
    if (phase !== 'input' || input.length >= sequence.length) {
      return;
    }
    setInput((prev) => [...prev, idx]);
  };

  const clearInput = (): void => {
    if (phase !== 'input') {
      return;
    }
    setInput([]);
  };

  const renderSymbolSlots = () => {
    return sequence.map((_, i) => {
      const has = i < input.length;
      const color = !has
        ? colors.textMuted
        : phase === 'failure'
          ? colors.red
          : phase === 'success'
            ? colors.green
            : colors.amber;
      return (
        <View key={i} style={styles.slot}>
          <Text style={[styles.slotGlyph, { color }]}>{has ? SYM[input[i] ?? 0] : '·'}</Text>
        </View>
      );
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.callerName}>{call.callerName}</Text>
        <Text style={styles.callerId}>{call.callerId}</Text>
      </View>

      <View style={styles.intro}>
        <Text style={styles.introText}>{call.intro ?? ''}</Text>
      </View>

      <View style={styles.slotsRow}>{renderSymbolSlots()}</View>

      {phase === 'success' && (
        <View style={styles.messageRow}>
          <Text style={styles.decodedMessage}>{call.decodedMessage ?? ''}</Text>
        </View>
      )}
      {phase === 'failure' && (
        <View style={styles.messageRow}>
          <Text style={styles.signalLost}>SIGNAL LOST</Text>
        </View>
      )}

      {phase === 'input' && (
        <View style={styles.symbolPad}>
          {SYM.map((glyph, idx) => (
            <Pressable
              key={idx}
              testID={`sym-${idx}`}
              style={({ pressed }) => [styles.symButton, pressed && styles.symButtonPressed]}
              onPress={() => tapSymbol(idx)}
              disabled={input.length >= sequence.length}
            >
              <Text style={styles.symGlyph}>{glyph}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {phase === 'input' && (
        <Pressable
          testID="clear"
          style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
          onPress={clearInput}
        >
          <Text style={styles.clearLabel}>CLEAR</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  callerName: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.amber,
    letterSpacing: 2,
  },
  callerId: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  intro: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    width: '100%',
  },
  introText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 16,
  },
  slotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  slot: {
    minWidth: 36,
    minHeight: 36,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  slotGlyph: {
    fontFamily: fonts.mono,
    fontSize: 20,
    color: colors.textMuted,
  },
  messageRow: {
    marginVertical: spacing.md,
  },
  decodedMessage: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.green,
    letterSpacing: 3,
    textAlign: 'center',
  },
  signalLost: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.red,
    letterSpacing: 3,
    textAlign: 'center',
  },
  symbolPad: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  symButton: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symButtonPressed: {
    borderColor: colors.amber,
    backgroundColor: `${colors.amber}15`,
  },
  symGlyph: {
    fontFamily: fonts.mono,
    fontSize: 28,
    color: colors.text,
  },
  clearButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  clearButtonPressed: {
    borderColor: colors.amber,
  },
  clearLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
  },
});
