// hooks/useSanityEffect.ts
// React hook: live SanityEffect derived from game store sanity.
// Pure derivation, memoized. No data/calls.js touch.

import { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { computeSanityEffect } from '../engine/calls/SanityEffectEngine';
import type { SanityEffect } from '../engine/calls/SanityEffectConfig';

/**
 * Subscribe to game store `sanity` and settings store `difficulty`,
 * return the computed SanityEffect. Recomputes only when either changes.
 */
export function useSanityEffect(): SanityEffect {
  const sanity = useGameStore((s) => s.sanity);
  const difficulty = useSettingsStore((s) => s.difficulty);
  return useMemo(() => computeSanityEffect(sanity, difficulty), [sanity, difficulty]);
}
