/**
 * DEA-95 Phase 1 — community client caches.
 *
 * The client takes its cache as a dependency so tests (and future offline
 * surfaces) can swap storage without pulling in AsyncStorage. The app uses
 * `asyncStorageCommunityCache`, which persists the last successful preset list
 * for offline fallback.
 */

import { storage } from '../storage';

export interface CommunityCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Process-local cache; useful for tests and throwaway clients. */
export function createMemoryCache(): CommunityCache {
  const entries = new Map<string, unknown>();
  return {
    async get<T>(key: string): Promise<T | null> {
      return (entries.get(key) as T | undefined) ?? null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      entries.set(key, value);
    },
    async remove(key: string): Promise<void> {
      entries.delete(key);
    },
  };
}

export const asyncStorageCommunityCache: CommunityCache = {
  get<T>(key: string): Promise<T | null> {
    return storage.get<T>(key);
  },
  set<T>(key: string, value: T): Promise<void> {
    return storage.set<T>(key, value);
  },
  remove(key: string): Promise<void> {
    return storage.remove(key);
  },
};
