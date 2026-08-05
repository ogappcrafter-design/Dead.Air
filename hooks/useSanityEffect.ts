// hooks/useSanityEffect.ts
// React hook: live SanityEffect derived from game store sanity.
// Pure derivation, memoized. No data/calls.js touch.

import { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { computeSanityEffect } from '../engine/calls/SanityEffectEngine';
import type { SanityEffect } from '../engine/calls/SanityEffectConfig';

/**
 * Subscribe to game store `sanity` and return the computed SanityEffect.
 * Recomputes only when sanity changes (referentially stable otherwise).
 */
export function useSanityEffect(): SanityEffect {
  const sanity = useGameStore((s) => s.sanity);
  return useMemo(() => computeSanityEffect(sanity), [sanity]);
}
