// engine/progression/TapeMastery.ts
// DEA-5: Tape Mastery System — pure functions for tracking per-tape listen
// counts and resolving hidden audio layers.
//
// Re-listening to a tape unlocks hidden audio layers:
//   - Surface (1st listen): the base audio layer, always available.
//   - Depth (5th listen): a deeper audio layer with hidden content.
//   - Abyss (10th listen): the deepest layer, full hidden content.
//
// The store persists `tapeListenCounts: Record<string, number>` and
// increments the count each time a tape is played via TapePlayback.
// These pure functions derive the current layer and check for unlocks.
//
// No side effects, no I/O — fully testable. Mirrors the pure-DI style of
// BandUnlock.ts.

/** Listen count thresholds for each layer. */
export const MASTERY_THRESHOLDS = {
  surface: 1,
  depth: 5,
  abyss: 10,
} as const;

/** Layer identifiers, ordered from shallowest to deepest. */
export type MasteryLayer = 'surface' | 'depth' | 'abyss';

/** Human-readable layer labels for UI display. */
export const MASTERY_LAYER_LABELS: Record<MasteryLayer, string> = {
  surface: 'Surface',
  depth: 'Depth',
  abyss: 'Abyss',
};

/** All layers in order (for iteration / comparison). */
export const MASTERY_LAYERS: MasteryLayer[] = ['surface', 'depth', 'abyss'];

/**
 * A mastery layer unlock definition, used by the data file to attach
 * hidden content to each layer.
 */
export interface TapeMasteryLayer {
  /** The tape ID this layer belongs to. */
  tapeId: string;
  /** Which layer this is. */
  layer: MasteryLayer;
  /** Listen count required to unlock this layer. */
  requiredListens: number;
  /** Hidden content revealed at this layer. */
  content: string;
  /** Optional: additional audio cue description. */
  audioCue?: string;
}

/**
 * Resolve which mastery layer the player currently has access to for a
 * given tape, based on their listen count.
 *
 * - 0 listens → null (tape has never been played; no layer yet).
 * - 1-4 listens → 'surface'.
 * - 5-9 listens → 'depth'.
 * - 10+ listens → 'abyss'.
 */
export function getCurrentLayer(listenCount: number): MasteryLayer | null {
  if (listenCount < MASTERY_THRESHOLDS.surface) {
    return null;
  }
  if (listenCount < MASTERY_THRESHOLDS.depth) {
    return 'surface';
  }
  if (listenCount < MASTERY_THRESHOLDS.abyss) {
    return 'depth';
  }
  return 'abyss';
}

/**
 * Check if a specific layer is unlocked for a tape.
 */
export function isLayerUnlocked(listenCount: number, layer: MasteryLayer): boolean {
  const threshold = MASTERY_THRESHOLDS[layer];
  return listenCount >= threshold;
}

/**
 * Get the listen count needed to unlock the next layer above the current one.
 * Returns null if already at the deepest layer (abyss).
 */
export function getNextLayerThreshold(
  listenCount: number,
): { layer: MasteryLayer; listensRemaining: number } | null {
  const current = getCurrentLayer(listenCount);

  if (current === null) {
    return {
      layer: 'surface',
      listensRemaining: MASTERY_THRESHOLDS.surface - listenCount,
    };
  }
  if (current === 'surface') {
    return {
      layer: 'depth',
      listensRemaining: MASTERY_THRESHOLDS.depth - listenCount,
    };
  }
  if (current === 'depth') {
    return {
      layer: 'abyss',
      listensRemaining: MASTERY_THRESHOLDS.abyss - listenCount,
    };
  }
  // Already at abyss — no further layers.
  return null;
}

/**
 * Increment the listen count for a tape. Returns a new record (does not
 * mutate the input).
 *
 * @param counts The current tapeListenCounts record.
 * @param tapeId The tape ID to increment.
 * @returns A new record with the updated count.
 */
export function incrementListenCount(
  counts: Record<string, number>,
  tapeId: string,
): Record<string, number> {
  return {
    ...counts,
    [tapeId]: (counts[tapeId] ?? 0) + 1,
  };
}

/**
 * Check if incrementing the listen count for a tape would unlock a new
 * layer. Returns the newly unlocked layer, or null if no new layer is
 * unlocked.
 *
 * This is called BEFORE incrementing to detect the transition. The store
 * can use this to trigger a "new layer unlocked" notification.
 */
export function checkLayerUnlock(currentCount: number): MasteryLayer | null {
  const before = getCurrentLayer(currentCount);
  const after = getCurrentLayer(currentCount + 1);

  if (before === after) {
    return null;
  }
  return after;
}

/**
 * Get all tapes that have reached at least the given layer.
 */
export function getTapesAtLayer(counts: Record<string, number>, layer: MasteryLayer): string[] {
  const threshold = MASTERY_THRESHOLDS[layer];
  return Object.entries(counts)
    .filter(([, count]) => count >= threshold)
    .map(([tapeId]) => tapeId);
}

/**
 * Get the total number of unique layers unlocked across all tapes.
 * Useful for achievements (e.g., "unlock 5 depth layers").
 */
export function getTotalLayersUnlocked(counts: Record<string, number>): {
  surface: number;
  depth: number;
  abyss: number;
} {
  let surface = 0;
  let depth = 0;
  let abyss = 0;

  for (const count of Object.values(counts)) {
    if (count >= MASTERY_THRESHOLDS.abyss) {
      abyss++;
      depth++;
      surface++;
    } else if (count >= MASTERY_THRESHOLDS.depth) {
      depth++;
      surface++;
    } else if (count >= MASTERY_THRESHOLDS.surface) {
      surface++;
    }
  }

  return { surface, depth, abyss };
}
