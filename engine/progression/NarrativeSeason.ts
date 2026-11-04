// engine/progression/NarrativeSeason.ts
// DEA-85: pure season state machine. Mirrors engine/progression/MetaNarrative.ts:
// no store imports, no React, no I/O. The React layer turns these results into
// CRT screens and audio; store/seasonStore persists the outcome.
//
// Season 1 domain rules:
//  - The season starts after the relay-point arc is complete (MetaNarrative).
//  - Acts advance with received season calls; Act V additionally requires the
//    first four season tapes.
//  - The ending is selected from the finale's s1_* choice tags. Season tags are
//    namespaced so they never match VARIANT_PRIORITY in MetaNarrative.

import type { Band } from '../../lib/constants';
import { SEASON_1_REQUIRED_TAPE_IDS } from '../../data/seasons/season1/tapes';
import type { SeasonEndingId } from '../../data/seasons/season1/ending';

export type SeasonAct = 1 | 2 | 3 | 4 | 5;

export const SEASON_1_ID = 's1_hold' as const;

/** Band that opens at each act. */
export const SEASON_1_ACT_BAND: Record<SeasonAct, Band> = {
  1: 'LIVING',
  2: 'LIMINAL',
  3: 'LOST',
  4: 'CLASSIFIED',
  5: '████████',
};

/** The season's parallel band ladder, in unlock order. */
export const SEASON_1_BAND_LADDER: readonly Band[] = [
  'LIVING',
  'LIMINAL',
  'LOST',
  'CLASSIFIED',
  '████████',
];

/** Which act each season call belongs to. */
const CALL_ACT: Record<number, SeasonAct> = {
  16000: 1,
  16001: 1,
  16002: 2,
  16003: 2,
  16004: 3,
  16005: 4,
  16006: 4,
  16007: 5,
};

/** Calls that must be received to leave each act. */
const ACT_GATES: ReadonlyArray<{ act: SeasonAct; requires: number }> = [
  { act: 2, requires: 16001 },
  { act: 3, requires: 16003 },
  { act: 4, requires: 16004 },
  { act: 5, requires: 16006 },
];

export interface SeasonProgressInput {
  receivedCalls: readonly number[];
  tapesCollected: readonly string[];
  /** s1_* tags from choiceHistoryStore, used only for the ending opening beat. */
  choiceTags?: readonly string[];
}

/** Current act, 1..5. Act V also requires the four pre-finale tapes. */
export function getSeasonAct(input: SeasonProgressInput): SeasonAct {
  const calls = new Set(input.receivedCalls);
  const tapes = new Set(input.tapesCollected);
  let act: SeasonAct = 1;
  for (const gate of ACT_GATES) {
    if (calls.has(gate.requires)) act = gate.act;
  }
  if (act === 5) {
    const hasAllTapes = SEASON_1_REQUIRED_TAPE_IDS.every((id) => tapes.has(id));
    if (!hasAllTapes) return 4;
  }
  return act;
}

/** Bands unlocked at a given act, in ladder order. */
export function getSeasonBandLadder(act: SeasonAct): Band[] {
  return SEASON_1_BAND_LADDER.slice(0, act);
}

/** True when a season call is eligible at the given act. */
export function isSeasonCallUnlocked(callId: number, act: SeasonAct): boolean {
  const callAct = CALL_ACT[callId];
  return callAct !== undefined && callAct <= act;
}

const FINALE_TAGS = ['s1_connect', 's1_chair', 's1_hangup'] as const;

/**
 * Season ending selection. The season has exactly one ending; the finale tag
 * only chooses its opening beat. 'no_ending' means the finale has not resolved.
 */
export function selectSeasonEnding(choiceTags: readonly string[]): SeasonEndingId {
  for (const tag of choiceTags) {
    if ((FINALE_TAGS as readonly string[]).includes(tag)) return 's1_hold';
  }
  return 'no_ending';
}

/** True when the finale is open and unplayed. */
export function isSeasonFinaleAvailable(input: SeasonProgressInput): boolean {
  return getSeasonAct(input) === 5 && !input.receivedCalls.includes(16007);
}
