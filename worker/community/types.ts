/**
 * DEA-95 Phase 1 — community Worker types.
 *
 * The D1 interfaces are structural (not imported from
 * `@cloudflare/workers-types`) so the Worker code typechecks with the repo's
 * existing TypeScript setup and can be exercised in Jest with an in-memory
 * store, while a real `D1Database` binding still satisfies them.
 */

import type { PresetPayload, PresetStatus } from '../../lib/community/schema';

export type { PresetStatus } from '../../lib/community/schema';

export interface D1Result<T> {
  success: boolean;
  results?: T[];
  meta?: {
    duration?: number;
    changes?: number;
    last_row_id?: number;
  };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result<unknown>>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export type ReportStatus = 'open' | 'resolved' | 'dismissed';
export type ReportReason = 'spam' | 'harassment' | 'hate' | 'sexual' | 'broken' | 'other';

export interface CommunityDevice {
  id: string;
  displayName: string;
  banned: boolean;
  createdAt: number;
  lastSeenAt: number;
}

export interface CommunityDeviceRecord extends CommunityDevice {
  tokenHash: string;
}

export interface CommunityPreset {
  id: string;
  authorId: string;
  authorName: string;
  name: string;
  description: string;
  band: string;
  frequency: number;
  payload: PresetPayload;
  tags: string[];
  /** DEA-89: optional author friend code attached to the preset. */
  friendCode: string | null;
  schemaVersion: number;
  status: PresetStatus;
  reportCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface CommunityReport {
  id: string;
  presetId: string;
  presetName?: string;
  reporterDeviceId: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  createdAt: number;
}

export interface PresetQuery {
  q?: string;
  band?: string;
  friendCode?: string;
  limit: number;
  cursor?: string;
}

export interface PresetPage {
  items: CommunityPreset[];
  nextCursor: string | null;
}

export type PresetPatch = Partial<
  Pick<CommunityPreset, 'name' | 'description' | 'payload' | 'tags' | 'friendCode'>
>;

export interface CommunityStore {
  bindEntitlement(input: VerifiedEntitlement): Promise<boolean>;
  createDevice(input: {
    id: string;
    tokenHash: string;
    displayName: string;
    createdAt: number;
  }): Promise<CommunityDeviceRecord>;
  getDeviceById(id: string): Promise<CommunityDeviceRecord | null>;
  getDeviceByTokenHash(tokenHash: string): Promise<CommunityDeviceRecord | null>;
  touchDevice(id: string, at: number): Promise<void>;
  countPresetsByAuthor(authorId: string): Promise<number>;
  createPreset(preset: CommunityPreset): Promise<CommunityPreset | null>;
  getPreset(id: string): Promise<CommunityPreset | null>;
  listPresets(query: PresetQuery): Promise<PresetPage>;
  updatePreset(id: string, patch: PresetPatch, updatedAt: number): Promise<CommunityPreset | null>;
  deletePreset(id: string): Promise<boolean>;
  setPresetStatus(
    id: string,
    status: PresetStatus,
    updatedAt: number,
  ): Promise<CommunityPreset | null>;
  createReport(report: CommunityReport): Promise<{
    created: boolean;
    reportId: string;
    reportCount: number;
  }>;
  listReports(status?: ReportStatus, limit?: number): Promise<CommunityReport[]>;
  resolveReport(id: string, status: Exclude<ReportStatus, 'open'>): Promise<boolean>;
}

/**
 * Worker bindings. `COMMUNITY_STORE` is an injection seam used by tests and
 * local development; production uses the D1 binding.
 */
export interface CommunityEnv {
  COMMUNITY_DB?: D1DatabaseLike;
  COMMUNITY_ENABLED?: string;
  ADMIN_TOKEN?: string;
  COMMUNITY_ALLOWED_ORIGIN?: string;
  COMMUNITY_STORE?: CommunityStore;
  APPLE_BUNDLE_ID?: string;
  APPLE_ISSUER_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
  GOOGLE_PACKAGE_NAME?: string;
  GOOGLE_CLIENT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
}

export interface VerifiedEntitlement {
  purchaseHash: string;
  deviceId: string;
  platform: 'apple' | 'google';
  active: boolean;
  verifiedAt: number;
}

export interface RequestContext {
  request: Request;
  env: CommunityEnv;
  store: CommunityStore;
  url: URL;
  now: () => number;
  newId: () => string;
}
