// components/calls/PuzzleCall.tsx
// Presentational component for PUZZLE calls.
// Player decodes multi-layer ciphers by entering text for each layer.
// Mirrors SignalDecodeCall's input-based pattern.

import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { Pressable, StyleSheet, Text, View, TextInput } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import { computePuzzleOutcome } from '../../engine/calls/renderers/PuzzleHandler';
import type { CallData, CallOutcome } from '../../engine/calls/types';

interface PuzzleCallProps {
  call: CallData;
  onComplete: (outcome: CallOutcome) => void;
}

type Phase = 'decoding' | 'result';

const RESULT_DWELL_MS = 3000;

export const PuzzleCall = memo(function PuzzleCall({ call, onComplete }: PuzzleCallProps) {
  const layers = call.cipherLayers ?? [];
  const [phase, setPhase] = useState<Phase>('decoding');
  const [currentLayerIdx, setCurrentLayerIdx] = useState(0);
  const [submissions, setSubmissions] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');

  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // No layers → immediate zero outcome.
  useEffect(() => {
    if (layers.length === 0 && phase === 'decoding') {
      setPhase('result');
    }
  }, [layers.length, phase]);

  // Result phase → compute and fire.
  useEffect(() => {
    if (phase !== 'result' || completedRef.current) return;
    completedRef.current = true;
    const outcome = computePuzzleOutcome(call, submissions);
    const timer = setTimeout(() => onCompleteRef.current(outcome), RESULT_DWELL_MS);
    return () => clearTimeout(timer);
  }, [phase, call, submissions]);

  const handleSubmitLayer = useCallback(() => {
    if (phase !== 'decoding') return;
    const newSubmissions = [...submissions, currentInput.trim()];
    setSubmissions(newSubmissions);
    setCurrentInput('');

    if (newSubmissions.length >= layers.length) {
      setPhase('result');
    } else {
      setCurrentLayerIdx((i) => i + 1);
    }
  }, [phase, submissions, currentInput, layers.length]);

  const currentLayer = layers[currentLayerIdx];
  const isLastLayer = currentLayerIdx === layers.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.callerName} accessibilityRole="header">
          {call.callerName}
        </Text>
        <Text style={styles.callerId}>{call.callerId}</Text>
      </View>

      {call.intro && (
        <View style={styles.introBlock}>
          <Text style={styles.introText}>{call.intro}</Text>
        </View>
      )}

      {phase === 'decoding' && currentLayer && (
        <View style={styles.decodingBlock}>
          <Text style={styles.layerCounter}>
            LAYER {currentLayerIdx + 1} / {layers.length}
          </Text>

          <View style={styles.encodedBlock}>
            <Text style={styles.encodedLabel}>ENCODED:</Text>
            <Text style={styles.encodedText} accessibilityLiveRegion="polite">
              {currentLayer.encoded}
            </Text>
          </View>

          <View style={styles.hintBlock}>
            <Text style={styles.hintLabel}>HINT:</Text>
            <Text style={styles.hintText}>{currentLayer.hint}</Text>
          </View>

          <TextInput
            style={styles.input}
            value={currentInput}
            onChangeText={setCurrentInput}
            placeholder="enter decoded text"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            accessible
            accessibilityLabel="Decoded text input"
            accessibilityHint="Enter your decoded text for this layer"
          />

          <Pressable
            style={[styles.submitButton, !currentInput.trim() && styles.submitButtonDisabled]}
            onPress={handleSubmitLayer}
            disabled={!currentInput.trim()}
            accessibilityRole="button"
            accessibilityLabel={isLastLayer ? 'Submit final layer' : 'Submit and continue'}
          >
            <Text style={styles.submitText}>{isLastLayer ? 'DECODE' : 'NEXT LAYER'}</Text>
          </Pressable>
        </View>
      )}

      {phase === 'result' && (
        <View style={styles.resultBlock}>
          {submissions.length === layers.length && layers.length > 0 && (
            <>
              <Text style={styles.resultLabel}>DECODED MESSAGE:</Text>
              <Text style={styles.decodedMessage} accessibilityLiveRegion="polite">
                {call.decodedMessage ?? ''}
              </Text>
            </>
          )}
          {(layers.length === 0 || submissions.length < layers.length) && (
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
  introBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    width: '100%',
    maxWidth: 400,
  },
  introText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 16,
  },
  decodingBlock: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: spacing.md,
  },
  layerCounter: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 3,
  },
  encodedBlock: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  encodedLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  encodedText: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.amber,
    letterSpacing: 2,
    textAlign: 'center',
  },
  hintBlock: {
    width: '100%',
    paddingHorizontal: spacing.md,
  },
  hintLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  hintText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text,
    fontStyle: 'italic',
  },
  input: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: colors.amber,
    backgroundColor: colors.surface,
    padding: spacing.md,
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 1,
  },
  submitButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.amber,
    backgroundColor: colors.surface,
  },
  submitButtonDisabled: {
    borderColor: colors.border,
    opacity: 0.5,
  },
  submitText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.amber,
    letterSpacing: 3,
  },
  resultBlock: {
    alignItems: 'center',
    gap: spacing.md,
  },
  resultLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 3,
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
  },
});

export default PuzzleCall;
