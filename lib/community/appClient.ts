// lib/community/appClient.ts
// DEA-95/DEA-89 — the app's shared community client.
//
// One lazily-created client keeps the device token and the offline preset
// cache in AsyncStorage.

import { asyncStorageCommunityCache } from './cache';
import { CommunityClient, resolveCommunityBaseUrl } from './client';

let appClient: CommunityClient | null = null;

export function getCommunityClient(): CommunityClient {
  if (appClient === null) {
    appClient = new CommunityClient({
      baseUrl: resolveCommunityBaseUrl(),
      cache: asyncStorageCommunityCache,
    });
  }
  return appClient;
}
