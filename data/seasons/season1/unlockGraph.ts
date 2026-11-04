// data/seasons/season1/unlockGraph.ts
// DEA-85: season call DAG. Mirrors data/unlockGraph.ts; the same validator in
// engine/progression/UnlockGraph.ts checks it for cycles at test time.

import type { UnlockGraph } from '../../unlockGraph';

export const SEASON_1_UNLOCK_GRAPH: UnlockGraph = {
  prerequisites: {
    16001: [16000],
    16002: [16001],
    16003: [16002],
    16004: [16003],
    16005: [16004],
    16006: [16005],
    16007: [16006],
  },
};
