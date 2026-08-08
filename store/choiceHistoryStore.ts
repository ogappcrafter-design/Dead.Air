// store/choiceHistoryStore.ts
// DEA-58 / DEA-69: Persistent record of every player choice made during calls.
// Choice keys are namespaced by callType (e.g. "RIGHT_ANSWER:callId:0",
// "PUZZLE:cipherPath", "CONVERSATION:trust"). The store is deliberately
// separate from narrativeStore (DEA-70) but is expected to feed it.
//
// Persist middleware mirrors useGameStore / useAchievementStore:
//   createJSONStorage(() => AsyncStorage) + partialize.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_KEY } from '../lib/constants';

/**
 * A single recorded player choice.
 *
 * `choiceKey` is namespaced by callType (e.g. "RIGHT_ANSWER:1005:0",
 * "PUZZLE:cipherPath", "CONVERSATION:trust"). Namespacing prevents
 * collisions between different call types and allows pattern queries
 * via `hasChoicePattern`.
 */
export interface ChoiceRecord {
  /** Call instance identifier (sacred call id or procedural id ≥1000). */
  callId: number;
  /** Namespaced choice key, e.g. "RIGHT_ANSWER:1005:0". */
  choiceKey: string;
  /** Player-selected value: choice text, decoded string, or index. */
  value: string | number;
  /** Unix epoch milliseconds when the choice was recorded. */
  timestamp: number;
}

/**
 * Read-only snapshot passed to engine code (ProceduralCallGenerator, gates)
 * so the engine stays framework-agnostic — no store import required.
 */
export interface ChoiceHistorySnapshot {
  records: ReadonlyArray<ChoiceRecord>;
  hasChoice: (choiceKey: string) => boolean;
  getChoice: (choiceKey: string) => ChoiceRecord | undefined;
  getChoicesForCall: (callId: number) => ReadonlyArray<ChoiceRecord>;
  hasChoicePattern: (pattern: RegExp) => boolean;
}

interface ChoiceHistoryState {
  /** All recorded choices, oldest first. */
  choices: ChoiceRecord[];
  /** Record a new choice. Deduplicates by choiceKey (last write wins). */
  recordChoice: (callId: number, choiceKey: string, value: string | number) => void;
  /** Predicate: has a choice with this exact key been recorded? */
  hasChoice: (choiceKey: string) => boolean;
  /** Return the most recent record for a key, or undefined. */
  getChoice: (choiceKey: string) => ChoiceRecord | undefined;
  /** Return all choices recorded for a specific call instance. */
  getChoicesForCall: (callId: number) => ChoiceRecord[];
  /** Predicate: does any choice key match the regex? */
  hasChoicePattern: (pattern: RegExp) => boolean;
  /** Produce a framework-agnostic snapshot for engine consumption. */
  toSnapshot: () => ChoiceHistorySnapshot;
  /** Wipe all history (used by resetGame / debug). */
  clear: () => void;
}

/** AsyncStorage persistence key, versioned alongside the main save. */
const STORAGE_NAME = `${SAVE_KEY}_choices_v1`;

/** Cap history to prevent unbounded growth across sessions. */
const MAX_RECORDS = 500;

export const useChoiceHistoryStore = create<ChoiceHistoryState>()(
  persist(
    (set, get) => ({
      choices: [],

      recordChoice: (callId, choiceKey, value) => {
        const ts = Date.now();
        set((state) => {
          // Replace existing entry with same key (last write wins);
          // otherwise append.
          const filtered = state.choices.filter((c) => c.choiceKey !== choiceKey);
          const next: ChoiceRecord = { callId, choiceKey, value, timestamp: ts };
          let updated = [...filtered, next];
          // Trim oldest entries if over cap.
          if (updated.length > MAX_RECORDS) {
            updated = updated.slice(updated.length - MAX_RECORDS);
          }
          return { choices: updated };
        });
      },

      hasChoice: (choiceKey) => get().choices.some((c) => c.choiceKey === choiceKey),

      getChoice: (choiceKey) => {
        const matches = get().choices.filter((c) => c.choiceKey === choiceKey);
        if (matches.length === 0) return undefined;
        // Return the most recent (last in array, since we append).
        return matches[matches.length - 1];
      },

      getChoicesForCall: (callId) => get().choices.filter((c) => c.callId === callId),

      hasChoicePattern: (pattern) => get().choices.some((c) => pattern.test(c.choiceKey)),

      toSnapshot: () => {
        const state = get();
        return {
          records: [...state.choices],
          hasChoice: state.hasChoice,
          getChoice: state.getChoice,
          getChoicesForCall: state.getChoicesForCall,
          hasChoicePattern: state.hasChoicePattern,
        };
      },

      clear: () => set({ choices: [] }),
    }),
    {
      name: STORAGE_NAME,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
