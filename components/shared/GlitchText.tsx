// components/shared/GlitchText.tsx
// Occasionally swaps the displayed text to an unsettling variant for a few
// frames, then reverts. The swap is rare and brief — a subliminal jolt, not a
// strobe. Uses a deterministic-ish timer so it doesn't feel scripted.

import { useEffect, useState, useCallback } from 'react';
import { Text, TextStyle } from 'react-native';

interface GlitchTextProps {
  base: string;
  variants: string[];
  style?: TextStyle;
  /** Average ms between glitch swaps. Default 6000. */
  intervalMs?: number;
  /** How long (ms) the variant stays before reverting. Default 140. */
  holdMs?: number;
}

export function GlitchText({
  base,
  variants,
  style,
  intervalMs = 6000,
  holdMs = 140,
}: GlitchTextProps) {
  const [display, setDisplay] = useState(base);

  const tick = useCallback(() => {
    if (variants.length === 0) return;
    const idx = Math.floor(Math.random() * variants.length);
    setDisplay(variants[idx] ?? base);
    setTimeout(() => setDisplay(base), holdMs);
  }, [base, variants, holdMs]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = intervalMs * (0.5 + Math.random());
      timeout = setTimeout(() => {
        tick();
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [tick, intervalMs]);

  return <Text style={style}>{display}</Text>;
}
