// components/calls/MultiCallerCall.tsx
// Presentational component for MULTI_CALLER calls.
// Two voices speak. Player attributes each line to the correct voice.
// Mirrors RightAnswerCall's choice-based pattern.

import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import { computeMultiCallerOutcome } from '../../engine/calls/renderers/MultiCallerHandler';
import type { CallData, CallOutcome } from '../../engine/calls/types';

interface MultiCallerCallProps {
  call: CallData;
  onComplete: (outcome: CallOutcome) => void;
}

type Phase = 'lines' | 'attribution' | 'outcome';

const LINE_INTERVAL_MS = 2500;
const OUTCOME_DWELL_MS = 2500;

export const MultiCallerCall = memo(function MultiCallerCall({
  call,
  onComplete,
}: MultiCallerCallProps) {
  const lines = call.lines ?? [];
  const speakers = call.speakerPairs ?? [];
  const voiceA = speakers[0]?.name ?? 'VOICE A';
  const voiceB = speakers[1]?.name ?? 'VOICE B';

  const [phase, setPhase] = useState<Phase>('lines');
  const [lineIndex, setLineIndex] = useState(0);
  const [attributions, setAttributions] = useState<number[]>([]);
  const [currentAttribution, setCurrentAttribution] = useState<number | null>(null);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Auto-advance lines.
  useEffect(() => {
    if (phase !== 'lines' || lines.length === 0) return;
    if (lineIndex >= lines.length - 1) {
      const timer = setTimeout(() => setPhase('attribution'), LINE_INTERVAL_MS);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setLineIndex((i) => i + 1), LINE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [phase, lineIndex, lines.length]);

  // Empty lines → skip to attribution (will produce zero outcome).
  useEffect(() => {
    if (lines.length === 0 && phase === 'lines') {
      setPhase('attribution');
    }
  }, [lines.length, phase]);

  const handleLineTap = useCallback(() => {
    if (phase !== 'lines') return;
    if (lineIndex >= lines.length - 1) {
      setPhase('attribution');
    } else {
      setLineIndex((i) => i + 1);
    }
  }, [phase, lineIndex, lines.length]);

  const handleAttribution = useCallback(
    (voiceIndex: number) => {
      if (phase !== 'attribution') return;
      setCurrentAttribution(voiceIndex);

      const newAttributions = [...attributions, voiceIndex];
      setAttributions(newAttributions);

      if (newAttributions.length >= lines.length) {
        // All lines attributed → compute outcome.
        const attributionArray = newAttributions.map((voiceIdx, utterIdx) => ({
          utteranceIndex: utterIdx,
          voiceIndex: voiceIdx,
        }));
        setPhase('outcome');
        setTimeout(() => {
          onCompleteRef.current(computeMultiCallerOutcome(call, attributionArray));
        }, OUTCOME_DWELL_MS);
      } else {
        setCurrentAttribution(null);
      }
    },
    [phase, attributions, lines.length, call],
  );

  const currentLine = phase === 'lines' ? lines[lineIndex] : (lines[attributions.length] ?? '');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.callerName} accessibilityRole="header">
          {call.callerName}
        </Text>
        <Text style={styles.callerId}>{call.callerId}</Text>
      </View>

      {/* Voice labels */}
      <View style={styles.voiceLabels}>
        <Text style={styles.voiceLabel}>{voiceA}</Text>
        <Text style={styles.voiceDivider}>vs</Text>
        <Text style={styles.voiceLabel}>{voiceB}</Text>
      </View>

      {phase === 'lines' && (
        <Pressable
          onPress={handleLineTap}
          style={styles.lineBlock}
          accessibilityRole="button"
          accessibilityLabel="Skip line"
        >
          {lines.length > 0 ? (
            <Text style={styles.line} accessibilityLiveRegion="polite">
              {lines[lineIndex] ?? ''}
            </Text>
          ) : (
            <Text style={styles.line}>...</Text>
          )}
          <Text style={styles.hint}>
            {lineIndex >= lines.length - 1 ? 'tap to continue' : 'tap to skip'}
          </Text>
        </Pressable>
      )}

      {phase === 'attribution' && (
        <View style={styles.attributionBlock}>
          <Text style={styles.attributionPrompt}>
            Line {attributions.length + 1} / {lines.length}:
          </Text>
          <Text style={styles.attributionLine} accessibilityLiveRegion="polite">
            {currentLine}
          </Text>
          <View style={styles.voiceButtons}>
            <Pressable
              style={[styles.voiceButton, currentAttribution === 0 && styles.voiceButtonSelected]}
              onPress={() => handleAttribution(0)}
              accessibilityRole="button"
              accessibilityLabel={`Attribute to ${voiceA}`}
            >
              <Text style={styles.voiceButtonText}>{voiceA}</Text>
            </Pressable>
            <Pressable
              style={[styles.voiceButton, currentAttribution === 1 && styles.voiceButtonSelected]}
              onPress={() => handleAttribution(1)}
              accessibilityRole="button"
              accessibilityLabel={`Attribute to ${voiceB}`}
            >
              <Text style={styles.voiceButtonText}>{voiceB}</Text>
            </Pressable>
          </View>
          <View style={styles.progressDots}>
            {lines.map((_, i) => (
              <View
                key={`dot-${i}`}
                style={[styles.dot, i < attributions.length && styles.dotFilled]}
              />
            ))}
          </View>
        </View>
      )}

      {phase === 'outcome' && (
        <View style={styles.outcomeBlock}>
          <Text style={styles.outcomeText} accessibilityLiveRegion="polite">
            CALL COMPLETE
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  callerName: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.amber,
    letterSpacing: 2,
  },
  callerId: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  voiceLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  voiceLabel: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 2,
  },
  voiceDivider: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
  },
  lineBlock: {
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  line: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  hint: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
    marginTop: spacing.lg,
  },
  attributionBlock: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: spacing.md,
  },
  attributionPrompt: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  attributionLine: {
    fontFamily: fonts.mono,
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
    minHeight: 60,
  },
  voiceButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  voiceButton: {
    flex: 1,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  voiceButtonSelected: {
    borderColor: colors.amber,
    backgroundColor: `${colors.amber}15`,
  },
  voiceButtonText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 1,
  },
  progressDots: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dotFilled: {
    backgroundColor: colors.dimGreen,
    borderColor: colors.dimGreen,
  },
  outcomeBlock: {
    alignItems: 'center',
  },
  outcomeText: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.dimGreen,
    letterSpacing: 4,
  },
});

export default MultiCallerCall;
