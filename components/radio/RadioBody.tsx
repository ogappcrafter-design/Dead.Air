import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '../../lib/theme';
import { useRadioStore } from '../../store/useRadioStore';
import { useGameStore } from '../../store/useGameStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { FrequencyDisplay } from './FrequencyDisplay';
import { BandSelector } from './BandSelector';
import { TuningDial } from './TuningDial';
import { VolumeControl } from './VolumeControl';
import { SignalStrength } from './SignalStrength';
import { BANDS as BAND_DATA } from '../../data/bands';

export function RadioBody() {
  const {
    currentBand,
    frequency,
    volume,
    isTuning,
    signalStrength,
    setFrequency,
    setTuning,
    setVolume,
  } = useRadioStore();
  const { unlockedBands, setBand } = useGameStore();
  const { sfxVolume, masterVolume, staticEnabled } = useSettingsStore();

  const bandInfo = BAND_DATA[currentBand];

  const handleBandSelect = (band: typeof currentBand) => {
    setBand(band);
    const bandData = BAND_DATA[band];
    setFrequency(bandData.frequencyRange[0]);
  };

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
  };

  const handleMuteToggle = () => {
    setVolume(volume > 0 ? 0 : 0.5);
  };

  return (
    <View style={styles.container}>
      <View style={styles.radio}>
        <FrequencyDisplay frequency={frequency} bandName={bandInfo.name} />

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
              minFreq={bandInfo.frequencyRange[0]}
              maxFreq={bandInfo.frequencyRange[1]}
              isTuning={isTuning}
              onFrequencyChange={setFrequency}
              onTuningStart={() => setTuning(true)}
              onTuningEnd={() => setTuning(false)}
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
});
