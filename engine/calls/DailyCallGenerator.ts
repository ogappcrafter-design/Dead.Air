/**
 * DailyCallGenerator — seeded-RNG daily mystery call generator.
 *
 * Produces a unique call per calendar date (UTC). Same date → same call for ALL players.
 * Call quality (narrative depth, branching complexity) scales with day-streak length.
 * Some daily calls are EXCLUSIVE — not available through normal gameplay.
 *
 * Pure: no I/O, no store imports, no singletons. All randomness via SeededRNG.
 */

import type { CallData, CallChoice } from './types';
import type { FragmentLibrary, ResponseOption, BandVariation } from '@/data/fragments/types';
import { BAND_VARIATIONS } from '@/data/fragments/variations';
import { ALL_FRAGMENTS } from '@/data/fragments';
import { SeededRNG } from './SeededRNG';

// ─── Constants ───────────────────────────────────────────────────────────────

export const DAILY_ID_BASE = 50_000;

const MIN_LINES = 2;
const MAX_MIDDLE_LINES_STREAK_0 = 1;
const MAX_MIDDLE_LINES_STREAK_7 = 2;
const MAX_MIDDLE_LINES_STREAK_30 = 3;

const MIN_CHOICES = 2;
const MAX_CHOICES_STREAK_0 = 2;
const MAX_CHOICES_STREAK_7 = 3;
const MAX_CHOICES_STREAK_30 = 4;

const DAILY_TAPE_PREFIX = 'Daily Transmission';

/** Call types available at each streak tier. Higher tiers unlock richer types. */
const STREAK_TIER_0_TYPES = ['JUST_LISTEN', 'DEAD_AIR', 'RIGHT_ANSWER'] as const;
const STREAK_TIER_7_TYPES = [
  ...STREAK_TIER_0_TYPES,
  'SIGNAL_DECODE',
  'STAY_CALM',
  'RECORDING',
] as const;
const STREAK_TIER_30_TYPES = [
  ...STREAK_TIER_7_TYPES,
  'MULTI_CALLER',
  'TIMING',
  'PUZZLE',
  'CONVERSATION',
] as const;

/** Exclusive daily caller ID prefixes — only appear in daily calls, never in normal gameplay. */
const EXCLUSIVE_CALLER_ID_PREFIXES = ['DAILY-####', 'SIGNAL-####', 'BROADCAST-####'];
const EXCLUSIVE_CALLER_NAME_PREFIXES = ['The Broadcaster', 'Daily Signal', 'Midnight Caller'];

/** Probability that a daily call is exclusive (not obtainable in normal gameplay). */
const EXCLUSIVE_CHANCE = 0.35;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DailyCallOptions {
  /** Current streak length (consecutive daily calls completed). 0 = first ever. */
  streak: number;
  /** Override date string (YYYY-MM-DD). Defaults to today UTC. */
  dateStr?: string;
  /** Override fragments. Defaults to ALL_FRAGMENTS. */
  fragments?: FragmentLibrary[];
  /** Override variations. Defaults to BAND_VARIATIONS. */
  variations?: BandVariation[];
}

export interface DailyCallResult {
  call: CallData;
  isExclusive: boolean;
  dateStr: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns today's date in UTC as YYYY-MM-DD. */
export function getTodayUTC(): string {
  return new Date().toISOString().split('T')[0] ?? '1970-01-01';
}

/** Streak tier: 0 = early, 1 = 7+ day streak, 2 = 30+ day streak. */
function streakTier(streak: number): 0 | 1 | 2 {
  if (streak >= 30) return 2;
  if (streak >= 7) return 1;
  return 0;
}

/** Max middle lines scales with streak — more narrative depth at higher streaks. */
function maxMiddleLines(streak: number): number {
  const tier = streakTier(streak);
  if (tier === 2) return MAX_MIDDLE_LINES_STREAK_30;
  if (tier === 1) return MAX_MIDDLE_LINES_STREAK_7;
  return MAX_MIDDLE_LINES_STREAK_0;
}

/** Max choices scales with streak — more branching at higher streaks. */
function maxChoices(streak: number): number {
  const tier = streakTier(streak);
  if (tier === 2) return MAX_CHOICES_STREAK_30;
  if (tier === 1) return MAX_CHOICES_STREAK_7;
  return MAX_CHOICES_STREAK_0;
}

/** Available call types for this streak tier. */
function availableCallTypes(streak: number): readonly string[] {
  const tier = streakTier(streak);
  if (tier === 2) return STREAK_TIER_30_TYPES;
  if (tier === 1) return STREAK_TIER_7_TYPES;
  return STREAK_TIER_0_TYPES;
}

// ─── DailyCallGenerator ──────────────────────────────────────────────────────

export class DailyCallGenerator {
  private readonly fragments: FragmentLibrary[];
  private readonly variations: BandVariation[];
  private readonly idBase: number;

  constructor(
    fragments: FragmentLibrary[] = ALL_FRAGMENTS,
    variations: BandVariation[] = BAND_VARIATIONS,
    idBase: number = DAILY_ID_BASE,
  ) {
    this.fragments = fragments;
    this.variations = variations;
    this.idBase = idBase;
  }

  /**
   * Generate the daily call for a given date and streak.
   *
   * Same date + same streak → same call (deterministic via SeededRNG).
   * The streak influences call complexity: more lines, more choices, richer types.
   * ~35% of daily calls are EXCLUSIVE (special caller names, not in normal gameplay).
   */
  generate(options: DailyCallOptions): DailyCallResult {
    const dateStr = options.dateStr ?? getTodayUTC();
    const streak = Math.max(0, options.streak);
    const fragments = options.fragments ?? this.fragments;
    const variations = options.variations ?? this.variations;

    // Seed combines date + streak tier so quality scaling is deterministic.
    // We include the streak TIER (not raw streak) so calls don't change every
    // single day as streak grows — they change at tier boundaries (0→7→30).
    const tier = streakTier(streak);
    const seed = `daily:${dateStr}:t${tier}`;
    const rng = new SeededRNG(seed);

    // Pick band — seeded, all 8 bands available.
    const band = rng.int(0, fragments.length - 1);
    const library = fragments[band];
    if (!library) {
      throw new Error(`DailyCallGenerator: no fragment library for band ${band}`);
    }
    const variation = this.getVariation(band, variations);

    // Decide exclusive status.
    const isExclusive = rng.chance(EXCLUSIVE_CHANCE);

    // Pick call type from available types for this streak tier.
    const types = availableCallTypes(streak);
    const filteredTypes = library.callTypes.filter((t) => types.includes(t));
    const callType =
      filteredTypes.length > 0 ? rng.pick(filteredTypes) : (library.callTypes[0] ?? 'JUST_LISTEN');

    // Generate caller info.
    const callerId = isExclusive
      ? this.generateExclusiveCallerId(rng)
      : this.generateCallerId(library, rng);
    const callerName = isExclusive
      ? rng.pick(EXCLUSIVE_CALLER_NAME_PREFIXES)
      : this.generateCallerName(library, rng);

    // Signal and static reward from variation ranges.
    const signal = rng.int(variation.signalRange[0], variation.signalRange[1]);
    const staticReward = rng.int(variation.staticRewardRange[0], variation.staticRewardRange[1]);

    // Unique daily ID: hash of date → stable per date.
    const dailyId = this.dateToId(dateStr);

    // Base call data.
    const base: CallData = {
      id: dailyId,
      band,
      callerId,
      callerName,
      signal,
      type: callType,
      staticReward,
    };

    // Build type-specific fields using seeded RNG.
    const call = this.buildCall(base, library, variation, callType, rng, streak);

    return { call, isExclusive, dateStr };
  }

  // ─── Type-Specific Call Building ──────────────────────────────────────────

  private buildCall(
    base: CallData,
    library: FragmentLibrary,
    variation: BandVariation,
    callType: string,
    rng: SeededRNG,
    streak: number,
  ): CallData {
    switch (callType) {
      case 'JUST_LISTEN':
        return {
          ...base,
          lines: this.assembleLines(library, rng, streak),
          sanityDelta: rng.int(variation.sanityDeltaRange[0], variation.sanityDeltaRange[1]),
        };

      case 'DEAD_AIR':
        return {
          ...base,
          lines: this.assembleLines(library, rng, streak),
          waitSeconds: rng.int(3, 8),
          sanityDelta: rng.int(variation.sanityDeltaRange[0], variation.sanityDeltaRange[1]),
        };

      case 'RIGHT_ANSWER':
        return {
          ...base,
          lines: this.assembleLines(library, rng, streak),
          choices: this.assembleChoices(library, variation, rng, streak),
        };

      case 'SIGNAL_DECODE':
        return {
          ...base,
          intro: this.assembleLines(library, rng, streak).join(' '),
          sequence: this.generateSequence(rng),
          decodedMessage: this.generateDecodedMessage(library, rng),
        };

      case 'STAY_CALM':
        return {
          ...base,
          lines: this.assembleLines(library, rng, streak),
          duration: rng.int(8, 16),
          sanityPenalty: rng.int(15, 25),
          sanityDelta: rng.int(variation.sanityDeltaRange[0], variation.sanityDeltaRange[1]),
        };

      case 'RECORDING':
        return {
          ...base,
          lines: this.assembleLines(library, rng, streak),
          sanityDelta: rng.int(variation.sanityDeltaRange[0], variation.sanityDeltaRange[1]),
          recordingClips: this.generateRecordingClips(library, rng),
        };

      case 'MULTI_CALLER': {
        const lines = this.assembleLines(library, rng, streak);
        return {
          ...base,
          lines,
          choices: this.assembleChoices(library, variation, rng, streak),
          speakerPairs: this.generateSpeakerPairs(library, rng),
          lineSpeakers: this.generateLineSpeakers(lines.length, rng),
        };
      }

      case 'TIMING':
        return {
          ...base,
          lines: this.assembleLines(library, rng, streak),
          duration: rng.int(8, 16),
          sanityPenalty: rng.int(15, 25),
          sanityDelta: rng.int(variation.sanityDeltaRange[0], variation.sanityDeltaRange[1]),
          beatMap: this.generateBeatMap(library, rng, streak),
        };

      case 'PUZZLE':
        return {
          ...base,
          intro: this.assembleLines(library, rng, streak).join(' '),
          cipherLayers: this.generateCipherLayers(library, rng),
          decodedMessage: this.generateDecodedMessage(library, rng),
        };

      case 'CONVERSATION':
        return {
          ...base,
          lines: this.assembleLines(library, rng, streak),
          dialogueTree: this.generateDialogueTree(library, variation, rng, streak),
        };

      default:
        return {
          ...base,
          lines: this.assembleLines(library, rng, streak),
          sanityDelta: rng.int(variation.sanityDeltaRange[0], variation.sanityDeltaRange[1]),
        };
    }
  }

  // ─── Line Assembly ─────────────────────────────────────────────────────────

  /** Assemble lines: 1 opening + N middles + 1 closing. N scales with streak. */
  private assembleLines(library: FragmentLibrary, rng: SeededRNG, streak: number): string[] {
    const lines: string[] = [];

    // Opening
    if (library.openings.length > 0) {
      lines.push(rng.pick(library.openings));
    }

    // Middles — sample without replacement, count scales with streak.
    const maxMids = maxMiddleLines(streak);
    const midCount = Math.min(maxMids, library.middles.length);
    if (midCount > 0) {
      const mids = rng.pickN(library.middles, midCount);
      lines.push(...mids);
    }

    // Closing
    if (library.closings.length > 0) {
      lines.push(rng.pick(library.closings));
    }

    // Ensure minimum.
    if (lines.length < MIN_LINES) {
      // Pad with a middle if available.
      if (library.middles.length > 0) {
        lines.push(rng.pick(library.middles));
      }
    }

    return lines;
  }

  // ─── Choice Assembly ──────────────────────────────────────────────────────

  /** Assemble 2-N choices from library responses. N scales with streak. */
  private assembleChoices(
    library: FragmentLibrary,
    variation: BandVariation,
    rng: SeededRNG,
    streak: number,
  ): CallChoice[] {
    if (library.responses.length === 0) {
      return [];
    }

    const maxCh = Math.min(maxChoices(streak), library.responses.length);
    const minCh = Math.min(MIN_CHOICES, maxCh);
    const count = rng.int(minCh, maxCh);
    const selected = rng.pickN(library.responses, count);

    return selected.map((r) => this.responseToChoice(r, variation, rng));
  }

  /** Map a ResponseOption to a CallChoice. */
  private responseToChoice(
    response: ResponseOption,
    variation: BandVariation,
    rng: SeededRNG,
  ): CallChoice {
    const sanityDelta =
      response.sanityDelta ?? rng.int(variation.sanityDeltaRange[0], variation.sanityDeltaRange[1]);
    const staticMult = response.staticMult ?? rng.int(1, 3);

    // Tape chance roll.
    let tape: boolean | undefined;
    let tapeName: string | undefined;
    if (response.tapeChance !== undefined && rng.chance(response.tapeChance)) {
      tape = true;
      tapeName = `${DAILY_TAPE_PREFIX} #${this.idBase + rng.int(1, 9999)}`;
    }

    return {
      text: response.text,
      outcome: response.outcome,
      sanityDelta,
      staticMult,
      tape,
      tapeName,
      choiceTag: response.branchId,
    };
  }

  // ─── Caller Generation ────────────────────────────────────────────────────

  private generateCallerId(library: FragmentLibrary, rng: SeededRNG): string {
    if (library.callerIdPrefixes.length === 0) {
      return `daily-${rng.int(1000, 9999)}`;
    }
    const prefix = rng.pick(library.callerIdPrefixes);
    const digits = String(rng.int(0, 9999)).padStart(4, '0');
    return prefix.replace(/####/g, digits) + `-${this.idBase + rng.int(1, 999)}`;
  }

  private generateCallerName(library: FragmentLibrary, rng: SeededRNG): string {
    if (library.callerNamePrefixes.length === 0) {
      return `Daily Caller ${rng.int(1, 99)}`;
    }
    const prefix = rng.pick(library.callerNamePrefixes);
    return `${prefix} ${rng.int(1, 99)}`;
  }

  private generateExclusiveCallerId(rng: SeededRNG): string {
    const prefix = rng.pick(EXCLUSIVE_CALLER_ID_PREFIXES);
    const digits = String(rng.int(0, 9999)).padStart(4, '0');
    return prefix.replace(/####/g, digits);
  }

  // ─── Specialized Field Generators ─────────────────────────────────────────

  private generateSequence(rng: SeededRNG): number[] {
    const length = rng.int(3, 6);
    return Array.from({ length }, () => rng.int(0, 2));
  }

  private generateDecodedMessage(library: FragmentLibrary, rng: SeededRNG): string {
    if (library.openings.length === 0) {
      return 'SIGNAL LOST';
    }
    const opening = rng.pick(library.openings);
    return opening
      .replace(/["'!?.,]/g, '')
      .toUpperCase()
      .slice(0, 60);
  }

  private generateRecordingClips(
    library: FragmentLibrary,
    rng: SeededRNG,
  ): NonNullable<CallData['recordingClips']> {
    if (library.recordingClips && library.recordingClips.length > 0) {
      const clip = rng.pick(library.recordingClips);
      return [
        {
          audioLabel: clip.audioLabel,
          duration: rng.int(10, 30),
          metadata: clip.metadata,
          targetSeekPosition: rng.next(),
        },
      ];
    }
    return [
      {
        audioLabel: 'daily_recording',
        duration: rng.int(10, 30),
        metadata: [],
        targetSeekPosition: 0,
      },
    ];
  }

  private generateSpeakerPairs(
    library: FragmentLibrary,
    rng: SeededRNG,
  ): NonNullable<CallData['speakerPairs']> {
    if (library.speakerPairs && library.speakerPairs.length >= 2) {
      return rng.pickN(library.speakerPairs, 2);
    }
    if (library.speakerPairs && library.speakerPairs.length === 1) {
      const sp = library.speakerPairs[0];
      if (sp) return [sp, sp];
    }
    return [
      { voiceId: 0, name: 'Caller A' },
      { voiceId: 1, name: 'Caller B' },
    ];
  }

  private generateLineSpeakers(lineCount: number, rng: SeededRNG): number[] {
    return Array.from({ length: lineCount }, () => rng.int(0, 1));
  }

  private generateBeatMap(
    library: FragmentLibrary,
    rng: SeededRNG,
    streak: number,
  ): NonNullable<CallData['beatMap']> {
    if (library.beatMaps && library.beatMaps.length > 0) {
      // beatMaps is Array<Array<beat>> — pick one beat map (array of beats).
      return rng.pick(library.beatMaps);
    }
    // Fallback: generate simple beat map.
    const count = 3 + streakTier(streak);
    return Array.from({ length: count }, (_, i) => ({
      timestampMs: (i + 1) * 1000,
      type: rng.chance(0.5) ? ('TAP' as const) : ('HOLD' as const),
      holdDurationMs: rng.chance(0.5) ? rng.int(500, 2000) : undefined,
    }));
  }

  private generateCipherLayers(
    library: FragmentLibrary,
    rng: SeededRNG,
  ): NonNullable<CallData['cipherLayers']> {
    if (library.cipherLayers && library.cipherLayers.length > 0) {
      const count = Math.min(rng.int(3, 6), library.cipherLayers.length);
      return rng.pickN(library.cipherLayers, count);
    }
    return [];
  }

  private generateDialogueTree(
    library: FragmentLibrary,
    variation: BandVariation,
    rng: SeededRNG,
    streak: number,
  ): NonNullable<CallData['dialogueTree']> {
    if (library.dialogueTrees && library.dialogueTrees.length > 0) {
      // dialogueTrees is Array<Array<node>> — pick one tree (array of nodes).
      const tree = rng.pick(library.dialogueTrees);
      return tree.map((node) => ({
        speaker: node.speaker,
        text: node.text,
        responses: node.responses.map((r) => this.responseToChoice(r, variation, rng)),
      }));
    }
    // Fallback: simple dialogue from lines.
    const lines = this.assembleLines(library, rng, streak);
    return lines.map((line, i) => ({
      speaker: i % 2 === 0 ? 'A' : 'B',
      text: line,
      responses: this.assembleChoices(library, variation, rng, streak),
    }));
  }

  // ─── ID Generation ────────────────────────────────────────────────────────

  /**
   * Convert a date string (YYYY-MM-DD) to a stable daily call ID.
   * Uses a simple hash to produce IDs in the DAILY_ID_BASE range.
   */
  private dateToId(dateStr: string): number {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      const char = dateStr.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return this.idBase + (Math.abs(hash) % 9999);
  }

  /** Look up a BandVariation from the provided array. */
  private getVariation(band: number, variations: BandVariation[]): BandVariation {
    const v = variations[band];
    if (v === undefined) {
      throw new Error(`DailyCallGenerator: no BandVariation for band ${band}`);
    }
    return v;
  }
}
