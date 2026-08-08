// engine/progression/MetaNarrative.ts
// DEA-59 / DEA-60 / DEA-55: pure meta-narrative deterministic state machine.
//
// All functions are pure and take plain inputs. The React layer translates
// these results into CRT screens + audio; store/narrativeStore persists the
// booleans. No imports from store/ or React.
//
// Domain rules:
//  - DEA-60: the meta-ending becomes available once (a) the player has
//    collected all 15 tapes AND (b) received the DEAD AIR call (id 17)
//    in the meta chain.
//  - DEA-59: the Relay Point arc is "triggered" when the player receives
//    THE WHISTLEBLOWER (id 14). It is "complete" when ORIGIN (id 15)
//    plays: the broadcaster's origin is revealed.
//  - DEA-55: ending variant is selected solely from ChoiceHistory tags
//    via a deterministic priority ladder (higher trait wins).

import { META_CHAIN_CALL_IDS, META_CHAIN_NAMES, CallId } from '../../data/unlockGraph';

export const TAPE_COUNT_FOR_META_ENDING = 15;

export const DEAD_AIR_CALL_ID: CallId = 17;
export const WHISTLEBLOWER_CALL_ID: CallId = 14;
export const ORIGIN_CALL_ID: CallId = 15;

/** Tags recorded by ChoiceHistory that influence ending variant. */
export const CHOICE_TAG = {
  cooperate: 'cooperate',
  refuse: 'refuse',
  seekTruth: 'seek_truth',
  protectSelf: 'protect_self',
  listen: 'listen',
  speak: 'speak',
} as const;

/** Plural alias for CHOICE_TAG — same object, ergonomic when used like
 *  `CHOICE_TAGS.cooperate`. The constant is referentially shared so
 *  importers can use whichever spelling reads better at the call site. */
export const CHOICE_TAGS = CHOICE_TAG;

/** Public ending variant identifiers consumed by the CRT renderer. */
export type EndingVariantId =
  'relay' | 'origin' | 'whistleblower' | 'hermit' | 'cassandra' | 'witness' | 'no_ending';

export interface EndingVariant {
  id: EndingVariantId;
  /** Short label rendered on the CRT. */
  label: string;
  /** Lore-style subtitle, ≤200 chars. */
  subtitle: string;
}

/** Stable priority order. Higher trait wins when multiple traits are present. */
export const VARIANT_PRIORITY: { tag: string; variant: EndingVariantId }[] = [
  { tag: CHOICE_TAG.cooperate, variant: 'relay' },
  { tag: CHOICE_TAG.speak, variant: 'relay' },
  { tag: CHOICE_TAG.refuse, variant: 'whistleblower' },
  { tag: CHOICE_TAG.protectSelf, variant: 'hermit' },
  { tag: CHOICE_TAG.seekTruth, variant: 'origin' },
  { tag: CHOICE_TAG.listen, variant: 'witness' },
];

export const VARIANT_LABELS: Record<EndingVariantId, EndingVariant> = {
  relay: {
    id: 'relay',
    label: 'THE RELAY',
    subtitle: 'You keep the signal alive. Something else speaks through you now.',
  },
  origin: {
    id: 'origin',
    label: 'THE ORIGIN',
    subtitle: 'You found the first voice. It has been waiting for someone to listen.',
  },
  whistleblower: {
    id: 'whistleblower',
    label: 'THE WHISTLEBLOWER',
    subtitle: 'You refused the contract. The static remembers that.',
  },
  hermit: {
    id: 'hermit',
    label: 'THE HERMIT',
    subtitle: 'You protected yourself. The radio keeps screaming, but not for you.',
  },
  cassandra: {
    id: 'cassandra',
    label: 'THE CASSANDRA',
    subtitle: 'You knew. Nobody believed you. They never do.',
  },
  witness: {
    id: 'witness',
    label: 'THE WITNESS',
    subtitle: 'You listened. That was all they ever asked.',
  },
  no_ending: {
    id: 'no_ending',
    label: 'NO ENDING',
    subtitle: 'The signal goes on. There is more to hear.',
  },
};

export const NO_ENDING = VARIANT_LABELS.no_ending;

export interface MetaNarrativeInput {
  /** Array of tape ids the player has collected. */
  tapesCollected: readonly string[];
  /** Array of call ids the player has received. */
  receivedCalls: readonly number[];
  /** Tags from ChoiceHistory (see store/choiceHistoryStore). */
  choiceTags: readonly string[];
  /** Sanity snapshot from useGameStore (0..100). */
  sanity?: number;
}

export interface MetaNarrativeState {
  /** True when WHISTLEBLOWER has been received (relay arc begins). */
  relayPointTriggered: boolean;
  /** True when ORIGIN has been received (relay arc climax plays). */
  relayPointComplete: boolean;
  /** True when DEAD AIR (id 17) has been received. */
  deadAirReceived: boolean;
  /** True when all 15 tapes are in tapesCollected. */
  allTapesCollected: boolean;
  /** DEA-60: meta-ending unlocked when both climbers are true. */
  metaEndingUnlocked: boolean;
  /** DEA-55: selected ending variant id (no_ending if not unlocked). */
  endingVariant: EndingVariantId;
  /** Full ending descriptor object (label + subtitle). */
  ending: EndingVariant;
  /** Ordered chain of received meta call ids (14..17 subset). */
  receivedMetaChain: CallId[];
}

function contains<T>(arr: readonly T[], v: T): boolean {
  return arr.indexOf(v) !== -1;
}

function hasAllTapes(tapes: readonly string[]): boolean {
  // We count distinct entries; the runtime dedups tape ids, but be defensive.
  return new Set(tapes).size >= TAPE_COUNT_FOR_META_ENDING;
}

/**
 * Resolve the player's ending variant from their accumulated choice tags.
 * Deterministic priority ladder — ties resolve to the higher-priority trait.
 */
export function resolveEndingVariant(choiceTags: readonly string[]): EndingVariantId {
  // Walk priority from highest to lowest; first tag present wins.
  for (const { tag, variant } of VARIANT_PRIORITY) {
    if (contains(choiceTags as string[], tag)) {
      return variant;
    }
  }
  // No tags yet → no_ending (neutral; the signal goes on).
  return 'no_ending';
}

/**
 * Pure computation layer: given the raw player state, derive every boolean
 * and variant that the runtime needs. UI layers should treat this as the
 * single source of truth for "should the meta-ending play now?".
 */
export function evaluateMetaNarrative(input: MetaNarrativeInput): MetaNarrativeState {
  const received = input.receivedCalls;
  const relayPointTriggered = contains(received, WHISTLEBLOWER_CALL_ID);
  const relayPointComplete = contains(received, ORIGIN_CALL_ID);
  const deadAirReceived = contains(received, DEAD_AIR_CALL_ID);
  const allTapesCollected = hasAllTapes(input.tapesCollected);

  const metaEndingUnlocked = deadAirReceived && allTapesCollected;

  // Only compute variant when the player is *at* the ending; otherwise
  // return no_ending so the CRT renderer keeps the game going.
  let endingVariant: EndingVariantId = 'no_ending';
  if (metaEndingUnlocked) {
    endingVariant = resolveEndingVariant(input.choiceTags);
  }

  // Sanity-based override: very low sanity (<5) bias of Cassandra over
  // anything except explicit refuse/cooperate paths.
  if (
    metaEndingUnlocked &&
    input.sanity !== undefined &&
    input.sanity < 5 &&
    !contains(input.choiceTags, CHOICE_TAG.cooperate) &&
    !contains(input.choiceTags, CHOICE_TAG.refuse)
  ) {
    endingVariant = 'cassandra';
  }

  const receivedMetaChain = META_CHAIN_CALL_IDS.filter((id) => contains(received, id));

  return {
    relayPointTriggered,
    relayPointComplete,
    deadAirReceived,
    allTapesCollected,
    metaEndingUnlocked,
    endingVariant,
    ending: VARIANT_LABELS[endingVariant],
    receivedMetaChain,
  };
}

/** Convenience: human-readable name of a received meta-chain call id. */
export function metaChainName(id: CallId): string {
  return META_CHAIN_NAMES[id] ?? 'UNKNOWN';
}

/**
 * True when all four meta-chain calls have been received in order.
 * Equivalent to relayPointComplete && deadAirReceived.
 */
export function isMetaChainComplete(receivedCalls: readonly number[]): boolean {
  return META_CHAIN_CALL_IDS.every((id) => contains(receivedCalls, id));
}
