// store/narrativeStore.ts
// DEA-70: Persisted meta-narrative state.
//
// Wraps the pure engine/progression/MetaNarrative functions with a Zustand
// store so across-session survival of relay-point flags and ending
// selection is guaranteed even if the player closes the app between
// receiving THE WHISTLEBLOWER (id 14) and ORIGIN (id 15).
//
// IMPORTANT: the actual boolean computation lives in MetaNarrative; this
// store only persists the *player-facing* state and exposes actions to
// push the engine result into persisted state at well-defined moments
// (after a call completes, after a tape is added, on resetGame).

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_KEY } from '../lib/constants';
import {
  evaluateMetaNarrative,
  MetaNarrativeInput,
  MetaNarrativeState,
  EndingVariantId,
} from '../engine/progression/MetaNarrative';

interface NarrativeState extends MetaNarrativeState {
  /** Whether the meta-ending sequence has already played. */
  endingPlayed: boolean;
  /** Epoch ms when the meta-ending first became unlocked, for analytics. */
  unlockedAt: number | null;
  // Actions
  /** Reconcile persisted flags with the current game state. Call after
   *  every `addTape`/`markCallReceived` so UI booleans stay fresh. */
  reconcile: (input: MetaNarrativeInput) => void;
  /** Mark the meta-ending sequence as already played (used by the
   *  ending renderer to avoid re-rendering on reload). */
  markEndingPlayed: () => void;
  /** Wipe narrative state to defaults (used by resetGame). */
  reset: () => void;
}

const initialState: Omit<NarrativeState, 'reconcile' | 'markEndingPlayed' | 'reset'> = {
  relayPointTriggered: false,
  relayPointComplete: false,
  deadAirReceived: false,
  receivedMetaChain: [],
  allTapesCollected: false,
  metaEndingUnlocked: false,
  endingVariant: 'no_ending' as EndingVariantId,
  ending: {
    id: 'no_ending',
    label: 'NO ENDING',
    subtitle: 'The signal goes on. There is more to hear.',
  },
  endingPlayed: false,
  unlockedAt: null,
};

export const useNarrativeStore = create<NarrativeState>()(
  persist(
    (set, get) => ({
      ...initialState,

      reconcile: (input) => {
        const next = evaluateMetaNarrative(input);
        const prev = get();
        // First time unlocking → record timestamp.
        const unlockedAt =
          next.metaEndingUnlocked && prev.unlockedAt == null ? Date.now() : prev.unlockedAt;
        // Keep endingPlayed sticky: if it was already true, don't revert
        // even if the player somehow loses a tape (defensive).
        set({ ...next, endingPlayed: prev.endingPlayed, unlockedAt });
      },

      markEndingPlayed: () => set({ endingPlayed: true }),

      reset: () =>
        set({
          ...initialState,
        }),
    }),
    {
      name: `${SAVE_KEY}_narrative`,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
