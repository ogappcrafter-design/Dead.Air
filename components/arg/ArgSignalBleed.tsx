// components/arg/ArgSignalBleed.tsx
// DEA-91: the player-facing surface of the in-fiction ARG trail.
//
// Two things live here:
//   1. A bleed — CLASSIFIED-band text that is not a call. It appears when the
//      trail's conditions are met and stays until the player files it (or
//      ignores it; nothing is forced).
//   2. A log — the rows and bleeds already collected, collapsed to one line
//      until the player opens it. Nothing renders before the player has
//      collected something, so a player who never investigates sees no new UI.
//
// The DECODE action is the in-game equivalent of screenshotting the trace and
// reading it by hand: the panel runs the real glyph round-trip and prints the
// registry row the matrix carries.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import type { ArgFragmentSpec, ArgTraceSpec } from '../../data/arg';
import type { DecodedArtifact, TrailLog } from '../../engine/arg/ArgTrail';

export interface ArgSignalBleedProps {
  activeTrace: ArgTraceSpec | null;
  activeFragment: ArgFragmentSpec | null;
  log: TrailLog;
  resolved: boolean;
  /** True when the resolved trail is tuned to the carrier and unplayed. */
  hiddenCallArmed: boolean;
  /** Runs the glyph round-trip and returns the artifact (or null). */
  onDecode: () => DecodedArtifact | null;
  /** Files the visible bleed. */
  onFile: () => void;
  /** Answers the armed carrier. */
  onAnswer: () => void;
}

export function ArgSignalBleed({
  activeTrace,
  activeFragment,
  log,
  resolved,
  hiddenCallArmed,
  onDecode,
  onFile,
  onAnswer,
}: ArgSignalBleedProps) {
  const [artifact, setArtifact] = useState<DecodedArtifact | null>(null);
  const [expanded, setExpanded] = useState(false);

  const collected = log.decodedRows.length + log.filedFragments.length;
  const isLive = activeTrace !== null || activeFragment !== null || hiddenCallArmed;
  const hasLog = collected > 0;

  if (!isLive && artifact === null && !hasLog) {
    return null;
  }

  const showLog = expanded;

  return (
    <View style={styles.root} testID="arg-signal-bleed">
      <View style={styles.headerRow}>
        <Text style={styles.header}>◈ {isLive ? 'SIGNAL BLEED' : 'TRAIL LOG'}</Text>
        {hasLog && (
          <Pressable
            testID="arg-trail-log-toggle"
            onPress={() => setExpanded((value) => !value)}
            hitSlop={8}
            accessible
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Collapse trail log' : 'Expand trail log'}
          >
            <Text style={styles.counter}>
              {resolved ? '47/47' : `ROWS ${log.decodedRows.length}/${log.totalTraces}`}
            </Text>
          </Pressable>
        )}
      </View>

      {artifact !== null && (
        <View style={styles.block}>
          <Text style={styles.decodedKey}>{artifact.payload}</Text>
          <Text style={styles.decodedLine}>
            {artifact.row.designation} · CARRIER {artifact.row.carrier}
          </Text>
          <Text style={styles.decodedLine}>{artifact.row.site}</Text>
          <Text style={styles.decodedStatus}>{artifact.row.status}</Text>
          <Pressable
            testID="arg-close-artifact"
            onPress={() => setArtifact(null)}
            hitSlop={8}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Close decoded row"
          >
            <Text style={styles.action}>CLOSE</Text>
          </Pressable>
        </View>
      )}

      {artifact === null && activeTrace !== null && (
        <View style={styles.block}>
          <Text style={styles.prompt}>TRACE DETECTED — UNRESOLVED</Text>
          <Text style={styles.hint}>A matrix in the raster. Hold still and read it.</Text>
          <Pressable
            testID="arg-decode-trace"
            onPress={() => setArtifact(onDecode())}
            hitSlop={8}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Decode the scanline trace"
          >
            <Text style={styles.action}>DECODE ▸</Text>
          </Pressable>
        </View>
      )}

      {activeFragment !== null && (
        <View style={styles.block}>
          <Text style={styles.prompt}>{activeFragment.label}</Text>
          {activeFragment.text.map((line, index) => (
            <Text key={index} style={styles.bleedLine}>
              {line}
            </Text>
          ))}
          <Pressable
            testID="arg-file-fragment"
            onPress={onFile}
            hitSlop={8}
            accessible
            accessibilityRole="button"
            accessibilityLabel="File this signal bleed"
          >
            <Text style={styles.action}>FILE IT ▸</Text>
          </Pressable>
        </View>
      )}

      {hiddenCallArmed && artifact === null && (
        <View style={styles.block}>
          <Text style={styles.prompt}>CARRIER LIVE — 104.7</Text>
          <Text style={styles.hint}>Nothing on the band is calling. Something is waiting.</Text>
          <Pressable
            testID="arg-answer-carrier"
            onPress={onAnswer}
            hitSlop={8}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Answer the carrier at 104.7"
          >
            <Text style={styles.action}>ANSWER ▸</Text>
          </Pressable>
        </View>
      )}

      {showLog && hasLog && (
        <View style={styles.block}>
          {log.decodedRows.map((row) => (
            <Text key={row.row} style={styles.logLine}>
              ROW {row.row} · {row.designation} · {row.carrier} · {row.status}
            </Text>
          ))}
          {log.filedFragments.map((fragment) => (
            <Text key={fragment.id} style={styles.logLine}>
              FILED · {fragment.label}
            </Text>
          ))}
          {log.decodedRows.length > 0 && log.filedFragments.length === 0 && (
            <Text style={styles.hint}>The register is not finished with you.</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 82,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,140,0,0.35)',
    backgroundColor: 'rgba(3,3,3,0.88)',
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  header: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.amber,
  },
  counter: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.dimGreen,
  },
  block: {
    marginTop: spacing.xs,
    gap: 2,
  },
  prompt: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.green,
  },
  hint: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
  },
  bleedLine: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 15,
    color: colors.text,
  },
  decodedKey: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 1,
    color: colors.amber,
  },
  decodedLine: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text,
  },
  decodedStatus: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.red,
  },
  logLine: {
    fontFamily: fonts.mono,
    fontSize: 10,
    lineHeight: 13,
    color: colors.textMuted,
  },
  action: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.amber,
    paddingTop: 2,
  },
});
