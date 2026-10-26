// tests/lib/community/client.test.ts
// DEA-95 Phase 1 — community client end-to-end (two devices share a preset)
// plus offline-safe fallback behavior.

import {
  CommunityClient,
  CommunityError,
  resolveCommunityBaseUrl,
  type CommunityCache,
} from '@/lib/community/client';
import { handleCommunityRequest } from '@/worker/community/index';
import { createMemoryStore } from '@/worker/community/memory_store';
import type { CommunityEnv } from '@/worker/community/types';

function createMemoryCache(): CommunityCache {
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

function toRequest(input: RequestInfo | URL, init?: RequestInit): Request {
  if (input instanceof Request) return input;
  return new Request(String(input), init);
}

function createFetch(env: CommunityEnv): typeof fetch {
  return async (input, init) => handleCommunityRequest(toRequest(input, init), env);
}

function createClient(
  fetchImpl: typeof fetch,
  overrides: Partial<ConstructorParameters<typeof CommunityClient>[0]> = {},
): CommunityClient {
  return new CommunityClient({
    baseUrl: 'https://api.deadair.test/community',
    enabled: true,
    fetchImpl,
    cache: createMemoryCache(),
    now: () => 1000,
    ...overrides,
  });
}

const PRESET_INPUT = {
  name: 'The Long Wave',
  description: 'A slow sweep across the lost band.',
  payload: { frequency: 99.5, band: 'LOST' as const, volume: 0.6 },
  tags: ['Night', 'calm'],
};

describe('community client — shared presets', () => {
  it('lets a second device discover and tune the preset the first device shared', async () => {
    const env: CommunityEnv = {
      COMMUNITY_ENABLED: 'on',
      COMMUNITY_STORE: createMemoryStore(),
    };
    const fetchImpl = createFetch(env);

    const ada = createClient(fetchImpl);
    const bo = createClient(fetchImpl);

    const adaSession = await ada.registerDevice('Ada');
    expect(adaSession.displayName).toBe('Ada');
    await expect(ada.hasDeviceToken()).resolves.toBe(true);

    const created = await ada.createPreset(PRESET_INPUT);
    expect(created.name).toBe('The Long Wave');
    expect(created.authorName).toBe('Ada');
    expect(created.payload.volume).toBe(0.6);
    expect(created.tags).toEqual(['night', 'calm']);

    await bo.registerDevice('Bo');

    const found = await bo.listPresets({ q: 'long' });
    expect(found.source).toBe('network');
    expect(found.stale).toBe(false);
    expect(found.presets).toHaveLength(1);
    expect(found.presets[0]?.id).toBe(created.id);

    const fetched = await bo.getPreset(created.id);
    expect(fetched.payload.frequency).toBe(99.5);

    const recent = await bo.listPresets();
    expect(recent.presets.map((preset) => preset.id)).toEqual([created.id]);

    const filtered = await bo.listPresets({ band: 'LIMINAL' });
    expect(filtered.presets).toHaveLength(0);
  });

  it('keeps owner-only mutations owner-only', async () => {
    const env: CommunityEnv = {
      COMMUNITY_ENABLED: 'on',
      COMMUNITY_STORE: createMemoryStore(),
    };
    const fetchImpl = createFetch(env);

    const ada = createClient(fetchImpl);
    const bo = createClient(fetchImpl);
    await ada.registerDevice('Ada');
    await bo.registerDevice('Bo');

    const created = await ada.createPreset(PRESET_INPUT);

    await expect(bo.updatePreset(created.id, { name: 'Hijacked' })).rejects.toMatchObject({
      code: 'forbidden',
      status: 403,
    });
    await expect(bo.deletePreset(created.id)).rejects.toBeInstanceOf(CommunityError);

    const updated = await ada.updatePreset(created.id, { name: 'Renamed Wave' });
    expect(updated.name).toBe('Renamed Wave');

    await expect(ada.deletePreset(created.id)).resolves.toBe(true);
  });

  it('rejects unauthenticated writes', async () => {
    const env: CommunityEnv = {
      COMMUNITY_ENABLED: 'on',
      COMMUNITY_STORE: createMemoryStore(),
    };
    const client = createClient(createFetch(env));

    await expect(client.createPreset(PRESET_INPUT)).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });
  });

  it('reports a preset once per device', async () => {
    const env: CommunityEnv = {
      COMMUNITY_ENABLED: 'on',
      COMMUNITY_STORE: createMemoryStore(),
    };
    const fetchImpl = createFetch(env);
    const ada = createClient(fetchImpl);
    const bo = createClient(fetchImpl);
    await ada.registerDevice('Ada');
    await bo.registerDevice('Bo');

    const created = await ada.createPreset(PRESET_INPUT);
    const first = await bo.reportPreset(created.id, { reason: 'spam' });
    expect(first).toEqual({ reportId: expect.any(String), alreadyReported: false, reportCount: 1 });

    const repeat = await bo.reportPreset(created.id, { reason: 'spam' });
    expect(repeat.reportId).toBe(first.reportId);
    expect(repeat.alreadyReported).toBe(true);
    expect(repeat.reportCount).toBe(1);
  });
});

describe('community client — offline-safe fallback', () => {
  it('serves the cached list when the network read fails', async () => {
    const env: CommunityEnv = {
      COMMUNITY_ENABLED: 'on',
      COMMUNITY_STORE: createMemoryStore(),
    };
    let online = true;
    const fetchImpl: typeof fetch = async (input, init) => {
      if (!online) throw new TypeError('Failed to fetch');
      return handleCommunityRequest(toRequest(input, init), env);
    };

    const client = createClient(fetchImpl);
    await client.registerDevice('Ada');
    await client.createPreset(PRESET_INPUT);

    const onlineResult = await client.listPresets();
    expect(onlineResult.source).toBe('network');

    online = false;

    const cached = await client.listPresets();
    expect(cached.source).toBe('cache');
    expect(cached.stale).toBe(true);
    expect(cached.error).toBe('network_error');
    expect(cached.presets.map((preset) => preset.name)).toEqual(['The Long Wave']);

    const differentQuery = await client.listPresets({ q: 'nothing-matches' });
    expect(differentQuery.source).toBe('empty');
    expect(differentQuery.presets).toHaveLength(0);
  });

  it('keeps cached pages isolated by every query field', async () => {
    const env: CommunityEnv = { COMMUNITY_ENABLED: 'on', COMMUNITY_STORE: createMemoryStore() };
    let online = true;
    const fetchImpl: typeof fetch = async (input, init) => {
      if (!online) throw new TypeError('Failed to fetch');
      return handleCommunityRequest(toRequest(input, init), env);
    };
    const client = createClient(fetchImpl);
    await client.registerDevice('Ada');
    await client.createPreset(PRESET_INPUT);
    await client.createPreset({ ...PRESET_INPUT, name: 'Second Wave' });
    const first = await client.listPresets({ limit: 1 });
    expect(first.nextCursor).not.toBeNull();
    online = false;
    await expect(client.listPresets({ limit: 1 })).resolves.toMatchObject({
      source: 'cache',
      nextCursor: first.nextCursor,
    });
    for (const query of [
      { limit: 2 },
      { band: 'LIMINAL' as const, limit: 1 },
      { limit: 1, cursor: first.nextCursor ?? undefined },
    ]) {
      await expect(client.listPresets(query)).resolves.toMatchObject({
        source: 'empty',
        presets: [],
        nextCursor: null,
      });
    }
    await expect(client.listPresets({ q: 'missing', limit: 1 })).resolves.toMatchObject({
      source: 'empty',
      presets: [],
      nextCursor: null,
    });
    await expect(client.getPreset(first.presets[0]?.id ?? '')).rejects.toMatchObject({
      code: 'network_error',
    });
  });

  it.each([200, 503])(
    'times out a stalled %i response body and returns the exact cached list',
    async (status) => {
      const env: CommunityEnv = { COMMUNITY_ENABLED: 'on', COMMUNITY_STORE: createMemoryStore() };
      let stalled = false;
      const fetchImpl: typeof fetch = async (input, init) => {
        if (!stalled) return handleCommunityRequest(toRequest(input, init), env);
        const response = new Response('{}', { status });
        jest.spyOn(response, 'json').mockImplementation(
          () =>
            new Promise<never>((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => reject(new Error('body aborted')));
            }),
        );
        return response;
      };
      const client = createClient(fetchImpl, { timeoutMs: 20 });
      await client.registerDevice('Ada');
      const preset = await client.createPreset(PRESET_INPUT);
      await client.listPresets();
      stalled = true;
      await expect(client.listPresets()).resolves.toMatchObject({
        source: 'cache',
        error: 'timeout',
        presets: [expect.objectContaining({ id: preset.id })],
      });
      await expect(client.getPreset(preset.id)).rejects.toMatchObject({ code: 'timeout' });
    },
  );

  it('returns an empty, non-throwing result when offline with no cache', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    const client = createClient(fetchImpl);

    const result = await client.listPresets();
    expect(result).toEqual({
      presets: [],
      nextCursor: null,
      source: 'empty',
      stale: false,
      error: 'network_error',
    });
  });

  it('falls back to cache when the server errors or returns an invalid body', async () => {
    const env: CommunityEnv = {
      COMMUNITY_ENABLED: 'on',
      COMMUNITY_STORE: createMemoryStore(),
    };
    let mode: 'ok' | 'error' | 'garbage' = 'ok';
    const fetchImpl: typeof fetch = async (input, init) => {
      if (mode === 'error') {
        return new Response(
          JSON.stringify({ error: { code: 'internal_error', message: 'boom' } }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (mode === 'garbage') {
        return new Response(JSON.stringify({ items: [{ id: 'only-an-id' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return handleCommunityRequest(toRequest(input, init), env);
    };

    const client = createClient(fetchImpl);
    await client.registerDevice('Ada');
    await client.createPreset(PRESET_INPUT);
    await client.listPresets();

    mode = 'error';
    const serverError = await client.listPresets();
    expect(serverError.source).toBe('cache');
    expect(serverError.error).toBe('internal_error');

    mode = 'garbage';
    const invalidBody = await client.listPresets();
    expect(invalidBody.source).toBe('cache');
    expect(invalidBody.error).toBe('invalid_response');
  });

  it('reports a timeout as an offline fallback instead of throwing', async () => {
    const hangingFetch: typeof fetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });

    const client = createClient(hangingFetch, { timeoutMs: 10 });
    const result = await client.listPresets();
    expect(result.source).toBe('empty');
    expect(result.error).toBe('timeout');
  });
});

describe('community client — local validation', () => {
  it('returns stable validation errors for every locally parsed input without fetching', async () => {
    const fetchImpl = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    const client = createClient(fetchImpl);
    const operations = [
      (): Promise<unknown> => client.createPreset({ ...PRESET_INPUT, name: 'ab' }),
      (): Promise<unknown> => client.updatePreset('preset-1', { name: 'ab' }),
      (): Promise<unknown> => client.createPreset({ ...PRESET_INPUT, tags: ['İ'.repeat(13)] }),
      (): Promise<unknown> => client.updatePreset('preset-1', { tags: ['İ'.repeat(13)] }),
      (): Promise<unknown> =>
        client.reportPreset('preset-1', { reason: 'spam', details: 'x'.repeat(501) }),
      (): Promise<unknown> => client.listPresets({ limit: 0 }),
    ];
    for (const operation of operations) {
      await expect(operation()).rejects.toMatchObject({
        name: 'CommunityError',
        code: 'validation_failed',
        status: 400,
        details: expect.any(Array),
      });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('community client — disabled flag', () => {
  it('never touches the network while the feature is off', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    const client = createClient(fetchImpl, { enabled: false });

    const result = await client.listPresets();
    expect(result).toEqual({
      presets: [],
      nextCursor: null,
      source: 'empty',
      stale: false,
      error: 'community_disabled',
    });
    expect(fetchImpl).not.toHaveBeenCalled();

    await expect(client.createPreset(PRESET_INPUT)).rejects.toMatchObject({
      code: 'community_disabled',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('defaults to off when no enabled override is passed and the build flag is unset', () => {
    const original = process.env.EXPO_PUBLIC_COMMUNITY_ENABLED;
    delete process.env.EXPO_PUBLIC_COMMUNITY_ENABLED;
    try {
      const client = new CommunityClient({
        baseUrl: 'https://api.deadair.test/community',
        cache: createMemoryCache(),
      });
      expect(client.isEnabled()).toBe(false);
    } finally {
      if (original === undefined) delete process.env.EXPO_PUBLIC_COMMUNITY_ENABLED;
      else process.env.EXPO_PUBLIC_COMMUNITY_ENABLED = original;
    }
  });
});

describe('resolveCommunityBaseUrl', () => {
  const originalCommunityUrl = process.env.EXPO_PUBLIC_COMMUNITY_API_URL;
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    if (originalCommunityUrl === undefined) delete process.env.EXPO_PUBLIC_COMMUNITY_API_URL;
    else process.env.EXPO_PUBLIC_COMMUNITY_API_URL = originalCommunityUrl;

    if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  });

  it('resolves and trims the dedicated community URL', () => {
    process.env.EXPO_PUBLIC_COMMUNITY_API_URL = ' https://community.deadair.test/ ';
    expect(resolveCommunityBaseUrl()).toBe('https://community.deadair.test');
  });

  it.each([undefined, '', '   '])('requires the community URL when it is %p', (communityUrl) => {
    delete process.env.EXPO_PUBLIC_COMMUNITY_API_URL;
    if (communityUrl !== undefined) process.env.EXPO_PUBLIC_COMMUNITY_API_URL = communityUrl;
    process.env.EXPO_PUBLIC_API_URL = 'https://api.deadair.test/';
    expect(resolveCommunityBaseUrl()).toBe('');
  });

  it('returns an empty string when neither variable is set', () => {
    delete process.env.EXPO_PUBLIC_COMMUNITY_API_URL;
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(resolveCommunityBaseUrl()).toBe('');
  });
});
