// data/choiceGates.ts
// DEA-61 / DEA-69: Static unlock graph mapping RIGHT_ANSWER choices to
// gated procedural call ids. When a player records a choice matching a
// gate's choiceKey (and optional value), the gate's unlocksCallId becomes
// available for generation by ProceduralCallGenerator.
//
// Pure data — no logic, no I/O, no imports of engine or store modules.

import type { CallType } from '../lib/constants';

export interface ChoiceGate {
  /** ChoiceHistory key that triggers this gate (exact match). */
  choiceKey: string;
  /** Optional value constraint. If set, the gate fires only when the
   *  recorded choice's value matches. If omitted, any value fires. */
  choiceValue?: string | number;
  /** Procedural call id unlocked by this gate (≥1000). */
  unlocksCallId: number;
  /** Call type of the unlocked call (for renderer routing). */
  callType: CallType;
}

/** Static gate table. ProceduralCallGenerator queries this via
 *  getGatedCallIds(choiceHistory) to exclude gated calls from generation
 *  until their gates are satisfied. */
export const CHOICE_GATES: ReadonlyArray<ChoiceGate> = [
  // Entries will be populated as procedural content authoring adds
  // gated calls. The empty array is a valid no-op: no calls are gated,
  // so all procedural ids are always available.
];
