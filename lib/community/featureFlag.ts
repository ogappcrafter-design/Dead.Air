/**
 * DEA-95 Phase 1 — community feature flag.
 *
 * The community platform ships dark. Only an explicit enabling value turns it
 * on, so a missing, empty, or misspelled flag fails closed on both the app and
 * the Worker. The server reads its own flag (`COMMUNITY_ENABLED`) so a client
 * build can never enable the API on its own.
 */

export const COMMUNITY_CLIENT_FLAG_ENV = 'EXPO_PUBLIC_COMMUNITY_ENABLED';
export const COMMUNITY_SERVER_FLAG_ENV = 'COMMUNITY_ENABLED';

/**
 * Parse a raw flag value. Anything that is not an explicit enabling value is
 * treated as off.
 */
export function parseCommunityFlag(raw: string | null | undefined): boolean {
  if (typeof raw !== 'string') return false;
  return raw.trim().toLowerCase() === 'on';
}

/**
 * Client-side flag read. Expo inlines `process.env.EXPO_PUBLIC_*` at build
 * time; when the variable is absent the feature is off.
 */
export function isCommunityEnabled(): boolean {
  return parseCommunityFlag(process.env.EXPO_PUBLIC_COMMUNITY_ENABLED);
}
