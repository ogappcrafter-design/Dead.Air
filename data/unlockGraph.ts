// data/unlockGraph.ts
// DEA-62: Dependency DAG for call unlocks.
//
// Each sacred call may have prerequisite calls that must already be in the
// `receivedCalls` log before the engine includes it in the pool. The graph
// is encoded as a static record keyed by callId pointing to an array of
// prerequisite callIds. Missing keys mean no prerequisites.
//
// The graph is a DAG because cycles would make calls unreachable; a
// pure validator is exported in engine/progression/UnlockGraph.ts to
// detect accidental cycles at test time.
//
// Sacred call id space lives at 0..17 (see data/calls.js). Procedural
// ids live at PROCEDURAL_ID_BASE 1000+ (see ProceduralCallGenerator);
// they are always available but gated by band unlock, not by this graph.

export type CallId = number;

export interface UnlockGraph {
  /** callId -> list of prerequisite call ids that must be in receivedCalls. */
  prerequisites: Record<number, CallId[]>;
}

/**
 * Static unlock graph for the 18 sacred calls.
 *
 * Progression is tuned so that band-locked content (calls 5..17) is only
 * eligible once earlier content has introduced the player to the
 * relevant lore vocabulary. The very late calls (14..17) form the meta
 * narrative chain and require *all* of the preceding band-specific calls
 * to keep the structure tight.
 */
export const UNLOCK_GRAPH: UnlockGraph = {
  prerequisites: {
    // LIVING
    1: [0], // know the voice before the name
    2: [1],
    3: [1],
    // LIMINAL
    4: [3],
    5: [4],
    6: [5],
    7: [5],
    // LOST
    8: [3, 7],
    9: [8],
    10: [9],
    11: [9],
    // CLASSIFIED
    12: [11],
    13: [12],
    14: [13], // THE WHISTLEBLOWER needs the prior classified material
    // ████
    15: [14], // ORIGIN only after WHISTLEBLOWER
    16: [15], // YOU CALLED US only after ORIGIN
    17: [16], // DEAD AIR final trigger
  },
};

/**
 * The call ids that participate in the meta-narrative chain.
 * Each call depends on the previous one; receiving DEAD AIR (17)
 * unlocks the meta-ending when combined with 15 tapes.
 */
export const META_CHAIN_CALL_IDS: CallId[] = [14, 15, 16, 17];

/**
 * Total number of sacred calls (ids 0..17 inclusive = 18).
 */
export const SACRED_CALL_COUNT = 18;

/**
 * Names of the meta-narrative chain calls (used by MetaNarrative).
 */
export const META_CHAIN_NAMES: Record<CallId, string> = {
  14: 'THE WHISTLEBLOWER',
  15: 'ORIGIN',
  16: 'YOU CALLED US',
  17: 'DEAD AIR',
};
