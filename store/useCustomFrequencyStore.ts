// store/useCustomFrequencyStore.ts
// DEA-89 — local library of player-authored and installed custom frequencies.
//
// Persisted separately from the game save so adding the forge never migrates
// or invalidates an existing save. Installed community frequencies are kept
// read-only by the UI; the ownership gate for playback lives in CallManager.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_KEY } from '../lib/constants';
import {
  CUSTOM_FREQUENCY_MAX_SAVED,
  CUSTOM_FREQUENCY_SCHEMA_VERSION,
  isValidCustomFrequency,
  validateCustomFrequency,
  type CustomFrequency,
  type CustomFrequencyIssue,
} from '../engine/calls/CustomFrequency';

export const CUSTOM_FREQUENCY_STORAGE_KEY = `${SAVE_KEY}_custom_frequencies_v1`;

export interface CustomFrequencyActionResult {
  ok: boolean;
  issues: CustomFrequencyIssue[];
  frequency?: CustomFrequency;
}

interface CustomFrequencyState {
  frequencies: CustomFrequency[];
  /** Create or update a locally authored frequency. */
  saveLocal: (frequency: CustomFrequency) => CustomFrequencyActionResult;
  /** Install (or refresh) a read-only community frequency. */
  install: (frequency: CustomFrequency) => CustomFrequencyActionResult;
  remove: (id: string) => void;
  reset: () => void;
}

function failure(message: string, path = 'frequency'): CustomFrequencyActionResult {
  return { ok: false, issues: [{ path, message }] };
}

function sanitizeStoredFrequencies(value: unknown): CustomFrequency[] {
  if (!Array.isArray(value)) return [];
  const valid: CustomFrequency[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object') continue;
    try {
      const candidate = entry as CustomFrequency;
      if (!isValidCustomFrequency(candidate)) continue;
      if (candidate.schemaVersion !== CUSTOM_FREQUENCY_SCHEMA_VERSION) continue;
      valid.push(candidate);
    } catch {
      // Ignore malformed persisted entries rather than breaking hydration.
    }
  }
  return valid.slice(0, CUSTOM_FREQUENCY_MAX_SAVED);
}

export const useCustomFrequencyStore = create<CustomFrequencyState>()(
  persist(
    (set, get) => ({
      frequencies: [],

      saveLocal: (frequency) => {
        const existing = get().frequencies.find((entry) => entry.id === frequency.id);
        const candidate: CustomFrequency = {
          ...frequency,
          remoteId: existing?.remoteId ?? frequency.remoteId,
          friendCode: frequency.friendCode ?? existing?.friendCode,
          origin: 'local',
        };
        const validation = validateCustomFrequency(candidate);
        if (!validation.ok) {
          return { ok: false, issues: validation.issues };
        }

        const existingIndex = get().frequencies.findIndex((entry) => entry.id === candidate.id);
        if (existingIndex === -1 && get().frequencies.length >= CUSTOM_FREQUENCY_MAX_SAVED) {
          return failure(`the library is full (${CUSTOM_FREQUENCY_MAX_SAVED} frequencies)`);
        }

        const now = Date.now();
        const stored: CustomFrequency = {
          ...candidate,
          createdAt: existingIndex === -1 ? now : candidate.createdAt || now,
          updatedAt: now,
        };
        const next = [...get().frequencies];
        if (existingIndex === -1) next.push(stored);
        else next[existingIndex] = stored;
        set({ frequencies: next });
        return { ok: true, issues: [], frequency: stored };
      },

      install: (frequency) => {
        const candidate: CustomFrequency = { ...frequency, origin: 'community' };
        if (candidate.remoteId === undefined || candidate.remoteId.trim().length === 0) {
          return failure('installed frequencies require a community id', 'remoteId');
        }
        if (!isValidCustomFrequency(candidate)) {
          return { ok: false, issues: validateCustomFrequency(candidate).issues };
        }

        const existingIndex = get().frequencies.findIndex(
          (entry) =>
            entry.id === candidate.id ||
            (candidate.remoteId !== undefined && entry.remoteId === candidate.remoteId),
        );
        if (existingIndex === -1 && get().frequencies.length >= CUSTOM_FREQUENCY_MAX_SAVED) {
          return failure(`the library is full (${CUSTOM_FREQUENCY_MAX_SAVED} frequencies)`);
        }

        const now = Date.now();
        const stored: CustomFrequency = {
          ...candidate,
          createdAt: existingIndex === -1 ? now : candidate.createdAt || now,
          updatedAt: now,
        };
        const next = [...get().frequencies];
        if (existingIndex === -1) next.push(stored);
        else next[existingIndex] = stored;
        set({ frequencies: next });
        return { ok: true, issues: [], frequency: stored };
      },

      remove: (id) => {
        set({ frequencies: get().frequencies.filter((entry) => entry.id !== id) });
      },

      reset: () => set({ frequencies: [] }),
    }),
    {
      name: CUSTOM_FREQUENCY_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      merge: (persisted, current) => {
        const state = persisted as { frequencies?: unknown } | undefined;
        return {
          ...current,
          frequencies: sanitizeStoredFrequencies(state?.frequencies),
        };
      },
    },
  ),
);
