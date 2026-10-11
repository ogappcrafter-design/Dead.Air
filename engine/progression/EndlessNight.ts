// engine/progression/EndlessNight.ts
// DEA-6: Endless Night Mode — pure state machine for survival mode.
//
// Endless Night is a no-goal survival mode: there is no tape count to
// reach, the player simply survives as long as possible. Strangeness
// escalates every 5 completed shifts:
//   - Sanity drain +10% per escalation level (compounding).
//   - New call types become available at certain escalation levels.
//   - Weather worsens (flavor, surfaced via weather state field).
//
// Score = total shifts survived. The game ends when sanity reaches 0.
//
// No side effects, no I/O — fully testable. Mirrors the pure-DI style of
// NightShift.ts and BandUnlock.ts.

/** Escalation occurs every N shifts. */
export const SHIFTS_PER_ESCALATION = 5;

/** Sanity drain increase per escalation level (additive: +10% per level). */
export const SANITY_DRAIN_ESCALATION_PER_LEVEL = 0.1;

/**
 * DEA-86: Probability that an idle window in an Endless Night run spawns a
 * rare event call instead of a normal shift call. Rare events are unique
 * procedural variants (advanced call types) that only exist during a run.
 */
export const RARE_EVENT_CHANCE = 0.2;

/**
 * DEA-86: Base interval (ms) between shift calls during an Endless Night
 * run. Divided by the escalation multiplier so escalation makes the night
 * feel faster as well as deadlier. 180s at level 0 → 25s (floor) by level 10.
 */
export const ENDLESS_SHIFT_CALL_BASE_INTERVAL_MS = 180_000;

/** Floor for the shift-call interval regardless of escalation speed-up. */
export const ENDLESS_SHIFT_CALL_MIN_INTERVAL_MS = 25_000;

/**
 * DEA-86: Seconds of idle sanity drain between calls, applied continuously
 * at ENDLESS_IDLE_DRAIN_PER_SECOND via the run hook.
 */
export const ENDLESS_IDLE_DRAIN_PER_SECOND = 0.2;

/**
 * DEA-86: Seconds of real time between ambient idle-drain ticks in the run
 * hook. Keeps the store update rate low while feeling continuous.
 */
export const ENDLESS_IDLE_DRAIN_TICK_MS = 1_000;

/**
 * Escalation level → call type IDs that become available.
 * Level 0: base calls only.
 * Level 1 (shifts 5+): MULTI_CALLER, TIMING.
 * Level 2 (shifts 10+): PUZZLE.
 * Level 3 (shifts 15+): CONVERSATION.
 * Level 4+ (shifts 20+): DEAD_AIR (rare horror event).
 */
export const ESCALATION_CALL_TYPES: Record<number, string[]> = {
  0: [],
  1: ['MULTI_CALLER', 'TIMING'],
  2: ['PUZZLE'],
  3: ['CONVERSATION'],
  4: ['DEAD_AIR'],
};

/** Weather state labels per escalation level. */
export const ESCALATION_WEATHER: Readonly<Record<number, string>> = {
  0: 'Clear',
  1: 'Overcast',
  2: 'Storm',
  3: 'Electrical Storm',
  4: 'Anomalous Static',
  5: 'Signal Collapse',
};

/**
 * Full Endless Night state. This is the pure state object that the store
 * persists and the game loop reads.
 */
export interface EndlessNightState {
  /** Whether Endless Night is currently active. */
  endlessModeActive: boolean;
  /** Total shifts survived so far (the player's score). */
  endlessScore: number;
  /** Highest score ever reached (persistent across runs). */
  endlessHighScore: number;
  /** Current escalation level (0, 1, 2, ...). */
  escalationLevel: number;
  /** Current weather label (derived from escalationLevel). */
  weather: string;
  /** Whether the endless run has ended (sanity hit 0). */
  isGameOver: boolean;
}

/**
 * Whether the player is eligible to start Endless Night.
 * Requires at least 1 completed normal game (shiftsCompleted >= 1).
 */
export function canStartEndlessNight(shiftsCompleted: number, ngPlusActive: boolean): boolean {
  // Must have completed at least 1 shift in normal (non-NG+, non-endless) mode.
  // Also blocked while NG+ is active.
  return shiftsCompleted >= 1 && !ngPlusActive;
}

/**
 * Create the initial Endless Night state for a new run.
 * The caller is responsible for resetting sanity/static/tapes as needed.
 */
export function startEndlessNight(previousHighScore: number): EndlessNightState {
  return {
    endlessModeActive: true,
    endlessScore: 0,
    endlessHighScore: previousHighScore,
    escalationLevel: 0,
    weather: ESCALATION_WEATHER[0] ?? 'Clear',
    isGameOver: false,
  };
}

/**
 * Compute the current escalation level from the score (shifts survived).
 * Level = floor(score / SHIFTS_PER_ESCALATION).
 */
export function getEscalationLevel(score: number): number {
  return Math.floor(score / SHIFTS_PER_ESCALATION);
}

/**
 * Get the call types that should be available at a given escalation level.
 * Returns the cumulative set (all types from level 0 through current level).
 */
export function getEscalationCallTypes(level: number): string[] {
  const types: string[] = [];
  for (let l = 0; l <= level; l++) {
    const levelTypes = ESCALATION_CALL_TYPES[l];
    if (levelTypes) {
      for (const t of levelTypes) {
        if (!types.includes(t)) {
          types.push(t);
        }
      }
    }
  }
  return types;
}

/**
 * Get the weather label for a given escalation level.
 * Levels beyond the defined range return the highest defined weather.
 */
export function getWeatherForLevel(level: number): string {
  const maxDefined = Math.max(...Object.keys(ESCALATION_WEATHER).map((k) => parseInt(k, 10)));
  const clamped = Math.min(level, maxDefined);
  return ESCALATION_WEATHER[clamped] ?? ESCALATION_WEATHER[maxDefined] ?? 'Unknown';
}

/**
 * Get the sanity drain multiplier for a given escalation level.
 * Base is 1.0; each level adds +0.1 (10%).
 * E.g., level 2 → 1.0 + 0.1 * 2 = 1.2.
 */
export function getEscalationSanityDrainMultiplier(level: number): number {
  return 1.0 + SANITY_DRAIN_ESCALATION_PER_LEVEL * level;
}

/**
 * Called when a shift is completed during Endless Night.
 * Increments the score, checks for escalation level change, and updates
 * weather. Returns a new state object (does not mutate).
 */
export function onShiftCompleted(state: EndlessNightState): EndlessNightState {
  const newScore = state.endlessScore + 1;
  const newLevel = getEscalationLevel(newScore);
  const newHighScore = Math.max(state.endlessHighScore, newScore);

  return {
    ...state,
    endlessScore: newScore,
    endlessHighScore: newHighScore,
    escalationLevel: newLevel,
    weather: getWeatherForLevel(newLevel),
  };
}

/**
 * Called when sanity reaches 0 during Endless Night.
 * Marks the game as over and deactivates the mode.
 * The high score is already up to date from onShiftCompleted.
 */
export function onGameOver(state: EndlessNightState): EndlessNightState {
  return {
    ...state,
    endlessModeActive: false,
    isGameOver: true,
  };
}

/**
 * End Endless Night voluntarily (player quits).
 * Deactivates the mode but does NOT mark as game over.
 */
export function endEndlessNight(state: EndlessNightState): EndlessNightState {
  return {
    ...state,
    endlessModeActive: false,
  };
}

// --- DEA-86: procedural depth helpers ---

/** A single rare event selection result. */
export interface RareEventSelection {
  /** True when a rare event should spawn this idle window. */
  isRareEvent: boolean;
  /** Advanced call type for the rare event (only meaningful when isRareEvent). */
  callType: string | null;
  /** Band index (0-4 core bands) for the rare event. */
  band: number | null;
}

/**
 * DEA-86: Decide whether the current idle window spawns a rare event call,
 * and which type/band to use.
 *
 * Rare events use advanced call types unlocked by the current escalation
 * level (from `ESCALATION_CALL_TYPES`). When no advanced types are unlocked
 * yet (level 0), no rare event can spawn — base calls only, per the
 * `ESCALATION_CALL_TYPES[0] = []` contract.
 *
 * `rngRoll` gates the spawn (roll < RARE_EVENT_CHANCE) and, once spawned,
 * is normalized to [0,1) to pick the type — so every unlocked type is
 * reachable, not just the first slice of the list. `bandRoll` (0..1) picks
 * the core band.
 *
 * Pure: driven by the injected rolls, so tests are deterministic.
 */
export function selectRareEvent(
  escalationLevel: number,
  rngRoll: number,
  bandRoll: number,
): RareEventSelection {
  const types = getEscalationCallTypes(escalationLevel);
  if (types.length === 0 || rngRoll >= RARE_EVENT_CHANCE) {
    return { isRareEvent: false, callType: null, band: null };
  }
  // Normalize the spawn roll to [0,1) so every unlocked type is reachable.
  const normalized = rngRoll / RARE_EVENT_CHANCE;
  const callType = types[Math.floor(normalized * types.length) % types.length] ?? null;
  if (callType === null) {
    return { isRareEvent: false, callType: null, band: null };
  }
  // Core bands only (0-4): they are the bands with full advanced-type
  // fragment coverage, so a rare event can never produce an unrenderable call.
  const band = Math.floor(bandRoll * 5) % 5;
  return { isRareEvent: true, callType, band };
}

/**
 * DEA-86: Compose the effective sanity-drain multiplier for an Endless
 * Night run. Stacks the base difficulty multiplier with the escalation
 * multiplier, mirroring how NG+ stacks on top of base difficulty
 * (see `getNgPlusDifficultyConfig`).
 *
 * E.g. insomniac (1.0) at level 2 → 1.0 * 1.2 = 1.2.
 *      no_rest (1.5) at level 3 → 1.5 * 1.3 = 1.95.
 */
export function getEndlessDrainMultiplier(
  difficultyMultiplier: number,
  escalationLevel: number,
): number {
  return difficultyMultiplier * getEscalationSanityDrainMultiplier(escalationLevel);
}

/**
 * DEA-86: Real-time interval between shift calls during an Endless Night
 * run, in milliseconds. Escalation shortens the interval (faster night)
 * with a floor so the loop stays playable.
 *
 * E.g. level 0 → 180s, level 5 → 120s, level 70 → 25s (floor).
 */
export function getEndlessCallInterval(
  escalationLevel: number,
  callFrequencyMultiplier: number,
): number {
  const scaled =
    (ENDLESS_SHIFT_CALL_BASE_INTERVAL_MS * callFrequencyMultiplier) /
    getEscalationSanityDrainMultiplier(escalationLevel);
  return Math.max(ENDLESS_SHIFT_CALL_MIN_INTERVAL_MS, scaled);
}
