// store/types.ts
// Central GameState type — extracted from useGameStore to break the
// circular dependency between useGameStore and its slices.

import type { GameStateSlice } from './slices/gameStateSlice';
import type { NgPlusSlice } from './slices/ngPlusSlice';
import type { EndlessNightSlice } from './slices/endlessNightSlice';
import type { TapeMasterySlice } from './slices/tapeMasterySlice';

export type GameState = GameStateSlice & NgPlusSlice & EndlessNightSlice & TapeMasterySlice;
