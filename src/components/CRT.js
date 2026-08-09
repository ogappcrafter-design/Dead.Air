import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

/**
 * Scanline + vignette overlay. The README has promised a "CRT scanline
 * aesthetic" since v1; this is the first build that actually draws one.
 *
 * The scanlines are a 1x3px PNG tiled with resizeMode="repeat" rather than a
 * stack of a few hundred Views — one node instead of one per line, and the GPU
 * does the tiling.
 */
const SCANLINE_TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAADCAYAAABS3WWCAAAAD0lEQVR42mNgYGDQY4ADAAIJAC/RxCXXAAAAAElFTkSuQmCC';

function CRT() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={{ uri: SCANLINE_TILE }}
        style={StyleSheet.absoluteFill}
        resizeMode="repeat"
        fadeDuration={0}
      />
      {/* Vignette, approximated with four edge gradients-by-opacity. */}
      <View style={[s.edge, s.top]} />
      <View style={[s.edge, s.bottom]} />
      <View style={[s.edge, s.left]} />
      <View style={[s.edge, s.right]} />
    </View>
  );
}

const s = StyleSheet.create({
  edge: { position: 'absolute', backgroundColor: '#000', opacity: 0.35 },
  top: { top: 0, left: 0, right: 0, height: 56 },
  bottom: { bottom: 0, left: 0, right: 0, height: 72 },
  left: { top: 0, bottom: 0, left: 0, width: 20, opacity: 0.22 },
  right: { top: 0, bottom: 0, right: 0, width: 20, opacity: 0.22 },
});

export default React.memo(CRT);
