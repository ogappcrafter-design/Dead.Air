import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, spacing } from '../../lib/theme';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAnalyticsStore } from '../../store/useAnalyticsStore';
import { ErrorReportButton } from '../../components/shared/ErrorReportButton';
import { useStoreStore } from '../../store/useStoreStore';

const CRT_INTENSITY_STEP = 0.1;
const VOLUME_STEP = 0.1;

const fmtVolume = (vol: number): string => vol.toFixed(1);

export default function SettingsScreen() {
  const {
    hasInfiniteSignal,
    isLoading,
    isInitialized,
    error,
    productPrice,
    initialize,
    purchaseInfiniteSignal,
    restorePurchases,
    dispose,
  } = useStoreStore();

  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize IAP service on mount
  useEffect(() => {
    initialize().finally(() => setIsInitializing(false));

    return () => {
      dispose();
    };
  }, [initialize, dispose]);

  // Show error alert if there's an error
  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
    }
  }, [error]);

  // Handle purchase
  const handlePurchase = async () => {
    if (!isInitialized) {
      Alert.alert('Error', 'IAP service not initialized');
      return;
    }

    try {
      await purchaseInfiniteSignal();
    } catch (err) {
      Alert.alert('Error', 'Purchase failed. Please try again.');
    }
  };

  // Handle restore
  const handleRestore = async () => {
    if (!isInitialized) {
      Alert.alert('Error', 'IAP service not initialized');
      return;
    }

    try {
      await restorePurchases();
      Alert.alert('Success', 'Purchases restored successfully');
    } catch (err) {
      Alert.alert('Error', 'Restore failed. Please try again.');
    }
  };

  const crtEnabled = useSettingsStore((s) => s.crtEnabled);
  const setCrtEnabled = useSettingsStore((s) => s.setCrtEnabled);
  const crtIntensity = useSettingsStore((s) => s.crtIntensity);
  const setCrtIntensity = useSettingsStore((s) => s.setCrtIntensity);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const setReducedMotion = useSettingsStore((s) => s.setReducedMotion);

  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const setMasterVolume = useSettingsStore((s) => s.setMasterVolume);
  const sfxVolume = useSettingsStore((s) => s.sfxVolume);
  const setSfxVolume = useSettingsStore((s) => s.setSfxVolume);
  const staticEnabled = useSettingsStore((s) => s.staticEnabled);
  const setStaticEnabled = useSettingsStore((s) => s.setStaticEnabled);

  const analyticsEnabled = useAnalyticsStore((s) => s.enabled);
  const setAnalyticsEnabled = useAnalyticsStore((s) => s.setEnabled);

  const lower = Math.max(0, Math.round((crtIntensity - CRT_INTENSITY_STEP) * 10) / 10);
  const raise = Math.min(1, Math.round((crtIntensity + CRT_INTENSITY_STEP) * 10) / 10);

  const masterLower = Math.max(0, Math.round((masterVolume - VOLUME_STEP) * 10) / 10);
  const masterRaise = Math.min(1, Math.round((masterVolume + VOLUME_STEP) * 10) / 10);
  const sfxLower = Math.max(0, Math.round((sfxVolume - VOLUME_STEP) * 10) / 10);
  const sfxRaise = Math.min(1, Math.round((sfxVolume + VOLUME_STEP) * 10) / 10);

  if (isInitializing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.amber} />
        <Text style={styles.loadingText}>Initializing...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        SETTINGS
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>INFINITE SIGNAL</Text>
        <Text style={styles.description}>
          Unlock the full call pool with procedural generation.
        </Text>

        {hasInfiniteSignal ? (
          <View style={styles.ownedContainer}>
            <Text style={styles.ownedText}>✓ Owned</Text>
          </View>
        ) : (
          <>
            <Pressable
              testID="iap-purchase-button"
              style={styles.purchaseButton}
              onPress={handlePurchase}
              disabled={isLoading || !isInitialized}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Purchase Infinite Signal"
            >
              {isLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.purchaseButtonText}>
                  Purchase - {productPrice || '$3.99'}
                </Text>
              )}
            </Pressable>

            <Pressable
              testID="iap-restore-button"
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={isLoading || !isInitialized}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Restore purchases"
            >
              <Text style={styles.restoreButtonText}>Restore Purchases</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>CRT</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>ENABLED</Text>
          <Switch
            value={crtEnabled}
            onValueChange={setCrtEnabled}
            trackColor={{ false: colors.border, true: colors.amber }}
            thumbColor={crtEnabled ? colors.background : colors.textMuted}
            accessible
            accessibilityRole="switch"
            accessibilityLabel="CRT enabled"
            accessibilityHint="Toggle CRT visual effects"
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>INTENSITY</Text>
          <View style={styles.stepper}>
            <Pressable
              testID="crt-intensity-down"
              style={[styles.stepBtn, !crtEnabled && styles.stepDisabled]}
              onPress={() => setCrtIntensity(lower)}
              disabled={!crtEnabled}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Decrease CRT intensity"
              accessibilityState={{ disabled: !crtEnabled }}
            >
              <Text style={styles.stepText}>-</Text>
            </Pressable>
            <Text style={styles.stepValue}>{crtIntensity.toFixed(1)}</Text>
            <Pressable
              testID="crt-intensity-up"
              style={[styles.stepBtn, !crtEnabled && styles.stepDisabled]}
              onPress={() => setCrtIntensity(raise)}
              disabled={!crtEnabled}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Increase CRT intensity"
              accessibilityState={{ disabled: !crtEnabled }}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>AUDIO</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>MASTER VOLUME</Text>
          <View style={styles.stepper}>
            <Pressable
              testID="master-volume-down"
              style={styles.stepBtn}
              onPress={() => setMasterVolume(masterLower)}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Decrease master volume"
            >
              <Text style={styles.stepText}>-</Text>
            </Pressable>
            <Text style={styles.stepValue}>{fmtVolume(masterVolume)}</Text>
            <Pressable
              testID="master-volume-up"
              style={styles.stepBtn}
              onPress={() => setMasterVolume(masterRaise)}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Increase master volume"
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>SFX VOLUME</Text>
          <View style={styles.stepper}>
            <Pressable
              testID="sfx-volume-down"
              style={styles.stepBtn}
              onPress={() => setSfxVolume(sfxLower)}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Decrease SFX volume"
            >
              <Text style={styles.stepText}>-</Text>
            </Pressable>
            <Text style={styles.stepValue}>{fmtVolume(sfxVolume)}</Text>
            <Pressable
              testID="sfx-volume-up"
              style={styles.stepBtn}
              onPress={() => setSfxVolume(sfxRaise)}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Increase SFX volume"
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>STATIC</Text>
          <Switch
            testID="static-enabled-switch"
            value={staticEnabled}
            onValueChange={setStaticEnabled}
            trackColor={{ false: colors.border, true: colors.amber }}
            thumbColor={staticEnabled ? colors.background : colors.textMuted}
            accessible
            accessibilityRole="switch"
            accessibilityLabel="Static noise enabled"
            accessibilityHint="Toggle inter-band static noise"
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>ACCESSIBILITY</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>REDUCED MOTION</Text>
          <Switch
            testID="reduced-motion-switch"
            value={reducedMotion}
            onValueChange={setReducedMotion}
            trackColor={{ false: colors.border, true: colors.amber }}
            thumbColor={reducedMotion ? colors.background : colors.textMuted}
            accessible
            accessibilityRole="switch"
            accessibilityLabel="Reduced motion"
            accessibilityHint="Disable nonessential animations and flicker"
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>ANALYTICS</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>USAGE DATA</Text>
          <Switch
            testID="analytics-enabled-switch"
            value={analyticsEnabled}
            onValueChange={setAnalyticsEnabled}
            trackColor={{ false: colors.border, true: colors.amber }}
            thumbColor={analyticsEnabled ? colors.background : colors.textMuted}
            accessible
            accessibilityRole="switch"
            accessibilityLabel="Analytics enabled"
            accessibilityHint="Opt in to local, non-identifying usage tracking"
          />
        </View>
      </View>

      <Pressable
        testID="settings-achievements-link"
        style={styles.link}
        onPress={() => router.push('/settings/achievements')}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Open achievements"
      >
        <Text style={styles.linkText}>ACHIEVEMENTS →</Text>
      </Pressable>
      <View style={styles.divider} />
      <ErrorReportButton />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.amber,
    marginBottom: spacing.md,
    letterSpacing: 4,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 3,
  },
  description: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text,
    letterSpacing: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: {
    opacity: 0.35,
  },
  stepText: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.amber,
  },
  stepValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    minWidth: 32,
    textAlign: 'center',
  },
  purchaseButton: {
    backgroundColor: colors.amber,
    padding: 14,
    borderRadius: 4,
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: colors.background,
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '600',
  },
  restoreButton: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  restoreButtonText: {
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  ownedContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.amber,
    padding: 14,
    borderRadius: 4,
    alignItems: 'center',
  },
  ownedText: {
    color: colors.amber,
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: 10,
    fontFamily: fonts.mono,
    fontSize: 14,
  },
  link: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    alignSelf: 'center',
  },
  linkText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.amber,
    letterSpacing: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  note: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
});
