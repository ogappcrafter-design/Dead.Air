import { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import { useRadioStore } from '../../store/useRadioStore';
import { useGameStore } from '../../store/useGameStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { FrequencyDisplay } from './FrequencyDisplay';
import { BandSelector } from './BandSelector';
import { TuningDial } from './TuningDial';
import { VolumeControl } from './VolumeControl';
import { SignalStrength } from './SignalStrength';
import { BANDS as BAND_DATA } from '../../data/bands';
import { Band } from '../../lib/constants';

export function RadioBody() {
  // Narrow selective selectors — each subscription only fires when that slice changes.
  const currentBand = useRadioStore((s) => s.currentBand);
  const frequency = useRadioStore((s) => s.frequency);
  const volume = useRadioStore((s) => s.volume);
  const isTuning = useRadioStore((s) => s.isTuning);
  const signalStrength = useRadioStore((s) => s.signalStrength);
  const setFrequency = useRadioStore((s) => s.setFrequency);
  const setTuning = useRadioStore((s) => s.setTuning);
  const setVolume = useRadioStore((s) => s.setVolume);

  const unlockedBands = useGameStore((s) => s.unlockedBands);

  const stationName = usePlayerStore((s) => s.stationName);

  const setBand = useRadioStore((s) => s.setBand);

  const bandInfo = BAND_DATA[currentBand];
  const minFreq = bandInfo.frequencyRange[0];
  const maxFreq = bandInfo.frequencyRange[1];

  const handleBandSelect = useCallback(
    (band: Band) => {
      setBand(band);
      const bandData = BAND_DATA[band];
      setFrequency(bandData.frequencyRange[0]);
    },
    [setBand, setFrequency],
  );

  const handleVolumeChange = useCallback(
    (vol: number) => {
      setVolume(vol);
    },
    [setVolume],
  );

  const handleMuteToggle = useCallback(() => {
    setVolume(volume > 0 ? 0 : 0.5);
  }, [volume, setVolume]);

  const handleTuningStart = useCallback(() => setTuning(true), [setTuning]);
  const handleTuningEnd = useCallback(() => setTuning(false), [setTuning]);

  const bandName = useMemo(() => bandInfo.name, [bandInfo]);

  return (
    <View style={styles.container}>
      <View style={styles.radio} accessible accessibilityLabel="Radio receiver">
        <FrequencyDisplay frequency={frequency} bandName={bandName} />
        {stationName.length > 0 && (
          <Text style={styles.stationName} numberOfLines={1}>
            {stationName}
          </Text>
        )}

        <BandSelector
          currentBand={currentBand}
          unlockedBands={unlockedBands}
          onBandSelect={handleBandSelect}
        />

        <View style={styles.mainArea}>
          <View style={styles.leftColumn}>
            <VolumeControl
              volume={volume}
              onVolumeChange={handleVolumeChange}
              muted={volume === 0}
              onMuteToggle={handleMuteToggle}
            />
          </View>

          <View style={styles.centerColumn}>
            <TuningDial
              frequency={frequency}
              minFreq={minFreq}
              maxFreq={maxFreq}
              isTuning={isTuning}
              onFrequencyChange={setFrequency}
              onTuningStart={handleTuningStart}
              onTuningEnd={handleTuningEnd}
            />
          </View>

          <View style={styles.rightColumn}>
            <SignalStrength strength={signalStrength} isTuning={isTuning} />
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.powerIndicator} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  radio: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.lg,
  },
  mainArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  leftColumn: {
    flex: 1,
  },
  centerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  rightColumn: {
    flex: 1,
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  powerIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
  },
  stationName: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.amber,
    textAlign: 'center',
    letterSpacing: 2,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    opacity: 0.8,
  },
});
