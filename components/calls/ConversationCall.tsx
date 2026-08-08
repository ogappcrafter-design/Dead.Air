// components/calls/ConversationCall.tsx
// Presentational component for CONVERSATION calls.
// Player navigates a branching dialogue tree by picking responses.
// Mirrors RightAnswerCall's choice-based pattern, extended with branching.

import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import { computeConversationOutcome } from '../../engine/calls/renderers/ConversationHandler';
import type { CallData, CallChoice, CallOutcome } from '../../engine/calls/types';

interface ConversationCallProps {
  call: CallData;
  onComplete: (outcome: CallOutcome) => void;
}

type Phase = 'dialogue' | 'outcome';

const OUTCOME_DWELL_MS = 3000;

export const ConversationCall = memo(function ConversationCall({
  call,
  onComplete,
}: ConversationCallProps) {
  const tree = call.dialogueTree ?? [];
  const [phase, setPhase] = useState<Phase>('dialogue');
  const [nodeIdx, setNodeIdx] = useState(0);
  const [path, setPath] = useState<number[]>([]);

  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Empty tree → immediate outcome.
  useEffect(() => {
    if (tree.length === 0 && phase === 'dialogue') {
      setPhase('outcome');
    }
  }, [tree.length, phase]);

  // Outcome phase → compute and fire.
  useEffect(() => {
    if (phase !== 'outcome' || completedRef.current) return;
    completedRef.current = true;
    const outcome = computeConversationOutcome(call, path);
    const timer = setTimeout(() => onCompleteRef.current(outcome), OUTCOME_DWELL_MS);
    return () => clearTimeout(timer);
  }, [phase, call, path]);

  const handleChoice = useCallback(
    (choiceIdx: number) => {
      if (phase !== 'dialogue') return;
      const newPath = [...path, choiceIdx];
      setPath(newPath);

      const nextNodeIdx = nodeIdx + 1;
      if (nextNodeIdx >= tree.length) {
        // End of tree → compute outcome.
        setPhase('outcome');
      } else {
        setNodeIdx(nextNodeIdx);
      }
    },
    [phase, nodeIdx, path, tree.length],
  );

  const currentNode = tree[nodeIdx];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.callerName} accessibilityRole="header">
          {call.callerName}
        </Text>
        <Text style={styles.callerId}>{call.callerId}</Text>
      </View>

      {phase === 'dialogue' && currentNode && (
        <View style={styles.dialogueBlock}>
          <Text style={styles.speaker} accessibilityRole="header">
            {currentNode.speaker}
          </Text>
          <Text style={styles.dialogueText} accessibilityLiveRegion="polite">
            {currentNode.text}
          </Text>

          <Text style={styles.prompt}>Your response:</Text>
          {currentNode.responses.map((choice, idx) => (
            <Pressable
              key={`resp-${nodeIdx}-${idx}`}
              style={styles.choiceButton}
              onPress={() => handleChoice(idx)}
              accessibilityRole="button"
              accessibilityLabel={choice.text}
              accessibilityHint="Choose this response"
            >
              <Text style={styles.choiceText}>{choice.text}</Text>
            </Pressable>
          ))}

          {/* Path progress indicator */}
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              Node {nodeIdx + 1} / {tree.length}
            </Text>
            <View style={styles.progressDots}>
              {tree.map((_, i) => (
                <View key={`prog-${i}`} style={[styles.dot, i <= nodeIdx && styles.dotFilled]} />
              ))}
            </View>
          </View>
        </View>
      )}

      {phase === 'dialogue' && !currentNode && (
        <View style={styles.dialogueBlock}>
          <Text style={styles.endText}>CONNECTION LOST</Text>
        </View>
      )}

      {phase === 'outcome' && (
        <View style={styles.outcomeBlock}>
          {path.length > 0 && tree.length > 0 ? (
            <>
              <Text style={styles.outcomeLabel}>CALL COMPLETE</Text>
              <Text style={styles.outcomeSummary}>
                {path.length} of {tree.length} nodes traversed
              </Text>
            </>
          ) : (
            <Text style={styles.signalLost}>SIGNAL LOST</Text>
          )}
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
    marginBottom: spacing.lg,
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
  dialogueBlock: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: spacing.sm,
  },
  speaker: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.amber,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  dialogueText: {
    fontFamily: fonts.mono,
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
    minHeight: 44,
  },
  prompt: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  choiceButton: {
    width: '100%',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  choiceText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  progressText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  progressDots: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dotFilled: {
    backgroundColor: colors.dimGreen,
    borderColor: colors.dimGreen,
  },
  endText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.red,
    letterSpacing: 3,
  },
  outcomeBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  outcomeLabel: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.dimGreen,
    letterSpacing: 4,
  },
  outcomeSummary: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  signalLost: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.red,
    letterSpacing: 3,
  },
});

export default ConversationCall;
