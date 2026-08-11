// app/onboarding.tsx
// Multi-step onboarding: (1) player name entry, (2) DJ call sign + station name.
// Shows on first launch before the player can access the radio.

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing } from '../lib/theme';
import { usePlayerStore } from '../store/usePlayerStore';
import { FlickeringText } from '../components/shared/FlickeringText';
import { BreathingText } from '../components/shared/BreathingText';
import { GlitchText } from '../components/shared/GlitchText';

type Step = 0 | 1;

export default function OnboardingScreen() {
  const router = useRouter();
  const completeOnboarding = usePlayerStore((s) => s.completeOnboarding);

  const [step, setStep] = useState<Step>(0);
  const [playerName, setPlayerName] = useState('');
  const [djCallSign, setDjCallSign] = useState('');
  const [stationName, setStationName] = useState('');
  const [promptText, setPromptText] = useState('What is your name?');

  // After a few seconds on step 0, the prompt shifts — like the station itself
  // is growing impatient. Subtle, not announced.
  useEffect(() => {
    if (step !== 0) return;
    const timer = setTimeout(() => {
      setPromptText('The line is open. What is your name?');
    }, 4000);
    return () => clearTimeout(timer);
  }, [step]);

  const nameValid = playerName.trim().length > 0;
  const callSignValid = djCallSign.trim().length > 0;
  const stationValid = stationName.trim().length > 0;
  const step1Valid = callSignValid && stationValid;

  const handleContinue = useCallback(() => {
    if (!nameValid) return;
    setStep(1);
  }, [nameValid]);

  const handleFinish = useCallback(() => {
    if (!step1Valid) return;
    completeOnboarding({
      playerName: playerName.trim(),
      djCallSign: djCallSign.trim(),
      stationName: stationName.trim(),
    });
    router.replace('/radio');
  }, [step1Valid, completeOnboarding, playerName, djCallSign, stationName, router]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <FlickeringText text="DEAD AIR" style={styles.title} letterSpacing={8} />
        <BreathingText style={styles.subtitle}>Late Night Radio</BreathingText>

        {step === 0 ? (
          <>
            <Text style={styles.prompt}>{promptText}</Text>
            <GlitchText
              base="Your real name. Not a username."
              variants={[
                'Your real name. Not a username.',
                'Your real name. It already knows.',
                'Your real name. Please.',
                'Say your name. The line is open.',
              ]}
              style={styles.hint}
              intervalMs={5000}
              holdMs={120}
            />
            <TextInput
              style={styles.input}
              value={playerName}
              onChangeText={setPlayerName}
              placeholder="Enter your name"
              placeholderTextColor={colors.textMuted}
              maxLength={32}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={handleContinue}
              accessible
              accessibilityLabel="Enter your name"
              accessibilityHint="Your name will be used in the story"
            />
            <Pressable
              testID="onboarding-name-continue"
              style={[styles.btn, !nameValid && styles.btnDisabled]}
              onPress={handleContinue}
              disabled={!nameValid}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Continue to next step"
              accessibilityState={{ disabled: !nameValid }}
            >
              <Text style={styles.btnText}>CONTINUE</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.prompt}>Set up your station</Text>
            <Text style={styles.hint}>Choose your DJ identity.</Text>

            <Text style={styles.fieldLabel}>DJ CALL SIGN</Text>
            <TextInput
              style={styles.input}
              value={djCallSign}
              onChangeText={setDjCallSign}
              placeholder="e.g. NIGHT OWL"
              placeholderTextColor={colors.textMuted}
              maxLength={20}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="next"
              accessible
              accessibilityLabel="DJ call sign"
              accessibilityHint="Your on-air identity"
            />

            <Text style={styles.fieldLabel}>STATION NAME</Text>
            <TextInput
              style={styles.input}
              value={stationName}
              onChangeText={setStationName}
              placeholder="e.g. WDAO 88.7"
              placeholderTextColor={colors.textMuted}
              maxLength={32}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleFinish}
              accessible
              accessibilityLabel="Station name"
              accessibilityHint="Your radio station's name"
            />

            <Pressable
              testID="onboarding-finish"
              style={[styles.btn, !step1Valid && styles.btnDisabled]}
              onPress={handleFinish}
              disabled={!step1Valid}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Finish onboarding"
              accessibilityState={{ disabled: !step1Valid }}
            >
              <Text style={styles.btnText}>START BROADCASTING</Text>
            </Pressable>
          </>
        )}

        {step === 1 && (
          <Pressable
            testID="onboarding-back"
            onPress={() => setStep(0)}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Go back to name entry"
          >
            <Text style={styles.backText}>← BACK</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 48,
    color: colors.amber,
    letterSpacing: 8,
    marginBottom: spacing.sm,
    textShadowColor: 'rgba(255, 140, 0, 0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  subtitle: {
    fontFamily: fonts.mono,
    fontSize: 22,
    color: colors.green,
    marginBottom: spacing.xxl,
    textShadowColor: 'rgba(57, 255, 20, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  prompt: {
    fontFamily: fonts.mono,
    fontSize: 22,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
    textShadowColor: 'rgba(224, 224, 224, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  hint: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.amber,
    letterSpacing: 3,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
    textShadowColor: 'rgba(255, 140, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  input: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: '100%',
    marginBottom: spacing.md,
    textShadowColor: 'rgba(224, 224, 224, 0.25)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  btn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: 4,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  btnDisabled: {
    borderColor: colors.border,
    opacity: 0.4,
  },
  btnText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.amber,
    letterSpacing: 3,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 140, 0, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  backText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 2,
    marginTop: spacing.xl,
  },
});
