// data/seasons/index.ts
// DEA-85: narrative-season registry. Mirrors data/tapePacks/index.ts: a pure
// data module the store and radio screen read. Season content lives under
// ./season1/ and never modifies data/calls.js.

import type { Band } from '../../lib/constants';
import type { CallData } from '../../engine/calls/types';
import type { TapeInfo } from '../tapes/types';
import { SEASON_1_CALLS, SEASON_1_CALL_IDS } from './season1/holdMusic';
import { SEASON_1_TAPES, SEASON_1_TAPE_IDS } from './season1/tapes';
import { SEASON_1_ENDING } from './season1/ending';
import { SEASON_1_PROLOGUE } from './season1/prologue';
import { SEASON_1_UNLOCK_GRAPH } from './season1/unlockGraph';
import type { UnlockGraph } from '../unlockGraph';

export type SeasonId = 's1_hold';

export interface SeasonDefinition {
  id: SeasonId;
  /** In-world designation, e.g. TRANSMISSION 01. */
  transmission: string;
  /** Player-facing title. */
  title: string;
  callIds: readonly number[];
  tapeIds: readonly string[];
  bandLadder: readonly Band[];
  endingId: string;
  prologue: readonly string[];
  /** Season only opens once the relay-point arc is complete. */
  requiresMetaArc: boolean;
  unlockGraph: UnlockGraph;
  calls: readonly CallData[];
  tapes: readonly TapeInfo[];
}

export const SEASONS: readonly SeasonDefinition[] = [
  {
    id: 's1_hold',
    transmission: 'TRANSMISSION 01',
    title: 'HOLD MUSIC',
    callIds: SEASON_1_CALL_IDS,
    tapeIds: SEASON_1_TAPE_IDS,
    // Mirrors SEASON_1_BAND_LADDER in engine/progression/NarrativeSeason.ts.
    // Kept literal so data/ never imports engine/.
    bandLadder: ['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED', '████████'],
    endingId: SEASON_1_ENDING.id,
    prologue: SEASON_1_PROLOGUE,
    requiresMetaArc: true,
    unlockGraph: SEASON_1_UNLOCK_GRAPH,
    calls: SEASON_1_CALLS,
    tapes: SEASON_1_TAPES,
  },
];

export const getSeasonById = (id: string): SeasonDefinition | undefined =>
  SEASONS.find((season) => season.id === id);
