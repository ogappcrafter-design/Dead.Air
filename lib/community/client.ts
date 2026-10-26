/**
 * DEA-95 Phase 1 — community API client.
 *
 * List reads fall back to the cached result for the same query.
 * Detail reads and writes require a network connection. Every response is
 * validated against the shared schemas before it reaches app state.
 */

import { z } from 'zod';
import type { CommunityCache } from './cache';
import { isCommunityEnabled } from './featureFlag';
import {
  apiErrorSchema,
  createPresetInputSchema,
  deleteResponseSchema,
  deviceProfileSchema,
  deviceSessionSchema,
  presetListResponseSchema,
  presetQuerySchema,
  presetSchema,
  reportInputSchema,
  reportResponseSchema,
  updatePresetInputSchema,
  type CreatePresetInput,
  type DeviceProfile,
  type DeviceSession,
  type Preset,
  type PresetQueryInput,
  type PresetReportInput,
  type PresetReportResponse,
  type UpdatePresetInput,
} from './schema';

export const COMMUNITY_TOKEN_STORAGE_KEY = 'dead_air_community_token_v1';
export const COMMUNITY_PRESET_CACHE_PREFIX = 'dead_air_community_presets_v1';
export const COMMUNITY_DEFAULT_TIMEOUT_MS = 8000;

export type { CommunityCache } from './cache';

const cachedPresetListSchema = z.object({
  presets: z.array(presetSchema),
  nextCursor: z.string().nullable(),
  cachedAt: z.number(),
});

type CachedPresetList = z.infer<typeof cachedPresetListSchema>;

export type PresetListSource = 'network' | 'cache' | 'empty';

export interface PresetListResult {
  presets: Preset[];
  nextCursor: string | null;
  /** Where the data came from; `cache` means the network read failed. */
  source: PresetListSource;
  /** True when the returned data is older than the current request. */
  stale: boolean;
  cachedAt?: number;
  error?: string;
}

export class CommunityError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 0, details?: unknown) {
    super(message);
    this.name = 'CommunityError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface CommunityClientConfig {
  baseUrl: string;
  /**
   * Cache for the device token and offline preset fallback. Required so the app
   * chooses persistence deliberately; use `asyncStorageCommunityCache` in
   * production and `createMemoryCache()` in tests.
   */
  cache: CommunityCache;
  /** Defaults to the `EXPO_PUBLIC_COMMUNITY_ENABLED` build flag. */
  enabled?: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
}

function errorCode(error: unknown): string {
  return error instanceof CommunityError ? error.code : 'unknown_error';
}

function parseInput<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new CommunityError(
      'validation_failed',
      'Community input failed validation.',
      400,
      parsed.error.issues,
    );
  }
  return parsed.data;
}

/** Resolve the API base URL from the public build environment. */
export function resolveCommunityBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_COMMUNITY_API_URL;
  if (explicit && explicit.trim().length > 0) return explicit.trim().replace(/\/+$/, '');

  return '';
}

export class CommunityClient {
  private readonly baseUrl: string;
  private readonly enabled: boolean;
  private readonly fetchImpl: typeof fetch;
  private readonly cache: CommunityCache;
  private readonly timeoutMs: number;
  private readonly now: () => number;

  constructor(config: CommunityClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.enabled = config.enabled ?? isCommunityEnabled();
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.cache = config.cache;
    this.timeoutMs = config.timeoutMs ?? COMMUNITY_DEFAULT_TIMEOUT_MS;
    this.now = config.now ?? Date.now;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ---------------------------------------------------------------- devices

  /** Register this device and persist the returned bearer token. */
  async registerDevice(displayName?: string): Promise<DeviceSession> {
    const body = displayName ? { displayName } : {};
    const session = await this.request(
      '/auth/device',
      { method: 'POST', body: JSON.stringify(body) },
      deviceSessionSchema,
    );
    await this.cache.set(COMMUNITY_TOKEN_STORAGE_KEY, session.token);
    return session;
  }

  async getDeviceProfile(): Promise<DeviceProfile> {
    return this.request('/auth/device', { method: 'GET' }, deviceProfileSchema);
  }

  async hasDeviceToken(): Promise<boolean> {
    const token = await this.cache.get<string>(COMMUNITY_TOKEN_STORAGE_KEY);
    return typeof token === 'string' && token.length > 0;
  }

  async clearDeviceToken(): Promise<void> {
    await this.cache.remove(COMMUNITY_TOKEN_STORAGE_KEY);
  }

  // ---------------------------------------------------------------- presets

  /**
   * List or search public presets. On any network/validation failure the
   * cached list for the same query is returned with `source: 'cache'`, so the
   * UI can keep showing presets offline.
   */
  async listPresets(query: PresetQueryInput = {}): Promise<PresetListResult> {
    const parsed = parseInput(presetQuerySchema, query);
    return this.cachedList(parsed);
  }

  async getPreset(presetId: string): Promise<Preset> {
    return this.request(
      `/presets/${encodeURIComponent(presetId)}`,
      { method: 'GET' },
      presetSchema,
    );
  }

  async createPreset(input: CreatePresetInput): Promise<Preset> {
    const body = parseInput(createPresetInputSchema, input);
    return this.request('/presets', { method: 'POST', body: JSON.stringify(body) }, presetSchema);
  }

  async updatePreset(presetId: string, patch: UpdatePresetInput): Promise<Preset> {
    const body = parseInput(updatePresetInputSchema, patch);
    return this.request(
      `/presets/${encodeURIComponent(presetId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
      presetSchema,
    );
  }

  async deletePreset(presetId: string): Promise<boolean> {
    const result = await this.request(
      `/presets/${encodeURIComponent(presetId)}`,
      { method: 'DELETE' },
      deleteResponseSchema,
    );
    return result.deleted;
  }

  async reportPreset(presetId: string, input: PresetReportInput): Promise<PresetReportResponse> {
    const body = parseInput(reportInputSchema, input);
    return this.request(
      `/presets/${encodeURIComponent(presetId)}/report`,
      { method: 'POST', body: JSON.stringify(body) },
      reportResponseSchema,
    );
  }

  // --------------------------------------------------------------- internals

  private async cachedList(params: Record<string, unknown>): Promise<PresetListResult> {
    if (!this.enabled) {
      return {
        presets: [],
        nextCursor: null,
        source: 'empty',
        stale: false,
        error: 'community_disabled',
      };
    }

    const key = `${COMMUNITY_PRESET_CACHE_PREFIX}:${JSON.stringify(params)}`;

    try {
      const body = await this.request(
        `/presets${this.buildQueryString(params)}`,
        { method: 'GET' },
        presetListResponseSchema,
      );
      const entry: CachedPresetList = {
        presets: body.items,
        nextCursor: body.nextCursor,
        cachedAt: this.now(),
      };
      await this.cache.set(key, entry);
      return {
        presets: body.items,
        nextCursor: body.nextCursor,
        source: 'network',
        stale: false,
        cachedAt: entry.cachedAt,
      };
    } catch (error) {
      const cached = await this.readCache(key);
      const code = errorCode(error);
      if (cached) {
        return {
          presets: cached.presets,
          nextCursor: cached.nextCursor,
          source: 'cache',
          stale: true,
          cachedAt: cached.cachedAt,
          error: code,
        };
      }
      return { presets: [], nextCursor: null, source: 'empty', stale: false, error: code };
    }
  }

  private async readCache(key: string): Promise<CachedPresetList | null> {
    const raw = await this.cache.get<unknown>(key);
    if (!raw) return null;
    const parsed = cachedPresetListSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  private buildQueryString(params: Record<string, unknown>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      search.set(key, String(value));
    }
    const query = search.toString();
    return query.length > 0 ? `?${query}` : '';
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new CommunityError('community_disabled', 'Community features are disabled.', 0);
    }
    if (this.baseUrl.length === 0) {
      throw new CommunityError('missing_base_url', 'Community API base URL is not configured.', 0);
    }
  }

  private async request<S extends z.ZodTypeAny>(
    path: string,
    init: RequestInit,
    schema: S,
  ): Promise<z.output<S>> {
    this.assertEnabled();

    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body !== undefined) headers.set('Content-Type', 'application/json');

    const token = await this.cache.get<string>(COMMUNITY_TOKEN_STORAGE_KEY);
    if (typeof token === 'string' && token.length > 0) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch((error: unknown) => {
        if (controller.signal.aborted) throw error;
        return null;
      });

      if (!response.ok) {
        const parsedError = apiErrorSchema.safeParse(body);
        if (parsedError.success) {
          throw new CommunityError(
            parsedError.data.error.code,
            parsedError.data.error.message,
            response.status,
            parsedError.data.error.details,
          );
        }
        throw new CommunityError(
          'http_error',
          `Community request failed with status ${response.status}.`,
          response.status,
        );
      }

      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        throw new CommunityError(
          'invalid_response',
          'Community response failed validation.',
          response.status,
          parsed.error.issues,
        );
      }
      return parsed.data;
    } catch (error) {
      const timedOut = controller.signal.aborted;
      if (!timedOut && error instanceof CommunityError) throw error;
      throw new CommunityError(
        timedOut ? 'timeout' : 'network_error',
        timedOut ? 'Community request timed out.' : 'Community request failed.',
        0,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
