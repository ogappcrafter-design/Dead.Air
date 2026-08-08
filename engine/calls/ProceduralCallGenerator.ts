// engine/calls/ProceduralCallGenerator.ts
// Procedural call generator for the Infinite Signal IAP.
//
// Assembles CallData objects from band fragment libraries. Each generated
// call has:
//   - A unique callerId (counter-prefixed, never collides with the
//     sacred 18's id range 0..17).
//   - Procedural lines assembled from openings + middles + closings.
//   - Randomized staticReward / sanityDelta / signal per BandVariation.
//   - Valid choices from response options (for RIGHT_ANSWER calls).
//
// Pure: no I/O, no store imports, no singletons. State is a monotonic
// counter for callerId uniqueness. Fully testable in isolation.
//
// Id range: generated calls use ids >= 1000 to avoid collision with the
// sacred 18 (ids 0..17). The CallManager registry is keyed by id, so
// collisions would silently overwrite sacred calls — this guard makes
// that impossible. Callers generating into a disjoint range (e.g. seasonal
// calls) pass a custom idBase to the constructor.

import type { CallData, CallChoice } from './types';
import type { CallType } from '../../lib/constants';
import type { FragmentLibrary, ResponseOption, BandVariation } from '../../data/fragments/types';
import { BAND_VARIATIONS, getBandVariation } from '../../data/fragments/variations';
import type { ChoiceHistorySnapshot } from '../../store/choiceHistoryStore';
import { CHOICE_GATES, type ChoiceGate } from '../../data/choiceGates';

/** Starting id for generated calls. Sacred 18 use ids 0..17. */
export const PROCEDURAL_ID_BASE = 1000;

/** Minimum number of lines a generated call must have (opening + closing). */
const MIN_LINES = 2;

/** Maximum number of middle lines to sample per call. */
const MAX_MIDDLE_LINES = 3;

/** Minimum number of choices for a RIGHT_ANSWER call. */
const MIN_CHOICES = 2;

/** Maximum number of choices for a RIGHT_ANSWER call. */
const MAX_CHOICES = 4;

/** Synthetic tape name prefix for procedurally-generated tape unlocks. */
const PROCEDURAL_TAPE_PREFIX = 'Procedural Tape';

/**
 * ProceduralCallGenerator — assembles infinite CallData from fragment libraries.
 *
 * Construction:
 *   - `new ProceduralCallGenerator(fragments)` — uses ALL band fragment
 *     libraries. Validates that every library has non-empty arrays.
 *   - The generator holds a monotonic id counter; each `generate()` call
 *     advances it, guaranteeing unique ids across the lifetime of the
 *     instance.
 *
 * Usage:
 *   - `generate(band)`: returns a single CallData for the given band index.
 *   - `generateBatch(band, count)`: returns `count` calls for the band.
 *   - `generateAcrossBands(countPerBand)`: returns calls spread across
 *     all bands (countPerBand per band, 5 bands total).
 *   - `reset()`: resets the id counter (test-only).
 *
 * Determinism: tests can seed Math.random externally (jest.spyOn or
 * a mock) to assert exact outputs. The generator never reads the
 * filesystem or store state.
 */
export class ProceduralCallGenerator {
  private readonly fragments: ReadonlyArray<FragmentLibrary>;
  private readonly variations: ReadonlyArray<BandVariation>;
  private readonly fragmentsByBand: Map<number, FragmentLibrary>;
  private readonly variationsByBand: Map<number, BandVariation>;
  private nextId: number;

  constructor(
    fragments: ReadonlyArray<FragmentLibrary>,
    variations: ReadonlyArray<BandVariation> = BAND_VARIATIONS,
    idBase: number = PROCEDURAL_ID_BASE,
  ) {
    this.validateFragments(fragments);
    this.validateVariations(variations, fragments);
    this.fragments = fragments;
    this.variations = variations;
    this.fragmentsByBand = new Map(this.fragments.map((lib) => [lib.band, lib]));
    this.variationsByBand = new Map(this.variations.map((v) => [v.band, v]));
    this.nextId = idBase;
  }

  /**
   * Generate a single procedural CallData for the given band index.
   *
   * @param band  Band index 0..4. Throws if out of range for the
   *              fragment libraries passed at construction.
   * @param options.choiceHistory  Optional ChoiceHistory snapshot. When
   *              provided, responses with `requiresChoiceKey` are filtered
   *              to only those whose prerequisites are met, and gated call
   *              ids from CHOICE_GATES are excluded from the id space.
   * @returns A valid CallData with a unique procedural id.
   */
  generate(band: number, options?: { choiceHistory?: ChoiceHistorySnapshot }): CallData {
    let library = this.getLibrary(band);
    // DEA-56: When choiceHistory is provided, select from branches whose
    // prerequisites are met. Falls back to the default library when no
    // branched libraries are available.
    if (options?.choiceHistory) {
      const branches = this.getAvailableBranches(options.choiceHistory, band);
      if (branches.length > 0) {
        library = this.pick(branches);
      }
    }
    const variation = this.getVariation(band);
    const callType = this.pickCallType(library);
    const id = this.nextId++;

    const call: CallData = {
      id,
      band,
      callerId: this.generateCallerId(library),
      callerName: this.generateCallerName(library),
      signal: this.randomInt(variation.signalRange[0], variation.signalRange[1]),
      type: callType,
      staticReward: this.randomInt(variation.staticRewardRange[0], variation.staticRewardRange[1]),
    };

    // Type-specific fields.
    if (callType === 'JUST_LISTEN' || callType === 'DEAD_AIR') {
      call.lines = this.assembleLines(library);
      call.sanityDelta = this.randomInt(
        variation.sanityDeltaRange[0],
        variation.sanityDeltaRange[1],
      );
      if (callType === 'DEAD_AIR') {
        call.waitSeconds = this.randomInt(6, 15);
      }
    } else if (callType === 'RIGHT_ANSWER') {
      call.lines = this.assembleLines(library);
      const responses = options?.choiceHistory
        ? this.filterResponses(library.responses, options.choiceHistory)
        : library.responses;
      call.choices = this.assembleChoices(responses, variation);
    } else if (callType === 'STAY_CALM') {
      call.lines = this.assembleLines(library);
      call.duration = this.randomInt(8, 16);
      call.sanityPenalty = this.randomInt(15, 25);
      call.sanityDelta = this.randomInt(
        variation.sanityDeltaRange[0],
        variation.sanityDeltaRange[1],
      );
    } else if (callType === 'SIGNAL_DECODE') {
      call.intro = this.pick(library.openings);
      call.sequence = this.generateSequence();
      call.decodedMessage = this.generateDecodedMessage(library);
    } else if (callType === 'RECORDING') {
      call.lines = this.assembleLines(library);
      call.sanityDelta = this.randomInt(
        variation.sanityDeltaRange[0],
        variation.sanityDeltaRange[1],
      );
      if (library.recordingClips && library.recordingClips.length > 0) {
        const clip = this.pick(library.recordingClips);
        call.recordingClips = [
          {
            audioLabel: clip.audioLabel,
            duration: this.randomInt(10, 30),
            metadata: clip.metadata,
            targetSeekPosition: Math.random(),
          },
        ];
      }
    } else if (callType === 'MULTI_CALLER') {
      call.lines = this.assembleLines(library);
      call.choices = this.assembleChoices(library.responses, variation);
      if (library.speakerPairs && library.speakerPairs.length >= 2) {
        call.speakerPairs = [library.speakerPairs[0]!, library.speakerPairs[1]!];
        call.lineSpeakers = call.lines!.map(() => this.randomInt(0, 1));
      }
    } else if (callType === 'TIMING') {
      call.lines = this.assembleLines(library);
      call.duration = this.randomInt(8, 16);
      call.sanityPenalty = this.randomInt(15, 25);
      call.sanityDelta = this.randomInt(
        variation.sanityDeltaRange[0],
        variation.sanityDeltaRange[1],
      );
      if (library.beatMaps && library.beatMaps.length > 0) {
        call.beatMap = this.pick(library.beatMaps);
      }
    } else if (callType === 'PUZZLE') {
      call.intro = this.pick(library.openings);
      if (library.cipherLayers && library.cipherLayers.length >= 3) {
        const layerCount = this.randomInt(3, Math.min(library.cipherLayers.length, 6));
        const shuffled = [...library.cipherLayers].sort(() => Math.random() - 0.5);
        call.cipherLayers = shuffled.slice(0, layerCount);
        call.decodedMessage = this.generateDecodedMessage(library);
      } else {
        call.cipherLayers = [];
        call.decodedMessage = '';
      }
    } else if (callType === 'CONVERSATION') {
      call.lines = this.assembleLines(library);
      if (library.dialogueTrees && library.dialogueTrees.length > 0) {
        const tree = this.pick(library.dialogueTrees);
        call.dialogueTree = tree.map((node) => ({
          speaker: node.speaker,
          text: node.text,
          responses: this.assembleChoices(node.responses, variation),
        }));
      }
    } else {
      // Exhaustive: CallType is a finite union; this is unreachable.
      const _exhaustive: never = callType;
      return _exhaustive;
    }

    return call;
  }

  /**
   * Generate `count` procedural calls for the given band.
   * Each call has a unique id.
   */
  generateBatch(
    band: number,
    count: number,
    options?: { choiceHistory?: ChoiceHistorySnapshot },
  ): CallData[] {
    const calls: CallData[] = [];
    for (let i = 0; i < count; i++) {
      calls.push(this.generate(band, options));
    }
    return calls;
  }

  /**
   * Generate calls spread across all bands.
   * @param countPerBand  Number of calls to generate per band.
   * @returns An array of CallData with `countPerBand * fragments.length` entries.
   */
  generateAcrossBands(
    countPerBand: number,
    options?: { choiceHistory?: ChoiceHistorySnapshot },
  ): CallData[] {
    const calls: CallData[] = [];
    for (const band of this.fragmentsByBand.keys()) {
      for (let i = 0; i < countPerBand; i++) {
        calls.push(this.generate(band, options));
      }
    }
    return calls;
  }

  /** Reset the id counter (test-only). */
  reset(): void {
    this.nextId = idBase;
  }

  /**
   * DEA-56 / DEA-69: Return the fragment libraries available for a band
   * after filtering by ChoiceHistory. Libraries with `requiresChoiceKey`
   * are included only when the player has recorded that choice. When
   * multiple libraries share the same `branchId`, only those whose
   * prerequisites are met are returned; if none match, the unbranched
   * library (no `requiresChoiceKey`) is used as fallback.
   */
  getAvailableBranches(choiceHistory: ChoiceHistorySnapshot, band: number): FragmentLibrary[] {
    const candidates = this.fragments.filter((lib) => lib.band === band);
    if (candidates.length === 0) return [];

    const hasKey = (lib: FragmentLibrary): boolean =>
      lib.requiresChoiceKey === undefined || choiceHistory.hasChoice(lib.requiresChoiceKey);

    const available = candidates.filter(hasKey);
    if (available.length === 0) {
      // Fall back to libraries without prerequisites.
      return candidates.filter((lib) => lib.requiresChoiceKey === undefined);
    }
    return available;
  }

  /**
   * DEA-61 / DEA-69: Return the set of procedural call ids unlocked by
   * the player's ChoiceHistory via CHOICE_GATES. Used by the scheduler to
   * include gated calls in the generation pool.
   */
  getGatedCallIds(choiceHistory: ChoiceHistorySnapshot): number[] {
    const unlocked: number[] = [];
    for (const gate of CHOICE_GATES) {
      if (!choiceHistory.hasChoice(gate.choiceKey)) continue;
      if (gate.choiceValue !== undefined) {
        const record = choiceHistory.getChoice(gate.choiceKey);
        if (record === undefined || record.value !== gate.choiceValue) continue;
      }
      unlocked.push(gate.unlocksCallId);
    }
    return unlocked;
  }

  /**
   * DEA-61 / DEA-69: Return every call id referenced by CHOICE_GATES,
   * regardless of unlock status. Callers subtract the unlocked set from
   * this to determine which gated calls remain locked.
   */
  getAllGatedCallIds(): number[] {
    return CHOICE_GATES.map((g) => g.unlocksCallId);
  }

  /**
   * DEA-61 / DEA-69: Filter a call pool so that gated call ids appear only
   * when their prerequisite choice has been recorded. Calls not referenced
   * by any gate pass through unchanged.
   */
  filterGatedCalls<T extends { id: number }>(
    calls: ReadonlyArray<T>,
    choiceHistory: ChoiceHistorySnapshot,
  ): T[] {
    const allGated = new Set(this.getAllGatedCallIds());
    if (allGated.size === 0) return [...calls];
    const unlocked = new Set(this.getGatedCallIds(choiceHistory));
    return calls.filter((c) => !allGated.has(c.id) || unlocked.has(c.id));
  }

  // --- Internal helpers ---

  /**
   * DEA-57 / DEA-69: Filter response options by ChoiceHistory. Responses
   * with `requiresChoiceKey` are included only when the player has
   * recorded that choice. Responses without prerequisites always pass.
   * Returns the full pool if no history is provided.
   */
  private filterResponses(
    responses: ReadonlyArray<ResponseOption>,
    choiceHistory: ChoiceHistorySnapshot,
  ): ReadonlyArray<ResponseOption> {
    const filtered = responses.filter(
      (r) => r.requiresChoiceKey === undefined || choiceHistory.hasChoice(r.requiresChoiceKey),
    );
    // Ensure we never drop below MIN_CHOICES — fall back to the full pool.
    if (filtered.length < MIN_CHOICES) {
      return responses;
    }
    return filtered;
  }

  /** Validate that every fragment library has non-empty arrays. */
  private validateFragments(fragments: ReadonlyArray<FragmentLibrary>): void {
    if (fragments.length === 0) {
      throw new Error('ProceduralCallGenerator requires at least one fragment library');
    }
    for (const lib of fragments) {
      if (lib.openings.length === 0) {
        throw new Error(`Band ${lib.bandName}: openings must be non-empty`);
      }
      if (lib.middles.length === 0) {
        throw new Error(`Band ${lib.bandName}: middles must be non-empty`);
      }
      if (lib.closings.length === 0) {
        throw new Error(`Band ${lib.bandName}: closings must be non-empty`);
      }
      if (lib.callTypes.length === 0) {
        throw new Error(`Band ${lib.bandName}: callTypes must be non-empty`);
      }
      if (lib.callerIdPrefixes.length === 0) {
        throw new Error(`Band ${lib.bandName}: callerIdPrefixes must be non-empty`);
      }
      if (lib.callerNamePrefixes.length === 0) {
        throw new Error(`Band ${lib.bandName}: callerNamePrefixes must be non-empty`);
      }
      // RIGHT_ANSWER calls need at least MIN_CHOICES responses.
      if (lib.callTypes.includes('RIGHT_ANSWER') && lib.responses.length < MIN_CHOICES) {
        throw new Error(
          `Band ${lib.bandName}: RIGHT_ANSWER requires at least ${MIN_CHOICES} responses`,
        );
      }
    }
  }

  /** Validate that every fragment library has a matching BandVariation. */
  private validateVariations(
    variations: ReadonlyArray<BandVariation>,
    fragments: ReadonlyArray<FragmentLibrary>,
  ): void {
    for (const lib of fragments) {
      const variation = variations.find((v) => v.band === lib.band);
      if (variation === undefined) {
        throw new Error(`No BandVariation for band ${lib.band} (${lib.bandName})`);
      }
    }
  }

  /** Get the fragment library for a band index. */
  private getLibrary(band: number): FragmentLibrary {
    const library = this.fragmentsByBand.get(band);
    if (library === undefined) {
      throw new Error(`No fragment library for band index ${band}`);
    }
    return library;
  }

  /** Get the BandVariation for a band index. */
  private getVariation(band: number): BandVariation {
    const variation = this.variationsByBand.get(band);
    if (variation === undefined) {
      // Fall back to the exported getter which throws a clear error.
      return getBandVariation(band);
    }
    return variation;
  }

  /** Pick a random element from a non-empty array. */
  private pick<T>(arr: ReadonlyArray<T>): T {
    const index = Math.floor(Math.random() * arr.length);
    const item = arr[index];
    if (item === undefined) {
      // Unreachable: validated non-empty at construction.
      throw new Error('pick() on empty array');
    }
    return item;
  }

  /** Pick a random call type from the library's supported types. */
  private pickCallType(library: FragmentLibrary): CallType {
    return this.pick(library.callTypes);
  }

  /** Random integer in [min, max] inclusive. */
  private randomInt(min: number, max: number): number {
    if (max < min) {
      // Defensive: ranges are calibrated in variations.ts, but guard
      // against accidental inversion.
      return min;
    }
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  /**
   * Assemble procedural lines: 1 opening + 1-3 middles + 1 closing.
   * Lines are sampled without replacement per slot (openings, middles,
   * closings are independent pools) so a single call never repeats the
   * same fragment, but the same fragment can appear across calls.
   */
  private assembleLines(library: FragmentLibrary): string[] {
    const opening = this.pick(library.openings);
    const middleCount = this.randomInt(1, MAX_MIDDLE_LINES);
    const middles: string[] = [];
    const available = [...library.middles];
    for (let i = 0; i < middleCount && available.length > 0; i++) {
      const idx = Math.floor(Math.random() * available.length);
      const line = available.splice(idx, 1)[0];
      if (line !== undefined) {
        middles.push(line);
      }
    }
    const closing = this.pick(library.closings);
    const lines = [opening, ...middles, closing];
    if (lines.length < MIN_LINES) {
      // Defensive: should be unreachable given non-empty validated pools.
      throw new Error('Generated call has too few lines');
    }
    return lines;
  }

  /**
   * Assemble choices for a RIGHT_ANSWER call.
   * Samples 2-4 responses from the library. Each response gets a
   * randomized tapeChance roll; if it succeeds, the choice unlocks
   * a synthetic procedural tape.
   *
   * staticMult is derived from the response's outcome length — longer
   * outcomes feel weightier, so they reward more static. Range 1..3.
   */
  private assembleChoices(
    responses: ReadonlyArray<ResponseOption>,
    variation: BandVariation,
  ): CallChoice[] {
    const choiceCount = Math.min(MAX_CHOICES, Math.max(MIN_CHOICES, responses.length));
    const available = [...responses];
    const choices: CallChoice[] = [];
    for (let i = 0; i < choiceCount && available.length > 0; i++) {
      const idx = Math.floor(Math.random() * available.length);
      const response = available.splice(idx, 1)[0];
      if (response === undefined) {
        continue;
      }
      const choice = this.responseToChoice(response, variation);
      choices.push(choice);
    }
    if (choices.length < MIN_CHOICES) {
      throw new Error('Generated RIGHT_ANSWER call has too few choices');
    }
    return choices;
  }

  /**
   * Convert a ResponseOption to a CallChoice.
   * - sanityDelta: from the response, or randomized within variation range.
   * - staticMult: 1..3, weighted by outcome length.
   * - tape: rolled against tapeChance; synthetic tape name assigned.
   */
  private responseToChoice(response: ResponseOption, variation: BandVariation): CallChoice {
    const sanityDelta =
      response.sanityDelta ??
      this.randomInt(variation.sanityDeltaRange[0], variation.sanityDeltaRange[1]);
    // staticMult: explicit fragment value, or derived from outcome length.
    // Clamped to [1, 3] to match the sacred 18's economy.
    const derivedMult =
      response.staticMult ?? Math.max(1, Math.min(3, Math.ceil(response.outcome.length / 80)));
    const staticMult = Math.max(1, Math.min(3, derivedMult));

    const choice: CallChoice = {
      text: response.text,
      outcome: response.outcome,
      sanityDelta,
      staticMult,
    };

    const tapeChance = response.tapeChance ?? 0;
    if (tapeChance > 0 && Math.random() < tapeChance) {
      choice.tape = true;
      choice.tapeName = `${PROCEDURAL_TAPE_PREFIX} #${this.nextId}`;
    }

    return choice;
  }

  /** Generate a callerId from the library's prefix pool + a counter suffix. */
  private generateCallerId(library: FragmentLibrary): string {
    const prefix = this.pick(library.callerIdPrefixes);
    // Replace #### placeholders with random digits for realism.
    const resolved = prefix.replace(/####/g, () => String(this.randomInt(0, 9)));
    return `${resolved}-${this.nextId}`;
  }

  /** Generate a callerName from the library's name prefix pool. */
  private generateCallerName(library: FragmentLibrary): string {
    const prefix = this.pick(library.callerNamePrefixes);
    return `${prefix} ${this.nextId}`;
  }

  /** Generate a SIGNAL_DECODE sequence (3-6 elements, values 0-2). */
  private generateSequence(): number[] {
    const length = this.randomInt(3, 6);
    const sequence: number[] = [];
    for (let i = 0; i < length; i++) {
      sequence.push(this.randomInt(0, 2));
    }
    return sequence;
  }

  /** Generate a SIGNAL_DECODE decoded message from the library's openings. */
  private generateDecodedMessage(library: FragmentLibrary): string {
    const opening = this.pick(library.openings);
    // Strip quotes and punctuation to make it feel like a decoded signal.
    return opening
      .replace(/[""".]/g, '')
      .toUpperCase()
      .slice(0, 60);
  }
}

// --- Module-level singleton ---

let generatorInstance: ProceduralCallGenerator | null = null;

/**
 * Get the singleton ProceduralCallGenerator. Returns null if not yet
 * initialized. Callers should use `getProceduralCallGenerator()` rather
 * than constructing directly when wiring into the live app.
 */
export const getProceduralCallGenerator = (): ProceduralCallGenerator | null => generatorInstance;

/**
 * Initialize the singleton generator from the live fragment libraries.
 * Idempotent — safe to call once at boot.
 */
export const initProceduralCallGenerator = (
  fragments: ReadonlyArray<FragmentLibrary>,
  variations?: ReadonlyArray<BandVariation>,
): ProceduralCallGenerator => {
  if (generatorInstance === null) {
    generatorInstance = new ProceduralCallGenerator(fragments, variations);
  }
  return generatorInstance;
};

/** Test-only: clear the singleton. */
export const resetProceduralCallGenerator = (): void => {
  generatorInstance = null;
};
