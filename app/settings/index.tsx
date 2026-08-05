import { View, Text, StyleSheet, Pressable, Switch, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, spacing } from '../../lib/theme';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAnalyticsStore } from '../../store/useAnalyticsStore';

const CRT_INTENSITY_STEP = 0.1;

export default function SettingsScreen() {
  const crtEnabled = useSettingsStore((s) => s.crtEnabled);
  const setCrtEnabled = useSettingsStore((s) => s.setCrtEnabled);
  const crtIntensity = useSettingsStore((s) => s.crtIntensity);
  const setCrtIntensity = useSettingsStore((s) => s.setCrtIntensity);
  const analyticsEnabled = useAnalyticsStore((s) => s.enabled);
  const setAnalyticsEnabled = useAnalyticsStore((s) => s.setEnabled);

  const lower = Math.max(0, Math.round((crtIntensity - CRT_INTENSITY_STEP) * 10) / 10);
  const raise = Math.min(1, Math.round((crtIntensity + CRT_INTENSITY_STEP) * 10) / 10);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>SETTINGS</Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>CRT</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>ENABLED</Text>
          <Switch
            value={crtEnabled}
            onValueChange={setCrtEnabled}
            trackColor={{ false: colors.border, true: colors.amber }}
            thumbColor={crtEnabled ? colors.background : colors.textMuted}
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>INTENSITY</Text>
          <View style={styles.stepper}>
            <Pressable
              style={[styles.stepBtn, !crtEnabled && styles.stepDisabled]}
              onPress={() => setCrtIntensity(lower)}
              disabled={!crtEnabled}
            >
              <Text style={styles.stepText}>-</Text>
            </Pressable>
            <Text style={styles.stepValue}>{crtIntensity.toFixed(1)}</Text>
            <Pressable
              style={[styles.stepBtn, !crtEnabled && styles.stepDisabled]}
              onPress={() => setCrtIntensity(raise)}
              disabled={!crtEnabled}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>ANALYTICS</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>LOCAL ONLY</Text>
          <Switch
            value={analyticsEnabled}
            onValueChange={setAnalyticsEnabled}
            trackColor={{ false: colors.border, true: colors.amber }}
            thumbColor={analyticsEnabled ? colors.background : colors.textMuted}
          />
        </View>
        <Text style={styles.note}>Opt-in. Events stay on device. No accounts, no network.</Text>
      </View>

      <Pressable style={styles.link} onPress={() => router.push('/settings/achievements')}>
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
