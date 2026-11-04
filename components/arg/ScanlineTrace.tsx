// components/arg/ScanlineTrace.tsx
// DEA-91: the glyph matrix hidden in the CRT scanline layer.
//
// This is not an overlay painted on top of the CRT — it renders inside the
// drifting scanline stack (see ScanlineOverlay's `trace` slot in
// components/shared/CRTEffects.tsx), in the same phosphor, at the same
// intensity scale. It reads as dense interference on the raster until the
// player stops to look at it.
//
// The matrix is 13 mono text rows rather than 169 Views: the scanline overlay
// was deliberately cut from 80 Views to 20 for render cost, and the ARG must
// not undo that. Text rows keep the trace free.
//
// Note: when scanline density is 'off' the whole overlay (and therefore the
// trace) does not render. That is consistent with the trail's contract — a
// player who turns the CRT off is not investigating, and loses only the
// hidden call.

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../lib/theme';
import { glyphMatrixRows, type GlyphGrid } from '../../engine/arg/GlyphCodec';

export interface ScanlineTraceProps {
  grid: GlyphGrid;
  /** CRT intensity 0..1 — scales the phosphor like the rest of the layer. */
  intensity?: number;
}

export const ScanlineTrace = memo(function ScanlineTrace({
  grid,
  intensity = 0.3,
}: ScanlineTraceProps) {
  const rows = glyphMatrixRows(grid);
  // Never fully invisible (the player is looking right at it), never loud.
  const opacity = Math.min(0.42, 0.16 + Math.max(0, intensity) * 0.5);

  return (
    <View style={[styles.root, { opacity }]} pointerEvents="none" testID="arg-scanline-trace">
      {rows.map((row, index) => (
        <Text key={index} style={styles.row} numberOfLines={1} allowFontScaling={false}>
          {row}
        </Text>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    right: '9%',
    bottom: '24%',
  },
  row: {
    fontFamily: fonts.mono,
    fontSize: 7,
    lineHeight: 7,
    letterSpacing: 0,
    color: colors.amber,
  },
});
