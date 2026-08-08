/**
 * Difficulty system for Dead Air Radio.
 *
 * Three modes that alter sanity drain, static tolerance, call frequency,
 * and whether hitting zero sanity ends the run permanently.
 */

export type DifficultyMode = 'night_owl' | 'insomniac' | 'no_rest';

export interface DifficultyConfig {
  /** Multiplier applied to all sanity drain. */
  readonly sanityDrainMultiplier: number;
  /** Multiplier applied to static accumulation. Lower = more tolerant. */
  readonly staticTolerance: number;
  /** Multiplier applied to call frequency intervals. Lower = more calls. */
  readonly callFrequencyMultiplier: number;
  /** When true, reaching 0 sanity wipes all progress. */
  readonly permadeath: boolean;
  /** Display label. */
  readonly label: string;
  /** Short description for the settings screen. */
  readonly description: string;
}

export const DIFFICULTY_CONFIGS: Record<DifficultyMode, DifficultyConfig> = {
  night_owl: {
    sanityDrainMultiplier: 0.7,
    staticTolerance: 0.7,
    callFrequencyMultiplier: 1.3,
    permadeath: false,
    label: 'NIGHT OWL',
    description: 'Gentle sanity drain, fewer calls. A soft introduction to the graveyard shift.',
  },
  insomniac: {
    sanityDrainMultiplier: 1,
    staticTolerance: 1,
    callFrequencyMultiplier: 1,
    permadeath: false,
    label: 'INSOMNIAC',
    description:
      'The intended experience. Sanity drains steadily, calls come at their natural rhythm.',
  },
  no_rest: {
    sanityDrainMultiplier: 1.5,
    staticTolerance: 1.3,
    callFrequencyMultiplier: 0.75,
    permadeath: true,
    label: 'NO REST',
    description:
      'Brutal drain, relentless calls. Hit zero sanity and everything is wiped — permanently.',
  },
} as const;

/** Ordered list for UI rendering. */
export const DIFFICULTY_ORDER: DifficultyMode[] = ['night_owl', 'insomniac', 'no_rest'];
