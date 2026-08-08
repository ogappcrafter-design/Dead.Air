import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, spacing } from '../../lib/theme';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAnalyticsStore } from '../../store/useAnalyticsStore';
import { useStoreStore } from '../../store/useStoreStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { ErrorReportButton } from '../../components/shared/ErrorReportButton';
import { restorePurchases } from '../../lib/iap';

const CRT_INTENSITY_STEP = 0.1;
const VOLUME_STEP = 0.1;

const fmtVolume = (vol: number): string => vol.toFixed(1);

export default function SettingsScreen() {
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

  const isConnected = useStoreStore((s) => s.isConnected);
  const hasBase = useStoreStore((s) => s.hasBase);
  const hasInfiniteSignal = useStoreStore((s) => s.hasInfiniteSignal);
  const lastError = useStoreStore((s) => s.lastError);
  const lastMessage = useStoreStore((s) => s.lastMessage);

  const playerName = usePlayerStore((s) => s.playerName);
  const setPlayerName = usePlayerStore((s) => s.setPlayerName);
  const djCallSign = usePlayerStore((s) => s.djCallSign);
  const setDjCallSign = usePlayerStore((s) => s.setDjCallSign);
  const stationName = usePlayerStore((s) => s.stationName);
  const setStationName = usePlayerStore((s) => s.setStationName);

  const [editingName, setEditingName] = useState(playerName);
  const [editingCallSign, setEditingCallSign] = useState(djCallSign);
  const [editingStation, setEditingStation] = useState(stationName);

  const lower = Math.max(0, Math.round((crtIntensity - CRT_INTENSITY_STEP) * 10) / 10);
  const raise = Math.min(1, Math.round((crtIntensity + CRT_INTENSITY_STEP) * 10) / 10);

  const masterLower = Math.max(0, Math.round((masterVolume - VOLUME_STEP) * 10) / 10);
  const masterRaise = Math.min(1, Math.round((masterVolume + VOLUME_STEP) * 10) / 10);
  const sfxLower = Math.max(0, Math.round((sfxVolume - VOLUME_STEP) * 10) / 10);
  const sfxRaise = Math.min(1, Math.round((sfxVolume + VOLUME_STEP) * 10) / 10);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        SETTINGS
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>IDENTITY</Text>

        <View style={styles.identityRow}>
          <Text style={styles.rowLabel}>NAME</Text>
          <TextInput
            testID="settings-player-name"
            style={styles.textInput}
            value={editingName}
            onChangeText={setEditingName}
            onBlur={() => {
              const trimmed = editingName.trim();
              if (trimmed.length > 0) setPlayerName(trimmed);
              else setEditingName(playerName);
            }}
            maxLength={32}
            autoCapitalize="words"
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            accessible
            accessibilityLabel="Player name"
          />
        </View>

        <View style={styles.identityRow}>
          <Text style={styles.rowLabel}>CALL SIGN</Text>
          <TextInput
            testID="settings-dj-call-sign"
            style={styles.textInput}
            value={editingCallSign}
            onChangeText={setEditingCallSign}
            onBlur={() => {
              const trimmed = editingCallSign.trim();
              if (trimmed.length > 0) setDjCallSign(trimmed);
              else setEditingCallSign(djCallSign);
            }}
            maxLength={20}
            autoCapitalize="characters"
            placeholder="DJ call sign"
            placeholderTextColor={colors.textMuted}
            accessible
            accessibilityLabel="DJ call sign"
          />
        </View>

        <View style={styles.identityRow}>
          <Text style={styles.rowLabel}>STATION</Text>
          <TextInput
            testID="settings-station-name"
            style={styles.textInput}
            value={editingStation}
            onChangeText={setEditingStation}
            onBlur={() => {
              const trimmed = editingStation.trim();
              if (trimmed.length > 0) setStationName(trimmed);
              else setEditingStation(stationName);
            }}
            maxLength={32}
            autoCapitalize="words"
            placeholder="Station name"
            placeholderTextColor={colors.textMuted}
            accessible
            accessibilityLabel="Station name"
          />
        </View>
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

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>STORE</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>CONNECTION</Text>
          <Text style={[styles.statusValue, isConnected ? styles.textGreen : styles.textRed]}>
            {isConnected ? 'CONNECTED' : 'OFFLINE'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>BASE GAME</Text>
          <Text style={[styles.statusValue, hasBase ? styles.textGreen : styles.textMuted]}>
            {hasBase ? 'OWNED' : 'NOT OWNED'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>INFINITE SIGNAL</Text>
          <Text
            style={[styles.statusValue, hasInfiniteSignal ? styles.textGreen : styles.textMuted]}
          >
            {hasInfiniteSignal ? 'OWNED' : 'NOT OWNED'}
          </Text>
        </View>

        {(lastError || lastMessage) && (
          <Text
            style={[styles.iapMessage, lastError ? styles.textError : styles.textInfo]}
            numberOfLines={3}
          >
            {lastError?.message ?? lastMessage}
          </Text>
        )}

        <Pressable
          testID="settings-restore-purchases"
          style={({ pressed }) => [styles.restoreBtn, pressed && styles.restoreBtnPressed]}
          onPress={() => {
            void restorePurchases();
          }}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
          accessibilityHint="Re-sync previously purchased entitlements from the store"
        >
          <Text style={styles.restoreBtnText} numberOfLines={1}>
            RESTORE PURCHASES
          </Text>
        </Pressable>
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
  statusValue: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
  },
  textGreen: {
    color: colors.green,
  },
  textRed: {
    color: colors.red,
  },
  textMuted: {
    color: colors.textMuted,
  },
  textError: {
    color: colors.red,
  },
  textInfo: {
    color: colors.green,
  },
  iapMessage: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  restoreBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    marginTop: spacing.xs,
  },
  restoreBtnPressed: {
    opacity: 0.6,
  },
  restoreBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.amber,
    letterSpacing: 2,
  },
  identityRow: {
    flexDirection: 'column',
    gap: spacing.xs,
  },
  textInput: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    letterSpacing: 1,
  },
});
