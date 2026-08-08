import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { colors, fonts, spacing } from '../../lib/theme';
import { formatTranscript, transcriptToText } from '../../utils/transcriptFormatter';
import type { CallData } from '../../engine/calls/types';

interface ShareTranscriptProps {
  call: CallData;
  djCallSign: string;
}

export function ShareTranscript({ call, djCallSign }: ShareTranscriptProps) {
  const viewRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transcript = formatTranscript(call, djCallSign);

  const handleShare = useCallback(async () => {
    if (!viewRef.current || sharing) return;
    setSharing(true);
    setError(null);
    try {
      const uri = await captureRef(viewRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Dead Air Radio — Transcript',
        });
      } else {
        setError('Sharing not available on this device');
      }
    } catch (e) {
      setError('Failed to capture transcript');
    } finally {
      setSharing(false);
    }
  }, [sharing]);

  return (
    <View style={styles.container}>
      <View ref={viewRef} style={styles.transcriptImage} collapsable={false}>
        <View style={styles.header}>
          <Text style={styles.stationName}>{transcript.stationName}</Text>
          <Text style={styles.djCallSign}>DJ {transcript.djCallSign}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.linesContainer}>
          {transcript.lines.map((line, idx) => (
            <View key={idx} style={styles.lineRow}>
              <Text style={styles.speaker}>{line.speaker}</Text>
              <Text style={styles.lineText}>{line.text}</Text>
            </View>
          ))}
        </View>
        <View style={styles.divider} />
        <Text style={styles.watermark}>{transcript.watermark}</Text>
      </View>

      <TouchableOpacity
        style={styles.shareButton}
        onPress={handleShare}
        disabled={sharing}
        activeOpacity={0.7}
      >
        {sharing ? (
          <ActivityIndicator color={colors.background} size="small" />
        ) : (
          <Text style={styles.shareButtonText}>SHARE TRANSCRIPT</Text>
        )}
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
  },
  transcriptImage: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    maxWidth: 320,
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  stationName: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.amber,
    letterSpacing: 2,
  },
  djCallSign: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.green,
    letterSpacing: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  linesContainer: {
    gap: spacing.xs,
  },
  lineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  speaker: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
    minWidth: 60,
  },
  lineText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text,
    flex: 1,
  },
  watermark: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    letterSpacing: 4,
    marginTop: spacing.sm,
  },
  shareButton: {
    backgroundColor: colors.amber,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 4,
    alignItems: 'center',
  },
  shareButtonText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.background,
    letterSpacing: 2,
  },
  errorText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.red,
  },
});
