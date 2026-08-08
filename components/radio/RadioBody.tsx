import { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSkinStore } from '../../store/useSkinStore';
import { getSkin } from '../../lib/skins';
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

  // Active cosmetic skin — drives all visual properties (colors, fonts, spacing).
  const activeSkin = useSkinStore((s) => s.activeSkin);
  const skin = getSkin(activeSkin);

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

  const skinStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: skin.spacing.comfortable,
        },
        radio: {
          width: '100%',
          maxWidth: 380,
          backgroundColor: skin.colors.surface,
          borderWidth: 2,
          borderColor: skin.colors.border,
          borderRadius: 8,
          padding: skin.spacing.comfortable + 8,
        },
        mainArea: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginVertical: skin.spacing.comfortable,
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
          marginTop: skin.spacing.compact + 4,
        },
        powerIndicator: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: skin.colors.power,
        },
        stationName: {
          fontFamily: skin.fonts.primary,
          fontSize: 11,
          color: skin.colors.station,
          textAlign: 'center',
          letterSpacing: 2,
          marginTop: skin.spacing.compact,
          marginBottom: skin.spacing.compact,
          opacity: 0.8,
        },
      }),
    [skin],
  );

  return (
    <View style={skinStyles.container}>
      <View style={skinStyles.radio} accessible accessibilityLabel="Radio receiver">
        <FrequencyDisplay frequency={frequency} bandName={bandName} />
        {stationName.length > 0 && (
          <Text style={skinStyles.stationName} numberOfLines={1}>
            {stationName}
          </Text>
        )}

        <BandSelector
          currentBand={currentBand}
          unlockedBands={unlockedBands}
          onBandSelect={handleBandSelect}
        />

        <View style={skinStyles.mainArea}>
          <View style={skinStyles.leftColumn}>
            <VolumeControl
              volume={volume}
              onVolumeChange={handleVolumeChange}
              muted={volume === 0}
              onMuteToggle={handleMuteToggle}
            />
          </View>

          <View style={skinStyles.centerColumn}>
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

          <View style={skinStyles.rightColumn}>
            <SignalStrength strength={signalStrength} isTuning={isTuning} />
          </View>
        </View>

        <View style={skinStyles.footer}>
          <View style={skinStyles.powerIndicator} />
        </View>
      </View>
    </View>
  );
}
