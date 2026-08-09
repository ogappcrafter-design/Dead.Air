import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import { useSettingsStore, type AudioQuality } from '../../store/useSettingsStore';
import type { ScanlineMode } from '../shared/CRTEffects';
import {
  getRecommendedSettings,
  getPerformanceTier,
  resetDeviceCache,
} from '../../utils/deviceInfo';

type ScanlineOption = {
  value: ScanlineMode;
  label: string;
  desc: string;
};

type AudioQualityOption = {
  value: AudioQuality;
  label: string;
  desc: string;
};

const SCANLINE_OPTIONS: readonly ScanlineOption[] = [
  { value: 'full', label: 'FULL', desc: '20 scanlines, authentic CRT' },
  { value: 'reduced', label: 'REDUCED', desc: '10 scanlines, lighter' },
  { value: 'off', label: 'OFF', desc: 'No scanlines, fastest' },
] as const;

const AUDIO_QUALITY_OPTIONS: readonly AudioQualityOption[] = [
  { value: 'low', label: 'LOW', desc: 'Low latency, fewer effects' },
  { value: 'balanced', label: 'BALANCED', desc: 'Mixed quality & latency' },
  { value: 'high', label: 'HIGH', desc: 'Full effects, higher latency' },
] as const;

export function PerformanceSettingsPanel(): React.JSX.Element {
  const scanlineDensity = useSettingsStore((s) => s.scanlineDensity);
  const setScanlineDensity = useSettingsStore((s) => s.setScanlineDensity);
  const particleEffects = useSettingsStore((s) => s.particleEffects);
  const setParticleEffects = useSettingsStore((s) => s.setParticleEffects);
  const audioQuality = useSettingsStore((s) => s.audioQuality);
  const setAudioQuality = useSettingsStore((s) => s.setAudioQuality);
  const autoDetectPerformance = useSettingsStore((s) => s.autoDetectPerformance);
  const setAutoDetectPerformance = useSettingsStore((s) => s.setAutoDetectPerformance);

  const [tierLabel, setTierLabel] = useState<string>('—');

  const handleAutoDetect = useCallback(() => {
    resetDeviceCache();
    const tier = getPerformanceTier();
    setTierLabel(tier.toUpperCase());
    const rec = getRecommendedSettings();
    setScanlineDensity(rec.scanlineDensity);
    setParticleEffects(rec.particleEffects);
    setAudioQuality(rec.audioQuality);
  }, [setScanlineDensity, setParticleEffects, setAudioQuality]);

  return (
    <View style={styles.container} testID="performance-settings-panel">
      {/* Auto-detect toggle */}
      <View style={styles.row}>
        <View style={styles.labelCol}>
          <Text style={styles.rowLabel}>AUTO-DETECT</Text>
          <Text style={styles.rowDesc}>Adjust settings based on device</Text>
        </View>
        <Switch
          value={autoDetectPerformance}
          onValueChange={setAutoDetectPerformance}
          trackColor={{ false: colors.surfaceLight, true: colors.dimGreen }}
          testID="auto-detect-switch"
        />
      </View>

      {/* Auto-detect button */}
      {autoDetectPerformance && (
        <Pressable
          style={styles.detectBtn}
          onPress={handleAutoDetect}
          testID="detect-btn"
          accessible
          accessibilityRole="button"
          accessibilityLabel="Detect device performance"
          accessibilityHint="Automatically sets scanline, particle, and audio quality based on device"
        >
          <Text style={styles.detectBtnText}>DETECT NOW ({tierLabel})</Text>
        </Pressable>
      )}

      {/* Scanline density */}
      <View style={styles.section}>
        <Text style={styles.sectionSubLabel}>SCANLINE DENSITY</Text>
        <View style={styles.optionList}>
          {SCANLINE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.option, scanlineDensity === opt.value && styles.optionSelected]}
              onPress={() => setScanlineDensity(opt.value)}
              testID={`scanline-${opt.value}`}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Scanline ${opt.label}`}
              accessibilityHint={opt.desc}
            >
              <Text
                style={[
                  styles.optionLabel,
                  scanlineDensity === opt.value
                    ? styles.optionLabelActive
                    : styles.optionLabelMuted,
                ]}
              >
                {opt.label}
              </Text>
              <Text style={styles.optionDesc}>{opt.desc}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Particle effects */}
      <View style={styles.row}>
        <View style={styles.labelCol}>
          <Text style={styles.rowLabel}>PARTICLE FX</Text>
          <Text style={styles.rowDesc}>Phosphor glow & ambient particles</Text>
        </View>
        <Switch
          value={particleEffects}
          onValueChange={setParticleEffects}
          trackColor={{ false: colors.surfaceLight, true: colors.dimGreen }}
          testID="particle-fx-switch"
        />
      </View>

      {/* Audio quality */}
      <View style={styles.section}>
        <Text style={styles.sectionSubLabel}>AUDIO QUALITY</Text>
        <View style={styles.optionList}>
          {AUDIO_QUALITY_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.option, audioQuality === opt.value && styles.optionSelected]}
              onPress={() => setAudioQuality(opt.value)}
              testID={`audio-quality-${opt.value}`}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Audio quality ${opt.label}`}
              accessibilityHint={opt.desc}
            >
              <Text
                style={[
                  styles.optionLabel,
                  audioQuality === opt.value ? styles.optionLabelActive : styles.optionLabelMuted,
                ]}
              >
                {opt.label}
              </Text>
              <Text style={styles.optionDesc}>{opt.desc}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 32,
  },
  labelCol: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text,
    letterSpacing: 2,
  },
  rowDesc: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  section: {
    gap: spacing.xs,
  },
  sectionSubLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 3,
  },
  optionList: {
    gap: spacing.xs,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  optionSelected: {
    borderColor: colors.amber,
  },
  optionLabel: {
    fontFamily: fonts.mono,
    fontSize: 14,
    letterSpacing: 2,
  },
  optionLabelActive: {
    color: colors.amber,
  },
  optionLabelMuted: {
    color: colors.textMuted,
  },
  optionDesc: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  detectBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  detectBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.green,
    letterSpacing: 2,
  },
});
