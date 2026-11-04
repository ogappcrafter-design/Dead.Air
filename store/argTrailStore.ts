// store/argTrailStore.ts
// DEA-91: persisted discovery log for the in-fiction ARG trail. Wraps the
// pure engine/arg/ArgTrail.ts helpers, mirroring store/seasonStore.ts.
//
// The log is deliberately separate from the game save: a discovery is
// knowledge, not inventory. A permadeath wipe (no_rest) clears the run, not
// what the player has already read — otherwise the trail could never resolve
// for a player who chose the hardest mode.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_KEY } from '../lib/constants';
import type { ArgFragmentId, ArgTraceId } from '../data/arg';

interface ArgTrailState {
  /** Registry rows the player has decoded from scanline traces. */
  decodedTraceIds: ArgTraceId[];
  /** CLASSIFIED bleeds the player chose to keep. */
  heardFragmentIds: ArgFragmentId[];
  /** True once the hidden call has been handed to the call manager. */
  hiddenCallPlayed: boolean;

  markTraceDecoded: (id: ArgTraceId) => void;
  markFragmentHeard: (id: ArgFragmentId) => void;
  markHiddenCallPlayed: () => void;
  reset: () => void;
}

const initialState = {
  decodedTraceIds: [] as ArgTraceId[],
  heardFragmentIds: [] as ArgFragmentId[],
  hiddenCallPlayed: false,
};

export const useArgTrailStore = create<ArgTrailState>()(
  persist(
    (set) => ({
      ...initialState,

      markTraceDecoded: (id): void => {
        set((state) => ({
          decodedTraceIds: state.decodedTraceIds.includes(id)
            ? state.decodedTraceIds
            : [...state.decodedTraceIds, id],
        }));
      },

      markFragmentHeard: (id): void => {
        set((state) => ({
          heardFragmentIds: state.heardFragmentIds.includes(id)
            ? state.heardFragmentIds
            : [...state.heardFragmentIds, id],
        }));
      },

      markHiddenCallPlayed: (): void => {
        set({ hiddenCallPlayed: true });
      },

      reset: (): void => {
        set({ ...initialState });
      },
    }),
    {
      name: `${SAVE_KEY}:arg`,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
