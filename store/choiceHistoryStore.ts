// store/choiceHistoryStore.ts
// Persistent choice history driving ending variant selection and
// procedural call gating.
//
// Records every meaningful decision the player makes across calls. Each
// RIGHT_ANSWER choice is keyed by a `choiceKey` (short semantic key) so
// MetaNarrative can evaluate the ending variant and ProceduralCallGenerator
// can gate fragment branches without re-parsing English choice text.
//
// Supports two API surfaces:
//   1. Legacy / consumer API: recordChoice(), clear(), hasChoice(),
//      getChoice(), getChoicesForCall(), hasChoicePattern(), toSnapshot().
//   2. DEA-58 compat aliases: addChoice(), reset(), getTags(), hasTag().
//
// Pure-ish: the store uses Zustand + AsyncStorage persistence; the
// evaluation logic lives in engine/progression/MetaNarrative.ts so it
// can be unit-tested without wiring React.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_KEY } from '../lib/constants';

/** Maximum records kept before oldest entries are trimmed. */
export const MAX_RECORDS = 500;

/**
 * A recorded player decision. One entry per choice made.
 */
export interface ChoiceRecord {
  /** Id of the call the choice belongs to. */
  callId: number;
  /** Short semantic key (e.g. `RIGHT_ANSWER:1001:0`, `cooperate`). */
  choiceKey: string;
  /** Value of the chosen option (label or index). */
  value: string | number;
  /** Timestamp (ms epoch) when the choice was made. */
  timestamp: number;
  // ── DEA-58 compat (optional, populated by addChoice alias) ──
  /** Index of the chosen option in the call's choices array. */
  choiceIndex?: number;
  /** Sanity delta applied by the choice (snapshot). */
  sanityDelta?: number;
}

/**
 * Immutable snapshot of the choice history with bound query methods.
 * Used by ProceduralCallGenerator to gate fragment branches without
 * importing the Zustand store.
 */
export interface ChoiceHistorySnapshot {
  /** Defensive copy of the recorded choices. */
  readonly records: ChoiceRecord[];
  hasChoice(choiceKey: string): boolean;
  getChoice(choiceKey: string): ChoiceRecord | undefined;
  getChoicesForCall(callId: number): ChoiceRecord[];
  hasChoicePattern(pattern: RegExp): boolean;
}

interface ChoiceHistoryState {
  /** Chronological list of recorded choices (oldest first). */
  choices: ChoiceRecord[];
  // ── Legacy API ──
  recordChoice: (callId: number, choiceKey: string, value: string | number) => void;
  clear: () => void;
  hasChoice: (choiceKey: string) => boolean;
  getChoice: (choiceKey: string) => ChoiceRecord | undefined;
  getChoicesForCall: (callId: number) => ChoiceRecord[];
  hasChoicePattern: (pattern: RegExp) => boolean;
  toSnapshot: () => ChoiceHistorySnapshot;
  // ── DEA-58 compat aliases ──
  addChoice: (record: Omit<ChoiceRecord, 'timestamp'>) => void;
  reset: () => void;
  getChoiceLog: () => ChoiceRecord[];
  getTags: () => string[];
  hasTag: (tag: string) => boolean;
}

/** Create a snapshot from a records array (shared by store + toSnapshot). */
function makeSnapshot(records: ChoiceRecord[]): ChoiceHistorySnapshot {
  return {
    records: [...records],
    hasChoice: (key) => records.some((r) => r.choiceKey === key),
    getChoice: (key) => records.find((r) => r.choiceKey === key),
    getChoicesForCall: (callId) => records.filter((r) => r.callId === callId),
    hasChoicePattern: (pattern) => records.some((r) => pattern.test(r.choiceKey)),
  };
}

/** Guard for records read from legacy storage. */
function isChoiceRecord(value: unknown): value is ChoiceRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.callId === 'number' &&
    typeof record.choiceKey === 'string' &&
    (typeof record.value === 'string' || typeof record.value === 'number') &&
    typeof record.timestamp === 'number'
  );
}

/**
 * DEA-48 migration: the persistence key was renamed from
 * `${SAVE_KEY}_choices` to `${SAVE_KEY}_choices_v1`. Import valid legacy
 * records when the new key has no saved state so existing saves keep
 * influencing ending variants and procedural-call gates.
 */
async function importLegacyChoices(
  state: ChoiceHistoryState | undefined,
): Promise<void> {
  if (!state || state.choices.length > 0) {
    return;
  }
  try {
    const raw = await AsyncStorage.getItem(`${SAVE_KEY}_choices`);
    if (!raw) {
      return;
    }
    const parsed: unknown = JSON.parse(raw);
    let records: unknown;
    if (Array.isArray(parsed)) {
      records = parsed;
    } else if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray((parsed as { state?: { choices?: unknown } }).state?.choices)
    ) {
      records = (parsed as { state: { choices: unknown } }).state.choices;
    } else {
      return;
    }
    const valid = (records as unknown[]).filter(isChoiceRecord);
    if (valid.length === 0) {
      return;
    }
    useChoiceHistoryStore.setState({ choices: valid });
  } catch {
    // Corrupt or unreadable legacy payload — never block hydration.
  }
}

export const useChoiceHistoryStore = create<ChoiceHistoryState>()(
  persist(
    (set, get) => ({
      choices: [],

      // ── Legacy API ──

      recordChoice: (callId, choiceKey, value) => {
        set((state) => {
          // Dedup by choiceKey — last write wins.
          const filtered = state.choices.filter((r) => r.choiceKey !== choiceKey);
          const record: ChoiceRecord = { callId, choiceKey, value, timestamp: Date.now() };
          const choices = [...filtered, record];
          // Trim oldest entries beyond MAX_RECORDS.
          if (choices.length > MAX_RECORDS) {
            return { choices: choices.slice(choices.length - MAX_RECORDS) };
          }
          return { choices };
        });
      },

      clear: () => set({ choices: [] }),

      hasChoice: (choiceKey) => get().choices.some((r) => r.choiceKey === choiceKey),

      getChoice: (choiceKey) => get().choices.find((r) => r.choiceKey === choiceKey),

      getChoicesForCall: (callId) => get().choices.filter((r) => r.callId === callId),

      hasChoicePattern: (pattern) => get().choices.some((r) => pattern.test(r.choiceKey)),

      toSnapshot: () => makeSnapshot(get().choices),

      // ── DEA-58 compat aliases ──

      addChoice: (record) => {
        get().recordChoice(record.callId, record.choiceKey, record.value);
      },

      reset: () => get().clear(),

      getChoiceLog: () => [...get().choices],

      getTags: () => {
        const seen = new Set<string>();
        const tags: string[] = [];
        for (const c of get().choices) {
          if (!seen.has(c.choiceKey)) {
            seen.add(c.choiceKey);
            tags.push(c.choiceKey);
          }
        }
        return tags;
      },

      hasTag: (tag) => get().hasChoice(tag),
    }),
    {
      name: `${SAVE_KEY}_choices_v1`,
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        void importLegacyChoices(state);
      },
    },
  ),
);
