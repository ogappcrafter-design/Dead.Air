// components/calls/RightAnswerCall.tsx
// Pure presentation for RIGHT_ANSWER call type. No store access —
// parent owns lifecycle and feeds the outcome to CallManager via onComplete.

import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { computeRightAnswerOutcome } from '@/engine/calls/renderers/RightAnswerHandler';
import type { CallData, CallOutcome } from '@/engine/calls/types';
import { colors, fonts, spacing } from '@/lib/theme';

/** Props: parent renders <RightAnswerCall call={...} onComplete={...} />. */
export interface RightAnswerCallProps {
  call: CallData;
  onComplete: (outcome: CallOutcome) => void;
}

/** Auto-advance interval for caller lines (ms). TapSurface to skip remaining wait. */
const LINE_INTERVAL_MS = 2500;
/** Outcome preview dwell before reporting completion (ms). */
const OUTCOME_DWELL_MS = 3000;

type Phase = 'lines' | 'choices' | 'outcome';

/**
 * Render flow:
 * 1. `lines` — caller speaks `call.lines` one at a time, auto-adv every 2.5s.
 *    Tap surface = skip to next line immediately.
 * 2. `choices` — after last line, render tappable buttons for each `call.choices`.
 * 3. `outcome` — on selection, show `choice.outcome` text for 3s, then onComplete.
 *
 * Pure presentational: no store reads. Only reads `call` and reports via
 * `onComplete(computeRightAnswerOutcome(call, choiceIndex))`.
 */
export function RightAnswerCall({ call, onComplete }: RightAnswerCallProps) {
  const lines = call.lines ?? [];
  const choices = call.choices ?? [];

  const [phase, setPhase] = useState<Phase>('lines');
  const [lineIndex, setLineIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  // onComplete must be stable across renders; capture latest in a ref so the
  // outcome-phase effect does not re-fire when the parent passes a new callback.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Guard: empty lines → skip straight to choices.
  useEffect(() => {
    if (lines.length === 0 && phase === 'lines') {
      setPhase('choices');
    }
  }, [lines.length, phase]);

  // Auto-advance lines.
  useEffect(() => {
    if (phase !== 'lines' || lines.length === 0) {
      return;
    }
    if (lineIndex >= lines.length - 1) {
      // Last line shown — advance to choices after final dwell.
      const timer = setTimeout(() => setPhase('choices'), LINE_INTERVAL_MS);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setLineIndex((i) => i + 1), LINE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [phase, lineIndex, lines.length]);

  // Outcome dwell → report.
  useEffect(() => {
    if (phase !== 'outcome' || selectedChoice === null) {
      return;
    }
    const timer = setTimeout(() => {
      onCompleteRef.current(computeRightAnswerOutcome(call, selectedChoice));
    }, OUTCOME_DWELL_MS);
    return () => clearTimeout(timer);
  }, [phase, selectedChoice, call]);

  const handleSurfaceTap = () => {
    if (phase !== 'lines' || lines.length === 0) {
      return;
    }
    if (lineIndex >= lines.length - 1) {
      setPhase('choices');
    } else {
      setLineIndex((i) => i + 1);
    }
  };

  const handleChoice = (index: number) => {
    if (phase !== 'choices') {
      return;
    }
    setSelectedChoice(index);
    setPhase('outcome');
  };

  return (
    <Pressable style={styles.container} onPress={handleSurfaceTap}>
      {phase === 'lines' && (
        <View>
          <View style={styles.header}>
            <Text style={styles.callerName}>{call.callerName}</Text>
            <Text style={styles.callerId}>{call.callerId}</Text>
          </View>
          {lines.length > 0 && <Text style={styles.line}>{lines[lineIndex] ?? ''}</Text>}
          <Text style={styles.hint}>
            {lineIndex >= lines.length - 1 ? 'tap to continue' : 'tap to skip'}
          </Text>
        </View>
      )}

      {phase === 'choices' && (
        <View>
          <View style={styles.header}>
            <Text style={styles.callerName}>{call.callerName}</Text>
            <Text style={styles.callerId}>{call.callerId}</Text>
          </View>
          {lines.length > 0 && <Text style={styles.line}>{lines[lines.length - 1] ?? ''}</Text>}
          <Text style={styles.prompt}>Choose your response:</Text>
          {choices.map((choice, index) => (
            <Pressable
              key={`${call.id}-choice-${index}`}
              style={styles.choiceButton}
              onPress={() => handleChoice(index)}
            >
              <Text style={styles.choiceText}>{choice.text}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {phase === 'outcome' && selectedChoice !== null && (
        <View style={styles.outcomeContainer}>
          <Text style={styles.callerName}>{call.callerName}</Text>
          <Text style={styles.outcomeText}>{choices[selectedChoice]?.outcome ?? ''}</Text>
          <Text style={styles.selectedLabel}>
            You chose:&nbsp;
            <Text style={styles.selectedText}>{choices[selectedChoice]?.text ?? ''}</Text>
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing.md,
  },
  callerName: {
    color: colors.amber,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  callerId: {
    color: colors.textMuted,
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  line: {
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.mono,
    fontSize: 11,
    textAlign: 'center',
  },
  prompt: {
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: 14,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  choiceButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  choiceText: {
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: 15,
  },
  outcomeContainer: {
    alignItems: 'center',
  },
  outcomeText: {
    color: colors.green,
    fontFamily: fonts.mono,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: spacing.md,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  selectedLabel: {
    color: colors.textMuted,
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  selectedText: {
    color: colors.green,
    fontFamily: fonts.mono,
    fontSize: 12,
  },
});
