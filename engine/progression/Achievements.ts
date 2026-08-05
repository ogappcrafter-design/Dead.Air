// engine/progression/Achievements.ts
// Pure functions for milestone tracking, unlock checks, and badge display
// metadata. No side effects, no I/O — fully testable. Mirrors the style of
// engine/progression/BandUnlock.ts.

/**
 * Aggregate stats surfaced from gameplay — the inputs every achievement
 * `check` evaluates against. Callers derive these from useGameStore +
 * NightShift engine state. All fields are stable primitive numbers so the
 * shape serializes cleanly and remains comparable across renders.
 */
export interface PlayerStats {
  /** Deduplicated incoming calls answered. */
  callsReceived: number;
  /** Count of unlocked bands (including LIVING). Range 1..5. */
  bandsUnlocked: number;
  /** Count of unique tapes collected. Range 0..15. */
  tapesCollected: number;
  /** Lowest sanity value reached across the save (100..0). */
  sanityLowest: number;
  /** Number of completed night shifts. */
  shiftsCompleted: number;
  /** Longest single-call duration survived, in milliseconds. */
  longestCallSurvivedMs: number;
}

/**
 * A single milestone. `check` is pure: same stats in → same result out.
 * Icons are emoji/symbols so no asset pipeline is required.
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  /** Pure predicate over PlayerStats. True when criteria are met. */
  check: (stats: PlayerStats) => boolean;
  /** Badge icon (emoji or symbol). */
  icon: string;
}

/**
 * Canonical achievement list. Order is significant for stable badge grid
 * rendering and deterministic unlock-multiset ordering (see checkAchievements).
 */
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_call',
    name: 'First Contact',
    description: 'Receive your first call',
    icon: '◈',
    check: (s) => s.callsReceived >= 1,
  },
  {
    id: 'survivor_10',
    name: 'Survivor',
    description: 'Survive 10 calls',
    icon: '◉',
    check: (s) => s.callsReceived >= 10,
  },
  {
    id: 'survivor_25',
    name: 'Veteran',
    description: 'Survive 25 calls',
    icon: '◎',
    check: (s) => s.callsReceived >= 25,
  },
  {
    id: 'collector_5',
    name: 'Collector',
    description: 'Collect 5 tapes',
    icon: '◇',
    check: (s) => s.tapesCollected >= 5,
  },
  {
    id: 'collector_all',
    name: 'Archivist',
    description: 'Collect all 15 tapes',
    icon: '◊',
    check: (s) => s.tapesCollected >= 15,
  },
  {
    id: 'band_3',
    name: 'Deep Listener',
    description: 'Unlock CLASSIFIED band',
    icon: ' █████',
    check: (s) => s.bandsUnlocked >= 4,
  },
  {
    id: 'band_5',
    name: 'Frequency Walker',
    description: 'Unlock all bands',
    icon: ' ████',
    check: (s) => s.bandsUnlocked >= 5,
  },
  {
    id: 'low_sanity',
    name: 'Edge of Madness',
    description: 'Reach sanity below 10',
    icon: ' ⚫',
    check: (s) => s.sanityLowest < 10,
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Complete 5 night shifts',
    icon: ' ◐',
    check: (s) => s.shiftsCompleted >= 5,
  },
  {
    id: 'long_call',
    name: 'Patient Listener',
    description: 'Survive a call lasting 2+ minutes',
    icon: ' ⏱',
    check: (s) => s.longestCallSurvivedMs >= 120000,
  },
];

/**
 * Check all achievements against a stats snapshot. Returns the IDs of any
 * achievements whose `check` passes that are NOT already in `alreadyUnlocked`.
 *
 * The returned array preserves ACHIEVEMENTS order (stable), so a single
 * gameplay tick that satisfies several milestones yields a deterministic
 * unlock-multiset. Idempotent: passing the same stats + unlocked set twice
 * yields [] the second time.
 *
 * Pure: no store reads, no allocations beyond the result array.
 */
export function checkAchievements(
  stats: PlayerStats,
  alreadyUnlocked: readonly string[],
): string[] {
  const unlockedSet = new Set(alreadyUnlocked);
  const newlyUnlocked: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (unlockedSet.has(a.id)) {
      continue;
    }
    if (a.check(stats)) {
      newlyUnlocked.push(a.id);
    }
  }
  return newlyUnlocked;
}

/**
 * Augment ACHIEVEMENTS with the per-entry unlock status for `unlocked`.
 * Returns a new array (does not mutate ACHIEVEMENTS). Order matches
 * ACHIEVEMENTS so screens can map it directly to a grid.
 */
export function getAchievementStatus(
  stats: PlayerStats,
  unlocked: readonly string[],
): Array<Achievement & { unlocked: boolean }> {
  const unlockedSet = new Set(unlocked);
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: unlockedSet.has(a.id) || a.check(stats),
  }));
}
