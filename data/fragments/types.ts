// data/fragments/types.ts
// Type definitions for the procedural call fragment system.
// Fragment libraries provide the raw material the ProceduralCallGenerator
// assembles into CallData objects for the Infinite Signal IAP.
//
// Design rule: every fragment library matches the FragmentLibrary interface
// and is pure data — no logic, no I/O, no imports of engine or store modules.

import type { CallType } from '../../lib/constants';

/**
 * A single response option within a RIGHT_ANSWER call.
 *
 * The generator picks 2-4 responses per RIGHT_ANSWER call. `tapeChance`
 * is a 0..1 probability that this response unlocks a tape; the generator
 * rolls once per response and sets `tape: true` + a synthetic tape name
 * when the roll succeeds.
 */
export interface ResponseOption {
  /** Player-facing choice text. */
  text: string;
  /** Outcome shown after the choice. */
  outcome: string;
  /** Sanity delta applied if this choice is picked. If omitted, the
   *  generator randomizes within the band's sanityDeltaRange. */
  sanityDelta?: number;
  /** Static reward multiplier (1..3). If omitted, the generator derives
   *  one from the outcome length. */
  staticMult?: number;
  /** 0..1 probability of unlocking a tape. 0 (or omitted) = never. */
  tapeChance?: number;
  /**
   * DEA-57 / DEA-69: If set, this response only appears when the player
   * has previously recorded a choice with this exact key in ChoiceHistory.
   * Allows dialogue to reference past decisions (filter-based insertion).
   */
  requiresChoiceKey?: string;
  /**
   * DEA-56 / DEA-69: Branch identifier. Response options sharing a branchId
   * belong to the same narrative branch. The generator uses this with
   * ChoiceHistory to select which branches are available.
   */
  branchId?: string;
}

/**
 * Per-band variation rules. Drives the randomized staticReward,
 * sanityDelta, and signal values the generator assigns to each call.
 *
 * Each range is [min, max] inclusive; the generator picks a random
 * integer (for staticReward/sanityDelta) or float (for signal) within.
 *
 * Values are calibrated to match the sacred 18 calls' per-band economy
 * so procedural calls feel consistent with hand-crafted ones.
 */
export interface BandVariation {
  /** Band index 0-4 (matches CallData.band and BANDS order). */
  band: number;
  /** Band name (matches lib/constants BANDS union). */
  bandName: string;
  /** Base static reward range, before multipliers. */
  staticRewardRange: [number, number];
  /** Sanity delta range applied at call end (can be negative). */
  sanityDeltaRange: [number, number];
  /** Signal strength range 0-5. */
  signalRange: [number, number];
}

/**
 * A fragment library for one band. The generator assembles calls by:
 *   1. Picking a callType from `callTypes`.
 *   2. Building `lines` from 1 opening + 1-3 middles + 1 closing.
 *   3. For RIGHT_ANSWER: attaching 2-4 choices sampled from `responses`.
 *   4. Randomizing staticReward / sanityDelta / signal per BandVariation.
 *   5. Synthesizing a unique callerId and callerName from the prefix pools.
 *
 * Every array must be non-empty; the generator asserts this at construction.
 */
export interface FragmentLibrary {
  /** Band index 0-4. */
  band: number;
  /** Band name (matches lib/constants BANDS union). */
  bandName: string;
  /** Call types this band supports (1-5 entries). */
  callTypes: CallType[];
  /** Opening lines — the first thing the caller says. */
  openings: string[];
  /** Middle lines — 1-3 are sampled per call, in order. */
  middles: string[];
  /** Closing lines — the last thing the caller says. */
  closings: string[];
  /** Response options for RIGHT_ANSWER calls. */
  responses: ResponseOption[];
  /** Caller ID prefix pool (e.g. 'UNKNOWN', 'PRIVATE', '555-####'). */
  callerIdPrefixes: string[];
  /** Caller name prefix pool (e.g. 'THE', 'AGENT', 'CALLER'). */
  callerNamePrefixes: string[];
  /**
   * DEA-57 / DEA-69: If set, this entire fragment library (and all its
   * calls) only appears when the player has previously recorded a choice
   * with this exact key. Allows band-level gating based on history.
   */
  requiresChoiceKey?: string;
  /**
   * DEA-56 / DEA-69: Branch identifier for this library. Libraries sharing
   * a branchId are alternate variants of the same band. The generator's
   * getAvailableBranches() uses this with ChoiceHistory to select which
   * variant to use for a band.
   */
  branchId?: string;

  // --- New call type fragment arrays (DEA-71) ---
  // All optional. Existing band files work unchanged; bands that include
  // new call types in callTypes[] populate these arrays.

  /** RECORDING: audio clip templates for the scrubbing mechanic. */
  recordingClips?: Array<{
    audioLabel: string;
    metadata: string[];
  }>;

  /** MULTI_CALLER: speaker pairs for the dual-voice attribution mechanic. */
  speakerPairs?: Array<{ voiceId: number; name: string }>;

  /** TIMING: beat map templates for the rhythm sync mechanic. */
  beatMaps?: Array<
    Array<{
      timestampMs: number;
      type: 'TAP' | 'HOLD';
      holdDurationMs?: number;
    }>
  >;

  /** PUZZLE: cipher layer templates for the multi-layer decode mechanic. */
  cipherLayers?: Array<{
    encoded: string;
    solution: string;
    hint: string;
  }>;

  /** CONVERSATION: dialogue tree templates for the branching dialogue mechanic. */
  dialogueTrees?: Array<
    Array<{
      speaker: string;
      text: string;
      responses: ResponseOption[];
    }>
  >;
}
