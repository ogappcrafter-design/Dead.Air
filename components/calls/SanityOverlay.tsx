// components/calls/SanityOverlay.tsx
// Presentational: renders sanity-driven visual artifacts over active calls.
// Pure view — no store access, no game logic. Props driven by SanityEffect.
// data/calls.js untouched.

import { useEffect, useMemo, useState, type JSX, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../lib/theme';
import type { SanityEffect } from '../../engine/calls/SanityEffectConfig';

interface SanityOverlayProps {
  effect: SanityEffect;
}

interface GlitchItem {
  text: string;
  top: number;
  left: number;
  key: number;
  visible?: boolean;
}

/**
 * SanityOverlay — presentational layer. Renders:
 * - Vignette: radial black vignette darkening edges, opacity = effect.vignetteOpacity.
 * - Glitch text: random hallucinationTexts placed at random coords, flickering.
 * - Red scanlines: visible only when effect.visualDistortion > 0.5.
 *
 * Deterministic-ish flicker via 700ms interval so tests/re-renders stay predictable.
 */
export const SanityOverlay = memo(function SanityOverlay({
  effect,
}: SanityOverlayProps): JSX.Element | null {
  const showVignette = effect.vignetteOpacity > 0;
  const showScanlines = effect.visualDistortion > 0.5;
  const glitchTexts = effect.hallucinationTexts;

  // Re-roll glitch placements every 700ms so hallucinations drift, not snap.
  const [roll, setRoll] = useState(0);
  useEffect(() => {
    if (glitchTexts.length === 0) return;
    const id = setInterval(() => setRoll((r) => (r + 1) % 1000), 700);
    return () => clearInterval(id);
  }, [glitchTexts.length]);

  // Build glitch placements from current roll. Stable per roll.
  // Gate items by effect.glitchProbability — if probability is 0 the engine
  // supplied text but the overlay should not display any hallucinations.
  const glitchProbability = effect.glitchProbability ?? 0;
  const glitchItems: GlitchItem[] = useMemo(() => {
    if (glitchTexts.length === 0 || glitchProbability <= 0) return [];
    // Seeded pseudo-random from roll so coordinates are deterministic per roll.
    let seed = roll * 31 + glitchTexts.length * 17;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return glitchTexts
      .map((text, i) => ({
        text,
        top: 8 + rand() * 84, // 8%..92% vertical
        left: 5 + rand() * 80, // 5%..85% horizontal
        key: i,
        visible: rand() < glitchProbability,
      }))
      .filter((item) => item.visible);
  }, [glitchTexts, roll, glitchProbability]);

  // Nothing to render: skip entirely (no zero-opacity layers stacked over calls).
  if (!showVignette && !showScanlines && glitchItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.root} pointerEvents="none">
      {showVignette ? (
        <View style={[styles.vignette, { opacity: effect.vignetteOpacity }]} />
      ) : null}

      {showScanlines ? (
        <View style={styles.scanlines} pointerEvents="none">
          {Array.from({ length: 24 }).map((_, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${(i * 100) / 24}%`,
                height: 1,
                backgroundColor: 'rgba(255, 49, 49, 0.35)',
              }}
            />
          ))}
        </View>
      ) : null}

      {glitchItems.map((item) => (
        <Text
          key={item.key}
          style={[
            styles.glitch,
            {
              top: `${item.top}%`,
              left: `${item.left}%`,
              opacity: 0.35 + (0.55 * ((item.key + roll) % 10)) / 10,
            },
          ]}
        >
          {item.text}
        </Text>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    inset: 0,
    zIndex: 50,
    elevation: 50,
  },
  // Vignette via two stacked radial-gradient-like linear gradients.
  // React Native has no native radial-gradient without LinearGradients,
  // so we approximate via a translucent dark frame using boxShadow inset-like
  // background and a transparent center via alpha layering on top.
  vignette: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'transparent',
    // Wide-corner dark frame approximates a vignette on flat RN views.
    shadowColor: '#000000',
    shadowOpacity: 0.9,
    shadowRadius: 120,
    shadowOffset: { width: 0, height: 0 },
    // Self-fill so shadow spreads inward from all edges.
    borderWidth: 60,
    borderColor: 'rgba(0,0,0,0.85)',
  },
  scanlines: {
    position: 'absolute',
    inset: 0,
    // Fixed dark-red overlay w/ horizontal lines via repeatingLinearGradient.
    // Approximated via translucent red wash + line texture in opacity.
    backgroundColor: 'rgba(255, 49, 49, 0.08)',
    opacity: 0.6,
  },
  glitch: {
    position: 'absolute',
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.red,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});
