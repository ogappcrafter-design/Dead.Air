// store/choiceHistoryStore.ts
// DEA-58: Persistent choice history driving ending variant selection.
//
// Records every meaningful decision the player makes across calls. Each
// RIGHT_ANSWER choice is tagged with a `choiceTag` (short semantic key)
// so MetaNarrative can evaluate the ending variant without re-parsing
// English choice text. Tags are derived from `CallChoice.choiceTag` if
// present, otherwise synthesized as `call:<id>:<index>`.
//
// Pure-ish: the store uses Zustand + AsyncStorage persistence; the
// evaluation logic lives in engine/progression/MetaNarrative.ts so it
// can be unit-tested without wiring React.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_KEY } from '../lib/constants';

/**
 * A recorded player decision. One entry per RIGHT_ANSWER choice made.
 */
export interface ChoiceRecord {
  /** Id of the call the choice belongs to. */
  callId: number;
  /** Index of the chosen option in the call's choices array. */
  choiceIndex: number;
  /** Short semantic tag (e.g. `cooperate`, `refuse`, `seek_truth`).
   *  When the call data carries an explicit `choiceTag` on CallChoice,
   *  that value is used. Otherwise synthesized as `call:<callId>:<idx>`. */
  tag: string;
  /** Sanity delta applied by the choice (snapshot). */
  sanityDelta: number;
  /** Timestamp (ms epoch) when the choice was made. */
  timestamp: number;
}

interface ChoiceHistoryState {
  /** Chronological list of recorded choices (oldest first). */
  choices: ChoiceRecord[];
  // Actions
  /** Record a player decision. Idempotent per (callId, choiceIndex). */
  addChoice: (record: Omit<ChoiceRecord, 'timestamp'>) => void;
  /** Return the full choice log ( Defensive copy ). */
  getChoiceLog: () => ChoiceRecord[];
  /** Return all tags in recording order, deduplicated, preserving first occurrence. */
  getTags: () => string[];
  /** True when at least one recorded choice matches the tag. */
  hasTag: (tag: string) => boolean;
  /** Clear the log (used by resetGame). */
  reset: () => void;
}

const recordKey = (r: { callId: number; choiceIndex: number }): string =>
  `${r.callId}:${r.choiceIndex}`;

export const useChoiceHistoryStore = create<ChoiceHistoryState>()(
  persist(
    (set, get) => ({
      choices: [],

      addChoice: (record) => {
        const key = recordKey(record);
        // Idempotent: skip if already recorded.
        if (get().choices.some((c) => recordKey(c) === key)) {
          return;
        }
        set((state) => ({
          choices: [...state.choices, { ...record, timestamp: Date.now() }],
        }));
      },

      getChoiceLog: () => [...get().choices],

      getTags: () => {
        const seen = new Set<string>();
        const tags: string[] = [];
        for (const c of get().choices) {
          if (!seen.has(c.tag)) {
            seen.add(c.tag);
            tags.push(c.tag);
          }
        }
        return tags;
      },

      hasTag: (tag) => get().choices.some((c) => c.tag === tag),

      reset: () => set({ choices: [] }),
    }),
    {
      name: `${SAVE_KEY}_choices`,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
