/**
 * DEA-95 Phase 1 — public preset serialization.
 *
 * Internal fields (author device id, raw storage columns) never leave the
 * Worker; timestamps are exposed as ISO strings so the shared schema can
 * validate them on the client.
 */

import type { CommunityPreset, PresetStatus } from './types';

export interface PublicPreset {
  id: string;
  name: string;
  description: string;
  payload: CommunityPreset['payload'];
  tags: string[];
  authorName: string;
  schemaVersion: number;
  status: PresetStatus;
  reportCount: number;
  createdAt: string;
  updatedAt: string;
}

export function toPublicPreset(preset: CommunityPreset): PublicPreset {
  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    payload: preset.payload,
    tags: preset.tags,
    authorName: preset.authorName,
    schemaVersion: preset.schemaVersion,
    status: preset.status,
    reportCount: preset.reportCount,
    createdAt: new Date(preset.createdAt).toISOString(),
    updatedAt: new Date(preset.updatedAt).toISOString(),
  };
}
