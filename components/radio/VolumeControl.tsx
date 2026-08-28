import { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';

interface VolumeControlProps {
  volume: number; // 0-1
  onVolumeChange: (vol: number) => void;
  muted: boolean;
  onMuteToggle: () => void;
}

export const VolumeControl = memo(function VolumeControl({
  volume,
  onVolumeChange,
  muted,
  onMuteToggle,
}: VolumeControlProps) {
  const segments = 10;
  const activeSegments = Math.round(volume * segments);

  const handleIncrease = () => {
    onVolumeChange(Math.min(1, volume + 0.1));
  };

  const handleDecrease = () => {
    onVolumeChange(Math.max(0, volume - 0.1));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label} accessibilityRole="header">
        VOLUME
      </Text>
      <View style={styles.controls}>
        <Pressable
          style={styles.button}
          onPress={handleDecrease}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Decrease volume"
          accessibilityHint="Lowers radio volume by 10 percent"
        >
          <Text style={styles.buttonText}>−</Text>
        </Pressable>
        <View
          style={styles.barContainer}
          accessible
          accessibilityLabel={`Volume ${Math.round(volume * 100)} percent`}
        >
          {Array.from({ length: segments }, (_, idx) => (
            <View
              key={`vol-${idx}`}
              style={[styles.segment, idx < activeSegments && styles.segmentActive]}
            />
          ))}
        </View>
        <Pressable
          style={styles.button}
          onPress={handleIncrease}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Increase volume"
          accessibilityHint="Raises radio volume by 10 percent"
        >
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
      <Pressable
        style={styles.muteButton}
        onPress={onMuteToggle}
        accessible
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Unmute radio' : 'Mute radio'}
        accessibilityHint={muted ? 'Tap to restore radio audio' : 'Tap to silence radio'}
      >
        <Text
          style={[styles.muteText, muted && styles.muteTextActive]}
          accessibilityLiveRegion="polite"
        >
          {muted ? 'MUTED' : 'MUTE'}
        </Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  button: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.text,
  },
  barContainer: {
    flexDirection: 'row',
    gap: 2,
    height: 16,
    alignItems: 'flex-end',
  },
  segment: {
    width: 4,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 1,
  },
  segmentActive: {
    backgroundColor: colors.amber,
  },
  muteButton: {
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  muteText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  muteTextActive: {
    color: colors.red,
  },
});
